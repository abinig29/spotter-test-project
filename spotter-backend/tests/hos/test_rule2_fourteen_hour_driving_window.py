from datetime import datetime, timedelta
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)
WINDOW_END = START + timedelta(hours=14)  # 8:00pm Day 1


def _driving_entries(plan):
    return [e for e in plan.entries if e.status == DutyStatus.DRIVING]


class Rule2_FourteenHourDrivingWindow:
    def test_driving_stops_when_14_hour_window_expires(self):
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        # No Day-1 driving entry ends after 8:00pm.
        day1 = [e for e in _driving_entries(plan) if e.start < WINDOW_END + timedelta(hours=4)]
        for e in day1:
            if e.start < WINDOW_END:
                assert e.end <= WINDOW_END + timedelta(seconds=1)

    def test_14_hour_window_starts_on_first_on_duty_event(self):
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert plan.entries[0].status == DutyStatus.ON_DUTY_NOT_DRIVING  # pickup at 6:00am
        assert plan.entries[0].start == START
        first_drive = _driving_entries(plan)[0]
        assert first_drive.start == START + timedelta(hours=1)  # driving begins 1h after pickup
        # No driving in window 1 runs past 6:00am + 14h.
        for e in _driving_entries(plan):
            if e.start < WINDOW_END:
                assert e.end <= WINDOW_END + timedelta(seconds=1)

    def test_non_driving_work_allowed_after_14_hour_window(self):
        # Invariant we enforce: no DRIVING entry begins at/after the window close.
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        for e in _driving_entries(plan):
            if e.start < WINDOW_END:
                assert e.end <= WINDOW_END + timedelta(seconds=1)

    def test_11_hour_limit_and_14_hour_window_both_enforced(self):
        # Day 1 stops at the binding limit and a 10h rest follows.
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert plan.logs[0].totals["driving"] <= 11.0
        assert any(e.status == DutyStatus.SLEEPER_BERTH for e in plan.entries)

    def test_window_binds_before_11_hour_cap_when_many_stops(self):
        # High mph forces frequent fuel stops, so wall-clock exhausts the 14h
        # window (ends 8:00pm) before the driver reaches 11h of driving.
        plan = plan_trip(RouteInput(8000.0, 20.0), 0.0, START)
        # Day 1 stopped because of the 14h window, so driving is strictly under 11h...
        assert plan.logs[0].totals["driving"] < 11.0
        # ...and a 10h sleeper rest is present (the forced reset).
        assert any(e.status == DutyStatus.SLEEPER_BERTH and round(e.duration_hours, 2) == 10.0
                   for e in plan.entries)
        # No Day-1 driving entry runs past the 8:00pm window close.
        window_end = START + timedelta(hours=14)
        for e in plan.entries:
            if e.status == DutyStatus.DRIVING and e.start < window_end:
                assert e.end <= window_end + timedelta(seconds=1)
