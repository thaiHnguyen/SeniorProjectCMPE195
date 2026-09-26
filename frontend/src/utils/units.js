// frontend/src/utils/units.js
/**
 * Temperature unit conversion.
 *
 * The backend stores, evaluates, and alerts in Celsius only. Fahrenheit is a
 * display preference applied at render time, not convert before classifying
 * a reading, or the card and the backend can disagree on a boundary value.
 * Use the *Delta* helpers for anything that is a difference or a span width.
 */


export const CELSIUS = "C";
export const FAHRENHEIT = "F";

/**absolute temperature in C and in F */
export const cToF = (c) => (c*9) / 5 + 32;
export const fToC = (f) => ((f - 32)*5) / 9;

/**temp difference in C: 2C -> 3.6F */
export const cDeltaToF = (d) => (d * 9) / 5;
export const fDeltaToC = (d) => (d * 5) / 9;

/**
 * Convert a stored Celcius value into the unit the user is viewing in sensorCard
 * Return num, unrounded 
 */
export function toDisplayTemp(celsius, unit) {
    return unit === FAHRENHEIT ? cToF(celsius) : celsius;
}
/**
 * Convert a value the user typed back into C for storage
 */
export function toStoredTemp(input, unit) {
    const n = Number(input);
    return unit === FAHRENHEIT ? fToC(n) : n;
}

/** Unit symbol for display: "°F" */
export const tempSymbol = (unit) => (unit === FAHRENHEIT ? "°F" : "°C");

/**
 * Format a stored Celsius value for display.
 * formatTemp(20, "F")  -> "68.00 °F"
 */
export function formatTemp(celsius, unit, digits = 2) {
    const n = Number(celsius);
    if (!Number.isFinite(n)) return "--";
    return `${toDisplayTemp(n, unit).toFixed(digits)} ${tempSymbol(unit)}`;
}

/**
 * Format a stored Celsius range for display.
 * formatTempRange(20, 25, "F") -> "68.0 – 77.0 °F"
 */
export function formatTempRange(loC, hiC, unit, digits = 1) {
    const lo = toDisplayTemp(Number(loC), unit).toFixed(digits);
    const hi = toDisplayTemp(Number(hiC), unit).toFixed(digits);
    return `${lo} – ${hi} ${tempSymbol(unit)}`;
}

