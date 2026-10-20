# Backend Update Oct 19: Login / Logout + `.env` setup

**Branch:** `login` -> merging into `main`

Users now **sign in** before seeing the dashboard. Each account has its **own threshold profiles and its own alerts**. Configuration also moved into a `.env` file.

> **The Pi must create a `.env`, pull, and restart the backend.** Until it does, Create Account and Sign In show **"Not Found"**, because the old backend has no login routes.
---

## What changed

### Login
- **Accounts:** new `users` and `sessions` tables. Passwords are stored as a salted **scrypt hash**, never as plain text.
- **New endpoints:**
  - `POST /api/auth/register`: create an account
  - `POST /api/auth/login`: returns a token
  - `POST /api/auth/logout`: ends the session
  - `GET /api/auth/me`: who is signed in
- **Sessions last 6 hours.** "Remember me" checked keeps you signed in after closing the browser (still up to 6 hours). Unchecked signs you out when the browser closes.
- **Profiles are per user:** every new account starts with its **own copy of the 10 example profiles**, with "Standard Hydroponic Range" active. Adding, editing, deleting or activating a profile only affects that account.
- **Alerts are per user:** every reading is checked against **each user's active profile**, and each user only sees their own alerts.
- **What needs a login:** `/api/configurations/*` and `/api/alerts/*` return **401** without one. Sensor data (`/api/sensors/*`, `/api/health`, `/api/status`) stays **public**, since there's one Pi and one garden.

### `.env` setup
- Settings are read from a **`.env` file in the repo root**. It's gitignored, so `git pull` won't create it. Copy it from `.env.example` (step 3 below).
- `.env` is now found **even if the backend starts from another folder**. Before, the settings silently fell back to defaults (e.g. `USE_MOCK_SENSORS` was ignored).
- The hardcoded ngrok URL was removed from `api.js`. The frontend reads it from `frontend/.env`.

### Automatic DB upgrade (first start only)
- The old shared profiles (including any you created, e.g. `"string"`) are **moved to `threshold_configurations_legacy`, not deleted**. Profiles now belong to accounts, so everyone starts from fresh copies of the examples.
- `alerts` gets a `user_id` column. **Old alerts no longer show on the dashboard** because they have no owner. They're still in the database.
- Sensor readings are untouched.

### Tests
- `tests/test_auth.py`: 14 new tests covering login, logout, expired sessions, users not seeing each other's profiles or alerts, and per-user alerts. **46/46 passing.**

---

## Update the Pi (hardware update for Vy)

Run these **from the repo root**.

```bash
# 1. Go to the repo and check the current version
cd ~/<repo-folder>
git log --oneline -1

# 2. Back up the database (the upgrade keeps all data; this is just in case)
cp data/hydroponic.db data/hydroponic.db.bak

# 3. Get the new code
git switch main               # use `git switch login` if it isn't merged yet
git pull
git log --oneline -1          # should show the login commit
```

### 4. Create the `.env` (first time only)
```bash
cp .env.example .env
nano .env
```
Set these values for the Pi:
```bash
APP_NAME=Smart Hydroponic System
CONTROLLER_NAME=hydro-pi
DEBUG=False
LOG_LEVEL=INFO

API_HOST=0.0.0.0
API_PORT=8000

DATABASE_PATH=./data/hydroponic.db

USE_MOCK_SENSORS=False
SENSOR_READ_INTERVAL=30

ALLOWED_ORIGINS=*
```
> Only use keys that exist in `backend/src/config/settings.py`. An unknown key stops the backend from starting.

### 5. Restart the backend
Pulling alone isn't enough, because a running Python process keeps the old code until it restarts.

**If it runs as a service:**
```bash
sudo systemctl restart <service-name>
sudo journalctl -u <service-name> -n 40     # check the startup log
```

**If it runs in a terminal or tmux:** press `Ctrl+C`, then:
```bash
python -m backend.src.main
```

> Always start it **from the repo root**. `DATABASE_PATH` is `./data/hydroponic.db`, which is relative to the current folder. Started from anywhere else, the backend creates a new empty database and the old data looks like it's gone.

### 6. Check the startup log
These lines appear **only on the first start** after the update:
```
Migrated: shared profiles kept in threshold_configurations_legacy; profiles are now per user
Migrated: added alerts.user_id
Database initialized
No user has an active threshold profile - alerts disabled
```
The last line is expected: no accounts exist yet. Alerts turn on as soon as someone creates one.

