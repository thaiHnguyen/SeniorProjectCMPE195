# tests/test_alert_evaluator.py
"""Tests for the alert state machine"""

from types import SimpleNamespace
import pytest

from backend.src.services.alert_evaluator import AlertEvaluator, AlertState

# Band 20–30: buffer = 1.0 (10%), hysteresis pad = 0.2 (2%)
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

#band classification (mirrors SensorCard)
@pytest.mark.parametrize("value,expected", [
    (25.0, AlertState.NORMAL),    # middle
    (20.5, AlertState.WARNING),   # inside, near lower edge
    (29.5, AlertState.WARNING),   # inside, near upper edge
    (19.0, AlertState.DANGER),    # below min
    (31.0, AlertState.DANGER),    # above max
    (20.0, AlertState.WARNING),   # exactly at min — inside, so warning
])

def test_classification_matches_sensorcard(ev, value, expected):
    assert ev.classify(value, 20.0, 30.0, AlertState.NORMAL) == expected

#transition only alerting
def test_stable_normal_produces_no_alerts(ev):
    assert feed(ev, 25.0, n=5) is None


def test_entering_warning_fires_once_then_goes_quiet(ev):
    assert feed(ev, 20.5) is None          # 1st reading, not yet confirmed
    t = feed(ev, 20.5)                     # 2nd, confirmed
    assert t is not None
    assert t.from_state == AlertState.NORMAL
    assert t.to_state == AlertState.WARNING
    assert feed(ev, 20.5, n=10) is None     # stable, silence


def test_danger_notifies_but_warning_does_not(ev):
    warning = feed(ev, 20.5, n=2)
    assert warning.should_notify is False
    danger = feed(ev, 19.0, n=2)
    assert danger.to_state == AlertState.DANGER
    assert danger.should_notify is True


def test_stuck_in_danger_does_not_spam(ev):
    feed(ev, 19.0, n=2)
    assert feed(ev, 19.0, n=20) is None     # would be 20 pushes without this

# debounce
def test_single_spike_is_ignored(ev):
    assert feed(ev, 19.0) is None           # one bad reading
    assert feed(ev, 25.0, n=2) is None      # back to normal, never alerted

# hysteresis
def test_value_hovering_at_boundary_does_not_flap(ev):
    feed(ev, 20.5, n=2)                     # now WARNING
    # 21.1 is  normal, but inside the hysteresis pad (21.2)
    assert feed(ev, 21.1, n=3) is None
    t = feed(ev, 21.5, n=2)                 # clearly clear of the edge
    assert t.to_state == AlertState.NORMAL

def test_recovery_from_danger_passes_through_warning(ev):
    feed(ev, 19.0, n=2)                     # DANGER
    t = feed(ev, 20.5, n=2)                 # back inside, near the edge
    assert t.from_state == AlertState.DANGER
    assert t.to_state == AlertState.WARNING

# per-sensor reading 
def test_two_sensors_track_the_same_metric_separately(ev):
    a = feed(ev, 19.0, n=2, sensor="bme280")
    assert a.to_state == AlertState.DANGER
    # bme680 has seen nothing yet — must still be NORMAL
    assert feed(ev, 25.0, n=2, sensor="bme680") is None
    b = feed(ev, 31.0, n=2, sensor="bme680")
    assert b.sensor_type == "bme680"

#profile-switching
def test_reset_clears_state_on_profile_change(ev):
    feed(ev, 19.0, n=2)                     # DANGER under this profile
    ev.reset()
    # Fresh start: normal readings produce no transition
    assert feed(ev, 25.0, n=3) is None

# guards
def test_unknown_metric_is_ignored(ev):
    assert ev.evaluate("bme280", "pressure", 1013.0, CONFIG) is None


def test_ph_uses_its_own_narrow_band(ev):
    # 5.5 - 6.5, buffer 0.1
    assert feed(ev, 6.0, n=2, sensor="ph", metric="ph") is None
    t = feed(ev, 5.4, n=2, sensor="ph", metric="ph")
    assert t.to_state == AlertState.DANGER
