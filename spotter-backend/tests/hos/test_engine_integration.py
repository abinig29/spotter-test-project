from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def driving_total(plan):
    return sum(e.duration_hours for e in plan.entries if e.status == DutyStatus.DRIVING)


def test_simple_one_day_trip():
    # 7h driving @ 60mph = 420 miles, no fuel stop, no break (under 8h driving).
    plan = plan_trip(RouteInput(total_miles=420.0, total_driving_hours=7.0), 0.0, START)
    assert plan.incomplete is False
    assert round(driving_total(plan), 2) == 7.0
    # Pickup first, dropoff last, both 1h on-duty-not-driving.
    assert plan.entries[0].status == DutyStatus.ON_DUTY_NOT_DRIVING
    assert plan.entries[0].note == "Pickup"
    assert plan.entries[0].duration_hours == 1.0
    last = plan.entries[-1]
    assert last.status == DutyStatus.ON_DUTY_NOT_DRIVING
    assert last.note == "Dropoff"
    assert last.duration_hours == 1.0
    # One log sheet, totals sum to 24.
    assert len(plan.logs) == 1
    assert sum(plan.logs[0].totals.values()) == 24.0


def test_contiguous_timeline_no_gaps():
    plan = plan_trip(RouteInput(total_miles=420.0, total_driving_hours=7.0), 0.0, START)
    for a, b in zip(plan.entries, plan.entries[1:]):
        assert a.end == b.start
