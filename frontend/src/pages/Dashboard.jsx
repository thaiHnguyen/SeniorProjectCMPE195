/**
 * Dashboard.jsx so that it can be used in both App.jsx and AppdDemo.jsx without duplication
 * 
 * Displays sensor cards (Temperature, Humidity, pH, Air Pressure, Air Quality Score)
 * and their historical charts. Pressure + Air Quality come from the BME680.
 * Extracted from App.jsx so each page has its own component
 */

import React from "react";
import SensorCard from "../components/SensorCard.jsx";
import SensorChart from "../components/SensorChart.jsx";

function Dashboard({ current, thresholds, charts }) {

    return (
        <main className="dashboard">
            {/* Sensor Cards */}
            <section className="card-grid">
                <SensorCard
                    title="Temperature"
                    metric="temperature"
                    value={current?.temperature ?? 0}
                    min={thresholds?.temperature?.min ?? 0}
                    max={thresholds?.temperature?.max ?? 0}
                />
                <SensorCard
                    title="Humidity"
                    metric="humidity"
                    value={current?.humidity ?? 0}
                    min={thresholds?.humidity?.min ?? 0}
                    max={thresholds?.humidity?.max ?? 0}
                />
                <SensorCard
                    title="pH"
                    metric="ph"
                    value={current?.ph ?? 0}
                    min={thresholds?.ph?.min ?? 0}
                    max={thresholds?.ph?.max ?? 0}
                />
                {/* NEW: BME680 cards */}
                <SensorCard
                    title="Air Pressure"
                    metric="pressure"
                    value={current?.pressure ?? 0}
                    min={thresholds?.pressure?.min ?? 0}
                    max={thresholds?.pressure?.max ?? 0}
                />
                {/* Title shortened from "Air Quality Score": the full name wraps
                    to two lines on the 150px card and breaks the row alignment */}
                <SensorCard
                    title="Air Quality"
                    metric="aqi_score"
                    value={current?.aqi_score ?? 0}
                    min={thresholds?.aqi_score?.min ?? 0}
                    max={thresholds?.aqi_score?.max ?? 0}
                />
            </section>

            <section className="sensor-chart-grid" style={{ marginTop: "40px" }}>
                <SensorChart
                    title="Temperature Chart"
                    metric="temperature"
                    data={charts?.temperature?.data ?? []}
                    timestamps={charts?.temperature?.timestamps ?? []}
                />
                <SensorChart
                    title="Humidity Chart"
                    metric="humidity"
                    data={charts?.humidity?.data ?? []}
                    timestamps={charts?.humidity?.timestamps ?? []}
                />
                <SensorChart
                    title="pH Chart"
                    metric="ph"
                    data={charts?.ph?.data ?? []}
                    timestamps={charts?.ph?.timestamps ?? []}
                />
                {/* NEW: BME680 charts */}
                <SensorChart
                    title="Air Pressure Chart (hPa)"
                    metric="pressure"
                    data={charts?.pressure?.data ?? []}
                    timestamps={charts?.pressure?.timestamps ?? []}
                />
                <SensorChart
                    title="Air Quality Score Chart"
                    metric="aqi_score"
                    data={charts?.aqi_score?.data ?? []}
                    timestamps={charts?.aqi_score?.timestamps ?? []}
                />
            </section>
        
        </main>
    );
}

export default Dashboard;