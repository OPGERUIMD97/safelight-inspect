// Inspect — one key for a full-screen magnified view in Develop.
//
// Press the Inspect key (default I) in Develop, or in the Library on a
// selected photo (it opens in Develop first): the panels are hidden, the
// window goes full screen and the photo zooms to 100% around the mouse. Scroll
// to zoom around the mouse from fit up to 800%; the bar at the bottom shows the
// zoom and has Fit, 100%, 200%, 400% and 800%. Escape, the ✕ button or the key
// again brings everything back as it was, back in the Library when you started
// there.
//
// Up to 200% Safelight's own canvas draws the view (its panels, fullscreen and
// zoom actions are driven through their current bindings). Past 200%, where
// Safelight stops, Inspect draws the view itself from patches of the live frame
// at the frame's own pixels (api.develop.captureRegion), enlarged without
// smoothing so single pixels stay sharp.

const EXT = "safelight-inspect";
const VERSION = "1.1.0";
const ACTION_ID = `${EXT}.toggle`;

export const ZOOM_STOPS = [
  { id: "fit", label: "Fit" },
  { id: "100", label: "100%" },
  { id: "200", label: "200%" },
  { id: "400", label: "400%" },
  { id: "800", label: "800%" },
];

// Past core's 200% Inspect zooms itself, up to 800%.
export const CORE_MAX = 2;
export const DEEP_MAX = 8;
export const TILE_MAX = 1024; // captureRegion's largest patch edge

export const clampDeep = (z) => Math.min(DEEP_MAX, Math.max(CORE_MAX, z));

// Zoom so the frame point under `anchorDev` (device px in the view) stays put:
// the new centre, in frame px.
export function anchoredCentre(frameAt, anchorDev, viewDev, zoom, zoomScale) {
  const s = zoom * zoomScale;
  return {
    x: frameAt.x - (anchorDev.x - viewDev.w / 2) / s,
    y: frameAt.y - (anchorDev.y - viewDev.h / 2) / s,
  };
}

// The patches that cover the view: centres 0..1 across the frame and sizes in
// frame px, each at most TILE_MAX.
export function tilePlan(centre, viewDev, zoom, zoomScale, frame) {
  const s = zoom * zoomScale;
  const vw = viewDev.w / s, vh = viewDev.h / s;
  let x0 = Math.max(0, centre.x - vw / 2), y0 = Math.max(0, centre.y - vh / 2);
  const x1 = Math.min(frame.w, centre.x + vw / 2), y1 = Math.min(frame.h, centre.y + vh / 2);
  if (x1 <= x0 || y1 <= y0) return [];
  const cols = Math.ceil((x1 - x0) / (TILE_MAX - 4)), rows = Math.ceil((y1 - y0) / (TILE_MAX - 4));
  const tw = (x1 - x0) / cols, th = (y1 - y0) / rows;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: (x0 + (c + 0.5) * tw) / frame.w,
        y: (y0 + (r + 0.5) * th) / frame.h,
        width: Math.min(TILE_MAX, Math.ceil(tw) + 2),
        height: Math.min(TILE_MAX, Math.ceil(th) + 2),
      });
    }
  }
  return out;
}

// Core actions, in the order they run, to reach a zoom stop. Core zooms in
// steps of 1.25× around the mouse and stops at 200%, so four steps from 100%
// land exactly on 200%.
export function zoomPlan(stop) {
  switch (stop) {
    case "fit": return ["develop.zoomFit"];
    case "100": return ["develop.zoom100"];
    case "200": return ["develop.zoom100", "develop.zoomIn", "develop.zoomIn", "develop.zoomIn", "develop.zoomIn"];
    default: return [];
  }
}

