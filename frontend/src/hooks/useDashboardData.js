/**
 * use this to call api.js then use transformer.js to feed data to UI
 * Flow: api.js -> transformer.js -> react state -> ui
 */
import { useEffect, useState } from "react";
import {
    fetchSystemStatus,
    fetchLatestReadings,
    fetchActiveConfiguration,
    fetchHistoricalData,
} from "../services/api";

import {
    mapSystemStatusToDevice,
    mapActiveConfigToThresholds,
    mapLatestReadingsToCurrent,
    mapHistoricalRowsToMetricChart,
} from "../utils/transformers";

export default function useDashboardData() {
    const [device, setDevice] = useState(null);
    const [current, setCurrent] = useState(null);
    const [thresholds, setThresholds] = useState(null);
    const [charts, setCharts] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load everything once
    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);

                const [
                    systemStatus,
                    latestReadings,
                    activeConfig,
                    tempHistory,
                    humidityHistory,
                    phHistory,
                ] = await Promise.all([
                    fetchSystemStatus(),
                    fetchLatestReadings(),
                    fetchActiveConfiguration(),
                    // 24h at a 30s read interval = 2,880 rows; 3,000 leaves headroom.
                    // Chart AND the expanded-view average both use this same data.
                    fetchHistoricalData({ sensorType: "bme280", hours: 24, limit: 3000 }),
                    fetchHistoricalData({ sensorType: "bme280", hours: 24, limit: 3000 }),
                    fetchHistoricalData({ sensorType: "ph",     hours: 24, limit: 3000 }),
                ]);

                // Transform data
                setDevice(mapSystemStatusToDevice(systemStatus));
                setCurrent(mapLatestReadingsToCurrent(latestReadings));
                setThresholds(mapActiveConfigToThresholds(activeConfig));

                setCharts({
                    temperature: mapHistoricalRowsToMetricChart(
                        tempHistory,
                        "temperature"
                    ),
                    humidity: mapHistoricalRowsToMetricChart(
                        humidityHistory,
                        "humidity"
                    ),
                    ph: mapHistoricalRowsToMetricChart(phHistory, "ph"),
                });
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    // Poll latest values every 5 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const latestReadings = await fetchLatestReadings();
                setCurrent(mapLatestReadingsToCurrent(latestReadings));
            } catch (err) {
                console.error("Polling error: ", err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return { device, current, thresholds, charts, loading, error, };
}