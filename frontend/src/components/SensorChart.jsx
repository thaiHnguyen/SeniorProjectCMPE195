import React, { useMemo, useState } from "react";
import "../styles/sensorChart.css";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { toDisplayTemp, tempSymbol } from "../utils/units.js";

// Suffix for non-temperature metrics; temperature comes from the context
const UNIT_LABEL = { humidity: "%", ph: "" };

// Chart vertical padding (in viewBox %)
const TOP_PADDING = 15;
const BOTTOM_PADDING = 15;
const USABLE_HEIGHT = 100 - TOP_PADDING - BOTTOM_PADDING;
const TICK_COUNT = 4; // 5 gridlines total

// NEW: x-axis time labels
const CHART_TIME_ZONE = "America/Los_Angeles";
const HOUR_MS = 60 * 60 * 1000;
// Roughly how many time labels to show in each view
const X_LABEL_TARGET = { collapsed: 4, expanded: 12 };
// Allowed spacing between labels (hours); smallest one that fits the target wins
const HOUR_STEPS = [1, 2, 3, 4, 6, 12, 24];

// Backend sends "YYYY-MM-DD HH:MM:SS" in UTC -> epoch ms
const parseUtc = (timestamp) =>
    timestamp ? new Date(timestamp.replace(" ", "T") + "Z").getTime() : NaN;

// Hour of day (0-23) in the chart's time zone, used to land labels on 12 AM, 6 AM, etc.
const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TIME_ZONE, hour: "2-digit", hourCycle: "h23",
});
const labelHourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TIME_ZONE, hour: "numeric",
});
const labelDateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TIME_ZONE, month: "short", day: "numeric",
});

