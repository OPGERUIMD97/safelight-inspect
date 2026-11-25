# Inspect

One key for a full-screen magnified view in Safelight's Develop module. Made for checking sharpness, fine detail (feathers, fur, textures) and noise across the whole screen instead of through a small loupe.

## Install

In Safelight: **Extensions** → search for **Inspect** → install. Or download the zip from the latest release and install it from the Extensions panel.

Needs Safelight 3.2.6 or later.

## Use

1. Open a photo in **Develop**.
2. Put the mouse on the spot you want to check and press **I** (or click **Inspect** in the Develop status bar).
3. The panels are hidden, the window goes full screen and the photo zooms to **100%** around the mouse.
4. Drag to pan. The bar at the bottom switches between **Fit**, **100%** and **200%**, or steps out (**−**) and in (**+**).
5. **Escape**, the **✕** button or **I** again brings everything back as it was.

| Control | What it does |
|---|---|
| **I** | Open or close Inspect. Change the key in *Preferences ▸ Shortcuts* ("Inspect (full-screen magnified view)"). |
| Fit / 100% / 200% | Zoom stops. 100% is one image pixel per screen pixel. |
| − / + | Zoom out or in by one step. |
| ✕ / Escape | Close Inspect: zoom back to fit, panels and window as before. |

## Notes

- Inspect uses Safelight's own actions: *Hide / show all panels*, full screen and the Develop zoom shortcuts. It follows your own bindings for them. If one of those has no shortcut, that step is skipped (see the console).
- Safelight zooms up to 200%. Zooming centres on the last mouse position on the photo.
- Leaving Develop or leaving full screen yourself also closes Inspect.

## Changelog

### 1.0.0
- First release: one key for a full-screen 100% view, zoom bar with Fit / 100% / 200% and − / +, Escape to close.

## License

MIT, see [LICENSE](LICENSE).
