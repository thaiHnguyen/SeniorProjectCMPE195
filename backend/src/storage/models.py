"""
Pydantic models for request/response validation

THRESHOLD CONFIGURATIONS:
These models support flexible configuration strategies:
    - Plant-centric: name="Lettuce", description="For leafy greens"
    - System-centric: name="My Indoor Garden", description="Basement setup"
    - Hybrid: name="Custom Lettuce", description="Based on lettuce template"
"""

# CHANGED: Pydantic v2 API (field_validator and ConfigDict replace the deprecated v1 versions)
from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from typing import Optional, List
from datetime import datetime


# ==================== SENSOR READING MODELS ====================


class SensorReading(BaseModel):
    """Base sensor reading model"""

    sensor_type: str
    timestamp: datetime = Field(default_factory=datetime.now)


class BME280Reading(SensorReading):
    """BME280 sensor reading"""

    sensor_type: str = "bme280"
    temperature: float
    humidity: float
    pressure: float


class BME680Reading(SensorReading):
    """BME680 sensor reading"""

    sensor_type: str = "bme680"
    temperature: float
    humidity: float
    pressure: float
    gas_resistance: int
    air_quality: str
    aqi_score: int  # NEW: 1 Good, 2 Moderate, 3 Poor, 4 Unhealthy


class PHReading(SensorReading):
    """pH sensor reading"""

    sensor_type: str = "ph"
    ph: float

    @field_validator("ph")
    @classmethod
    def validate_ph(cls, v):
        if not 0 <= v <= 14:
            raise ValueError("pH must be between 0 and 14")
        return v


# ==================== THRESHOLD CONFIGURATION MODELS ====================
#
# These models represent alert threshold configurations.
# They are intentionally generic to support multiple use cases:
#
# USE CASE 1: Plant-Specific Profiles
#   name = "Lettuce"
#   description = "Optimal ranges for lettuce cultivation"
#
# USE CASE 2: Custom System Settings
#   name = "My Greenhouse Setup"
#   description = "Custom ranges for mixed crop greenhouse"
#
# USE CASE 3: Environmental Presets
#   name = "Summer Configuration"
#   description = "Adjusted for high ambient temperatures"


class ThresholdConfigurationBase(BaseModel):
    """
    Base threshold configuration

    Can represent plant profiles, system settings, or environmental presets.
    Name and description fields allow flexible interpretation.
    """

    name: str = Field(
        ..., description="Configuration name (e.g., 'Lettuce' or 'My Indoor Setup')"
    )
    description: Optional[str] = Field(
        None, description="Optional details about this configuration's purpose"
    )

    # pH thresholds
    ph_min: float = Field(ge=0, le=14, description="Minimum acceptable pH")
    ph_max: float = Field(ge=0, le=14, description="Maximum acceptable pH")

    # Temperature thresholds (Celsius)
    temp_min: float = Field(description="Minimum acceptable temperature (°C)")
    temp_max: float = Field(description="Maximum acceptable temperature (°C)")

    # Humidity thresholds (percentage)
    humidity_min: float = Field(
        ge=0, le=100, description="Minimum acceptable humidity (%)"
    )
    humidity_max: float = Field(
        ge=0, le=100, description="Maximum acceptable humidity (%)"
    )

    # NEW: Air pressure thresholds (hPa, BME680).
    # Defaults keep older clients (that don't send these yet) working.
    pressure_min: float = Field(
        990, ge=300, le=1100, description="Minimum acceptable air pressure (hPa)"
    )
    pressure_max: float = Field(
        1030, ge=300, le=1100, description="Maximum acceptable air pressure (hPa)"
    )

    # NEW: Air quality score thresholds (BME680; 1 Good ... 4 Unhealthy)
    aqi_min: float = Field(1, ge=1, le=4, description="Minimum acceptable air quality score")
    aqi_max: float = Field(2, ge=1, le=4, description="Maximum acceptable air quality score")

    @field_validator("ph_max")
    @classmethod
    def validate_ph_range(cls, v, info: ValidationInfo):
        # info.data holds fields already validated (declared above this one)
        if "ph_min" in info.data and v < info.data["ph_min"]:
            raise ValueError("ph_max must be >= ph_min")
        return v

    @field_validator("temp_max")
    @classmethod
    def validate_temp_range(cls, v, info: ValidationInfo):
        # info.data holds fields already validated (declared above this one)
        if "temp_min" in info.data and v < info.data["temp_min"]:
            raise ValueError("temp_max must be >= temp_min")
        return v

    @field_validator("humidity_max")
    @classmethod
    def validate_humidity_range(cls, v, info: ValidationInfo):
        # info.data holds fields already validated (declared above this one)
        if "humidity_min" in info.data and v < info.data["humidity_min"]:
            raise ValueError("humidity_max must be >= humidity_min")
        return v

    # NEW
    @field_validator("pressure_max")
    @classmethod
    def validate_pressure_range(cls, v, info: ValidationInfo):
        # info.data holds fields already validated (declared above this one)
        if "pressure_min" in info.data and v < info.data["pressure_min"]:
            raise ValueError("pressure_max must be >= pressure_min")
        return v

    # NEW
    @field_validator("aqi_max")
    @classmethod
    def validate_aqi_range(cls, v, info: ValidationInfo):
        # info.data holds fields already validated (declared above this one)
        if "aqi_min" in info.data and v < info.data["aqi_min"]:
            raise ValueError("aqi_max must be >= aqi_min")
        return v


class ThresholdConfigurationCreate(ThresholdConfigurationBase):
    """
    Create a new threshold configuration

    Examples:
        - Plant-based: {"name": "Tomato", "description": "For tomato plants", ...}
        - System-based: {"name": "Main Reservoir", "description": "Indoor setup", ...}
    """

    pass


class ThresholdConfigurationUpdate(BaseModel):
    """Update threshold configuration (all fields optional)"""

    name: Optional[str] = None
    description: Optional[str] = None
    ph_min: Optional[float] = Field(None, ge=0, le=14)
    ph_max: Optional[float] = Field(None, ge=0, le=14)
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    humidity_min: Optional[float] = Field(None, ge=0, le=100)
    humidity_max: Optional[float] = Field(None, ge=0, le=100)

    pressure_min: Optional[float] = Field(None, ge=300, le=1100)  # NEW
    pressure_max: Optional[float] = Field(None, ge=300, le=1100)  # NEW
    aqi_min: Optional[float] = Field(None, ge=1, le=4)            # NEW
    aqi_max: Optional[float] = Field(None, ge=1, le=4)            # NEW

    is_active: Optional[bool] = None


class ThresholdConfiguration(ThresholdConfigurationBase):
    """
    Threshold configuration from database

    The active configuration (is_active=True) determines alert thresholds.
    """

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True) 


# ALERT MODELS 
class AlertCreate(BaseModel):
    """Create alert"""
    alert_type: str
    sensor_type: Optional[str] = None
    message: str
    # CHANGED: same names as AlertEvaluator / SensorCard (was info|warning|critical)
    severity: str = Field(default="warning", pattern="^(normal|warning|danger)$")
    reading_value: Optional[float] = None
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None

class Alert(AlertCreate):
    """Alert from database"""

    id: int
    is_read: bool
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

#  RESPONSE MODELS 
class SensorReadingsResponse(BaseModel):
    """Response with sensor readings"""
    status: str = "success"
    timestamp: datetime = Field(default_factory=datetime.now)
    data: dict


class MessageResponse(BaseModel):
    """Generic message response"""
    status: str
    message: str

class HistoricalDataResponse(BaseModel):
    """Response with historical data"""
    status: str = "success"
    count: int
    data: List[dict]
