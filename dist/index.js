// Inspect — one key for a full-screen magnified view in Develop.
//
// Press the Inspect key (default I) in Develop: the panels are hidden, the
// window goes full screen and the photo zooms to 100% around the mouse. A
// small bar at the bottom switches between Fit, 100% and 200%, or steps in and
// out. Escape, the ✕ button or the
// key again brings everything back as it was.
//
// It drives Safelight's own actions (Hide / show all panels, Fullscreen, the
// Develop zoom shortcuts) through their current bindings, so it follows the
// person's own key choices and core's canvas does the drawing.

const EXT = "safelight-inspect";
const VERSION = "1.0.0";
const ACTION_ID = `${EXT}.toggle`;

export const ZOOM_STOPS = [
  { id: "fit", label: "Fit" },
  { id: "100", label: "100%" },
  { id: "200", label: "200%" },
];

// Core actions, in the order they run, to reach a zoom stop. Core zooms in
// steps of 1.25× around the mouse and stops at 200%, so four steps from 100%
// land exactly on 200%.
export function zoomPlan(stop) {
  switch (stop) {
    case "fit": return ["develop.zoomFit"];
    case "100": return ["develop.zoom100"];
    case "200": return ["develop.zoom100", "develop.zoomIn", "develop.zoomIn", "develop.zoomIn", "develop.zoomIn"];
    case "in": return ["develop.zoomIn"];
    case "out": return ["develop.zoomOut"];
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
  const { useSyncExternalStore } = React;
  const createPortal = api.reactDom?.createPortal;
  const useUIStore = api.stores?.useUIStore;
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent || "");

  // ── state ────────────────────────────────────────────────────────────────
  let state = { open: false, stop: "100" };
  const listeners = new Set();
  const setState = (patch) => { state = { ...state, ...patch }; for (const l of [...listeners]) l(); };
  const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
  const useInspect = () => useSyncExternalStore(subscribe, () => state);

  let panelsHidden = false;   // we hid the panels, so we show them again
  let enteredFullscreen = false;

  const inDevelop = () => (useUIStore?.getState?.().activeModule ?? "develop") === "develop";

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

  function zoomTo(stop) {
    for (const id of zoomPlan(stop)) fire(id);
    setState({ stop: stop === "in" || stop === "out" ? "" : stop });
  }

  function open() {
    if (state.open || !inDevelop()) return;
    panelsHidden = fire("panels.toggle");
    enteredFullscreen = false;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      enteredFullscreen = true;
      document.documentElement.requestFullscreen().catch(() => { enteredFullscreen = false; });
    }
    setState({ open: true });
    // Let the canvas take the new size before zooming in.
    setTimeout(() => zoomTo("100"), 120);
  }

  function close() {
    if (!state.open) return;
    setState({ open: false });
    fire("develop.zoomFit");
    if (panelsHidden) fire("panels.toggle");
    panelsHidden = false;
    if (enteredFullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    enteredFullscreen = false;
  }

  const toggle = () => (state.open ? close() : open());

  api.registerKeybinding({
    id: ACTION_ID,
    label: "Inspect (full-screen magnified view)",
    category: "Develop",
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

  // Leaving full screen yourself (the window's own Escape) or leaving Develop
  // ends Inspect too.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && state.open && enteredFullscreen) {
      enteredFullscreen = false;
      close();
    }
  });
  useUIStore?.subscribe?.((s, prev) => {
    if (state.open && prev && s.activeModule !== prev.activeModule && s.activeModule !== "develop") close();
  });

  // ── UI ───────────────────────────────────────────────────────────────────
  const barBtn = (active) => ({
    fontSize: 12, padding: "4px 10px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border, rgba(255,255,255,0.25))"}`,
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-on-accent, #fff)" : "var(--color-text, #F4F3EE)",
  });

  // The floating bar, in a portal so it stays clickable over the canvas.
  function InspectBar() {
    const s = useInspect();
    if (!s.open || !createPortal) return null;
    const bar = h("div", {
      role: "toolbar", "aria-label": "Inspect",
      style: {
        position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 2147483000,
        display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 999,
        background: "var(--color-surface-1, rgba(20,20,20,0.85))",
        border: "1px solid var(--color-border, rgba(255,255,255,0.15))",
        boxShadow: "0 4px 16px rgba(0,0,0,0.45)", pointerEvents: "auto",
      },
    },
      h("span", { style: { fontSize: 12, padding: "0 6px", color: "var(--color-text-muted, #B1ADA1)" } }, "Inspect"),
      ZOOM_STOPS.map((z) => h("button", {
        key: z.id, type: "button", style: barBtn(s.stop === z.id), "aria-pressed": s.stop === z.id,
        onClick: () => zoomTo(z.id),
      }, z.label)),
      h("button", { type: "button", title: "Zoom out", "aria-label": "Zoom out", style: barBtn(false), onClick: () => zoomTo("out") }, "−"),
      h("button", { type: "button", title: "Zoom in", "aria-label": "Zoom in", style: barBtn(false), onClick: () => zoomTo("in") }, "+"),
      h("button", {
        type: "button", title: "Close (Esc)", "aria-label": "Close Inspect", onClick: close,
        style: { ...barBtn(false), padding: "4px 9px" },
      }, "✕"));
    return createPortal(bar, document.body);
  }

  // A button in the Develop status bar, next to the zoom controls.
  function ToolbarButton() {
    const s = useInspect();
    const combo = api.keybindings?.getBinding?.(ACTION_ID) || "";
    return h("button", {
      type: "button", onClick: toggle, "aria-pressed": s.open,
      title: `Inspect: full-screen magnified view${combo ? ` (${combo})` : ""}`,
      style: { ...barBtn(s.open), fontSize: 11, padding: "2px 8px" },
    }, "Inspect");
  }

  api.registerSlot({ id: `${EXT}.bar`, slot: "develop-canvas-overlay", component: InspectBar });
  api.registerSlot({ id: `${EXT}.button`, slot: "develop-toolbar", component: ToolbarButton, order: 90 });

  console.log(`[${EXT}] v${VERSION} loaded`);
}

export function deactivate() {}
