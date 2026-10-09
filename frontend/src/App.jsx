import { useState, useEffect } from "react";
import { getAlerts } from "./services/api.js";

import "./styles/App.css";

import Navbar from "./components/Navbar.jsx";
import TabBar from "./components/TabBar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import Appearance from "./pages/Appearance.jsx";
import AlertModal from "./components/AlertModal.jsx";
import LandingPage from "./pages/LandingPage.jsx";

import useDashboardData from "./hooks/useDashboardData.js";


function App() {
    const { device, current, thresholds, charts, loading, error } = useDashboardData();

    // "dashboard" = show sensor cards and charts
    // "settings"  = show threshold profile management
    // "appearance" = show theme + temperature unit buttons
    const [activeTab, setActiveTab] = useState("dashboard");

    const [dangerAlerts, setDangerAlerts] = useState([]);
    // Per-session dismissals — intentionally not persisted, so a refresh re-shows
    const [dismissed, setDismissed] = useState(() => new Set());

    // Dark / Light mode (button now lives on the Appearance page;
    // theme-switching logic to be added later)
    const [darkMode, setDarkMode] = useState(false);

    // Appearance page doesn't need sensor data, so it renders the same
    // way in the loading, error, and normal states
    const appearancePage = (
        <main className="dashboard">
            <Appearance
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(!darkMode)}
            />
        </main>
    );
    
    // Controls Landing Page -> Dashboard
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Poll alongside existing sensor polling
    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            try {
                const alerts = await getAlerts({ severity: "critical", limit: 20 });
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
    
    // Show Landing Page before entering Dashboard
    if (!isLoggedIn) {
        return (
            <LandingPage
                onLogin={() => setIsLoggedIn(true)}
            />
        );
    }

    // Loading State
    if (loading) {
        return (
            <>
                <Navbar 
                    deviceName="Loading..." 
                    status="offline" 
                />
                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
                />
                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
            {/* Navbar - always visible */}
            <Navbar
                deviceName={device?.name || "Smart Hydroponic System"}
                status={device?.status || "offline"}
                lastUpdated={device?.lastUpdated}
            />
            
            {/* Tab Bar - always visible, switches between pages */}
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

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