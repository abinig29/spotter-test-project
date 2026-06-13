from datetime import datetime
from app.hos.engine import plan_trip
from app.hos.models import RouteInput

START = datetime(2026, 1, 1, 6)


def test_stops_carry_mile_markers():
    # 2200mi/22h @ 100mph: fuel at ~1000 and ~2000 miles, pickup at 0, dropoff at total.
    plan = plan_trip(RouteInput(2200.0, 22.0), 0.0, START)
    by_type = {}
    for s in plan.stops:
        by_type.setdefault(s.type, []).append(s.mile_marker)
    assert by_type["pickup"][0] == 0.0
    assert by_type["dropoff"][0] == 2200.0
    fuels = sorted(by_type["fuel"])
    assert len(fuels) == 2
    assert abs(fuels[0] - 1000.0) < 1.0
    assert abs(fuels[1] - 2000.0) < 1.0
