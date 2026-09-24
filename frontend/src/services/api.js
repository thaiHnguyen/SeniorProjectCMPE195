/**
 * API Service Layer
 *
 * EXISTING endpoints are untouched.
 * NEW endpoints added at the bottom for configuration CRUD:
 *  - createConfiguration()
 *  - updateConfiguration()
 *  - deleteConfiguration()
 *  - activateConfiguration()
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://expedition-23.ngrok.app";

async function fetchJSON(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData?.detail) {
                message = errorData.detail;
            }
        } catch {
            // ignore JSON parse errors
        }
        throw new Error(message);
    }

    return response.json();
}

// HEALTH & SYSTEM 
export async function fetchHealth() {
    return fetchJSON("/api/health");
}

export async function fetchSystemStatus() {
    return fetchJSON("/api/status");
}

// SENSORS 
export async function fetchCurrentReadings() {
    return fetchJSON("/api/sensors/current");
}

export async function fetchLatestReadings() {
    return fetchJSON("/api/sensors/latest");
}

export async function fetchHistoricalData({
    hours = 24,
    limit = 200,
    sensorType = null,
} = {}) {
    const params = new URLSearchParams();
    params.set("hours", String(hours));
    params.set("limit", String(limit));
    if (sensorType) {
        params.set("sensor_type", sensorType);
    }
    return fetchJSON(`/api/sensors/historical?${params.toString()}`);
}

export async function fetchSensorStatus() {
    return fetchJSON("/api/sensors/status");
}

export async function fetchAllConfigurations() {
    return fetchJSON("/api/configurations/");
}

export async function fetchActiveConfiguration() {
    return fetchJSON("/api/configurations/active");
}
/**
 * CONFIGURATIONS - CRUD 
 * These call the backend endpoints in: backend/src/api/routes/configurations.py
 */

/**
 * Create a new threshold configuration profile
 * POST /api/configurations/
 *
 * @param {Object} configData - { name, description?, ph_min, ph_max, temp_min, temp_max, humidity_min, humidity_max }
 * @returns {Object} The created configuration with its new ID
 */
export async function createConfiguration(configData) {
    return fetchJSON("/api/configurations/", {
        method: "POST",
        body: JSON.stringify(configData),
    });
}

/**
 * Update an existing threshold configuration (partial update)
 * PATCH /api/configurations/{id}
 *
 * @param {number} configId - The ID of the configuration to update
 * @param {Object} updateData - Only the fields you want to change
 * @returns {Object} The updated configuration
 */
export async function updateConfiguration(configId, updateData) {
    return fetchJSON(`/api/configurations/${configId}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
    });
}

/**
 * Delete a threshold configuration profile
 * DELETE /api/configurations/{id}
 * NOTE: Backend rejects deletion of the active profile.
 *
 * @param {number} configId - The ID to delete
 */
export async function deleteConfiguration(configId) {
    return fetchJSON(`/api/configurations/${configId}`, {
        method: "DELETE",
    });
}

/**
 * Set a configuration as the active profile
 * POST /api/configurations/{id}/activate
 *
 * @param {number} configId - The ID to activate
 */
export async function activateConfiguration(configId) {
    return fetchJSON(`/api/configurations/${configId}/activate`, {
        method: "POST",
    });
}

export async function fetchDashboardBootstrap() {
    const [systemStatus, latestReadings, activeConfiguration] =
        await Promise.all([
            fetchSystemStatus(),
            fetchLatestReadings(),
            fetchActiveConfiguration(),
        ]);
    return { systemStatus, latestReadings, activeConfiguration };
}

export async function getAlerts({ severity, limit = 20 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (severity) params.set("severity", severity);
    const res = await fetch(`${API_BASE_URL}/api/alerts/?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch alerts: ${res.status}`);
    return res.json();
}