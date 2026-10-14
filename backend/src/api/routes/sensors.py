"""
Sensor data endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime

from backend.src.sensors.sensor_factory import SensorFactory
from backend.src.storage import db_manager
from backend.src.config.settings import settings
from backend.src.utils.logger import logger

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.get("/current")
async def get_current_readings():
    """
    Get current readings from all sensors

    Reads sensors in real-time and stores in database

    Returns:
        Current sensor readings with timestamp
    """
    try:
        # Create sensor manager
        sensor_manager = SensorFactory.get_sensor_manager(
            use_mock=settings.use_mock_sensors
        )

        # Read all sensors
        readings = await sensor_manager.read_all()

        # Store readings in database
        for sensor_type, data in readings.items():
            if data.get("status") == "ok":
                try:
                    await db_manager.insert_sensor_reading(sensor_type, data)
                except Exception as e:
                    logger.error(f"Failed to store {sensor_type} reading: {e}")

        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "data": readings,
        }

    except Exception as e:
        logger.error(f"Error reading sensors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest")
async def get_latest_readings():
    """
    Get latest readings from database

    Returns most recent stored reading from each sensor

    Returns:
        Latest sensor readings from database
    """
    try:
        readings = await db_manager.get_latest_readings()

        return {"status": "success", "count": len(readings), "data": readings}

    except Exception as e:
        logger.error(f"Error getting latest readings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical")
async def get_historical_data(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back (1-168)"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum records to return"),
    sensor_type: Optional[str] = Query(
        None, description="Filter by sensor type (bme280, bme680, ph)"
    ),
):
    """
    Get historical sensor data

    Args:
        hours: Number of hours to look back (default: 24, max: 168/1 week)
        limit: Maximum number of records (default: 1000, max: 10000)
        sensor_type: Optional filter by sensor type

    Returns:
        Historical sensor readings
    """
    try:
        # Validate sensor_type if provided
        if sensor_type and sensor_type not in ["bme280", "bme680", "ph"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid sensor_type. Must be one of: bme280, bme680, ph",
            )

        data = await db_manager.get_historical_data(
            hours=hours, limit=limit, sensor_type=sensor_type
        )

        return {
            "status": "success",
            "count": len(data),
            "hours": hours,
            "sensor_type": sensor_type,
            "data": data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting historical data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_sensor_status():
    """
    Get health status of all sensors

    Returns:
        Status information for each sensor
    """
    try:
        sensor_manager = SensorFactory.get_sensor_manager(
            use_mock=settings.use_mock_sensors
        )

        status = sensor_manager.get_all_status()

        return {
            "status": "success",
            "using_mock": settings.use_mock_sensors,
            "sensors": status,
        }

    except Exception as e:
        logger.error(f"Error getting sensor status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
