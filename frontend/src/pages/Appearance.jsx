/**
 * Appearance Page
 *
 * Holds the display preferences that used to sit in the top-right corner
 * of the Navbar:
 *  - Dark / Light theme toggle
 *  - Temperature unit (°C | °F)
 *
 * Behavior is unchanged from the Navbar version:
 *  - Theme: darkMode state still lives in App.jsx and is passed in as props
 *    (theme-switching logic to be added later)
 *  - Unit: read/written through TempUnitContext, so SensorCard and
 *    SensorChart update the moment the unit changes
 *
 * Props:
 *  - darkMode: boolean
 *  - onToggleDarkMode: function()
 */
import React from "react";
import darkModeIcon from "../assets/icons/darkmode.png";
import lightModeIcon from "../assets/icons/lightmode.png";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { CELSIUS, FAHRENHEIT } from "../utils/units.js";
import "../styles/appearance.css";

function Appearance({ darkMode, onToggleDarkMode }) {
    // Unit comes from context rather than props (same as before)
    const { tempUnit, setTempUnit } = useTempUnit();

    return (
        <div className="appearance-page">
            {/* Row 1: Dark / Light Mode (moved from Navbar) */}
            <div className="appearance-row">
                <span className="appearance-label">Theme</span>
                <button type="button" className="theme-toggle" onClick={onToggleDarkMode}>
                    <img src={darkMode ? lightModeIcon : darkModeIcon} alt="" />
                    <span>{darkMode ? "Light" : "Dark"}</span>
                </button>
            </div>

            {/* Row 2: Temperature unit, segmented C | F (moved from Navbar) */}
            <div className="appearance-row">
                <span className="appearance-label">Temperature unit</span>
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
                        className={tempUnit === FAHRENHEIT ? "unit-option active" : "unit-option"}
                        onClick={() => setTempUnit(FAHRENHEIT)}
                        aria-pressed={tempUnit === FAHRENHEIT}
                    >
                        °F
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Appearance;