from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def _day1_driving(plan):
    return plan.logs[0].totals["driving"]


def _has_10h_rest(plan):
    return any(
        e.status == DutyStatus.SLEEPER_BERTH and round(e.duration_hours, 2) == 10.0
        for e in plan.entries
    )


class Rule1_ElevenHourDrivingLimit:
    def test_driving_stops_at_11_hours(self):
        # 14h of driving needed @ 60mph (840mi, under fuel interval).
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert _day1_driving(plan) == 11.0
        assert _has_10h_rest(plan)

    def test_cumulative_driving_across_segments_stops_at_11(self):
        # Driving is cumulative across breaks; day 1 still caps at 11h.
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert _day1_driving(plan) == 11.0
        assert _has_10h_rest(plan)

    def test_driving_under_11_hours_no_forced_rest(self):
        # 7h total driving — never hits the 11h limit, no mid-trip rest.
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START)
        assert not _has_10h_rest(plan)
