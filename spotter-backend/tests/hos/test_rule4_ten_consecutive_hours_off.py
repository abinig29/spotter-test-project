from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def _rests(plan):
    return [e for e in plan.entries if e.status == DutyStatus.SLEEPER_BERTH]


class Rule4_TenConsecutiveHoursOff:
    def test_10_hour_rest_inserted_after_day_ends(self):
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        rests = _rests(plan)
        assert len(rests) >= 1
        assert round(rests[0].duration_hours, 2) == 10.0

    def test_rest_is_logged_as_sleeper_berth(self):
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        for r in _rests(plan):
            assert r.status == DutyStatus.SLEEPER_BERTH

    def test_driving_limits_reset_after_10_hour_rest(self):
        # Day 1 uses 11 driving hours; day 2 starts fresh and finishes the remaining 3h.
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert plan.logs[0].totals["driving"] == 11.0
        assert plan.logs[1].totals["driving"] == 3.0

    def test_new_log_sheet_created_after_rest(self):
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        # One rest => two days => two log sheets.
        assert len(plan.logs) == 2
        assert len(_rests(plan)) == len(plan.logs) - 1
