"""
Health check and system status endpoints
"""

from fastapi import APIRouter, Depends
from datetime import datetime

from backend.src.config.settings import settings 
from backend.src.sensors.sensor_factory import SensorFactory
from backend.src.storage import db_manager
from backend.src.services.data_collector import data_collector

from backend.src.api.routes.auth import get_optional_user  

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check():
    """
    Basic health check

    Returns service status and timestamp
    """
    return {
        "status": "healthy",
        "service": "Smart Hydroponic System API",
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/status")
async def system_status(user: dict | None = Depends(get_optional_user)):
    """
    Detailed system status

    Returns:
        - API status
        - Database status
        - Sensor status
        - Active configuration
    """
    # Get sensor status
    sensor_manager = SensorFactory.get_sensor_manager(
        use_mock=settings.use_mock_sensors
    )
    sensor_status = sensor_manager.get_all_status()

    # Get active configuration
    # CHANGED (login): profiles are per user. Logged in -> your active profile;
    # not logged in -> None. The route itself stays public.
    active_config = (
        await db_manager.get_active_configuration(user["id"]) if user else None
    )

    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "controller_name": settings.controller_name,
        "database": {"status": "connected", "path": db_manager.db_path},
        "sensors": {
            "count": len(sensor_status),
            "using_mock": settings.use_mock_sensors,
            "sensors": sensor_status,
        },
        "data_collector": data_collector.get_status(),
        "active_configuration": active_config["name"] if active_config else None,
    }