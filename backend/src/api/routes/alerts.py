"""
Alert management endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from backend.src.storage import db_manager
from backend.src.storage.models import Alert
from backend.src.utils.logger import logger

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/", response_model=List[Alert])
async def get_alerts(
    unread_only: bool = Query(False, description="Only return unread alerts"),
    severity: Optional[str] = Query(None, description="info | warning | critical"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Get recent alerts, newest first.

    The frontend polls this with severity=critical to drive the danger modal.
    """
    try:
        alerts = await db_manager.get_alerts(unread_only=unread_only, limit=limit)

        # db_manager has no severity filter; applying it here avoids touching it
        if severity:
            alerts = [a for a in alerts if a["severity"] == severity]

        return alerts

    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{alert_id}/read")
async def mark_read(alert_id: int):
    """Mark a single alert as read."""
    try:
        success = await db_manager.mark_alert_read(alert_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        return {"status": "success", "message": f"Alert {alert_id} marked read"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking alert {alert_id} read: {e}")
        raise HTTPException(status_code=500, detail=str(e))