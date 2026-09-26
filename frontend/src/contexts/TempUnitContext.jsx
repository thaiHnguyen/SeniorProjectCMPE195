/**
 * Temperature display unit (C or F), shared across the app.
 *
 * This is a display preference only, all values in state and in the API
 * are Celsius. Components convert at render time via utils/units.js
 */

import { createContext, useContext, useEffect, useState } from "react";
import { CELSIUS, FAHRENHEIT } from "../utils/units";

const STORAGE_KEY = "tempUnit";

const TempUnitContext = createContext({
    tempUnit: CELSIUS,
    setTempUnit: () => {},
    toggleTempUnit: () => {},
});

export function TempUnitProvider({children}) {
    const [tempUnit, setTempUnit] = useState(() => {
        // read storage once on mount, not every render
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved === FAHRENHEIT ? FAHRENHEIT : CELSIUS;
        }
        catch {
            return CELSIUS;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, tempUnit);
        } 
        catch {
            // non-fatal 
        }
    }, [tempUnit]);

    const toggleTempUnit = () => setTempUnit((u) => (u === CELSIUS ? FAHRENHEIT : CELSIUS));

    return (
        <TempUnitContext.Provider
            value={{ tempUnit, setTempUnit, toggleTempUnit }}
        >
            {children}
        </TempUnitContext.Provider>
    );
}

export function useTempUnit() {
    return useContext(TempUnitContext);
}