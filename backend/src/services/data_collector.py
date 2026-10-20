"""
Data collection service - runs in background
Compatible with both mock sensors and real Raspberry Pi sensors
"""

import asyncio
from datetime import datetime
from typing import Optional
from types import SimpleNamespace

from backend.src.sensors.sensor_factory import SensorFactory
from backend.src.storage import db_manager
from backend.src.config.settings import settings
from backend.src.utils.logger import logger
from backend.src.services.alert_evaluator import AlertEvaluator, AlertState, METRIC_BOUNDS


# Evaluator state -> DB severity. CHANGED: the DB now uses the same names as the
# evaluator and the dashboard (normal|warning|danger), so this is a 1:1 mapping.
SEVERITY_MAP = {
    AlertState.WARNING: "warning",
    AlertState.DANGER: "danger",
    AlertState.NORMAL: "normal",
}

# Display units per metric. Temperature carries both scales because the
# frontend lets users switch between C and F; stored values stay Celsius.
METRIC_UNITS = {
    "temperature": "°C",
    "humidity": "%",
    "ph": "",
    "pressure": " hPa",   # NEW
    "aqi_score": "",      # NEW
}

# NEW: metrics that should only be checked on one sensor. The BME280 also reports
# pressure, so without this both sensors would raise the same pressure alert.
METRIC_SENSORS = {
    "pressure": {"bme680"},
    "aqi_score": {"bme680"},
}

def _c_to_f(c: float) -> float:
    """Absolute temp conversion. Not for spanning"""
    return c * 9 / 5 + 32

def _fmt_value(metric:str, value:float) -> str:
    """Format a reading for an alert message, both scales for temp"""
    if metric == "temperature":
        return f"{value:.1f} °C ({_c_to_f(value):.1f} °F)"
    
    if metric == "aqi_score":
        return f"{value:.0f}"   # NEW: whole-number score (1-4), not "3.0"
    return f"{value:.1f}{METRIC_UNITS.get(metric, '')}"
    
def _fmt_range(metric: str, lo: float, hi: float) -> str:
    """Format a threshold range for an alert message."""
    if metric == "temperature":
        return (
            f"{lo:.1f}-{hi:.1f}°C / "
            f"{_c_to_f(lo):.1f}-{_c_to_f(hi):.1f}°F"
        )
    unit = METRIC_UNITS.get(metric, "")
    return f"{lo:.1f}-{hi:.1f}{unit}"

