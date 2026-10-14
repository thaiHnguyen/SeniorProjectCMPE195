-- Smart Hydroponic System Database Schema
-- 
-- DESIGN PHILOSOPHY:
-- Threshold configurations are flexible and can represent:
--   1. Plant-specific profiles (e.g., "Lettuce", "Tomato")
--   2. System-specific settings (e.g., "My Greenhouse Setup")
--   3. Environmental presets (e.g., "Summer Configuration")
-- Users can use provided templates or create custom configurations.

-- SENSOR READINGS
CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_type TEXT NOT NULL,
    temperature REAL,
    humidity REAL,
    pressure REAL,
    gas_resistance INTEGER,
    air_quality TEXT,
    aqi_score INTEGER,      -- BME680 air quality score: 1 Good, 2 Moderate, 3 Poor, 4 Unhealthy
    ph REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK(sensor_type IN ('bme280', 'bme680', 'ph'))
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp 
ON sensor_readings(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_type 
ON sensor_readings(sensor_type, timestamp DESC);


-- ============================================================
-- THRESHOLD CONFIGURATIONS
-- ============================================================
-- Flexible threshold profiles that can represent:
--   - Plant types (Lettuce, Tomato, Basil)
--   - Custom system setups (My Indoor Garden, Greenhouse A)
--   - Environmental presets (Summer, Winter, Optimal)
-- Only one configuration can be active at a time.
CREATE TABLE IF NOT EXISTS threshold_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,  -- Optional: describe what this configuration is for
    
    -- pH thresholds
    ph_min REAL NOT NULL,
    ph_max REAL NOT NULL,
    
    -- Temperature thresholds (Celsius)
    temp_min REAL NOT NULL,
    temp_max REAL NOT NULL,
    
    -- Humidity thresholds (percentage)
    humidity_min REAL NOT NULL,
    humidity_max REAL NOT NULL,

    -- Air pressure thresholds (hPa, BME680). Defaults let older inserts still work
    pressure_min REAL NOT NULL DEFAULT 990,
    pressure_max REAL NOT NULL DEFAULT 1030,

    -- Air quality score thresholds (1-4, BME680; lower is better)
    aqi_min REAL NOT NULL DEFAULT 1,
    aqi_max REAL NOT NULL DEFAULT 2,
    
    -- Only one configuration is active at a time
    is_active BOOLEAN DEFAULT 0,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Validation constraints
    CHECK(ph_min >= 0 AND ph_min <= 14),
    CHECK(ph_max >= 0 AND ph_max <= 14),
    CHECK(ph_min <= ph_max),
    CHECK(temp_min <= temp_max),
    CHECK(humidity_min >= 0 AND humidity_min <= 100),
    CHECK(humidity_max >= 0 AND humidity_max <= 100),
    CHECK(humidity_min <= humidity_max),
    CHECK(pressure_min <= pressure_max),
    CHECK(aqi_min >= 1 AND aqi_min <= 4),
    CHECK(aqi_max >= 1 AND aqi_max <= 4),
    CHECK(aqi_min <= aqi_max)
);

-- Ensure only one active configuration at a time
CREATE TRIGGER IF NOT EXISTS one_active_configuration
BEFORE UPDATE OF is_active ON threshold_configurations
WHEN NEW.is_active = 1
BEGIN
    UPDATE threshold_configurations SET is_active = 0 WHERE id != NEW.id;
END;


-- ALERTS
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,
    sensor_type TEXT,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    reading_value REAL,
    threshold_min REAL,
    threshold_max REAL,
    is_read BOOLEAN DEFAULT 0,
    is_resolved BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    
    -- CHANGED: matches the dashboard states (was info / warning / critical).
    -- db_manager rebuilds an older alerts table and renames its rows on startup.
    CHECK(severity IN ('normal', 'warning', 'danger'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_unread 
ON alerts(is_read, created_at DESC);

-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- DEFAULT CONFIGURATIONS
-- ============================================================
-- Pre-loaded configurations serve as examples and starting points.
-- Users can:
--   1. Use these as-is for common plants
--   2. Clone and modify them for their specific system
--   3. Create entirely custom configurations from scratch

-- CATEGORY: General Hydroponic Presets
-- Use these for typical hydroponic setups or as starting templates
INSERT OR IGNORE INTO threshold_configurations 
(name, description, ph_min, ph_max, temp_min, temp_max, humidity_min, humidity_max, is_active) 
VALUES
    ('Standard Hydroponic Range', 
        'Balanced settings suitable for most hydroponic systems and leafy greens', 
        5.8, 6.5, 20, 25, 55, 70, 1),
    
    ('Wide Tolerance Range', 
        'Broader ranges for mixed crops or experimental setups', 
        5.5, 7.0, 18, 28, 50, 80, 0),
    
    ('Precision Control', 
        'Narrow ranges for optimal, controlled growing conditions', 
        6.0, 6.5, 21, 24, 58, 68, 0);


-- CATEGORY: Climate-Based Presets
-- Use these based on your growing environment
INSERT OR IGNORE INTO threshold_configurations 
(name, description, ph_min, ph_max, temp_min, temp_max, humidity_min, humidity_max, is_active) 
VALUES
    ('Warm Climate / Summer', 
        'Optimized for warmer environments (greenhouses, summer months)', 
        5.5, 6.5, 22, 28, 60, 80, 0),
    
    ('Cool Climate / Winter', 
        'Optimized for cooler environments (basements, winter months)', 
        6.0, 6.8, 18, 23, 50, 65, 0);


-- CATEGORY: Plant-Specific Templates (Optional)
-- Use these if growing specific plant types
-- Feel free to customize these values for your specific system
INSERT OR IGNORE INTO threshold_configurations 
(name, description, ph_min, ph_max, temp_min, temp_max, humidity_min, humidity_max, is_active) 
VALUES
    ('Lettuce', 
        'Optimal ranges for lettuce and similar leafy greens', 
        5.5, 6.5, 18, 24, 50, 70, 0),
    
    ('Tomato', 
        'Optimal ranges for tomatoes and fruiting plants', 
        5.5, 6.5, 20, 27, 60, 80, 0),
    
    ('Basil', 
        'Optimal ranges for basil and culinary herbs', 
        5.5, 6.5, 20, 25, 40, 60, 0),
    
    ('Spinach', 
        'Optimal ranges for spinach', 
        6.0, 7.0, 15, 21, 50, 60, 0),
    
    ('Strawberry', 
        'Optimal ranges for strawberries', 
        5.5, 6.5, 18, 24, 60, 80, 0);


-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('sensor_read_interval', '60', 'How often to read sensors (seconds)'),
    ('alert_cooldown', '300', 'Minimum time between duplicate alerts (seconds)'),
    ('data_retention_days', '30', 'How long to keep sensor readings (days)'),
    ('system_name', 'My Hydroponic System', 'User-defined name for this system');


-- ============================================================
-- NOTES FOR DEVELOPERS
-- ============================================================
-- 
-- USING THRESHOLD CONFIGURATIONS:
-- 
-- Option 1 - Plant-Specific:
--   User growing lettuce activates "Lettuce" configuration
--   System alerts when readings fall outside lettuce's optimal ranges
-- 
-- Option 2 - System-Specific:
--   User creates "My Basement Setup" with custom ranges
--   System alerts based on their specific environment
-- 
-- Option 3 - Hybrid:
--   User starts with "Lettuce" template
--   Clones and modifies to "My Lettuce System" with custom tweaks
--   Both configurations remain in database for comparison
-- 
-- The active configuration (is_active = 1) determines alert thresholds
-- regardless of whether it's plant-based or system-based.