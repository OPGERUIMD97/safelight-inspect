# Inspect

One key for a full-screen magnified view in Safelight, from Develop or from a selected photo in the Library. Made for checking sharpness, fine detail (feathers, fur, textures) and noise across the whole screen instead of through a small loupe.

## Install

In Safelight: **Extensions** → search for **Inspect** → install. Or download the zip from the latest release and install it from the Extensions panel.

Needs Safelight 3.2.6 or later.

## Use

1. Open a photo in **Develop**, or select a photo in the **Library**.
2. Press **I** (or click **Inspect** in the Develop status bar or the Library toolbar). In Develop, put the mouse on the spot you want to check first. From the Library the photo opens in Develop first.
3. The panels are hidden, the window goes full screen and the photo zooms to **100%** around the mouse.
4. Drag to pan. The bar at the bottom switches between **Fit**, **100%** and **200%**, or steps out (**−**) and in (**+**).
5. **Escape**, the **✕** button or **I** again brings everything back as it was, back in the Library when you started there.

| Control | What it does |
|---|---|
| **I** | Open or close Inspect, in Develop or on the selected photo in the Library (the active photo when it's selected, else the first selected one). Change the key in *Preferences ▸ Shortcuts* ("Inspect (full-screen magnified view)"). |
| Fit / 100% / 200% | Zoom stops. 100% is one image pixel per screen pixel. |
| − / + | Zoom out or in by one step. |
| ✕ / Escape | Close Inspect: zoom back to fit, panels and window as before. |

## Try it locally

With the **Developer Tools** extension: unzip the release into your dev folder (one subfolder `safelight-inspect` with `safelight.json` and `dist/`), then reload the extensions. Remove it from the dev folder again once you install the store version, because a dev folder copy takes precedence.

## Notes

- Inspect uses Safelight's own actions: *Hide / show all panels*, full screen and the Develop zoom shortcuts. It follows your own bindings for them. If one of those has no shortcut, that step is skipped (see the console).
- Safelight zooms up to 200%. Zooming centres on the last mouse position on the photo.
- Leaving Develop or leaving full screen yourself also closes Inspect.

## Changelog

### 1.1.0
- Works from the Library: **I** on a selected photo opens it in Develop and inspects it; closing brings you back to the Library.
- **Inspect** button in the Library toolbar.

### 1.0.0
- First release: one key for a full-screen 100% view, zoom bar with Fit / 100% / 200% and − / +, Escape to close.

## License

MIT, see [LICENSE](LICENSE).
