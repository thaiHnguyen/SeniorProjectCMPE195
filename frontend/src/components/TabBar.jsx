/**
 * Tab switcher to switch between Dashboard, Settings and Appearance
 * 
 * Props:
 *  - activeTab: "dashboard" | "settings" | "appearance"
 *  - onTabChange: function(tabName)
 */

import React from "react";
import "../styles/tabBar.css";

function TabBar({activeTab, onTabChange}) {
    return (
        <nav className="tab-bar">
            {/* Dashboard Tab */}
            <button
                className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => onTabChange("dashboard")}
            >
                DashBoard
            </button>

            {/* SettingsTab */}
            <button
                className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => onTabChange("settings")}
            >
                Settings
            </button>

            {/* Appearance Tab - theme + temperature unit */}
            <button
                className={`tab-btn ${activeTab === "appearance" ? "active" : ""}`}
                onClick={() => onTabChange("appearance")}
            >
                Appearance
            </button>
        </nav>
    );
}

export default TabBar;