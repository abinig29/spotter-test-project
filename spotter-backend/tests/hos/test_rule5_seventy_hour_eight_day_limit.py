from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)
ON_DUTY = {DutyStatus.DRIVING, DutyStatus.ON_DUTY_NOT_DRIVING}


def _on_duty_hours(plan):
    return sum(e.duration_hours for e in plan.entries if e.status in ON_DUTY)


class Rule5_SeventyHourEightDayLimit:
    def test_trip_respects_remaining_cycle_hours(self):
        # 65 used -> 5 left. Long route, but on-duty scheduled must not exceed 5 more.
        plan = plan_trip(RouteInput(1200.0, 20.0), 65.0, START)
        assert _on_duty_hours(plan) <= 5.0 + 1e-6
        assert plan.cycle_hours_warning is not None

    def test_full_cycle_available_when_zero_hours_used(self):
        # 20h driving completes (well under 70h) with no early forced stop.
        plan = plan_trip(RouteInput(1200.0, 20.0), 0.0, START)
        assert plan.incomplete is False
        assert plan.entries[-1].note == "Dropoff"

    def test_cycle_hours_include_both_driving_and_on_duty_not_driving(self):
        # 60 used + 3h driving + 1h pickup + 1h dropoff = 65.
        plan = plan_trip(RouteInput(180.0, 3.0), 60.0, START)
        assert round(plan.total_cycle_hours_used, 2) == 65.0

    def test_warning_raised_when_cycle_hours_exceeded(self):
        # 69 used: pickup pushes to 70, no driving room left.
        plan = plan_trip(RouteInput(600.0, 10.0), 69.0, START)
        assert plan.cycle_hours_warning is not None
        assert plan.incomplete is True
