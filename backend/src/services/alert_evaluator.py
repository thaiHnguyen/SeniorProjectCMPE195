"""
Threshold evaluation and alert state machine.

Severity bands mirror the frontend SensorCard:
    NORMAL   comfortably inside [min, max]
    WARNING  inside the range but within `buffer` of either edge
    DANGER   outside [min, max]

Logic, no IO needed for this class
"""

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

RANK = {"normal": 0, "warning": 1, "danger": 2}

class AlertState(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    DANGER = "danger"

METRIC_BOUNDS = {
    "temperature":  ("temp_min", "temp_max"),
    "humidity":     ("humidity_min", "humidity_max"),
    "ph":           ("ph_min", "ph_max")
}

@dataclass
class Transition:
    sensor_type: str
    metric: str
    from_state: AlertState
    to_state: AlertState
    value: float
    threshold_min: float
    threshold_max: float

    @property
    def should_notify(self) -> bool:
        """Only push notification on switching to DANGER"""
        return self.to_state == AlertState.DANGER

@dataclass
class MetricState:
    state: AlertState = AlertState.NORMAL
    pending: Optional[AlertState] = None
    pending_count: int = 0

class AlertEvaluator:
    def __init__ (
        self,
        warning_buffer_pct: float = 0.10, #same behavior from SensorCard.jsx
        hysteresis_pct: float = 0.02,
        confirm_readings: int = 2,
    ):
        self.warning_buffer_pct = warning_buffer_pct
        self.hysteresis_pct = hysteresis_pct
        self.confirm_readings = confirm_readings
        self._states: Dict[Tuple[str, str], MetricState] = {}

    def _raw(self, value, lo, hi, buf) -> AlertState:
        """Severity ignoring history (same behavior as SensorCard.jsx)"""
        if value < lo or value > hi:
            return AlertState.DANGER
        if value <= lo + buf or value >= hi - buf:
            return AlertState.WARNING
        return AlertState.NORMAL

    def classify(self, value, lo, hi, current: AlertState) -> AlertState:
        band = (hi-lo) or 1.0
        # Set cap of buffer so i cannot swallow whole range on a narrow band
        buf = min(band * self.warning_buffer_pct, band * 0.45)
        pad = self.hysteresis_pct * band

        raw = self._raw(value, lo, hi, buf)

        # Require clearing boundary by "pad" before doing any downgrading
        #   ,or a value will sit on the line and dont switch between state
        if RANK[raw] < RANK[current]:
            if current == AlertState.DANGER and not (lo + pad <= value <= hi - pad):
                return AlertState.DANGER
            
            if RANK[raw] < RANK[AlertState.WARNING]:
                if not (lo + buf + pad <= value <= hi - buf - pad):
                    return AlertState.WARNING
        return raw

    def evaluate(self, sensor_type, metric, value, config) -> Optional[Transition]:
        """Return a Transition only on a confirmed state change"""
        if metric not in METRIC_BOUNDS:
            return None

        lo_field, hi_field, = METRIC_BOUNDS[metric]
        lo, hi = getattr(config, lo_field), getattr(config, hi_field)

        key = (sensor_type, metric)
        ms = self._states.setdefault(key, MetricState())
        observed = self.classify(value, lo, hi, ms.state)

        if observed == ms.state:
            ms.pending, ms.pending_count = None, 0
            return None

        #debounce: one noisy reading should not move us
        if observed == ms.pending:
            ms.pending_count += 1
        else:
            ms.pending, ms.pending_count = observed, 1

        if ms.pending_count < self.confirm_readings:
            return None

        previous, ms.state = ms.state, observed
        ms.pending, ms.pending_count = None, 0
        return Transition(sensor_type, metric, previous, observed, value, lo, hi)

    def reset(self, sensor_type: str=None, metric: str=None):
        """ Clear tracked state. Call with no args when active threshold 
            profile changed by user
        """
        if sensor_type is None:
            self._states.clear()
        else:
            self._states.pop((sensor_type, metric), None)