const CODE_FOR = {
  "=": "Equal", "+": "Equal", "-": "Minus", "0": "Digit0", "[": "BracketLeft", "]": "BracketRight",
  ",": "Comma", ".": "Period", "/": "Slash", ";": "Semicolon", "'": "Quote", "`": "Backquote",
  "\\": "Backslash", Tab: "Tab", Space: "Space", Enter: "Enter", Escape: "Escape",
};

// A Safelight combo ("Ctrl+Shift+1", "Tab", "F") as KeyboardEvent fields.
// "Ctrl" means Control, or Command on a Mac, as core reads it.
export function keyEventInit(combo, isMac = false) {
  if (!combo || typeof combo !== "string") return null;
  const parts = combo === "+" ? ["+"] : combo.split("+").map((p) => p.trim()).filter(Boolean);
  if (combo.endsWith("++")) parts.push("+");
  let ctrl = false, shift = false, alt = false, key = "";
  for (const p of parts) {
    if (p === "Ctrl") ctrl = true;
    else if (p === "Shift") shift = true;
    else if (p === "Alt") alt = true;
    else key = p;
  }
  if (!key || key === "Wheel") return null;
  let code = CODE_FOR[key];
  if (!code && /^[A-Za-z]$/.test(key)) code = `Key${key.toUpperCase()}`;
  if (!code && /^[0-9]$/.test(key)) code = `Digit${key}`;
  if (!code) code = key;
  const evKey = key === "Space" ? " " : /^[A-Z]$/.test(key) && !shift ? key.toLowerCase() : key;
  return {
    key: evKey, code,
    ctrlKey: ctrl && !isMac, metaKey: ctrl && isMac, shiftKey: shift, altKey: alt,
  };
}

