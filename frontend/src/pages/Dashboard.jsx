/**
 * Dashboard.jsx so that it can be used in both App.jsx and AppdDemo.jsx without duplication
 * 
 * Displays sensor cards (Temperature, Humidity, pH) and their historical charts
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
                    unit=" °C"
                    min={thresholds?.temperature?.min ?? 0}
                    max={thresholds?.temperature?.max ?? 0}
                />
                <SensorCard
                    title="Humidity"
                    metric="humidity"
                    value={current?.humidity ?? 0}
                    unit=" %"
                    min={thresholds?.humidity?.min ?? 0}
                    max={thresholds?.humidity?.max ?? 0}
                />
                <SensorCard
                    title="pH"
                    metric="ph"
                    value={current?.ph ?? 0}
                    unit=""
                    min={thresholds?.ph?.min ?? 0}
                    max={thresholds?.ph?.max ?? 0}
                />
            </section>

            <section className="sensor-chart-grid" style={{ marginTop: "40px" }}>
                <SensorChart
                    title="Temperature Chart"
                    unit="°C"
                    data={charts?.temperature?.data ?? []}
                    timestamps={charts?.temperature?.timestamps ?? []}
                />
                <SensorChart
                    title="Humidity Chart"
                    unit="%"
                    data={charts?.humidity?.data ?? []}
                    timestamps={charts?.humidity?.timestamps ?? []}
                />
                <SensorChart
                    title="pH Chart"
                    unit=""
                    data={charts?.ph?.data ?? []}
                    timestamps={charts?.ph?.timestamps ?? []}
                />
            </section>
        </main>
    );
}

export default Dashboard;