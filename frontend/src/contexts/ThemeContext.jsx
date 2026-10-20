/**
 * Dark / Light theme, shared across the app (same pattern as TempUnitContext).
 *
 * Sets <html data-theme="dark|light">. styles/theme.css defines the color
 * variables for each value, so every component re-colors automatically.
 * Choice is saved in localStorage so it survives a refresh.
 */

import { createContext, useContext, useEffect, useState } from "react";

export const DARK = "dark";
export const LIGHT = "light";
const STORAGE_KEY = "theme";
const ThemeContext = createContext({
    theme: DARK,
    setTheme: () => {},
    toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        // read storage once on mount; default is dark
        let saved = DARK;
        try {
            saved = localStorage.getItem(STORAGE_KEY) === LIGHT ? LIGHT : DARK;
        } catch {
            // storage blocked - keep dark
        }
        // apply before first paint so a saved light theme doesn't flash dark
        document.documentElement.dataset.theme = saved;
        return saved;
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // non-fatal
        }
    }, [theme]);

    const toggleTheme = () => setTheme((t) => (t === DARK ? LIGHT : DARK));

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// The hook lives next to its Provider on purpose. This rule only affects Vite's
// hot-reload during development, not the app itself.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    return useContext(ThemeContext);
}