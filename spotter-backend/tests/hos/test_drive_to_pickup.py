from datetime import datetime, timedelta

from app.hos.engine import plan_trip
from app.hos.models import RouteInput
from app.hos.statuses import DutyStatus

START = datetime(2026, 1, 1, 6)


def _drive_hours(entries):
    return sum(e.duration_hours for e in entries if e.status == DutyStatus.DRIVING)


class Rule7_DriveToPickup:
    """Rule 7 refinement: the current->pickup leg is driven *before* the 1h pickup."""

    def test_first_entry_is_drive_to_pickup_not_pickup_block(self):
        plan = plan_trip(
            RouteInput(470.8, 8.0, pickup_miles=20.0, pickup_driving_hours=0.5),
            0.0, START, pickup_location="Pickupville",
        )
        assert plan.entries[0].status == DutyStatus.DRIVING

    def test_pickup_block_comes_after_drive_to_pickup_leg(self):
        plan = plan_trip(
            RouteInput(470.8, 8.0, pickup_miles=20.0, pickup_driving_hours=0.5),
            0.0, START, pickup_location="Pickupville",
        )
        pickup = next(e for e in plan.entries if e.note == "Pickup")
        before = plan.entries[: plan.entries.index(pickup)]
        assert abs(_drive_hours(before) - 0.5) < 1e-6

    def test_window_starts_at_first_drive_not_pickup(self):
        plan = plan_trip(
            RouteInput(470.8, 8.0, pickup_miles=20.0, pickup_driving_hours=0.5),
            0.0, START,
        )
        assert plan.entries[0].start == START
        pickup = next(e for e in plan.entries if e.note == "Pickup")
        assert pickup.start == START + timedelta(hours=0.5)

    def test_total_driving_unchanged_by_split(self):
        plan = plan_trip(
            RouteInput(470.8, 8.0, pickup_miles=20.0, pickup_driving_hours=0.5),
            0.0, START,
        )
        assert abs(_drive_hours(plan.entries) - 8.0) < 1e-6

    def test_zero_pickup_leg_keeps_pickup_first(self):
        # Backward compatible: no separate leg -> pickup is still the first event.
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START)
        assert plan.entries[0].status == DutyStatus.ON_DUTY_NOT_DRIVING
        assert plan.entries[0].note == "Pickup"
