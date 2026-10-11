/**
 * Appearance Page
 *
 * Holds the display preferences that used to sit in the top-right corner
 * of the Navbar:
 *  - Dark / Light theme toggle
 *  - Temperature unit (°C | °F)
 *
 * Both settings come from context, so this page takes no props:
 *  - Theme: ThemeContext sets <html data-theme>, and styles/theme.css
 *    swaps every color variable (saved in localStorage)
 *  - Unit: TempUnitContext, so SensorCard and SensorChart update the
 *    moment the unit changes
 */
import React from "react";
import darkModeIcon from "../assets/icons/darkmode.png";
import lightModeIcon from "../assets/icons/lightmode.png";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { useTheme, DARK } from "../contexts/ThemeContext.jsx";
import { CELSIUS, FAHRENHEIT } from "../utils/units.js";
import "../styles/appearance.css";

function Appearance() {
    const { tempUnit, setTempUnit } = useTempUnit();
    const { theme, toggleTheme } = useTheme();
    const darkMode = theme === DARK;

    return (
        <div className="appearance-page">
            <h2 className="appearance-title">Appearance</h2>

            {/* Row 1: Dark / Light Mode - button shows the mode you'd switch TO */}
            <div className="appearance-row">
                <span className="appearance-label">Theme</span>
                <button type="button" className="theme-toggle" onClick={toggleTheme}>
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