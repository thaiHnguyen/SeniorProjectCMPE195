import React from "react";
import "../styles/sensorCard.css";

/**
 * Sensor card will be use to display: 
 *  temp: C
 *  Humidity: %
 *  pH: double
 *  status: Normal/Warning/Danger
 */

// Must match TOLERANCE in backend/src/services/alert_evaluator.py
const TOLERANCE = { temperature: 2.0, humidity: 5.0, ph: 0.3 };

function SensorCard({ title, value, unit, min, max, metric }) {
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

    return (
        <div className={`sensor-card ${status}`}>
            <h3>{title}</h3>
            <p className="sensor-value">
                {currentValue} {unit}
            </p>
            <p className="sensor-status">{status.toUpperCase()}</p>
        </div>
    );
}
export default SensorCard;
