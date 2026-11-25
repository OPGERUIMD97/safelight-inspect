# Inspect

One key for a full-screen magnified view in Safelight, from Develop or from a selected photo in the Library. Made for checking sharpness, fine detail (feathers, fur, textures) and noise across the whole screen instead of through a small loupe.

## Install

In Safelight: **Extensions** → search for **Inspect** → install. Or download the zip from the latest release and install it from the Extensions panel.

Needs Safelight 3.2.6 or later.

## Use

1. Open a photo in **Develop**, or select a photo in the **Library**.
2. Press **I** (or click **Inspect** in the Develop status bar or the Library toolbar). In Develop, put the mouse on the spot you want to check first. From the Library the photo opens in Develop first.
3. The panels are hidden, the window goes full screen and the photo zooms to **100%** around the mouse.
4. **Scroll to zoom around the mouse**, from fit up to **800%**. The bar at the bottom shows the current zoom and has **Fit**, **100%**, **200%**, **400%** and **800%**, and steps out (**−**) and in (**+**). The buttons zoom around the last mouse point on the photo. Drag to pan.
5. **Escape**, the **✕** button or **I** again brings everything back as it was, back in the Library when you started there.

| Control | What it does |
|---|---|
| **I** | Open or close Inspect, in Develop or on the selected photo in the Library (the active photo when it's selected, else the first selected one). Change the key in *Preferences ▸ Shortcuts* ("Inspect (full-screen magnified view)"). |
| Scroll | Zoom in or out around the mouse, up to 800%. |
| Zoom readout | The current zoom, live while you scroll. |
| Fit / 100% / 200% / 400% / 800% | Zoom stops. 100% is one image pixel per screen pixel. |
| − / + | Zoom out or in by one step (1.25×). |
| ✕ / Escape | Close Inspect: zoom back to fit, panels and window as before. |

## Try it locally

With the **Developer Tools** extension: unzip the release into your dev folder (one subfolder `safelight-inspect` with `safelight.json` and `dist/`), then reload the extensions. Remove it from the dev folder again once you install the store version, because a dev folder copy takes precedence.

## Notes

- Inspect uses Safelight's own actions: *Hide / show all panels*, full screen and the Develop zoom shortcuts. It follows your own bindings for them. If one of those has no shortcut, that step is skipped (see the console).
- Up to 200% Safelight's own canvas draws the view. Past 200%, where Safelight stops, Inspect draws the view itself from the live frame at its own pixels, enlarged without smoothing so single pixels stay crisp. It shows your edit as the canvas does. Scrolling back below 200% hands the view back to Safelight.
- The deep view (past 200%) needs Safelight 3.2.7 or later; on 3.2.6 Inspect stops at 200%.
- Leaving Develop or leaving full screen yourself also closes Inspect.

## Changelog

### 1.1.0
- Zoom up to **800%**, scrolling around the mouse. Past Safelight's 200% Inspect draws the view itself, pixel-sharp.
- Zoom readout in the bar, live while scrolling; stops for 400% and 800%; the buttons zoom around the last mouse point on the photo.
- Works from the Library: **I** on a selected photo opens it in Develop and inspects it; closing brings you back to the Library.
- **Inspect** button in the Library toolbar.

### 1.0.0
- First release: one key for a full-screen 100% view, zoom bar with Fit / 100% / 200% and − / +, Escape to close.

## License

MIT, see [LICENSE](LICENSE).
