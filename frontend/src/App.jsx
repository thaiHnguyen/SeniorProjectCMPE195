import { useState, useEffect } from "react";
import {
    getAlerts,
    getToken,
    fetchCurrentUser,
    logoutUser,
    AUTH_EXPIRED_EVENT,
} from "./services/api.js";

import "./styles/App.css";

import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import Appearance from "./pages/Appearance.jsx";
import AlertModal from "./components/AlertModal.jsx";
import LandingPage from "./pages/LandingPage.jsx";

import useDashboardData from "./hooks/useDashboardData.js";

/**
 * NEW (login): App is now the sign-in gate.
 * - Shows LandingPage until someone signs in.
 * - On refresh, a saved token is checked with GET /api/auth/me, so a
 *   remembered user goes straight back to the dashboard.
 * - Goes back to LandingPage on logout, or when the backend rejects the token
 *   (api.js fires AUTH_EXPIRED_EVENT, e.g. after the 6-hour session ends).
 * The dashboard itself (data polling, settings, alerts) lives in AuthedApp
 * below, so nothing is fetched before login and each user starts fresh.
 */
function App() {
    const [user, setUser] = useState(null);
    // Only "checking" when there is a saved token to verify; avoids flashing
    // the landing page for a remembered user
    const [checking, setChecking] = useState(() => Boolean(getToken()));

    // Restore a saved login once, on first load
    useEffect(() => {
        if (!getToken()) return;
        fetchCurrentUser()
            .then(setUser)
            .catch(() => setUser(null))    // invalid/expired: api.js already cleared it
            .finally(() => setChecking(false));
    }, []);

    // Backend said the token is no longer valid -> back to the landing page
    useEffect(() => {
        const onExpired = () => setUser(null);
        window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    }, []);

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (e) {
            console.error("Logout request failed:", e);   // token is cleared anyway
        }
        setUser(null);
    };

    if (checking) {
        return <p className="dashboard">Loading...</p>;
    }

    // Show Landing Page before entering Dashboard
    if (!user) {
        return <LandingPage onLogin={setUser} />;
    }

    // key: switching accounts remounts the dashboard with fresh state
    return <AuthedApp key={user.id} user={user} onLogout={handleLogout} />;
}

/**
 * The dashboard for a signed-in user.
 * CHANGED: this was the body of App; it now only mounts after login.
 */
function AuthedApp({ user, onLogout }) {
    const { device, current, thresholds, charts, loading, error } = useDashboardData();
    // "dashboard" = show sensor cards and charts
    // "settings"  = show threshold profile management
    // "appearance" = show theme + temperature unit buttons
    const [activeTab, setActiveTab] = useState("dashboard");
    const [dangerAlerts, setDangerAlerts] = useState([]);
    // Per-session dismissals, intentionally not persisted, so a refresh re-shows
    const [dismissed, setDismissed] = useState(() => new Set());

    // Appearance page doesn't need sensor data, so it renders the same
    // way in the loading, error, and normal states
    const appearancePage = (
        <main className="dashboard">
            <Appearance />
        </main>
    );

    // Poll alongside existing sensor polling
    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            try {
                // CHANGED: backend severity is now normal|warning|danger (was "critical")
                const alerts = await getAlerts({ severity: "danger", limit: 20 });
                if (!cancelled) setDangerAlerts(alerts);
            } catch (e) {
                console.error("Alert poll failed:", e);   // don't break the dashboard
            }
        };

        poll();
        const id = setInterval(poll, 15000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    const visible = dangerAlerts.filter((a) => !dismissed.has(a.id));

    const handleClose = () => {
        setDismissed((prev) => {
            const next = new Set(prev);
            visible.forEach((a) => next.add(a.id));
            return next;
        });
    };
    
    // Loading State
    if (loading) {
        return (
            <>
                <Navbar 
                    deviceName="Loading..." 
                    status="offline" 
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    userName={user.name}
                    onLogout={onLogout}
                />
                {activeTab === "appearance" ? appearancePage : (
                <main className="dashboard">
                    {activeTab === "dashboard" ? (
                        <p>Loading dashboard data...</p>
                    ) : (
                        <Settings />
                    )}
                </main>
                )}
            </>
        );
    }
    // Error State
    if (error) {
        return (
            <>
                <Navbar 
                    deviceName="System Error" 
                    status="offline"
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    userName={user.name}
                    onLogout={onLogout}
                />
                {activeTab === "appearance" ? appearancePage : (
                <main className="dashboard">
                    {activeTab === "dashboard" ? (
                        <p>Error: {error}</p>
                    ) : (
                        <Settings />
                    )}
                </main>
                )}
            </>
        );
    }
    // Main Render
    return (
        <>
            {/* Navbar - always visible. CHANGED: also holds the tabs (logo | tabs | account) */}
            <Navbar
                deviceName={device?.name || "Smart Hydroponic System"}
                status={device?.status || "offline"}
                lastUpdated={device?.lastUpdated}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                userName={user.name}
                onLogout={onLogout}
            />
            {/*Page Content - conditionally rendered based on active tab*/}
            {activeTab === "dashboard" ? (
                <Dashboard
                    current={current}
                    thresholds={thresholds}
                    charts={charts}
                />
            ) : activeTab === "appearance" ? (
                appearancePage
            ) : (
                <main className="dashboard">
                    <Settings />
                </main>
            )}
            {/*Alert Modal - use when threshold is on DANGER */}
            <AlertModal alerts={visible} onClose={handleClose} />
        </>
    );
}

export default App;