class DataCollector:
    """
    Background service that periodically reads sensors

    Works with:
    - Mock sensors (development)
    - Real I2C sensors (Raspberry Pi)

    Automatically adjusts behavior based on USE_MOCK_SENSORS setting
    """

    def __init__(self):
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.sensor_manager = None
        self.read_count = 0
        self.alert_count = 0
        # CHANGED (login): one evaluator per user. Each keeps its own alert state
        # (hysteresis, cooldowns), because the same reading can be DANGER for one
        # user's profile and NORMAL for another's.
        self.evaluators: dict[int, AlertEvaluator] = {}
        # {user_id: active profile}, avoids a DB read every cycle. None = reload
        self._config_cache: Optional[dict] = None
        self._warned_no_config = False # log the no-users case once
        
    async def start(self):
        """Start background data collection"""
        if self.is_running:
            logger.warning("Data collector already running")
            return

        # Create sensor manager
        self.sensor_manager = SensorFactory.get_sensor_manager(
            use_mock=settings.use_mock_sensors
        )
        logger.info(f"Active sensors: {list(self.sensor_manager.sensors.keys())}")

        # Start background task
        self.is_running = True
        self.task = asyncio.create_task(self._collection_loop())

        sensor_type = "MOCK" if settings.use_mock_sensors else "REAL"
        logger.info(
            f"Data collector started ({sensor_type} sensors, "
            f"interval: {settings.sensor_read_interval}s)"
        )

    async def stop(self):
        """Stop background data collection"""
        if not self.is_running:
            return

        self.is_running = False

        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

        logger.info(f"Data collector stopped (collected {self.read_count} readings)")

    async def _collection_loop(self):
        """
        Main collection loop

        Continuously reads sensors at configured interval
        Works identically for mock and real sensors
        """
        logger.info("Starting sensor collection loop...")

        while self.is_running:
            try:
                await self._read_and_store()

                # Wait for next interval
                await asyncio.sleep(settings.sensor_read_interval)

            except asyncio.CancelledError:
                logger.info("Collection loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in collection loop: {e}")
                # Continue despite errors (important for reliability)
                await asyncio.sleep(settings.sensor_read_interval)

    async def _read_and_store(self):
        """
        Read all sensors and store in database

        This method works identically whether sensors are mock or real
        The sensor_manager abstraction handles the difference
        """
        try:
            # Read all sensors (mock or real)
            readings = await self.sensor_manager.read_all()

            # Store each reading
            stored_count = 0
            for sensor_type, data in readings.items():
                if data.get("status") == "ok":
                    try:
                        await db_manager.insert_sensor_reading(sensor_type, data)
                        stored_count += 1
                    except Exception as e:
                        logger.error(f"Failed to store {sensor_type} reading: {e}")

            self.read_count += stored_count

            await self._evaluate_alerts(readings) 

            if stored_count > 0:
                logger.debug(
                    f"Stored {stored_count} readings " f"(total: {self.read_count})"
                )

        except Exception as e:
            logger.error(f"Error reading/storing sensors: {e}")

    def get_status(self) -> dict:
        """Get collector status"""
        return {
            "is_running": self.is_running,
            "total_readings": self.read_count,
            "total_alerts": self.alert_count,
            "using_mock": settings.use_mock_sensors,
            "interval_seconds": settings.sensor_read_interval,
        }

    def invalidate_config(self, user_id: Optional[int] = None):
        """
        Called when a user's active threshold profile changes
        (DANGER state at one profile can be NORMAL in another one when switching)

        (login): user_id -> reset only that user's alert state.
        No user_id (e.g. a new account) -> just reload the profile list.
        """
        self._config_cache = None
        self._warned_no_config = False
        if user_id is not None:
            evaluator = self.evaluators.get(user_id)
            if evaluator:
                evaluator.reset()
            logger.info(f"Threshold profile changed for user {user_id} - alert state reset")

    async def _get_configs(self) -> dict:
        """
        CHANGED (login): every user's active profile as {user_id: config},
        cached until invalidate_config()
        """
        if self._config_cache is None:
            rows = await db_manager.get_all_active_configurations()
            # Db returns dicts; evaluator reads attributes
            self._config_cache = {row["user_id"]: SimpleNamespace(**row) for row in rows}
            # Forget evaluators of users who no longer have an active profile
            for uid in list(self.evaluators):
                if uid not in self._config_cache:
                    del self.evaluators[uid]
        return self._config_cache

    async def _evaluate_alerts(self, readings: dict):
        """
        Check each reading against EVERY user's active thresholds and persist
        any confirmed state changes, tagged with that user.

        Never raises - alerting problems must not stop data collection.
        """
        configs = await self._get_configs()
        if not configs:
            if not self._warned_no_config:
                logger.warning("No user has an active threshold profile - alerts disabled")
                self._warned_no_config = True
            return

        for user_id, config in configs.items():
            evaluator = self.evaluators.setdefault(user_id, AlertEvaluator())

            for sensor_type, data in readings.items():
                if data.get("status") != "ok":
                    continue

                # A sensor may report several metrics (BME280: temp + humidity)
                for metric in METRIC_BOUNDS:
                    if metric not in data:
                        continue
                    # skip metrics this sensor isn't the source of
                    allowed = METRIC_SENSORS.get(metric)
                    if allowed and sensor_type not in allowed:
                        continue

                    transition = evaluator.evaluate(
                        sensor_type, metric, data[metric], config
                    )
                    if transition:
                        await self._record_alert(transition, user_id)

    async def _record_alert(self, t, user_id: int):
        """Persist one transition, and notify if it warrants it."""
        recovered = t.to_state == AlertState.NORMAL
        message = (
            f"{t.sensor_type} {t.metric} back to normal: "
            f"{_fmt_value(t.metric, t.value)}"
            if recovered
            else f"{t.sensor_type} {t.metric} is {t.to_state.value.upper()}: "
                    f"{_fmt_value(t.metric, t.value)} "
                    f"(range {_fmt_range(t.metric, t.threshold_min, t.threshold_max)})"
        )

        try:
            await db_manager.create_alert({
                "user_id": user_id,  #login: whose profile raised it
                "alert_type": "recovery" if recovered else "threshold_breach",
                "sensor_type": t.sensor_type,
                "message": message,
                "severity": SEVERITY_MAP[t.to_state],
                "reading_value": t.value,
                "threshold_min": t.threshold_min,
                "threshold_max": t.threshold_max,
            })
            self.alert_count += 1
            logger.info(f"Alert (user {user_id}): {message}")
        except Exception as e:
            # Log and move on, a failed alert insert must not cost us readings
            logger.error(f"Failed to store alert for {t.sensor_type} (user {user_id}): {e}")

        if t.should_notify:
            # TODO(Phase 4): web push
            logger.warning(f"DANGER: {message}")

# Singleton instance
data_collector = DataCollector()