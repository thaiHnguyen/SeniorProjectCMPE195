# Backend Update Oct 15: BME680 Air Pressure + Air Quality Score

**Branch:** `backend-update` -> merged into `main` 

The dashboard now shows **Air Pressure** and **Air Quality Score** from the BME680, each with a card, a 24h chart, and min/max thresholds in profiles.

> **The Pi must pull and restart the backend.** Until it does, the dashboard shows Air Quality as `0` and Air Pressure as `DANGER`, because the old backend doesn't send the new fields.

---

## What changed

### Backend
- Air Quality Score is now saved: The BME680 code already calculated `aqi_score` (1 Good, 2 Moderate, 3 Poor, 4 Unhealthy) but never stored it. New `aqi_score` column in `sensor_readings`. 

- New profile thresholds: `pressure_min` / `pressure_max` (hPa, default **990–1030**) and `aqi_min` / `aqi_max` (default **1–2**) in `threshold_configurations`.

- Alerts for the new metrics: Pressure tolerance **±10 hPa**, Air Quality **±1 step** (score 3 = WARNING, 4 = DANGER with the default 1–2 range). Pressure and Air Quality alerts come from the **BME680 only**, so the BME280 doesn't raise a duplicate

- Alert severity renamed: `info / warning / critical` -> **`normal / warning / danger`**, the same names the dashboard uses. Old alerts are renamed automatically. 

- Automatic DB upgrade: On startup the backend adds the missing columns and rebuilds the `alerts` table once. **No data is deleted**, and existing profiles get the default ranges.

- Import fix: `main.py`, `sensors.py`, `health.py` imported `backend.src.database`, but that folder was renamed to `storage/`. The backend wouldn't start on a fresh clone.

- Pydantic v2 cleanup: `@validator` -> `@field_validator`, `class Config` → `ConfigDict`, `.dict()` -> `.model_dump()`. 

### Tests
- `tests/test_alert_evaluator.py`: new tests for pressure and Air Quality bands, **31/31 passing**

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
git switch main
git pull origin main
git log --oneline -1          # should what i've been commited lately to main
```

### 4. Restart the backend
Pulling alone isn't enough, because a running Python process keeps the old code until it restarts.

**If it runs as a service:**
```bash
sudo systemctl restart <service-name>
sudo journalctl -u <service-name> -n 30     # check the startup log
```

**If it runs in a terminal or tmux:** press `Ctrl+C`, then:
```bash
python -m backend.src.main
```

> Always start it **from the repo root**. The DB path is `./data/hydroponic.db`, which is relative to the current folder. Started from anywhere else, the backend creates a new empty database and the old data looks like it's gone.

### 5. Check the startup log
These lines appear **only on the first start** after the update:
```
Migrated: added sensor_readings.aqi_score
Migrated: added threshold_configurations.pressure_min
Migrated: added threshold_configurations.pressure_max
Migrated: added threshold_configurations.aqi_min
Migrated: added threshold_configurations.aqi_max
Migrated: alert severity renamed to normal|warning|danger
Database initialized
```
On later restarts they won't appear, and that's expected.

---

## Verify

```bash
curl https://expedition-23.ngrok.app/api/configurations/active
#   should include: "pressure_min", "pressure_max", "aqi_min", "aqi_max"

curl https://expedition-23.ngrok.app/api/sensors/latest
#   every row should have an "aqi_score" key; the bme680 row should have a number 1-4
#   (wait one read cycle, about 30s, after the restart)
```

Then **refresh the dashboard**:
- **Air Pressure** card goes back to NORMAL (if the reading is inside 990–1030)
- **Air Quality** card shows 1–4 instead of 0
- **Air Quality chart** fills in from the update onward. Readings saved before it have no score, so the 24h line builds up over the day.

---

## Troubleshooting

- No `Migrated:` lines, and `curl` still has no `pressure_min`: The backend wasn't restarted, or it runs from a different folder. Find where it runs from: `ps aux \| grep backend.src.main` and `sudo systemctl cat <service-name> \| grep -i "WorkingDirectory\|ExecStart"` 
- `ModuleNotFoundError: No module named 'backend.src.database'`: Still on old code. `git pull` again. An old leftover `backend/src/database/` folder can be deleted; the code now uses `storage/`.
- Air Quality still `0` after the restart: Wait one read cycle, then refresh the page. Check that `/api/sensors/latest` shows `aqi_score` on the bme680 row.
- Danger popup never shows: Frontend and backend are out of sync. Both must be on the new `main` (the popup asks for `severity=danger`). 
- `Logging error in Loguru Handler` on Windows | Only happens on Windows dev machines with auto-reload (`DEBUG=True`). It doesn't affect the Pi. Workaround: set `DEBUG=false`.

### Rollback
```bash
# stop the backend first
git switch <previous-commit-or-branch>
cp data/hydroponic.db.bak data/hydroponic.db
# start the backend again
```