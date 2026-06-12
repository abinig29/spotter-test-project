from datetime import datetime

from app.hos.engine import plan_trip
from app.hos.models import RouteInput

START = datetime(2026, 1, 1, 6)


def test_pickup_dropoff_cannot_overshoot_70h_cap():
    # 69 used + near-zero route: pickup fits to exactly 70, dropoff cannot fit.
    plan = plan_trip(RouteInput(0.0, 0.0), 69.0, START)
    assert plan.total_cycle_hours_used <= 70.0 + 1e-6
    assert plan.incomplete is True
    assert plan.cycle_hours_warning is not None
