/**
 * this will convert backend data into format that react in frontend can read
 * Flow: Backend -> transformer.js -> UI
 */

export function mapSystemStatusToDevice(systemStatus) {
    return {
        // Controller name from /api/status (set via CONTROLLER_NAME or Pi hostname).
        // Replaces the old workaround that showed the active threshold profile name.
        name: systemStatus?.controller_name || "Smart Hydroponic System",   

        status: systemStatus?.status || "offline",
        lastUpdated: systemStatus?.timestamp || null,
        usingMock: systemStatus?.sensors?.using_mock ?? true,

        // Kept in case you want to show the profile elsewhere (e.g. Dashboard header)
        activeProfile: systemStatus?.active_configuration || null,
    };
}

export function mapActiveConfigToThresholds(config) {
    return {
        temperature: {
            min: config?.temp_min ?? 0,
            max: config?.temp_max ?? 0,
        },
        humidity: {
            min: config?.humidity_min ?? 0,
            max: config?.humidity_max ?? 0,
        },
        ph: {
            min: config?.ph_min ?? 0,
            max: config?.ph_max ?? 0,
        },
    };
}

export function mapLatestReadingsToCurrent(latestResponse) {
    const rows = latestResponse?.data || [];

    let temperature = null;
    let humidity = null;
    let ph = null;
    let latestTimestamp = null;

    rows.forEach((row) => {
        if (!latestTimestamp || (row.timestamp && row.timestamp > latestTimestamp)) {
            latestTimestamp = row.timestamp;
        }

        if (row.sensor_type === "bme280" || row.sensor_type === "bme680") {
            if (row.temperature !== null && row.temperature !== undefined) {
                temperature = row.temperature;
            }
            if (row.humidity !== null && row.humidity !== undefined) {
                humidity = row.humidity;
            }
        }

        if (row.sensor_type === "ph") {
            if (row.ph !== null && row.ph !== undefined) {
                ph = row.ph;
            }
        }
    });

    return {
        temperature,
        humidity,
        ph,
        timestamp: latestTimestamp,
    };
}

export function mapHistoricalRowsToMetricChart(historicalResponse, metricKey) {
    const rows = historicalResponse?.data || [];

    const dataPoints = rows
        .filter((row) => row[metricKey] !== null && row[metricKey] !== undefined)
        .map((row) => ({
            timestamp: row.timestamp,
            value: row[metricKey],
        }))
        .reverse();

    return {
        data: dataPoints.map(point => point.value),
        timestamps: dataPoints.map(point => point.timestamp)
    };
}

export function buildDashboardData({
    systemStatus,
    activeConfiguration,
    latestReadings,
    temperatureHistory,
    humidityHistory,
    phHistory,
}) {
    return {
        device: mapSystemStatusToDevice(systemStatus),
        thresholds: mapActiveConfigToThresholds(activeConfiguration),
        current: mapLatestReadingsToCurrent(latestReadings),
        charts: {
            temperature: mapHistoricalRowsToMetricChart(
                temperatureHistory,
                "temperature"
            ),
            humidity: mapHistoricalRowsToMetricChart(humidityHistory, "humidity"),
            ph: mapHistoricalRowsToMetricChart(phHistory, "ph"),
        },
    };
}