import { useState, useEffect } from "react";
import { getAlerts } from "./services/api.js";

import "./styles/App.css";

import Navbar from "./components/Navbar.jsx";
import TabBar from "./components/TabBar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import AlertModal from "./components/AlertModal.jsx";
import LandingPage from "./pages/LandingPage.jsx";

import useDashboardData from "./hooks/useDashboardData.js";


function App() {
    const { device, current, thresholds, charts, loading, error } = useDashboardData();

    // "dashboard" = show sensor cards and charts
    // "settings"  = show threshold profile management
    const [activeTab, setActiveTab] = useState("dashboard");

    const [dangerAlerts, setDangerAlerts] = useState([]);
    // Per-session dismissals — intentionally not persisted, so a refresh re-shows
    const [dismissed, setDismissed] = useState(() => new Set());

    // Dark / Light mode
    const [darkMode, setDarkMode] = useState(false);
    
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
                    darkMode={darkMode} 
                    onToggleDarkMode={() => setDarkMode(!darkMode)}
                />
                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
                <main className="dashboard">
                    {activeTab === "dashboard" ? (
                        <p>Loading dashboard data...</p>
                    ) : (
                        <Settings />
                    )}
                </main>
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
                    darkMode={darkMode}
                    onToggleDarkMode={() => setDarkMode(!darkMode)}
                />
                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
                <main className="dashboard">
                    {activeTab === "dashboard" ? (
                        <p>Error: {error}</p>
                    ) : (
                        <Settings />
                    )}
                </main>
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
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(!darkMode)}
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
