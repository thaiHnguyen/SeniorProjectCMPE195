/**
 * ProfileCard to display threshold profile: 
 *  - name, badge, theshold, action
 * 
 * Props:
 *  - profile: {id, name, description, ph_min, ph_max, temp_min, temp_max
 *              humidity_min, humidity_max,
 *              pressure_min, pressure_max, aqi_min, aqi_max,   <- NEW (from BME680)
 *              is_active}
 *  - onEdit(profile)
 *  - onDuplicate(profile)
 *  - onUse(profile)
 *  - onDelete(profile)
 */

import React from "react";
import "../styles/profileCard.css";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { toDisplayTemp, tempSymbol } from "../utils/units.js";

// Stored °C -> chosen unit, max 1 decimal, no trailing zeros (68, 68.5)
const fmtTemp = (celsius, unit) => Number(toDisplayTemp(Number(celsius), unit).toFixed(1));

function ProfileCard({profile, onEdit, onDuplicate, onUse, onDelete}) {
    // Profiles are stored in °C; only the display follows the Appearance setting
    const { tempUnit } = useTempUnit();

    return (
        <div className={`profile-card ${profile.is_active ? "active-profile" : ""}`}>
            {/*Top Row: Name + actions */}
            <div className="profile-top">
                <div className="profile-info">
                    <div className="profile-name-row">
                        <span className="profile-name">{profile.name}</span>

                        {/* Active badge for in-used profile */}
                        {!!profile.is_active && (
                            <span className="active-badge">In Use</span>
                        )}
                    </div>

                    {profile.description && (
                        <p className="profile-desc">{profile.description}</p>
                    )}
                </div>

                {/*Action button*/}
                <div className="profile-actions">
                    <button className="action-btn" title="Edit" 
                        onClick={() => onEdit(profile)}>
                        Edit
                    </button>
                
                    <button className="action-btn" title="Duplicate"
                        onClick={() => onDuplicate(profile)}>
                        Duplicate
                    </button>

                    {/*Apply - hidden if already in used */}
                    {!profile.is_active && (
                        <button className="action-btn apply" title="Use this profile"
                            onClick={() => onUse(profile)}>
                            Use
                        </button>
                    )}

                    {/*Delete - hidden if in used*/}
                    {!profile.is_active && (
                        <button className="action-btn danger" title="Delete"
                            onClick={() => onDelete(profile)}>
                            Delete
                        </button>
                    )}
                </div>
            </div>
            
            {/*Threshold ranges*/}
            <div className="threshold-gird">
                <div className="threshold-item ph">
                    <div className="threshold-label">pH</div>
                    <div className="threshold-range">{profile.ph_min} - {profile.ph_max}</div>
                </div>

                <div className="threshold-item temp">
                    <div className="threshold-label">Temperature</div>
                    <div className="threshold-range">
                        {fmtTemp(profile.temp_min, tempUnit)}° – {fmtTemp(profile.temp_max, tempUnit)}{tempSymbol(tempUnit)}
                    </div>
                </div>

                <div className="threshold-item hum">
                    <div className="threshold-label">Humidity</div>
                    <div className="threshold-range">{profile.humidity_min} - {profile.humidity_max}%</div>
                </div>

                {/* NEW: air pressure from BME680 thresholds ("--" if an older backend doesn't send them) */}
                <div className="threshold-item pressure">
                    <div className="threshold-label">Air Pressure</div>
                    <div className="threshold-range">
                        {profile.pressure_min ?? "--"} - {profile.pressure_max ?? "--"} hPa
                    </div>
                </div>

                <div className="threshold-item aqi">
                    <div className="threshold-label">Air Quality Score</div>
                    <div className="threshold-range">{profile.aqi_min ?? "--"} - {profile.aqi_max ?? "--"}</div>
                </div>
            </div>
        </div>
    );

}

export default ProfileCard;