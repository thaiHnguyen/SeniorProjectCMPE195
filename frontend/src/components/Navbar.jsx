/**
 * Navigation Bar
 *
 * CHANGED (layout): logo, tabs and account now share one row
 *  - Row 1: [Logo] [Dashboard | Settings | Appearance]          [Hi, User] [Log out]
 *  - Row 2: Controller name | <StatusIcon> online/offline | Last update: [time]
 *
 * The logo replaces the "Smart Hydroponic Gardening System" text and follows the
 * theme: Logo_Light.png on the light theme, Logo_dark.png on the dark theme.
 * Clicking the logo reloads the page (the saved login keeps you signed in).
 *
 * Props:
 *  - deviceName, status, lastUpdated: row 2
 *  - activeTab, onTabChange: NEW, tabs are rendered here (App no longer renders TabBar itself)
 *  - userName, onLogout: account area (hidden when onLogout is not passed, e.g. AppDemo)
 */
import React from "react";
import onlineIcon from "../assets/icons/online.png";
import offlineIcon from "../assets/icons/offline.png";
import logoLight from "../assets/Logo_light.png";  
import logoDark from "../assets/Logo_dark.png";     
import { useTheme, LIGHT } from "../contexts/ThemeContext.jsx";
import TabBar from "./TabBar.jsx";   
import "../styles/typography.css";
import "../styles/navbar.css";

function Navbar({ deviceName, status, activeTab, onTabChange, userName, onLogout }) {
  // pick the logo that matches the current theme
  const { theme } = useTheme();
  const logo = theme === LIGHT ? logoLight : logoDark;

  //Determine the status icon based on the connection status
  const statusIcon = status === "online" ? onlineIcon : offlineIcon;
  const statusClass = status === "online" ? "status-online" : "status-offline";

  // Current time for latest update
  const currTime = new Date().toLocaleTimeString();

  return (
    <header className="navbar">

      {/* ROW 1: LOGO + TABS (left) | ACCOUNT (right) */}
      <div className="nav-top">
        {/* logo is a link that reloads the page */}
        <a
          href="/"
          className="nav-logo-link"
          title="Refresh"
          onClick={(e) => {
            e.preventDefault();          // stay on the current URL
            window.location.reload();
          }}
        >
          <img
            src={logo}
            alt="Smart Hydroponic Gardening System"
            className="nav-logo"
          />
        </a>

        {onTabChange && (
          <TabBar activeTab={activeTab} onTabChange={onTabChange} />
        )}

        {onLogout && (
          <div className="nav-account">
            {userName && <span className="nav-user">Hi, {userName}</span>}
            <button type="button" className="nav-logout" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </div>

      {/* ROW 2: CONTROLLER NAME | STATUS | LAST UPDATE */}
      <div className="nav-info">
        {/*NAME OF DEVICE*/}
        <div className="nav-item nav-device">
          <span>{deviceName}</span>
        </div>

        {/* status icon and status of device*/}
        <div className="nav-item">
          <img src={statusIcon} alt="" />
          <span className={statusClass}>{status}</span>
        </div>

        {/*Last Update with timestamp*/}
        <div className="nav-item">
          <span>Last update: {currTime}</span>
        </div>
      </div>
    </header>
  );
}

export default Navbar;