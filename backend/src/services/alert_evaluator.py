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

# Absolute tolerance OUTSIDE [min, max] that counts as WARNING; beyond is DANGER.
# Must match TOLERANCE in frontend/src/components/SensorCard.jsx
TOLERANCE = {
    "temperature": 2.0,
    "humidity": 5.0,
    "ph": 0.3,
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
    def __init__(
        self,
        tolerance: Dict[str, float] = None,
        hysteresis_frac: float = 0.2,   # fraction of tolerance needed to recover
        confirm_readings: int = 2,
    ):
        self.tolerance = tolerance or TOLERANCE
        self.hysteresis_frac = hysteresis_frac
        self.confirm_readings = confirm_readings
        self._states: Dict[Tuple[str, str], MetricState] = {}

    def _raw(self, value, lo, hi, tol) -> AlertState:
        """In range = NORMAL, within tolerance outside = WARNING, beyond = DANGER."""
        if lo <= value <= hi:
            return AlertState.NORMAL
        if lo - tol <= value <= hi + tol:
            return AlertState.WARNING
        return AlertState.DANGER

    def classify(self, value, lo, hi, tol, current: AlertState) -> AlertState:
        # Cap the pad so a narrow range can still recover to NORMAL
        pad = min(tol * self.hysteresis_frac, (hi - lo) * 0.25)
        raw = self._raw(value, lo, hi, tol)

        # Improving? Require clearing each boundary by `pad` before downgrading (NEED TEST)
        if RANK[raw] < RANK[current]:
            if current == AlertState.DANGER and not (lo - tol + pad <= value <= hi + tol - pad):
                return AlertState.DANGER
            if RANK[raw] < RANK[AlertState.WARNING]:
                if not (lo + pad <= value <= hi - pad):
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
        observed = self.classify(value, lo, hi, self.tolerance[metric], ms.state)

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

