from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def _breaks(plan):
    return [e for e in plan.entries if e.note == "30-min break"]


class Rule3_ThirtyMinuteRestBreak:
    def test_break_inserted_after_8_cumulative_driving_hours(self):
        # 10h driving @ 60mph (600mi, no fuel) -> one break after 8h.
        plan = plan_trip(RouteInput(600.0, 10.0), 0.0, START)
        breaks = _breaks(plan)
        assert len(breaks) == 1
        # Driving before the break sums to 8h.
        idx = plan.entries.index(breaks[0])
        before = sum(e.duration_hours for e in plan.entries[:idx]
                     if e.status == DutyStatus.DRIVING)
        assert round(before, 2) == 8.0

    def test_break_is_consecutive_30_minutes(self):
        plan = plan_trip(RouteInput(600.0, 10.0), 0.0, START)
        b = _breaks(plan)[0]
        assert round(b.duration_hours, 2) == 0.5
        assert b.status == DutyStatus.OFF_DUTY

    def test_break_does_not_reset_driving_clock(self):
        # 14h needed: day 1 = 8h + break + 3h = 11h driving, then rest.
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert plan.logs[0].totals["driving"] == 11.0

    def test_break_does_not_reset_14_hour_window(self):
        from datetime import timedelta
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        window_end = START + timedelta(hours=14)
        for e in plan.entries:
            if e.status == DutyStatus.DRIVING and e.start < window_end:
                assert e.end <= window_end + timedelta(seconds=1)

    def test_cumulative_driving_resets_after_break(self):
        # 10h driving: 8h -> break -> 2h. Only the first 8h block triggers a break.
        plan = plan_trip(RouteInput(600.0, 10.0), 0.0, START)
        assert len(_breaks(plan)) == 1
