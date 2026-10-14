# Controller Name in Navbar — Setup for Pi Owner

## What changed
The navbar used to show the **active threshold profile name** (e.g. "Warm Climate / Summer") as the device name.
It now shows the **controller name** sent by the backend.


- `backend/src/config/settings.py`: New setting `controller_name` (reads `CONTROLLER_NAME` from `.env`, defaults to the Pi's hostname) |
-  `backend/src/api/routes/health.py`: `/api/status` now returns `"controller_name"` 
-  `frontend/src/utils/transformers.js`: Navbar name reads `controller_name` instead of `active_configuration`

## Why the navbar currently shows "Smart Hydroponic System"
That is the frontend fallback. The Pi behind `expedition-23.ngrok.app` is still running the old backend,
so `/api/status` has no `controller_name` field yet.

## What to do on the Pi
1. Pull the latest code:
   ```bash
   git pull
   ```
2. Add this line to `backend/.env` (optional; without it the Pi's hostname is shown):
   ```
   CONTROLLER_NAME=Raspberry Pi 5
   ```
3. Restart the backend (systemd service or uvicorn).

## How to verify
1. Open `https://expedition-23.ngrok.app/api/status`.
2. Confirm the JSON contains `"controller_name": "Raspberry Pi 5"`.
3. Hard-refresh the dashboard (Ctrl+Shift+R). The left side of the navbar should show the controller name.

> If `"controller_name"` shows the hostname instead of your `.env` value, `.env` isn't being loaded.
> Run uvicorn from the directory that contains `.env` (known issue, same as `USE_MOCK_SENSORS`).