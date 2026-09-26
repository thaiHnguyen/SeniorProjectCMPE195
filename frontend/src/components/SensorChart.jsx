import React, { useState } from "react"; 
import "../styles/sensorChart.css";
import { useTempUnit } from "../contexts/TempUnitContext.jsx";
import { toDisplayTemp, tempSymbol } from "../utils/units.js";

// Suffix for non-temperature metrics; temperature comes from the context
const UNIT_LABEL = { humidity: "%", ph: "" };

function SensorChart({title, metric, data = [], timestamps = []}) {
    const { tempUnit } = useTempUnit();
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState(null);

    const toggleExpand = () => {
        setIsExpanded((prev) => !prev);
    };

    // Convert once, up front. The chart only displays, no threshold logic
    const displayData =
        metric === "temperature" ? data.map((c) => toDisplayTemp(c, tempUnit)) : data;

    const unit = metric === "temperature" ? tempSymbol(tempUnit) : UNIT_LABEL[metric] ?? "";

    // Trim float noise from conversion (82.49000000000001)
    const fmt = (n) => Number(n.toFixed(2));

     // For the chart
    const topPadding = 15;
    const bottomPadding = 15;
    const usableHeight = 100 - topPadding - bottomPadding;

    // only fallback to 0/1 when there are no data at all.
    const maxValue = displayData.length ? Math.max(...displayData) : 1;
    const minValue = displayData.length ? Math.min(...displayData) : 0;
    const range = maxValue - minValue || 1;

    // shared value -> y% mapping
    const getY = (value) => topPadding + (1 - (value - minValue) / range) * usableHeight;

    const points = displayData.map((value, index) => {
        const x = (index / (displayData.length - 1 || 1)) * 100;
        return {x, y: getY(value), value, timestamp: timestamps[index] };
    });

    // evenly spaced tick value across actual data range
    const tickCount = 4; //for 5 gridlines total
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
        const value = minValue + (range * i ) / tickCount;
        return {value: Math.round(value * 10) / 10, y: getY(value)};
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");

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

            <div className="sensor-chart-body">
                {/* axis label column, rendered as HTML (not SVG) so text
                    doesn't get stretched by preserveAspectRatio="none" */}
                <div className="chart-axis-labels">
                    {ticks.map((ticks, i) => (
                        <span key={i} className="axis-label" style= {{top: `${ticks.y}%` }}>
                            {ticks.value}{unit}
                        </span>
                    ))}
                </div>
            
            {/*wrapper so tooltip %-positioning stays relative to just the plot area*/}
            <div className="chart-plot-area">
                <svg 
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="chart-svg"
                >
                    {/*gridline that will sit ontop */}
                    {ticks.map((ticks, i) => (
                        <line
                            key = {i}
                            x1="0" y1={ticks.y}
                            x2="100" y2={ticks.y}
                            className="chart-gridline"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}

                    {/*Line chart*/}
                    <polyline
                        fill = "none"
                        stroke = "currentColor"
                        strokeWidth="2"
                        points={polylinePoints}
                        vectorEffect="non-scaling-stroke"
                    />

                    {/*Invinsible hover points*/}
                    {points.map((points, index) => (
                        <circle
                            key={index}
                            cx={points.x}
                            cy={points.y}
                            r="3"
                            fill="currentColor"
                            opacity={hoveredPoint === index ? 1 : 0}
                            onMouseEnter={(e) => {
                                e.stopPropagation();
                                setHoveredPoint(index);
                            }}
                            onMouseLeave={(e) => {
                                e.stopPropagation();
                                setHoveredPoint(null);
                            }}
                            style={{cursor: 'pointer'}}
                        />
                    ))}
                </svg>
                
            </div>
                {/* Tooltip */}
                {hoveredPoint !== null && (
                    <div 
                        className="chart-tooltip"
                        style={{
                            left: `${points[hoveredPoint].x}%`,
                            top: `${points[hoveredPoint].y}%`
                        }}
                    >
                        <div className="tooltip-value">
                            {fmt(points[hoveredPoint].value)}{unit}
                        </div>
                        <div className="tooltip-timestamp">
                            {formatTimestamp(points[hoveredPoint].timestamp)}
                        </div>
                    </div>
                )}
            </div>

            <div className="sensor-chart-footer">
                <span>Min: {fmt(minValue)}{unit}</span>
                <span>Max: {fmt(maxValue)}{unit}</span>
            </div>
        </div>
    );
} 

export default SensorChart;