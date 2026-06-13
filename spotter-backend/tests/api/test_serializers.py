from datetime import datetime

from app.api.serializers import TripPlanRequestSerializer, serialize_day, serialize_entry
from app.hos.models import DayLog, LogEntry
from app.hos.statuses import DutyStatus

VALID = {
    "current_location": {"lat": 41.85, "lng": -87.65, "address": "Chicago, IL"},
    "pickup_location": {"lat": 38.62, "lng": -90.19, "address": "St. Louis, MO"},
    "dropoff_location": {"lat": 36.16, "lng": -86.78, "address": "Nashville, TN"},
    "cycle_hours_used": 32,
}


def test_valid_request_passes():
    s = TripPlanRequestSerializer(data=VALID)
    assert s.is_valid(), s.errors
    assert s.validated_data["cycle_hours_used"] == 32


def test_cycle_hours_over_70_rejected():
    bad = {**VALID, "cycle_hours_used": 71}
    assert not TripPlanRequestSerializer(data=bad).is_valid()


def test_cycle_hours_negative_rejected():
    bad = {**VALID, "cycle_hours_used": -1}
    assert not TripPlanRequestSerializer(data=bad).is_valid()


def test_missing_location_rejected():
    bad = {k: v for k, v in VALID.items() if k != "pickup_location"}
    assert not TripPlanRequestSerializer(data=bad).is_valid()


def test_serialize_entry_formats_hhmm():
    e = LogEntry(DutyStatus.DRIVING, datetime(2026, 1, 1, 7), datetime(2026, 1, 1, 14, 30))
    out = serialize_entry(e)
    assert out == {"status": "driving", "start": "07:00", "end": "14:30"}


def test_serialize_entry_includes_location_and_note():
    e = LogEntry(DutyStatus.ON_DUTY_NOT_DRIVING, datetime(2026, 1, 1, 6),
                 datetime(2026, 1, 1, 7), location="Chicago, IL", note="Pickup")
    out = serialize_entry(e)
    assert out["location"] == "Chicago, IL"
    assert out["note"] == "Pickup"


def test_serialize_day_shape():
    e = LogEntry(DutyStatus.DRIVING, datetime(2026, 1, 1, 7), datetime(2026, 1, 1, 9))
    day = DayLog(day=1, date="2026-01-01", total_miles_today=120.0, entries=[e],
                 totals={"driving": 2.0}, remarks=["Chicago, IL — Pickup"])
    out = serialize_day(day)
    assert out["day"] == 1
    assert out["date"] == "2026-01-01"
    assert out["total_miles_today"] == 120.0
    assert out["entries"][0]["status"] == "driving"
    assert out["remarks"] == ["Chicago, IL — Pickup"]
