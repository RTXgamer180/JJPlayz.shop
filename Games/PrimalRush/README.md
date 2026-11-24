# Primal Rush — Single-player WebXR

A browser-based hand-locomotion prototype.

## Publish on GitHub Pages (without GitHub Actions)
1. Upload `index.html` to your repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your branch (usually `main`) and folder (`/(root)` if `index.html` is at the repository root).
5. Save and wait for GitHub Pages to publish.

If you put the file in a subfolder, make sure the selected Pages folder contains the `index.html` file.

## Controls
- Desktop: WASD + mouse.
- VR: open the page in a WebXR-compatible headset browser over HTTPS and press **Enter VR**.
- Only the hands collide with the environment; hand locomotion is experimental.

This build is single-player. Multiplayer, room creation/joining, networking, and the Python server are not included.
