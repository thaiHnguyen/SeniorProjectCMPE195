/**
 * Dashboard.jsx so that it can be used in both App.jsx and AppdDemo.jsx without duplication
 * 
 * Displays sensor cards (Temperature, Humidity, pH) and their historical charts
 * Extracted from App.jsx so each page has its own component
 */

import React from "react";
import SensorCard from "../components/SensorCard.jsx";
import SensorChart from "../components/SensorChart.jsx";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";

function Dashboard({ current, thresholds, charts }) {
    const { tempUnit, toggleTempUnit } = useTempUnit();

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
            </section>
        
        </main>
    );
}

export default Dashboard;