If the Pi skipped the Oct 15 update, you'll also see:
```
Migrated: added sensor_readings.aqi_score
Migrated: alert severity renamed to normal|warning|danger
```

Also check which sensors actually connected:
```
Sensor modes - REAL: ['bme280', 'bme680', 'ph'] | MOCK: none
```
Any sensor listed under `MOCK` didn't connect; the warning just above it says why. Don't rely on the `Using REAL sensors` line: it only repeats the `.env` setting.

---

## Verify

**1. Protected routes need a login** (should be `401`):
```bash
curl -i https://expedition-23.ngrok.app/api/configurations/
```

**2. Create an account and sign in:**
```bash
curl -X POST https://expedition-23.ngrok.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Vy","email":"vy@example.com","password":"choose-a-password"}'

curl -X POST https://expedition-23.ngrok.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vy@example.com","password":"choose-a-password"}'
#   copy the "token" value from the response
```

**3. Use the token** (should list your 10 profiles):
```bash
curl https://expedition-23.ngrok.app/api/configurations/ \
  -H "Authorization: Bearer <token>"
```

**4. In the browser:** set `frontend/.env` to `VITE_API_BASE_URL=https://expedition-23.ngrok.app`, restart `npm run dev`, then:
- **Create Account** works and opens Sign In with the email filled in
- **Sign In** shows the dashboard with "Hi, <name>" and **Log out** in the navbar
- **Settings** shows 10 profiles
- **Refresh** keeps you signed in; **Log out** returns to the landing page

> Accounts live in the database they were created in. An account made on a laptop (`localhost:8000`) doesn't exist on the Pi, so create one on each.

---

## Troubleshooting

- **"Not Found" on Create Account or Sign In:** the frontend is talking to a backend without the login code. Either the Pi wasn't restarted, or `frontend/.env` points somewhere else. Open `<backend-url>/docs`: there should be an **auth** section.
- **No `Migrated:` lines, and `/docs` has no auth section:** the backend wasn't restarted, or it runs from a different folder. Find where it runs from: `ps aux | grep backend.src.main` and `sudo systemctl cat <service-name> | grep -i "WorkingDirectory\|ExecStart"`.
- **Backend won't start with `Extra inputs are not permitted`:** `.env` has a key that isn't in `settings.py`. Remove it or check for typos.
- **`USE_MOCK_SENSORS` seems ignored:** the same key appears twice in `.env` (the last one wins), or a system environment variable with that name overrides it (`echo $USE_MOCK_SENSORS`).
- **Signed out after a while:** sessions end after 6 hours. Sign in again.
- **Profiles from before the update are missing:** they're in `threshold_configurations_legacy`. Recreate any you need in your account from the Settings page.
- **Danger popup never shows:** frontend and backend are out of sync. Both must be on the new `main`, and you must be signed in (alerts are per user).
- **`Logging error in Loguru Handler` on Windows:** only happens on Windows dev machines with auto-reload (`DEBUG=True`). It doesn't affect the Pi. Workaround: set `DEBUG=False`.

### Rollback
```bash
# stop the backend first
git switch <previous-commit-or-branch>
cp data/hydroponic.db.bak data/hydroponic.db
# start the backend again
```
> Restore the backup when rolling back: the old code doesn't know about accounts and would mix everyone's profiles together.

---

## Previous update (Oct 15): BME680 Air Pressure + Air Quality Score

- **Air Quality Score is saved:** new `aqi_score` column in `sensor_readings` (1 Good, 2 Moderate, 3 Poor, 4 Unhealthy).
- **New profile thresholds:** `pressure_min` / `pressure_max` (hPa, default **990–1030**) and `aqi_min` / `aqi_max` (default **1–2**).
- **Alerts for the new metrics:** pressure ±10 hPa, Air Quality ±1 step. These come from the **BME680 only**, so the BME280 doesn't raise duplicates.
- **Alert severity renamed:** `info / warning / critical` -> **`normal / warning / danger`**. Old alerts are renamed automatically.
- **Import fix:** `backend.src.database` -> `backend.src.storage`, so the backend starts on a fresh clone.
- **Pydantic v2 cleanup:** `@field_validator`, `ConfigDict`, `.model_dump()`.