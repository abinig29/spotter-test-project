import pytest
from datetime import datetime
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)

SCENARIOS = [
    RouteInput(0.0, 0.0),       # identical points: pickup + dropoff only
    RouteInput(420.0, 7.0),     # one-day trip
    RouteInput(840.0, 14.0),    # two-day trip
    RouteInput(2200.0, 22.0),   # multi-day with fuel stops
]


@pytest.mark.parametrize("route", SCENARIOS)
def test_every_day_totals_sum_to_24(route):
    plan = plan_trip(route, 0.0, START)
    for log in plan.logs:
        assert abs(sum(log.totals.values()) - 24.0) < 0.01

@pytest.mark.parametrize("route", SCENARIOS)
def test_log_sheet_count_matches_days(route):
    plan = plan_trip(route, 0.0, START)
    # Day numbers are contiguous starting at 1.
    assert [log.day for log in plan.logs] == list(range(1, len(plan.logs) + 1))
