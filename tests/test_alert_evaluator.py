# tests/test_alert_evaluator.py
"""
Tests for the alert state machine. Pure logic — no DB, no hardware.

Model: in [min, max] = NORMAL, within tolerance outside = WARNING, beyond = DANGER.
"""

from types import SimpleNamespace
import pytest

from backend.src.services.alert_evaluator import AlertEvaluator, AlertState


# temp 20–30 with tolerance 2.0  → WARNING 18–20 / 30–32, DANGER beyond
#   hysteresis pad = min(2.0 * 0.2, 10 * 0.25) = 0.4
# pH 5.5–6.5 with tolerance 0.3  → WARNING 5.2–5.5 / 6.5–6.8, DANGER beyond
CONFIG = SimpleNamespace(
    temp_min=20.0, temp_max=30.0,
    humidity_min=40.0, humidity_max=80.0,
    ph_min=5.5, ph_max=6.5,
)


@pytest.fixture
def ev():
    return AlertEvaluator()


def feed(ev, value, n=1, sensor="bme280", metric="temperature"):
    """Feed a value n times, returning the last transition (or None)."""
    result = None
    for _ in range(n):
        result = ev.evaluate(sensor, metric, value, CONFIG)
    return result


# ---------- band classification (must match SensorCard) ----------

@pytest.mark.parametrize("value,expected", [
    (25.0, AlertState.NORMAL),    # middle
    (20.0, AlertState.NORMAL),    # exactly at min — in range
    (30.0, AlertState.NORMAL),    # exactly at max — in range
    (19.0, AlertState.WARNING),   # just below, within tolerance
    (31.0, AlertState.WARNING),   # just above, within tolerance
    (17.0, AlertState.DANGER),    # beyond tolerance
    (33.0, AlertState.DANGER),
])
def test_classification_matches_sensorcard(ev, value, expected):
    assert ev.classify(value, 20.0, 30.0, 2.0, AlertState.NORMAL) == expected


def test_real_readings_from_dashboard(ev):
    """Regression: the values that prompted the tolerance change."""
    # 26.83°C against 22–26.5 was showing DANGER; should be WARNING
    assert ev.classify(26.83, 22.0, 26.5, 2.0, AlertState.NORMAL) == AlertState.WARNING
    # 47.49% against 30–47 — same
    assert ev.classify(47.49, 30.0, 47.0, 5.0, AlertState.NORMAL) == AlertState.WARNING
    # pH 7 against 6–7 was showing WARNING; in range, so NORMAL
    assert ev.classify(7.0, 6.0, 7.0, 0.3, AlertState.NORMAL) == AlertState.NORMAL


# ---------- transition-only alerting ----------

def test_stable_normal_produces_no_alerts(ev):
    assert feed(ev, 25.0, n=5) is None


def test_entering_warning_fires_once_then_goes_quiet(ev):
    assert feed(ev, 31.0) is None          # 1st reading — not yet confirmed
    t = feed(ev, 31.0)                     # 2nd — confirmed
    assert t is not None
    assert t.from_state == AlertState.NORMAL
    assert t.to_state == AlertState.WARNING
    assert feed(ev, 31.0, n=10) is None     # stable — silence


def test_danger_notifies_but_warning_does_not(ev):
    warning = feed(ev, 31.0, n=2)
    assert warning.should_notify is False
    danger = feed(ev, 33.0, n=2)
    assert danger.to_state == AlertState.DANGER
    assert danger.should_notify is True


def test_stuck_in_danger_does_not_spam(ev):
    feed(ev, 33.0, n=2)
    assert feed(ev, 33.0, n=20) is None     # would be 20 pushes without this


# ---------- debounce ----------

def test_single_spike_is_ignored(ev):
    assert feed(ev, 33.0) is None           # one bad reading
    assert feed(ev, 25.0, n=2) is None      # back to normal, never alerted


# ---------- hysteresis ----------

def test_value_hovering_at_boundary_does_not_flap(ev):
    feed(ev, 31.0, n=2)                     # WARNING
    # 29.8 is in range, but within the 0.4 pad of max (needs ≤ 29.6)
    assert feed(ev, 29.8, n=3) is None
    t = feed(ev, 29.0, n=2)                 # clearly inside
    assert t.to_state == AlertState.NORMAL


def test_recovery_from_danger_passes_through_warning(ev):
    feed(ev, 33.0, n=2)                     # DANGER
    t = feed(ev, 31.0, n=2)                 # back within tolerance
    assert t.from_state == AlertState.DANGER
    assert t.to_state == AlertState.WARNING


# ---------- per-sensor independence ----------

def test_two_sensors_track_the_same_metric_separately(ev):
    a = feed(ev, 33.0, n=2, sensor="bme280")
    assert a.to_state == AlertState.DANGER
    # bme680 has seen nothing out of range — must still be NORMAL
    assert feed(ev, 25.0, n=2, sensor="bme680") is None
    b = feed(ev, 33.0, n=2, sensor="bme680")
    assert b.sensor_type == "bme680"


# ---------- profile switching ----------

def test_reset_clears_state_on_profile_change(ev):
    feed(ev, 33.0, n=2)                     # DANGER under this profile
    ev.reset()
    assert feed(ev, 25.0, n=3) is None      # fresh start, nothing to report


# ---------- guards ----------

def test_unknown_metric_is_ignored(ev):
    assert ev.evaluate("bme280", "pressure", 1013.0, CONFIG) is None


def test_ph_uses_its_own_tolerance(ev):
    assert feed(ev, 6.0, n=2, sensor="ph", metric="ph") is None
    w = feed(ev, 6.7, n=2, sensor="ph", metric="ph")     # within 0.3 above max
    assert w.to_state == AlertState.WARNING
    d = feed(ev, 6.9, n=2, sensor="ph", metric="ph")     # beyond 6.8
    assert d.to_state == AlertState.DANGER