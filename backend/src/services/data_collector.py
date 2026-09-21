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


# Evaluator severity -> DB severity (*models.py pattern is info|warning|critical)
SEVERITY_MAP = {
    AlertState.WARNING: "warning",
    AlertState.DANGER: "critical",
    AlertState.NORMAL: "info",
}

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
        self.evaluator = AlertEvaluator()
        self._config_cache = None      # avoids a DB read every cycle
        self._warned_no_config = False # log the missing-config case once
        
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

    def invalidate_config(self):
        """
        Called when active threshold profile change
        (DANGER state at one profile can be NORMAL in another one when switching)
        """
        self._config_cache = None
        self._warned_no_config = False
        self.evaluator.reset()
        logger.info("Threshold profile changed - alert state reset")

    async def _get_config(self):
        """
        Fetch the active config, cached until invalidate
        """
        if self._config_cache is None:
            raw = await db_manager.get_active_configuration()
            if raw is None:
                return None
            
            #Db returns a dict; evaluator reads attr
            self._config_cache = SimpleNamespace(**raw)
        return self._config_cache

    async def _evaluate_alerts(self, readings: dict):
        """
        Check each reading against the active thresholds and persist any
        confirmed state changes.

        Never raises - alerting problems must not stop data collection.
        """
        config = await self._get_config()
        if config is None:
            if not self._warned_no_config:
                logger.warning("No active threshold configuration - alerts disabled")
                self._warned_no_config = True
            return

        for sensor_type, data in readings.items():
            if data.get("status") != "ok":
                continue

            # A sensor may report several metrics (BME280: temp + humidity)
            for metric in METRIC_BOUNDS:
                if metric not in data:
                    continue

                transition = self.evaluator.evaluate(
                    sensor_type, metric, data[metric], config
                )
                if transition:
                    await self._record_alert(transition)

    async def _record_alert(self, t):
        """Persist one transition, and notify if it warrants it."""
        recovered = t.to_state == AlertState.NORMAL
        message = (
            f"{t.sensor_type} {t.metric} back to normal: {t.value}"
            if recovered
            else f"{t.sensor_type} {t.metric} is {t.to_state.value.upper()}: "
                    f"{t.value} (range {t.threshold_min}-{t.threshold_max})"
        )

        try:
            await db_manager.create_alert({
                "alert_type": "recovery" if recovered else "threshold_breach",
                "sensor_type": t.sensor_type,
                "message": message,
                "severity": SEVERITY_MAP[t.to_state],
                "reading_value": t.value,
                "threshold_min": t.threshold_min,
                "threshold_max": t.threshold_max,
            })
            self.alert_count += 1
            logger.info(f"Alert: {message}")
        except Exception as e:
            # Log and move on - a failed alert insert must not cost us readings
            logger.error(f"Failed to store alert for {t.sensor_type}: {e}")

        if t.should_notify:
            # TODO(Phase 4): web push
            logger.warning(f"DANGER: {message}")

# Singleton instance
data_collector = DataCollector()
