"""
Threshold configuration endpoints

CHANGED (login): every route requires a logged-in user and only sees that
user's own profiles. Another user's profile id returns 404, same as a missing one.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List

import aiosqlite

from backend.src.api.routes.auth import get_current_user
from backend.src.storage import db_manager
from backend.src.services.data_collector import data_collector
from backend.src.storage.models import (
    ThresholdConfiguration,
    ThresholdConfigurationCreate,
    ThresholdConfigurationUpdate,
)
from backend.src.utils.logger import logger

router = APIRouter(prefix="/api/configurations", tags=["configurations"])


def _duplicate_name(name: str) -> HTTPException:
    """names are unique per user; say so instead of a generic 500"""
    return HTTPException(
        status_code=409, detail=f"You already have a profile named '{name}'"
    )


@router.get("/", response_model=List[ThresholdConfiguration])
async def get_all_configurations(user: dict = Depends(get_current_user)):
    """
    Get all of the current user's threshold configurations

    Returns:
        List of the user's configurations (plant profiles, system settings, etc.)
    """
    try:
        return await db_manager.get_configurations(user["id"])

    except Exception as e:
        logger.error(f"Error getting configurations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active", response_model=ThresholdConfiguration)
async def get_active_configuration(user: dict = Depends(get_current_user)):
    """
    Get the current user's active configuration

    The active configuration determines this user's alert thresholds

    Returns:
        Active threshold configuration
    """
    try:
        config = await db_manager.get_active_configuration(user["id"])

        if not config:
            raise HTTPException(status_code=404, detail="No active configuration found")

        return config

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{config_id}", response_model=ThresholdConfiguration)
async def get_configuration(config_id: int, user: dict = Depends(get_current_user)):
    """
    Get one of the current user's configurations by ID

    Args:
        config_id: Configuration ID

    Returns:
        Threshold configuration
    """
    try:
        config = await db_manager.get_configuration(config_id, user["id"])

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
async def create_configuration(
    config: ThresholdConfigurationCreate, user: dict = Depends(get_current_user)
):
    """
    Create new threshold configuration in the current user's account

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
        config_id = await db_manager.create_configuration(
            config.model_dump(), user["id"]
        )

        # Fetch the created configuration
        created = await db_manager.get_configuration(config_id, user["id"])

        return {
            "status": "success",
            "message": f"Configuration '{config.name}' created",
            "data": created,
        }

    except aiosqlite.IntegrityError:
        raise _duplicate_name(config.name)
    except Exception as e:
        logger.error(f"Error creating configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{config_id}")
async def update_configuration(
    config_id: int,
    config: ThresholdConfigurationUpdate,
    user: dict = Depends(get_current_user),
):
    """
    Update one of the current user's threshold configurations

    Args:
        config_id: Configuration ID to update
        config: Fields to update (only provided fields will be updated)

    Returns:
        Updated configuration
    """
    try:
        # Check if it exists (and belongs to this user)
        existing = await db_manager.get_configuration(config_id, user["id"])
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Configuration {config_id} not found"
            )

        # Update with only provided fields
        update_data = config.model_dump(exclude_unset=True)  # CHANGED: .dict() is deprecated
        # Activation goes through POST /{id}/activate only, so a user can never
        # end up with zero or two active profiles through a PATCH
        update_data.pop("is_active", None)

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields provided to update")

        try:
            success = await db_manager.update_configuration(
                config_id, update_data, user["id"]
            )
        except aiosqlite.IntegrityError:
            raise _duplicate_name(update_data.get("name", existing["name"]))

        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to update configuration"
            )

        # Unconditional: cheap, and covers editing the active profile
        data_collector.invalidate_config(user["id"])

        # Fetch updated configuration
        updated = await db_manager.get_configuration(config_id, user["id"])

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
async def activate_configuration(config_id: int, user: dict = Depends(get_current_user)):
    """
    Set one of the current user's configurations as their active profile

    Deactivates the user's other configurations (other users are unaffected)

    Args:
        config_id: Configuration ID to activate

    Returns:
        Success message with activated configuration
    """
    try:
        # Check if it exists (and belongs to this user)
        config = await db_manager.get_configuration(config_id, user["id"])
        if not config:
            raise HTTPException(
                status_code=404, detail=f"Configuration {config_id} not found"
            )

        # Activate it
        success = await db_manager.set_active_configuration(config_id, user["id"])

        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to activate configuration"
            )

        # New bands for this user: drop their cached config and alert state
        data_collector.invalidate_config(user["id"])

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
async def delete_configuration(config_id: int, user: dict = Depends(get_current_user)):
    """
    Delete one of the current user's threshold configurations

    Cannot delete the user's active configuration

    Args:
        config_id: Configuration ID to delete

    Returns:
        Success message
    """
    try:
        # Check if it's active
        active = await db_manager.get_active_configuration(user["id"])
        if active and active["id"] == config_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete active configuration. Activate another one first.",
            )

        success = await db_manager.delete_configuration(config_id, user["id"])

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