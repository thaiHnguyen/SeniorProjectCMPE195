/**
 * Modal form for creating or editing a threshold profile
 * 
 * Modal will detect:
 *  - profile.id exist -> edit mode ("save changes")
 *  - profile.id undefined -> Create mode ("create profile")
 * 
 * Temperature: the form keeps temp_min/temp_max in °C (what the backend
 * stores), but the inputs show and accept the unit chosen on the Appearance
 * page. Typed values are converted back to °C as you type
 *
 * Prop:
 *  - profile: object with form default
 *  - onSave(formData): called on submit
 *  - onClose: called on cancelled or overlayclicj
 */

import React, {useState} from "react";
import "../styles/profileModal.css";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { toDisplayTemp, toStoredTemp, tempSymbol } from "../utils/units.js";

// °C -> what the input shows in the chosen unit (1 decimal, no trailing zeros)
const toInputTemp = (celsius, unit) =>
    celsius === "" || celsius == null ? "" : Number(toDisplayTemp(Number(celsius), unit).toFixed(1));

function ProfileModal({profile, onSave, onClose}) {
    // Local copy of form data, edit dont effect parent until click save
    const [form, setForm] = useState({...profile});
    const isEdit = !!profile.id;

    const { tempUnit } = useTempUnit();
    // What the two temperature inputs show, in the chosen unit
    const [tempInput, setTempInput] = useState({
        temp_min: toInputTemp(profile.temp_min, tempUnit),
        temp_max: toInputTemp(profile.temp_max, tempUnit),
    });

    // update text field
    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value}));
    };

    // update numeric field ('' for empty, do not allow NaN)
    const updateNumber = (key, value) => {
        setForm((prev) => ({
            ...prev,
            [key]: value=== "" ? "" : Number(value),
        }));
    };

    // Temperature field: show what was typed, store it as °C
    // (rounded to 2 decimals so 70°F saves as 21.11, not 21.111111...)
    const updateTemp = (key, value) => {
        setTempInput((prev) => ({ ...prev, [key]: value }));
        setForm((prev) => ({
            ...prev,
            [key]: value === "" ? "" : Number(toStoredTemp(value, tempUnit).toFixed(2)),
        }));
    };

    const handleSubmit = () => {
        if (!form.name.trim()) return;  //Name is required
        onSave(form);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">
                    {isEdit ? "Edit Profile" : "Create New Profile"}
                </h2>

                {/*Profile name*/}
                <div className="form-group">
                    <label  className="form-label">Profile Name</label>
                    <input className="form-input" type="text"
                        placeholder="e.g, My Garden Setup, Lettuce Garden..."
                        value={form.name}
                        onChange={(e) => updateField("name", e.target.value)}
                    />
                </div>

                {/*optional description*/}
                <div className="form-group">
                    <label className="form-label">Description</label> 
                    <input className="form-input" type="text"
                        placeholder="Description..."
                        value={form.description || ""}
                        onChange={(e) => updateField("description", e.target.value)}
                    />
                </div>

                {/*pH ranges*/}
                <h3 className="range-header ph">pH Range</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Min</label>
                        <input className="form-input" type="number"
                            step="0.1" min="0" max="14"
                            value={form.ph_min}
                            onChange={(e) => updateNumber("ph_min", e.target.value)} 
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Max</label>
                        <input className="form-input" type="number"
                            step="0.1" min="0" max="14"
                            value={form.ph_max}
                            onChange={(e) => updateNumber("ph_max", e.target.value)} 
                        />
                    </div>
                </div>

                {/*Temp Ranges*/}
                <h3 className="range-header temp">Temperature ({tempSymbol(tempUnit)})</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Min</label>
                        <input className="form-input" type="number" step="0.5"
                            value={tempInput.temp_min}
                            onChange={(e) => updateTemp("temp_min", e.target.value)} 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Max</label>
                        <input className="form-input" type="number" step="0.5"
                            value={tempInput.temp_max}
                            onChange={(e) => updateTemp("temp_max", e.target.value)} 
                        />
                    </div>
                </div>

                {/* Humidity Range */}
                <h3 className="range-header hum">Humidity (%)</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Min</label>
                        <input className="form-input" type="number"
                            step="1" min="0" max="100"
                            value={form.humidity_min}
                            onChange={(e) => updateNumber("humidity_min", e.target.value)} 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Max</label>
                        <input className="form-input" type="number"
                            step="1" min="0" max="100"
                            value={form.humidity_max}
                            onChange={(e) => updateNumber("humidity_max", e.target.value)} 
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>
                        Cancel
                    </button>

                    <button className="btn-save" onClick={handleSubmit}>
                        {isEdit ? "Save Changes" : "Create Profile"}
                    </button>
                </div>
            </div>
        </div>

    );
}

export default ProfileModal;