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
        // NEW: BME680 thresholds
        pressure: {
            min: config?.pressure_min ?? 0,
            max: config?.pressure_max ?? 0,
        },
        aqi_score: {
            min: config?.aqi_min ?? 0,
            max: config?.aqi_max ?? 0,
        },
    };
}

export function mapLatestReadingsToCurrent(latestResponse) {
    const rows = latestResponse?.data || [];

    let temperature = null;
    let humidity = null;
    let ph = null;

    let pressure = null;    // NEW
    let aqiScore = null;    // NEW
    
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

        // NEW: pressure + air quality score are taken from the BME680 only
        // (the BME280 also reports pressure; we ignore it on purpose)
        if (row.sensor_type === "bme680") {
            if (row.pressure !== null && row.pressure !== undefined) {
                pressure = row.pressure;
            }
            if (row.aqi_score !== null && row.aqi_score !== undefined) {
                aqiScore = row.aqi_score;
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
        pressure,               // NEW
        aqi_score: aqiScore,    // NEW
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
    bme680History,   // NEW
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

            pressure: mapHistoricalRowsToMetricChart(bme680History, "pressure"),     // NEW
            aqi_score: mapHistoricalRowsToMetricChart(bme680History, "aqi_score"),   // NEW

        },
    };
}