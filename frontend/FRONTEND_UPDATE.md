# Frontend Update: BME680 Air Pressure + Air Quality Score

The dashboard now shows two new BME680 metrics, styled the same way as Temperature, Humidity and pH

**Air Quality Score:** 1 Good · 2 Moderate · 3 Poor · 4 Unhealthy (**lower is better**). It's calculated from the BME680's gas resistance. With the default range of 1–2, a score of 3 shows **WARNING** and 4 shows **DANGER**.

> **Requires the updated backend.** On an old backend, Air Quality shows `0` and Air Pressure shows `DANGER`, because the new fields are missing and the cards fall back to 0. See `BACKEND_UPDATE_README.md`.

---

## Run it

```bash
cd frontend
npm install          # only needed if package-lock.json changed or this is a fresh clone
npm run dev        
```
- **Offline UI testing:** change `<App />` to `<AppDemo />` in `src/main.jsx`. It uses mock data, including the new metrics (pressure 1013.25 hPa, Air Quality 3 → WARNING). **Switch it back before committing.**
- **Check before pushing:** `npm run build`

---

## Data flow

```
Backend                                   Frontend
/api/sensors/latest      ─ bme680 row ─▶  transformers.mapLatestReadingsToCurrent ─▶ current.pressure, current.aqi_score
/api/sensors/historical  ─ bme680 rows ─▶ mapHistoricalRowsToMetricChart          ─▶ charts.pressure, charts.aqi_score
/api/configurations/active ────────────▶  mapActiveConfigToThresholds             ─▶ thresholds.pressure, thresholds.aqi_score
                                                          │
                                                          ▼
                                             Dashboard.jsx → SensorCard / SensorChart
```

- **Pressure and Air Quality are read from `bme680` rows only.** The BME280 also reports pressure, but it's ignored on purpose so the card has one source.
- **One extra request:** `useDashboardData` makes one more call, `fetchHistoricalData({ sensorType: "bme680", hours: 24, limit: 3000 })`, which feeds both new charts.
- **Charts load once, on page load. Cards update every 5s,** the same as before.

---

## What changed, by file
- `pages/Dashboard.jsx`: Two new `SensorCard`s (`metric="pressure"`, `metric="aqi_score"`) and two new `SensorChart`s 

- `components/SensorCard.jsx`: `TOLERANCE` and `UNIT_LABEL` entries for both metrics. Pressure rounded to 1 decimal so it fits the card. The Air Quality card has a hover hint explaining the 1–4 scale. 

- `components/SensorChart.jsx`: Units for both metrics. Pressure **y-axis labels** drop "hPa" because the 42px axis column is too narrow; the unit still shows in the title, tooltip and min/max. 

- `utils/transformers.js`: Reads `pressure` and `aqi_score` from `bme680` rows; maps `pressure_min/max` and `aqi_min/max` to `thresholds` 

- `hooks/useDashboardData.js`: Extra BME680 history fetch -> `charts.pressure`, `charts.aqi_score` 

- `components/ProfileCard.jsx`: Two new threshold items ("--" if the backend doesn't send them) 

- `components/ProfileModal.jsx`: Two new Min/Max sections: Air Pressure (300–1100) and Air Quality Score (1–4)

- `pages/Settings.jsx`: New-profile defaults (990–1030, 1–2) and the update payload include the new fields 

- `hooks/useSettings.js`: Duplicate copies the new fields 

- `App.jsx`: Danger popup now asks for `severity: "danger"` (was `"critical"`), matching the backend rename 

- `AppDemo.jsx`: Mock profiles, readings and chart data for the new metrics 

- `styles/theme.css`: `--metric-pressure` (purple) and `--metric-aqi` (pink) for modal headers, in dark and light 

- `styles/profileModal.css`: `.range-header.pressure`, `.range-header.aqi` 

- `styles/profileCard.css`: Accent color for `.threshold-item.pressure` and `.threshold-item.aqi` 

---

## Keep in sync with the backend

These values are defined in **two places**. If you change one, change the other:

- `TOLERANCE` in `components/SensorCard.jsx` = `TOLERANCE` in `backend/src/services/alert_evaluator.py` 
- Default ranges in `pages/Settings.jsx` and `AppDemo.jsx` = Field defaults in `backend/src/storage/models.py` and column defaults in `db_manager.py` (`ADDED_COLUMNS`) 
- Alert severity `"danger"` in `App.jsx` = `SEVERITY_MAP` in `backend/src/services/data_collector.py` 

---

## Adding another sensor metric later (checklist)

Use the same steps as this update, with `pressure` as the example:

1. **Backend:** the sensor's value is stored in `sensor_readings`. Add a column and an `ADDED_COLUMNS` entry if needed.
2. **Backend:** add `<metric>_min/_max` to the schema, `models.py`, `db_manager.create_configuration`, and `ADDED_COLUMNS`.
3. **Backend:** add the metric to `METRIC_BOUNDS` and `TOLERANCE` in `alert_evaluator.py`.
4. **`transformers.js`:** add it in `mapLatestReadingsToCurrent` and `mapActiveConfigToThresholds`.
5. **`useDashboardData.js`:** add it to `charts` (reuse a history fetch if it comes from the same sensor).
6. **`SensorCard.jsx` / `SensorChart.jsx`:** add `TOLERANCE` and `UNIT_LABEL` entries.
7. **`Dashboard.jsx`:** add the card and the chart.
8. **Profiles:** `ProfileCard`, `ProfileModal`, `Settings` (defaults + update payload), `useSettings` (duplicate).
9. **`AppDemo.jsx`:** add mock data, then check in the demo app.

---
