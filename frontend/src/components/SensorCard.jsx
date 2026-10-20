import React from "react";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { formatTemp } from "../utils/units.js";

import "../styles/sensorCard.css";
/**
 * Sensor card will be use to display: 
 *  temp: C or F
 *  Humidity: %
 *  pH: double
 *  Air Pressure: hPa (BME680)
 *  Air Quality Score: 1-4 (BME680)
 *  status: Normal/Warning/Danger
 */

// Must match TOLERANCE in backend/src/services/alert_evaluator.py
const TOLERANCE = { temperature: 2.0, humidity: 5.0, ph: 0.3, pressure: 10.0, aqi_score: 1 };

// Suffix for non-temperature metrics; temperature comes from the context
const UNIT_LABEL = { humidity: " %", ph: "", pressure: " hPa", aqi_score: "" };

// NEW: meaning of each air quality score, shown as a hover hint on the card
const AQI_LABEL = { 1: "Good", 2: "Moderate", 3: "Poor", 4: "Unhealthy" };

// removed unused `unit` prop (units come from UNIT_LABEL / the temp context)
function SensorCard({ title, value, min, max, metric }) {
    const { tempUnit } = useTempUnit();

    const currentValue = Number(value);
    const minVal = Number(min);
    const maxVal = Number(max);
    const tol = TOLERANCE[metric] ?? 0;

    let status;
    if (currentValue >= minVal && currentValue <= maxVal) {
        status = "normal";
    } else if (currentValue >= minVal - tol && currentValue <= maxVal + tol) {
        status = "warning";
    } else {
        status = "danger";
    }
    // Convert only for display, as the last step
    // NEW: pressure rounded to 1 decimal so "1013.25 hPa" doesn't overflow the card
    const shown = metric === "pressure" ? Number(currentValue.toFixed(1)) : currentValue;
    const display =
        metric === "temperature" ? formatTemp(currentValue, tempUnit) 
                                : `${shown}${UNIT_LABEL[metric] ?? ""}`;

    // NEW: hover hint explaining the 1-4 scale (other cards have no hint)
    const hint = metric === "aqi_score"
        ? `${AQI_LABEL[currentValue] ?? "Unknown"} (1 Good · 2 Moderate · 3 Poor · 4 Unhealthy)`
        : undefined;

    return (
        <div className={`sensor-card ${status}`} title={hint}>
            <h3>{title}</h3>
            <p className="sensor-value">
                {display}
            </p>
            <p className="sensor-status">{status.toUpperCase()}</p>
        </div>
    );
}
export default SensorCard;