import React from "react";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { formatTemp } from "../utils/units.js";

import "../styles/sensorCard.css";
/**
 * Sensor card will be use to display: 
 *  temp: C or F
 *  Humidity: %
 *  pH: double
 *  status: Normal/Warning/Danger
 */

// Must match TOLERANCE in backend/src/services/alert_evaluator.py
const TOLERANCE = { temperature: 2.0, humidity: 5.0, ph: 0.3 };

// Suffix for non-temperature metrics; temperature comes from the context
const UNIT_LABEL = { humidity: " %", ph: "" };

function SensorCard({ title, value, unit, min, max, metric }) {
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
    const display =
        metric === "temperature" ? formatTemp(currentValue, tempUnit) 
                                : `${currentValue}${UNIT_LABEL[metric] ?? ""}`;

    return (
        <div className={`sensor-card ${status}`}>
            <h3>{title}</h3>
            <p className="sensor-value">
                {display}
            </p>
            <p className="sensor-status">{status.toUpperCase()}</p>
        </div>
    );
}
export default SensorCard;
