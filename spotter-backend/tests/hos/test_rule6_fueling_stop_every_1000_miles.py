from datetime import datetime, timedelta
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def _fuel_stops(plan):
    return [e for e in plan.entries if e.note == "Fueling stop"]


class Rule6_FuelingStopEvery1000Miles:
    def test_no_fuel_stop_for_trips_under_1000_miles(self):
        plan = plan_trip(RouteInput(800.0, 8.0), 0.0, START)  # mph 100
        assert len(_fuel_stops(plan)) == 0

    def test_one_fuel_stop_for_trips_between_1000_and_2000_miles(self):
        plan = plan_trip(RouteInput(1400.0, 14.0), 0.0, START)  # mph 100
        assert len(_fuel_stops(plan)) == 1

    def test_two_fuel_stops_for_trips_over_2000_miles(self):
        plan = plan_trip(RouteInput(2200.0, 22.0), 0.0, START)  # mph 100
        assert len(_fuel_stops(plan)) == 2

    def test_fuel_stop_logged_as_on_duty_not_driving(self):
        plan = plan_trip(RouteInput(1400.0, 14.0), 0.0, START)
        assert _fuel_stops(plan)[0].status == DutyStatus.ON_DUTY_NOT_DRIVING

    def test_fuel_stop_duration_is_30_minutes(self):
        plan = plan_trip(RouteInput(1400.0, 14.0), 0.0, START)
        assert round(_fuel_stops(plan)[0].duration_hours, 2) == 0.5

    def test_fuel_stop_counts_toward_14_hour_window(self):
        # The first fuel stop on Day 1 falls inside the 6:00am + 14h window.
        plan = plan_trip(RouteInput(1400.0, 14.0), 0.0, START)
        window_end = START + timedelta(hours=14)
        first_fuel = _fuel_stops(plan)[0]
        assert first_fuel.start < window_end