function SensorChart({title, metric, data = [], timestamps = []}) {
    const { tempUnit } = useTempUnit();
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState(null);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    const unit = metric === "temperature" ? tempSymbol(tempUnit) : UNIT_LABEL[metric] ?? "";

    // Trim float noise from conversion (82.49000000000001)
    const fmt = (n) => Number(n.toFixed(2));

    // CHANGED: all chart math is memoized so hovering (which re-renders on every
    // index change) doesn't recompute ~2,880 points + the polyline string each time.
    // Only recalculates when the data, timestamps, metric, or °C/°F setting change.
    const chart = useMemo(() => {
        // Convert once, up front. The chart only displays, no threshold logic
        const displayData =
            metric === "temperature" ? data.map((c) => toDisplayTemp(c, tempUnit)) : data;

        const hasData = displayData.length > 0;

        // only fallback to 0/1 when there are no data at all.
        const maxValue = hasData ? Math.max(...displayData) : 1;
        const minValue = hasData ? Math.min(...displayData) : 0;
        const range = maxValue - minValue || 1;

        // Average of the exact points plotted (already in the chosen unit)
        const avgValue = hasData
            ? displayData.reduce((sum, v) => sum + v, 0) / displayData.length
            : null;

        // shared value -> y% mapping
        const getY = (value) => TOP_PADDING + (1 - (value - minValue) / range) * USABLE_HEIGHT;

        // Points are evenly spaced by index across 0–100% width
        const points = displayData.map((value, index) => {
            const x = (index / (displayData.length - 1 || 1)) * 100;
            return { x, y: getY(value), value, timestamp: timestamps[index] };
        });

        // evenly spaced tick value across actual data range
        const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
            const value = minValue + (range * i) / TICK_COUNT;
            return { value: Math.round(value * 10) / 10, y: getY(value) };
        });

        const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

        // NEW: find where the data crosses each whole hour.
        // LA is offset from UTC by whole hours, so a change in the UTC hour
        // number is also an hour boundary locally.
        const hourMarks = [];
        let prevHour = null;
        points.forEach((p) => {
            const ms = parseUtc(p.timestamp);
            if (Number.isNaN(ms)) return;
            const hourNum = Math.floor(ms / HOUR_MS);
            if (prevHour !== null && hourNum !== prevHour) {
                const boundary = new Date(hourNum * HOUR_MS);
                const localHour = Number(hourFormatter.format(boundary));
                hourMarks.push({
                    x: p.x,
                    localHour,
                    // Midnight include  the date; other hours show "6 AM"
                    label: localHour === 0
                        ? labelDateFormatter.format(boundary)
                        : labelHourFormatter.format(boundary),
                });
            }
            prevHour = hourNum;
        });

        // Hours covered by the data, used to pick label spacing
        const spanHours = timestamps.length > 1
            ? (parseUtc(timestamps[timestamps.length - 1]) - parseUtc(timestamps[0])) / HOUR_MS
            : 0;

        return {
            hasData, minValue, maxValue, avgValue, points, ticks, polylinePoints,
            hourMarks, spanHours,
            // time span the plotted data actually covers (oldest -> newest)
            rangeStart: timestamps[0],
            rangeEnd: timestamps[timestamps.length - 1],
        };
    }, [data, timestamps, metric, tempUnit]);

    const { hasData, minValue, maxValue, avgValue, points, ticks, polylinePoints,
            hourMarks, spanHours, rangeStart, rangeEnd } = chart;

    // NEW: pick which hour marks to label. Collapsed = few labels, expanded = more.
    // Step adapts to the data span, so 2h of data still gets labels, not just 24h.
    const xTicks = useMemo(() => {
        const target = isExpanded ? X_LABEL_TARGET.expanded : X_LABEL_TARGET.collapsed;
        const step = HOUR_STEPS.find((s) => spanHours / s <= target) ?? 24;
        return hourMarks.filter((m) => m.localHour % step === 0);
    }, [hourMarks, spanHours, isExpanded]);

    // NEW: one handler replaces ~2,880 invisible <circle> elements.
    // Points are evenly spaced, so the cursor's horizontal position maps
    // directly to the nearest index — exact, and the dot lands under the cursor.
    const handleMouseMove = (e) => {
        if (!points.length) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        // React skips the re-render when the index hasn't changed
        setHoveredPoint(Math.round(frac * (points.length - 1)));
    };

    const handleMouseLeave = () => setHoveredPoint(null);

    // Format timestamp for display
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "";

        // Backend sends "YYYY-MM-DD HH:MM:SS" format in UTC
        // Convert to ISO format and append 'Z' to indicate UTC
        const utcTimestamp = timestamp.replace(' ', 'T') + 'Z';
        const date = new Date(utcTimestamp);

        return date.toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const hovered = hoveredPoint !== null ? points[hoveredPoint] : null;

    return (
        <div className={`sensor-chart-card ${isExpanded ? "expanded" : ""}`}
                onClick={toggleExpand}
        >
            <div className="sensor-chart-header">
                <h3>{title}</h3>
                <span className="expand-hint">
                    {isExpanded ? "Click to collapse" : "Click to expand"}
                </span>
            </div>

            {/* Row holding the summary panel (expanded only) + the chart */}
            <div className="sensor-chart-content">
                {/* Summary panel, hidden when collapsed */}
                {isExpanded && (
                    <aside className="chart-summary">
                        <div className="summary-avg">
                            {hasData ? `${fmt(avgValue)}${unit}` : "--"}
                        </div>
                        <div className="summary-label">Average · Last 24h</div>
                        {hasData && (
                            <div className="summary-range">
                                {formatTimestamp(rangeStart)} – {formatTimestamp(rangeEnd)}
                            </div>
                        )}
                        <div className="summary-minmax">
                            {hasData
                                ? `Min: ${fmt(minValue)}${unit} - Max: ${fmt(maxValue)}${unit}`
                                : "No data"}
                        </div>
                    </aside>
                )}

                <div className="sensor-chart-body">
                    {/* axis label column, rendered as HTML (not SVG) so text
                        doesn't get stretched by preserveAspectRatio="none" */}
                    <div className="chart-axis-labels">
                        {ticks.map((tick, i) => (
                            <span key={i} className="axis-label" style={{ top: `${tick.y}%` }}>
                                {tick.value}{unit}
                            </span>
                        ))}
                    </div>

                    {/* CHANGED: mouse handlers live on the plot area itself, and the
                        tooltip is inside it, so dot, tooltip and cursor share the
                        same coordinate box (previously the tooltip was offset by
                        the axis-label column). */}
                    <div
                        className="chart-plot-area"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            className="chart-svg"
                        >
                            {/* gridlines */}
                            {ticks.map((tick, i) => (
                                <line
                                    key={i}
                                    x1="0" y1={tick.y}
                                    x2="100" y2={tick.y}
                                    className="chart-gridline"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}

                            {/* NEW: faint vertical gridline at each labeled hour */}
                            {xTicks.map((tick, i) => (
                                <line
                                    key={`x-${i}`}
                                    x1={tick.x} y1="0"
                                    x2={tick.x} y2="100"
                                    className="chart-gridline chart-gridline-x"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}

                            {/* Line chart */}
                            <polyline
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                points={polylinePoints}
                                vectorEffect="non-scaling-stroke"
                            />
                            {/* REMOVED: one invisible <circle> per point (caused lag
                                and stretched, overlapping hit areas) */}
                        </svg>

                        {/* NEW: x-axis time labels. Inside the plot area so their
                            x% lines up exactly with the data points. HTML (not SVG)
                            so text isn't stretched. Edge labels are aligned inward
                            so they don't get clipped. */}
                        <div className="chart-x-labels">
                            {xTicks.map((tick, i) => (
                                <span
                                    key={i}
                                    className={`x-label ${
                                        tick.x < 4 ? "edge-left" : tick.x > 96 ? "edge-right" : ""
                                    } ${tick.localHour === 0 ? "x-label-day" : ""}`}
                                    style={{ left: `${tick.x}%` }}
                                >
                                    {tick.label}
                                </span>
                            ))}
                        </div>

                        {/* Hover dot: HTML so it stays a perfect circle at any chart size */}
                        {hovered && (
                            <span
                                className="chart-hover-dot"
                                style={{ left: `${hovered.x}%`, top: `${hovered.y}%` }}
                            />
                        )}

                        {/* Tooltip (moved inside the plot area) */}
                        {hovered && (
                            <div
                                className="chart-tooltip"
                                style={{ left: `${hovered.x}%`, top: `${hovered.y}%` }}
                            >
                                <div className="tooltip-value">
                                    {fmt(hovered.value)}{unit}
                                </div>
                                <div className="tooltip-timestamp">
                                    {formatTimestamp(hovered.timestamp)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Collapsed view keeps the compact footer;
                expanded view shows Min/Max in the summary panel instead */}
            {!isExpanded && (
                <div className="sensor-chart-footer">
                    <span>Min: {fmt(minValue)}{unit}</span>
                    <span>Max: {fmt(maxValue)}{unit}</span>
                </div>
            )}
        </div>
    );
}

export default SensorChart;