export function activate(api) {
  const React = api.react;
  const h = React.createElement;
  const { useSyncExternalStore, useEffect, useRef } = React;
  const createPortal = api.reactDom?.createPortal;
  const useUIStore = api.stores?.useUIStore;
  const useCatalogStore = api.stores?.useCatalogStore;
  const useDevelopStore = api.stores?.useDevelopStore;
  const useOverlay = api.develop?.useDevelopOverlay;
  const captureRegion = () => api.develop?.captureRegion;
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent || "");
  const dpr = () => window.devicePixelRatio || 1;

  // ── state ────────────────────────────────────────────────────────────────
  // open: Inspect is on. deep: Inspect draws the view itself (past 200%).
  // pct: the zoom shown in the bar.
  let state = { open: false, deep: false, pct: null };
  const listeners = new Set();
  const setState = (patch) => {
    let changed = false;
    for (const k in patch) if (state[k] !== patch[k]) changed = true;
    if (!changed) return;
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };
  const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
  const useInspect = () => useSyncExternalStore(subscribe, () => state);

  let panelsHidden = false;   // we hid the panels, so we show them again
  let enteredFullscreen = false;
  let returnToLibrary = false; // started in the Library: go back there on close

  const moduleNow = () => useUIStore?.getState?.().activeModule ?? "develop";
  const inDevelop = () => moduleNow() === "develop";

  // Run a core action through its current binding.
  function fire(actionId) {
    const combo = api.keybindings?.getBinding?.(actionId);
    const init = keyEventInit(combo, isMac);
    if (!init) {
      console.warn(`[${EXT}] "${actionId}" has no shortcut; skipped.`);
      return false;
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }));
    return true;
  }

  // ── the view: geometry shared by core mode and deep mode ─────────────────
  // Filled by the overlay layer each render: where the image sits (layout px of
  // the canvas), the zoom scale, and the layer element for client → layout.
  const view = { root: null, imageRect: null, rect: null, zoomScale: 1, frame: null };
  let lastPhotoPoint = null; // last client point over the photo (not the bar)

  const uiZoom = () => {
    const el = view.root;
    if (!el) return 1;
    const w = el.getBoundingClientRect().width;
    return w > 0 && el.offsetWidth > 0 ? w / el.offsetWidth : 1;
  };
  // Client point → layout point of the layer, and device px in it.
  const toLayout = (cx, cy) => {
    const r = view.root.getBoundingClientRect();
    const z = uiZoom();
    return { x: (cx - r.left) / z, y: (cy - r.top) / z };
  };
  const viewDev = () => {
    const el = view.root;
    const k = uiZoom() * dpr();
    return { w: Math.max(1, Math.round(el.offsetWidth * k)), h: Math.max(1, Math.round(el.offsetHeight * k)) };
  };

  // The frame's size in its own pixels, asked once per photo / crop.
  let probing = false;
  async function probeFrame() {
    const cap = captureRegion();
    if (!cap || probing) return view.frame;
    probing = true;
    try {
      const p = await cap({ x: 0.5, y: 0.5, width: 2, height: 2 });
      if (p) {
        view.frame = { w: p.frameWidth, h: p.frameHeight };
        p.bitmap?.close?.();
      }
    } catch (e) {} finally { probing = false; }
    return view.frame;
  }

  // Core mode's zoom, as Safelight counts it: device px a frame px spans.
  function corePct() {
    const ir = view.imageRect, f = view.frame;
    if (!ir || !f || !f.w) return null;
    return (ir.w * uiZoom() * dpr()) / (f.w * (view.zoomScale || 1)) * 100;
  }

  // Core mode: the frame point under a client point.
  function coreFrameAt(cx, cy) {
    const ir = view.imageRect, f = view.frame;
    if (!ir || !f || !view.root) return null;
    const l = toLayout(cx, cy);
    return { x: (l.x - ir.x) / ir.w * f.w, y: (l.y - ir.y) / ir.h * f.h };
  }

  // ── deep mode (past 200%) ────────────────────────────────────────────────
  const deep = { zoom: 2.5, centre: { x: 0, y: 0 } };
  let tiles = [];        // { bitmap, rect, gen, space }
  let gen = 0, fetchTimer = 0, drawFrame = 0, editEpoch = 0;
  let canvasEl = null, ctx = null, ctxSpace = "";

  function deepFrameAt(cx, cy) {
    const l = toLayout(cx, cy);
    const k = uiZoom() * dpr();
    const d = { x: l.x * k, y: l.y * k };
    const v = viewDev();
    const s = deep.zoom * (view.zoomScale || 1);
    return { frame: { x: deep.centre.x + (d.x - v.w / 2) / s, y: deep.centre.y + (d.y - v.h / 2) / s }, dev: d };
  }
  const devAt = (cx, cy) => { const l = toLayout(cx, cy); const k = uiZoom() * dpr(); return { x: l.x * k, y: l.y * k }; };

  function enterDeep(zoom, client) {
    if (!view.frame || !view.root || !captureRegion()) return;
    const v = viewDev();
    let at = client && coreFrameAt(client.x, client.y);
    let dev = client && devAt(client.x, client.y);
    if (!at) {
      const r = view.rect || view.imageRect;
      const cx = r ? r.x + r.w / 2 : view.root.offsetWidth / 2, cy = r ? r.y + r.h / 2 : view.root.offsetHeight / 2;
      const ir = view.imageRect;
      at = ir ? { x: (cx - ir.x) / ir.w * view.frame.w, y: (cy - ir.y) / ir.h * view.frame.h } : { x: view.frame.w / 2, y: view.frame.h / 2 };
      dev = { x: v.w / 2, y: v.h / 2 };
    }
    deep.zoom = clampDeep(zoom);
    deep.centre = anchoredCentre(at, dev, v, deep.zoom, view.zoomScale || 1);
    setState({ deep: true, pct: deep.zoom * 100 });
    redraw(true);
  }

  function zoomDeep(zoom, client) {
    const v = viewDev();
    const a = client ? deepFrameAt(client.x, client.y) : { frame: { ...deep.centre }, dev: { x: v.w / 2, y: v.h / 2 } };
    deep.zoom = clampDeep(zoom);
    deep.centre = anchoredCentre(a.frame, a.dev, v, deep.zoom, view.zoomScale || 1);
    setState({ pct: deep.zoom * 100 });
    redraw(true);
  }

  function leaveDeep() {
    setState({ deep: false, pct: corePct() });
    for (const t of tiles) t.bitmap?.close?.();
    tiles = [];
    gen++;
  }

  function ensureCanvas(space) {
    const host = view.root?.querySelector?.("[data-inspect-deep]");
    if (!host) return null;
    const v = viewDev();
    if (!canvasEl || canvasEl.parentNode !== host || (space && space !== ctxSpace)) {
      canvasEl?.remove();
      canvasEl = document.createElement("canvas");
      canvasEl.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
      host.appendChild(canvasEl);
      ctxSpace = space || ctxSpace || "srgb";
      try { ctx = canvasEl.getContext("2d", { colorSpace: ctxSpace }); } catch (e) { ctx = canvasEl.getContext("2d"); }
    }
    if (canvasEl.width !== v.w || canvasEl.height !== v.h) { canvasEl.width = v.w; canvasEl.height = v.h; }
    return ctx;
  }

  function paint() {
    drawFrame = 0;
    if (!state.deep) return;
    const c = ensureCanvas(tiles.length ? tiles[tiles.length - 1].space : "");
    if (!c) return;
    const v = viewDev();
    const s = deep.zoom * (view.zoomScale || 1);
    const x0 = deep.centre.x - v.w / 2 / s, y0 = deep.centre.y - v.h / 2 / s;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#000";
    c.fillRect(0, 0, v.w, v.h);
    for (const t of tiles) {
      c.drawImage(t.bitmap, (t.rect.x - x0) * s, (t.rect.y - y0) * s, t.rect.width * s, t.rect.height * s);
    }
  }

  function redraw(refetch) {
    if (!drawFrame) drawFrame = requestAnimationFrame(paint);
    if (refetch) {
      clearTimeout(fetchTimer);
      fetchTimer = setTimeout(fetchTiles, 70);
    }
  }

  async function fetchTiles() {
    const cap = captureRegion();
    if (!state.deep || !cap || !view.frame || !view.root) return;
    const my = ++gen;
    const plan = tilePlan(deep.centre, viewDev(), deep.zoom, view.zoomScale || 1, view.frame);
    const fresh = [];
    for (const req of plan) {
      let p = null;
      try { p = await cap(req); } catch (e) { console.warn(`[${EXT}] patch failed:`, e); }
      if (my !== gen || !state.deep) { p?.bitmap?.close?.(); for (const t of fresh) t.bitmap.close?.(); return; }
      if (p) {
        if (p.frameWidth && (p.frameWidth !== view.frame.w || p.frameHeight !== view.frame.h)) view.frame = { w: p.frameWidth, h: p.frameHeight };
        const t = { bitmap: p.bitmap, rect: p.rect, gen: my, space: p.colorSpace };
        fresh.push(t);
        tiles.push(t);
        redraw(false);
      }
    }
    // The new set covers the view: drop the older patches.
    const keep = [];
    for (const t of tiles) { if (t.gen === my) keep.push(t); else t.bitmap?.close?.(); }
    tiles = keep;
    redraw(false);
  }

  // ── wheel and drag while Inspect is on ───────────────────────────────────
  // The wheel zooms around the mouse: Safelight's canvas up to 200%, then
  // Inspect's own view up to 800%, and back.
  const isZoomWheel = (e) => {
    if (e.ctrlKey || e.metaKey) return true;
    const b = api.keybindings?.getBinding?.("viewport.wheelZoom") || "Wheel";
    const parts = [];
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    parts.push("Wheel");
    return parts.join("+") === b;
  };
  const overBar = (e) => e.target instanceof Element && !!e.target.closest("[data-inspect-bar]");
  const overPhotoArea = (e) => {
    if (!view.root) return false;
    const r = view.root.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  function onWheel(e) {
    if (!state.open || overBar(e) || !overPhotoArea(e) || !isZoomWheel(e)) return;
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= 120;
    const factor = Math.pow(1.25, -d / 100);
    const client = { x: e.clientX, y: e.clientY };
    if (state.deep) {
      e.preventDefault(); e.stopPropagation();
      const next = deep.zoom * factor;
      if (next < CORE_MAX - 1e-3) { leaveDeep(); return; }
      zoomDeep(next, client);
      return;
    }
    const pct = corePct();
    if (d < 0 && pct != null && pct >= CORE_MAX * 100 - 3 && captureRegion()) {
      e.preventDefault(); e.stopPropagation();
      enterDeep(CORE_MAX * factor, client);
    }
  }

  let drag = null;
  function onPointerDown(e) {
    if (!state.deep || e.button !== 0) return;
    if (!(e.target instanceof Element) || !e.target.closest("[data-inspect-deep]")) return;
    e.preventDefault(); e.stopPropagation();
    drag = { x: e.clientX, y: e.clientY };
    e.target.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (overPhotoArea(e) && !overBar(e)) lastPhotoPoint = { x: e.clientX, y: e.clientY };
    if (!drag || !state.deep) return;
    const k = uiZoom() * dpr() / (deep.zoom * (view.zoomScale || 1));
    deep.centre = { x: deep.centre.x - (e.clientX - drag.x) * k, y: deep.centre.y - (e.clientY - drag.y) * k };
    drag = { x: e.clientX, y: e.clientY };
    redraw(true);
  }
  function onPointerUp() { drag = null; }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  window.addEventListener("pointerup", onPointerUp, true);

  // Core's keyboard zoom anchors at the last mouse point; a click on the bar
  // would move it there, so put it back on the photo first.
  function anchorCoreAtMouse() {
    const p = lastPhotoPoint;
    if (!p) return;
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: p.x, clientY: p.y, bubbles: true }));
  }

  function zoomTo(stop) {
    if (stop === "400" || stop === "800") {
      const z = stop === "400" ? 4 : 8;
      if (state.deep) zoomDeep(z, lastPhotoPoint);
      else enterDeep(z, lastPhotoPoint);
      return;
    }
    if (state.deep) leaveDeep();
    anchorCoreAtMouse();
    for (const id of zoomPlan(stop)) fire(id);
  }

  function stepZoom(dir) {
    const factor = dir > 0 ? 1.25 : 0.8;
    if (state.deep) {
      const next = deep.zoom * factor;
      if (next < CORE_MAX - 1e-3) leaveDeep();
      else zoomDeep(next, lastPhotoPoint);
      return;
    }
    const pct = corePct();
    if (dir > 0 && pct != null && pct >= CORE_MAX * 100 - 3) { enterDeep(CORE_MAX * factor, lastPhotoPoint); return; }
    anchorCoreAtMouse();
    fire(dir > 0 ? "develop.zoomIn" : "develop.zoomOut");
  }

  // ── open / close ─────────────────────────────────────────────────────────
  function open() {
    if (state.open || !inDevelop()) return;
    panelsHidden = fire("panels.toggle");
    enteredFullscreen = false;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      enteredFullscreen = true;
      document.documentElement.requestFullscreen().catch(() => { enteredFullscreen = false; });
    }
    setState({ open: true, deep: false });
    void probeFrame();
    // Let the canvas take the new size before zooming in, around the mouse.
    setTimeout(() => zoomTo("100"), 120);
  }

  function close() {
    if (!state.open) return;
    if (state.deep) leaveDeep();
    setState({ open: false });
    fire("develop.zoomFit");
    if (panelsHidden) fire("panels.toggle");
    panelsHidden = false;
    if (enteredFullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    enteredFullscreen = false;
    if (returnToLibrary) {
      returnToLibrary = false;
      useUIStore?.getState?.().setActiveModule?.("library");
    }
  }

  // Library: the photo to inspect is the active one when it's selected, else the
  // first selected one, else the active one.
  function libraryTarget() {
    const cat = useCatalogStore?.getState?.();
    if (!cat) return null;
    const sel = cat.selectedIds instanceof Set ? cat.selectedIds : new Set(cat.selectedIds || []);
    if (cat.activePhotoId && (sel.size === 0 || sel.has(cat.activePhotoId))) return cat.activePhotoId;
    return sel.size ? [...sel][0] : null;
  }

  // From the Library: open the photo in Develop, wait until its edit is held and
  // the canvas is up, then inspect.
  function openFromLibrary() {
    const id = libraryTarget();
    if (!id) return;
    const cat = useCatalogStore.getState();
    if (cat.activePhotoId !== id) cat.setActivePhoto?.(id);
    useUIStore.getState().setActiveModule?.("develop");
    const started = Date.now();
    const tick = () => {
      const ready = inDevelop()
        && (!useDevelopStore || useDevelopStore.getState?.().photoId === id)
        && document.querySelector("[data-canvas-surround]");
      if (ready) {
        open();
        returnToLibrary = state.open;
      } else if (Date.now() - started < 4000) {
        setTimeout(tick, 60);
      }
    };
    setTimeout(tick, 60);
  }

  function toggle() {
    if (state.open) return close();
    const m = moduleNow();
    if (m === "develop") open();
    else if (m === "library") openFromLibrary();
  }

  api.registerKeybinding({
    id: ACTION_ID,
    label: "Inspect (full-screen magnified view)",
    category: "General",
    defaultCombo: "I",
    handler: toggle,
  });

  // Escape closes. Core's own Escape handling runs first and leaves this alone
  // when it has nothing to close.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open && e.isTrusted) {
      e.preventDefault();
      close();
    }
  }, true);

  // Leaving full screen yourself or leaving Develop ends Inspect too.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && state.open && enteredFullscreen) {
      enteredFullscreen = false;
      close();
    }
  });
  useUIStore?.subscribe?.((s, prev) => {
    if (state.open && prev && s.activeModule !== prev.activeModule && s.activeModule !== "develop") close();
  });
  // An edit, another photo or a new crop: the deep view asks again.
  useDevelopStore?.subscribe?.((s, prev) => {
    if (!state.open || !prev) return;
    if (s.photoId !== prev.photoId) { view.frame = null; if (state.deep) leaveDeep(); void probeFrame(); return; }
    if (s.params !== prev.params || s.paramBag !== prev.paramBag || s.sourceSize !== prev.sourceSize) {
      editEpoch++;
      if (state.deep) redraw(true);
    }
  });

  // ── UI ───────────────────────────────────────────────────────────────────
  const barBtn = (active) => ({
    fontSize: 12, padding: "4px 10px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border, rgba(255,255,255,0.25))"}`,
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-on-accent, #fff)" : "var(--color-text, #F4F3EE)",
  });

  // Over the canvas: reads the view's geometry, and holds the deep view.
  function InspectLayer() {
    const s = useInspect();
    const ov = useOverlay ? useOverlay() : {};
    const root = useRef(null);
    view.root = root.current || view.root;
    view.imageRect = ov.imageRect || null;
    view.rect = ov.rect || null;
    view.zoomScale = ov.zoomScale || 1;
    const regionKey = ov.region ? `${ov.region.x} ${ov.region.y} ${ov.region.width} ${ov.region.height}` : "";
    useEffect(() => { view.root = root.current; return () => { if (view.root === root.current) view.root = null; }; }, []);
    useEffect(() => { if (s.open) { view.frame = null; void probeFrame().then(() => { if (!state.deep) setState({ pct: corePct() }); }); } }, [s.open, regionKey]);
    useEffect(() => { if (s.open && !s.deep) setState({ pct: corePct() }); });
    useEffect(() => { if (s.deep) redraw(true); }, [s.deep]);
    return h("div", { ref: root, "data-inspect-layer": "", style: { position: "absolute", inset: 0, pointerEvents: "none" } },
      s.open && s.deep
        ? h("div", { "data-inspect-deep": "", style: { position: "absolute", inset: 0, background: "#000", pointerEvents: "auto", cursor: "grab" } })
        : null,
      s.open ? h(InspectBar, null) : null);
  }

  // The floating bar, in a portal so it stays clickable over everything.
  function InspectBar() {
    const s = useInspect();
    if (!createPortal) return null;
    const pct = s.pct == null ? "—" : `${Math.round(s.pct)}%`;
    const near = (v) => s.pct != null && Math.abs(s.pct - v) < 1.5;
    const activeOf = (id) => (id === "fit" ? false : near(Number(id)));
    const bar = h("div", {
      role: "toolbar", "aria-label": "Inspect", "data-inspect-bar": "",
      style: {
        position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 2147483000,
        display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 999,
        background: "var(--color-surface-1, rgba(20,20,20,0.85))",
        border: "1px solid var(--color-border, rgba(255,255,255,0.15))",
        boxShadow: "0 4px 16px rgba(0,0,0,0.45)", pointerEvents: "auto",
      },
    },
      h("span", { style: { fontSize: 12, padding: "0 4px 0 6px", color: "var(--color-text-muted, #B1ADA1)" } }, "Inspect"),
      h("span", {
        "aria-live": "polite", title: "Zoom",
        style: { fontSize: 12, minWidth: 48, textAlign: "center", fontVariantNumeric: "tabular-nums",
                 color: "var(--color-text, #F4F3EE)", fontWeight: 600 },
      }, pct),
      h("button", { type: "button", title: "Zoom out", "aria-label": "Zoom out", style: barBtn(false), onClick: () => stepZoom(-1) }, "−"),
      h("button", { type: "button", title: "Zoom in", "aria-label": "Zoom in", style: barBtn(false), onClick: () => stepZoom(1) }, "+"),
      ZOOM_STOPS.map((z) => h("button", {
        key: z.id, type: "button", style: barBtn(activeOf(z.id)), "aria-pressed": activeOf(z.id),
        onClick: () => zoomTo(z.id),
      }, z.label)),
      h("button", {
        type: "button", title: "Close (Esc)", "aria-label": "Close Inspect", onClick: close,
        style: { ...barBtn(false), padding: "4px 9px" },
      }, "✕"));
    return createPortal(bar, document.body);
  }

  // A button in the Develop status bar and the Library toolbar.
  function ToolbarButton() {
    const s = useInspect();
    const inLibrary = useUIStore ? useUIStore((st) => st.activeModule === "library") : false;
    const combo = api.keybindings?.getBinding?.(ACTION_ID) || "";
    return h("button", {
      type: "button", onClick: toggle, "aria-pressed": s.open,
      className: inLibrary ? "sl-library-toolbar-action" : undefined,
      title: `Inspect: full-screen magnified view${inLibrary ? " of the selected photo" : ""}${combo ? ` (${combo})` : ""}`,
      style: inLibrary ? undefined : { ...barBtn(s.open), fontSize: 11, padding: "2px 8px" },
    }, "Inspect");
  }

  api.registerSlot({ id: `${EXT}.layer`, slot: "develop-canvas-overlay", component: InspectLayer });
  api.registerSlot({ id: `${EXT}.button`, slot: "develop-toolbar", component: ToolbarButton, order: 90 });
  api.registerSlot({ id: `${EXT}.library-button`, slot: "library-toolbar", component: ToolbarButton, order: 90 });

  console.log(`[${EXT}] v${VERSION} loaded`);
}

export function deactivate() {}
