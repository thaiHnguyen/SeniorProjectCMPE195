"""
Alert management endpoints

CHANGED (login): alerts are per user. Each user only sees alerts raised by
their own active profile.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from backend.src.api.routes.auth import get_current_user
from backend.src.storage import db_manager
from backend.src.storage.models import Alert
from backend.src.utils.logger import logger

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/", response_model=List[Alert])
async def get_alerts(
    unread_only: bool = Query(False, description="Only return unread alerts"),
    severity: Optional[str] = Query(None, description="normal | warning | danger"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    """
    Get recent alerts, newest first.

    The frontend polls this with severity=danger to drive the danger modal.
    """
    try:
        # CHANGED: severity is now filtered in SQL, so `limit` counts matching
        # alerts only (before, 50 warnings could hide every danger alert)
        return await db_manager.get_alerts(
            user["id"], unread_only=unread_only, limit=limit, severity=severity
        )

    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{alert_id}/read")
async def mark_read(alert_id: int, user: dict = Depends(get_current_user)):
    """Mark a single alert as read."""
    try:
        success = await db_manager.mark_alert_read(alert_id, user["id"])
        if not success:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        return {"status": "success", "message": f"Alert {alert_id} marked read"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking alert {alert_id} read: {e}")
        raise HTTPException(status_code=500, detail=str(e))