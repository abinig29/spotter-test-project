from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput, LogEntry


def test_duty_status_values():
    assert DutyStatus.OFF_DUTY.value == "off_duty"
    assert DutyStatus.SLEEPER_BERTH.value == "sleeper_berth"
    assert DutyStatus.DRIVING.value == "driving"
    assert DutyStatus.ON_DUTY_NOT_DRIVING.value == "on_duty_not_driving"


def test_log_entry_duration_hours():
    e = LogEntry(DutyStatus.DRIVING, datetime(2026, 1, 1, 7), datetime(2026, 1, 1, 9))
    assert e.duration_hours == 2.0


def test_route_input_fields():
    r = RouteInput(total_miles=470.0, total_driving_hours=7.2)
    assert r.total_miles == 470.0
    assert r.total_driving_hours == 7.2
