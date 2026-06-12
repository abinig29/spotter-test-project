from datetime import datetime, timedelta
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


class Rule7_OneHourPickupAndDropoff:
    def test_pickup_logged_as_1_hour_on_duty_not_driving(self):
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START,
                         pickup_location="Chicago, IL", dropoff_location="Nashville, TN")
        first = plan.entries[0]
        assert first.status == DutyStatus.ON_DUTY_NOT_DRIVING
        assert first.duration_hours == 1.0
        assert first.note == "Pickup"

    def test_dropoff_logged_as_1_hour_on_duty_not_driving(self):
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START,
                         pickup_location="Chicago, IL", dropoff_location="Nashville, TN")
        last = plan.entries[-1]
        assert last.status == DutyStatus.ON_DUTY_NOT_DRIVING
        assert last.duration_hours == 1.0
        assert last.note == "Dropoff"

    def test_pickup_starts_14_hour_window(self):
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START)
        assert plan.entries[0].start == START  # window starts at pickup, 6:00am
        first_drive = next(e for e in plan.entries if e.status == DutyStatus.DRIVING)
        assert first_drive.start == START + timedelta(hours=1)  # driving 1h later

    def test_pickup_and_dropoff_count_toward_cycle_hours(self):
        # 68 used + 1h pickup + 1h dropoff = 70 (tiny route, ~0 driving).
        plan = plan_trip(RouteInput(0.0, 0.0), 68.0, START)
        assert round(plan.total_cycle_hours_used, 2) == 70.0
        assert plan.cycle_hours_warning is not None

    def test_pickup_and_dropoff_both_appear_in_log_remarks(self):
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START,
                         pickup_location="Chicago, IL", dropoff_location="Nashville, TN")
        all_remarks = [r for log in plan.logs for r in log.remarks]
        assert any("Pickup" in r for r in all_remarks)
        assert any("Dropoff" in r for r in all_remarks)
