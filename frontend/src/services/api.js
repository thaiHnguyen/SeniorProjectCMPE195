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

// Backend URL comes from frontend/.env (see frontend/.env.example).
// Falls back to a local backend instead of a hardcoded public tunnel URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn("[api] VITE_API_BASE_URL not set: using http://localhost:8000. Copy frontend/.env.example to frontend/.env.");
}

//  AUTH TOKEN (NEW: login) 
// The token from /api/auth/login is kept in the browser and sent with every
// request as "Authorization: Bearer <token>".
//   "Remember me" checked   -> localStorage   (survives closing the browser;
//                                             the backend still ends it after 6 h)
//   "Remember me" unchecked -> sessionStorage (cleared when the browser closes)
// Storage access is wrapped in try/catch: it can throw in private windows.
const TOKEN_KEY = "hydrogarden_token";

export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

function saveToken(token, remember) {
    clearToken();   // never keep one in both places
    try {
        (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
        // storage blocked: login still works until the page is refreshed
    }
}

export function clearToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    } catch {
        // ignore
    }
}

// App.jsx listens for this to send the user back to the landing page when the
// backend rejects the token (expired after 6 h, or logged out elsewhere).
export const AUTH_EXPIRED_EVENT = "auth:expired";

async function fetchJSON(endpoint, options = {}) {
    const token = getToken();
    // CHANGED: build headers last. Before, `...options` came after `headers`,
    // so passing options.headers silently dropped Content-Type.
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),   // NEW
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
            const errorData = await response.json();
            if (typeof errorData?.detail === "string") {
                message = errorData.detail;
            } else if (Array.isArray(errorData?.detail)) {
                // NEW: FastAPI validation errors (422) arrive as a list
                message = errorData.detail
                    .map((d) => String(d.msg).replace(/^Value error, /, ""))
                    .join(". ");
            }
        } catch {
            // ignore JSON parse errors
        }

        // NEW: a rejected token means the session is over. Login itself also
        // returns 401 (wrong password), but there is no token yet in that case.
        if (response.status === 401 && token) {
            clearToken();
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        }
        throw new Error(message);
    }

    return response.json();
}

//  AUTH (NEW: login) 
// Backend: backend/src/api/routes/auth.py

/** POST /api/auth/register: create an account (gets copies of the example profiles) */
export async function registerUser({ name, email, password }) {
    return fetchJSON("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
    });
}

/** POST /api/auth/login: on success the token is saved, returns the user */
export async function loginUser({ email, password, remember }) {
    const result = await fetchJSON("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    saveToken(result.token, remember);
    return result.user;
}

/** POST /api/auth/logout: ends the session on the server, then forgets the token */
export async function logoutUser() {
    try {
        await fetchJSON("/api/auth/logout", { method: "POST" });
    } finally {
        clearToken();   // log out locally even if the backend can't be reached
    }
}

/** GET /api/auth/me: who is logged in (throws if the saved token is invalid) */
export async function fetchCurrentUser() {
    return fetchJSON("/api/auth/me");
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
    // CHANGED: goes through fetchJSON so the login token is sent (alerts are per user)
    return fetchJSON(`/api/alerts/?${params}`);
}