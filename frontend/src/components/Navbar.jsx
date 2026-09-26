/**
 * Navigation Bar will display
 * - Top right: Dark/Light mode toggle button
 * - First row: Project Title
 * - Second row:
 *      - Left Side: Device name: <StatusIcon> [Online | Offline]
 *      - Right Side: Latest Update: [Timestamp]
 */
import React from "react";
import onlineIcon from "../assets/icons/online.png";
import offlineIcon from "../assets/icons/offline.png";
import darkModeIcon from "../assets/icons/darkmode.png";
import lightModeIcon from "../assets/icons/lightmode.png";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { CELSIUS, FAHREINHEIT } from "../utils/units.js";
import "../styles/typography.css";
import "../styles/navbar.css";

function Navbar({ deviceName, status, lastUpdated, darkMode, onToggleDarkMode, }) {
  // Unit comes from context rather than props
  const { tempUnit, setTempUnit } = useTempUnit();

  //Determine the status icon based on the connection status
  const statusIcon = status === "online" ? onlineIcon : offlineIcon;
  const statusClass = status === "online" ? "status-online" : "status-offline";

  // Current time for latest update
  const currTime = new Date().toLocaleTimeString();

  return (
    <nav className="navbar">
      {/* Top-right controls */}
      <div className="nav-actions">

        {/* Temperature unit: segmented C | F */}
        <div className="unit-toggle" role="group" aria-label="Temperature unit">
          <button
            type="button"
            className={tempUnit === CELSIUS ? "unit-option active" : "unit-option"}
            onClick={() => setTempUnit(CELSIUS)}
            aria-pressed={tempUnit === CELSIUS}
          >
            °C
          </button>
          <button
            type="button"
            className={tempUnit === FAHREINHEIT ? "unit-option active" : "unit-option"}
            onClick={() => setTempUnit(FAHREINHEIT)}
            aria-pressed={tempUnit === FAHREINHEIT}
          >
            °F
          </button>
        </div>

        {/* Dark / Light Mode */}
        <button className="theme-toggle" onClick={onToggleDarkMode}>
          <img src={darkMode ? lightModeIcon : darkModeIcon} alt="" />
          <span>{darkMode ? "Light" : "Dark"}</span>
        </button>
      </div>

      {/* TITLE */}
      <div className="nav-title">Smart Hydroponic Gardening System</div>

      {/* INFO */}
      <div className="nav-info">
        {/*NAME OF DEVICE*/}
        <div className="nav-item">
          <span>{deviceName}</span>
        </div>

        {/* status icon and status of device*/}
        <div className="nav-item">
          <img src={statusIcon} alt={status} />
          <span className={statusClass}>{status}</span>
        </div>

        {/*Last Update with timestamp*/}
        <div className="nav-item">
          <span>Last update: {currTime}</span>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
