/**
 * Navigation Bar will display
 * - First row: Project Title
 * - Second row:
 *      - Left Side: Device name: <StatusIcon> [Online | Offline]
 *      - Right Side: Latest Update: [Timestamp]
 * 
 * NEW (login): signed-in user's name + Log out button on the title row
 */
import React from "react";
import onlineIcon from "../assets/icons/online.png";
import offlineIcon from "../assets/icons/offline.png";
import darkModeIcon from "../assets/icons/darkmode.png";
import lightModeIcon from "../assets/icons/lightmode.png";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { CELSIUS, FAHRENHEIT } from "../utils/units.js";
import "../styles/typography.css";
import "../styles/navbar.css";

function Navbar({ deviceName, status, lastUpdated, darkMode, onToggleDarkMode, userName, onLogout }) {
  // Unit comes from context rather than props
  const { tempUnit, setTempUnit } = useTempUnit();

  //Determine the status icon based on the connection status
  const statusIcon = status === "online" ? onlineIcon : offlineIcon;
  const statusClass = status === "online" ? "status-online" : "status-offline";

  // Current time for latest update
  const currTime = new Date().toLocaleTimeString();

  return (
    <nav className="navbar">

      {/* TITLE + ACCOUNT (NEW: login) */}
      <div className="nav-top">
        <div className="nav-title">Smart Hydroponic Gardening System</div>

        {onLogout && (
          <div className="nav-account">
            {userName && <span className="nav-user">Hi, {userName}</span>}
            <button type="button" className="nav-logout" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </div>

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