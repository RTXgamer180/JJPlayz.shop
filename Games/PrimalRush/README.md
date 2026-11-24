# Primal Rush — Multiplayer WebXR prototype

## Project files
- `index.html` — browser game, WebXR entry, desktop preview, in-world PC room terminal, virtual keyboard, avatars and pickups.
- `app.py` — Python Socket.IO room server.
- `requirements.txt` — Python dependencies.
- `render.yaml` — optional Render Blueprint config.

## 1) Deploy the multiplayer server on Render
1. Create a GitHub repository and upload these files.
2. In Render, create a **New Web Service** from that repository.
3. Use the settings from `render.yaml` (or Python runtime, build `pip install -r requirements.txt`, start `gunicorn --worker-class gthread --threads 100 --timeout 120 app:app`).
4. Wait for the service to deploy. Open its URL; it should show `{"game":"Primal Rush multiplayer server","status":"online"}`.

## 2) Publish the game page on GitHub Pages
GitHub Pages serves the `index.html` file directly. You can put it at the repository root or in a folder such as `Games/PrimalRush/` (then open `/Games/PrimalRush/`). Enable Pages in the repository's Settings → Pages and choose the branch/folder containing the file. The other files can stay in the repository; Pages will not execute the Python file.

Open the published page and paste your Render URL into **ROOM SERVER URL**.

## 3) Play together
- Player A: enter a name, optionally enter a room code, press **CREATE ROOM**.
- Player B: use the same server URL and room code, press **JOIN ROOM**.
- In desktop mode, walk near the computer in the starting area and press **E** to open the room terminal. The on-screen keys let you type a room code.
- Press **LEAVE ROOM** on the PC to leave.
- VR needs a headset browser with WebXR support and an HTTPS page.

## Important prototype notes
This is an early multiplayer prototype, not a finished commercial game. It syncs room membership and basic player positions/rotations. Avatars and pickups are simple generated meshes. The current hand-locomotion physics are experimental; the server does not run physics or anti-cheat. The virtual keyboard is a 2D overlay styled as an in-world PC terminal. On touchscreens, tap the buttons.


## GitHub Pages auto-launch workflow
The project includes `.github/workflows/launch.yml`. Put the project in a GitHub repository's `main` branch, then set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Every push to `main` and manual run from the Actions tab will publish the static website.

**Important:** this workflow publishes the website only. GitHub Actions runners are temporary and do not provide an always-on multiplayer server. The included `app.py` still needs a separate backend host.
