"""
Threshold configuration endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import List

from backend.src.storage import db_manager
from backend.src.services.data_collector import data_collector
from backend.src.storage.models import (
    ThresholdConfiguration,
    ThresholdConfigurationCreate,
    ThresholdConfigurationUpdate,
)
from backend.src.utils.logger import logger

router = APIRouter(prefix="/api/configurations", tags=["configurations"])


@router.get("/", response_model=List[ThresholdConfiguration])
async def get_all_configurations():
    """
    Get all threshold configurations

    Returns:
        List of all configurations (plant profiles, system settings, etc.)
    """
    try:
        configs = await db_manager.get_configurations()
        return configs

    except Exception as e:
        logger.error(f"Error getting configurations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active", response_model=ThresholdConfiguration)
async def get_active_configuration():
    """
    Get currently active configuration

    The active configuration determines alert thresholds

    Returns:
        Active threshold configuration
    """
    try:
        config = await db_manager.get_active_configuration()

        if not config:
            raise HTTPException(status_code=404, detail="No active configuration found")

        return config

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{config_id}", response_model=ThresholdConfiguration)
async def get_configuration(config_id: int):
    """
    Get specific configuration by ID

    Args:
        config_id: Configuration ID

    Returns:
        Threshold configuration
    """
    try:
        config = await db_manager.get_configuration(config_id)

        if not config:
            raise HTTPException(
                status_code=404, detail=f"Configuration {config_id} not found"
            )

        return config

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting configuration {config_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", status_code=201)
async def create_configuration(config: ThresholdConfigurationCreate):
    """
    Create new threshold configuration

    Can be used for:
    - Plant-specific profiles (e.g., "Tomato", "Lettuce")
    - Custom system settings (e.g., "My Greenhouse Setup")
    - Environmental presets (e.g., "Summer Configuration")

    Args:
        config: Configuration data

    Returns:
        Created configuration with ID
    """
    try:
        config_id = await db_manager.create_configuration(config.dict())

        # Fetch the created configuration
        created = await db_manager.get_configuration(config_id)

        return {
            "status": "success",
            "message": f"Configuration '{config.name}' created",
            "data": created,
        }

    except Exception as e:
        logger.error(f"Error creating configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{config_id}")
async def update_configuration(config_id: int, config: ThresholdConfigurationUpdate):
    """
    Update threshold configuration

    Args:
        config_id: Configuration ID to update
        config: Fields to update (only provided fields will be updated)

    Returns:
        Updated configuration
    """
    try:
        # Check if exists
        existing = await db_manager.get_configuration(config_id)
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Configuration {config_id} not found"
            )

        # Update with only provided fields
        update_data = config.dict(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields provided to update")

        success = await db_manager.update_configuration(config_id, update_data)

        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to update configuration"
            )
        
        # Unconditional: cheap, and covers editing the active profile
        data_collector.invalidate_config()

        # Fetch updated configuration
        updated = await db_manager.get_configuration(config_id)

        return {
            "status": "success",
            "message": f"Configuration {config_id} updated",
            "data": updated,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating configuration {config_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{config_id}/activate")
async def activate_configuration(config_id: int):
    """
    Set configuration as active

    Deactivates all other configurations (only one can be active)

    Args:
        config_id: Configuration ID to activate

    Returns:
        Success message with activated configuration
    """
    try:
        # Check if exists
        config = await db_manager.get_configuration(config_id)
        if not config:
            raise HTTPException(
                status_code=404, detail=f"Configuration {config_id} not found"
            )

        # Activate it
        success = await db_manager.set_active_configuration(config_id)

        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to activate configuration"
            )

        # New bands: drop cached config and tracked alert state
        data_collector.invalidate_config()
        
        return {
            "status": "success",
            "message": f"Configuration '{config['name']}' activated",
            "data": config,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating configuration {config_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{config_id}")
async def delete_configuration(config_id: int):
    """
    Delete threshold configuration

    Cannot delete the currently active configuration

    Args:
        config_id: Configuration ID to delete

    Returns:
        Success message
    """
    try:
        # Check if it's active
        active = await db_manager.get_active_configuration()
        if active and active["id"] == config_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete active configuration. Activate another one first.",
            )

        success = await db_manager.delete_configuration(config_id)

        if not success:
            raise HTTPException(
                status_code=404, detail=f"Configuration {config_id} not found"
            )

        return {"status": "success", "message": f"Configuration {config_id} deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting configuration {config_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
