from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import LogEntry
from app.hos.daysplit import build_day_logs


def _entry(status, sh, eh, day_start=datetime(2026, 1, 1), **kw):
    return LogEntry(status, day_start.replace(hour=sh), day_start.replace(hour=eh), **kw)


def test_single_day_totals_sum_to_24():
    start = datetime(2026, 1, 1, 6)
    entries = [
        LogEntry(DutyStatus.ON_DUTY_NOT_DRIVING, datetime(2026, 1, 1, 6), datetime(2026, 1, 1, 7), note="Pickup"),
        LogEntry(DutyStatus.DRIVING, datetime(2026, 1, 1, 7), datetime(2026, 1, 1, 14), miles=420.0),
        LogEntry(DutyStatus.ON_DUTY_NOT_DRIVING, datetime(2026, 1, 1, 14), datetime(2026, 1, 1, 15), note="Dropoff"),
    ]
    logs = build_day_logs(entries, start)
    assert len(logs) == 1
    assert logs[0].day == 1
    assert logs[0].date == "2026-01-01"
    assert sum(logs[0].totals.values()) == 24.0
    # 00:00-06:00 and 15:00-24:00 are off-duty fill = 6 + 9 = 15
    assert logs[0].totals["off_duty"] == 15.0
    assert logs[0].totals["driving"] == 7.0
    assert logs[0].total_miles_today == 420.0
    assert "Pickup" in logs[0].remarks[0]


def test_entry_crossing_midnight_is_split_into_two_days():
    start = datetime(2026, 1, 1, 6)
    entries = [
        LogEntry(DutyStatus.SLEEPER_BERTH, datetime(2026, 1, 1, 20), datetime(2026, 1, 2, 6), note="10-hour rest"),
    ]
    logs = build_day_logs(entries, start)
    assert len(logs) == 2
    assert sum(logs[0].totals.values()) == 24.0
    assert sum(logs[1].totals.values()) == 24.0
    # Day 1: 20:00-24:00 sleeper = 4h; Day 2: 00:00-06:00 sleeper = 6h
    assert logs[0].totals["sleeper_berth"] == 4.0
    assert logs[1].totals["sleeper_berth"] == 6.0
