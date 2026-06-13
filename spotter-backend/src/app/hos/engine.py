from __future__ import annotations

from datetime import datetime, timedelta

from app.hos import constants as C
from app.hos.daysplit import build_day_logs
from app.hos.models import LogEntry, RouteInput, Stop, TripPlan
from app.hos.statuses import DutyStatus


def _hours(h: float) -> timedelta:
    return timedelta(hours=h)


def plan_trip(
    route: RouteInput,
    cycle_hours_used: float,
    start_dt: datetime | None = None,
    pickup_location: str | None = None,
    dropoff_location: str | None = None,
) -> TripPlan:
    if start_dt is None:
        start_dt = datetime(2026, 1, 1, C.START_HOUR, 0, 0)
    sim = _Simulation(route, cycle_hours_used, start_dt, pickup_location, dropoff_location)
    sim.run()
    logs = build_day_logs(sim.entries, start_dt)
    return TripPlan(
        entries=sim.entries,
        stops=sim.stops,
        logs=logs,
        cycle_hours_warning=sim.warning,
        total_cycle_hours_used=round(sim.cycle_used, 2),
        incomplete=sim.incomplete,
    )


class _Simulation:
    def __init__(self, route, cycle_hours_used, start_dt, pickup_location, dropoff_location):
        self.route = route
        self.clock = start_dt
        self.cycle_used = float(cycle_hours_used)
        self.pickup_location = pickup_location
        self.dropoff_location = dropoff_location

        self.entries: list[LogEntry] = []
        self.stops: list[Stop] = []
        self.warning: str | None = None
        self.incomplete = False

        # Per-day clocks (reset on 10-hour rest).
        self.driving_today = 0.0
        self.drive_since_break = 0.0
        self.window_start: datetime | None = None

        # Trip progress.
        self.drive_remaining = float(route.total_driving_hours)
        self.miles_done = 0.0
        self.next_fuel_mile = C.FUEL_INTERVAL_MILES
        self.mph = (
            route.total_miles / route.total_driving_hours
            if route.total_driving_hours > C.EPS
            else 0.0
        )

    # --- helpers -----------------------------------------------------------
    def _add(self, status, hours, location=None, note=None, miles=0.0):
        end = self.clock + _hours(hours)
        self.entries.append(LogEntry(status, self.clock, end, location, note, miles))
        self.clock = end
        return end

    def _cap_remaining(self) -> float:
        return C.CYCLE_LIMIT_HOURS - self.cycle_used

    # --- top-level flow ----------------------------------------------------
    def run(self):
        self._pickup()
        if not self.incomplete:
            self._drive()
        if not self.incomplete:
            self._dropoff()
        self._finalize_warning()

    def _pickup(self):
        # Rule 5: don't schedule the on-duty block if it would exceed the 70h cap.
        if C.PICKUP_DURATION_HOURS > self._cap_remaining() + C.EPS:
            self.incomplete = True
            return
        self.window_start = self.clock  # Rule 2/7: window starts at the first on-duty event.
        start = self.clock
        self._add(DutyStatus.ON_DUTY_NOT_DRIVING, C.PICKUP_DURATION_HOURS,
                  self.pickup_location, "Pickup")
        self.cycle_used += C.PICKUP_DURATION_HOURS
        self.stops.append(Stop("pickup", self.pickup_location, None, None, start,
                               C.PICKUP_DURATION_HOURS, mile_marker=0.0))

    def _dropoff(self):
        # Rule 5: don't schedule the on-duty block if it would exceed the 70h cap.
        if C.DROPOFF_DURATION_HOURS > self._cap_remaining() + C.EPS:
            self.incomplete = True
            return
        start = self.clock
        self._add(DutyStatus.ON_DUTY_NOT_DRIVING, C.DROPOFF_DURATION_HOURS,
                  self.dropoff_location, "Dropoff")
        self.cycle_used += C.DROPOFF_DURATION_HOURS
        self.stops.append(Stop("dropoff", self.dropoff_location, None, None, start,
                               C.DROPOFF_DURATION_HOURS, mile_marker=self.route.total_miles))

    # --- driving loop ------------------------------------------------------
    def _drive(self):
        while self.drive_remaining > C.EPS:
            if self.window_start is None:
                self.window_start = self.clock

            if self._cap_remaining() <= C.EPS:
                self.incomplete = True
                return

            window_end = self.window_start + _hours(C.DRIVING_WINDOW_HOURS)
            to_window = (window_end - self.clock).total_seconds() / 3600.0
            if to_window <= C.EPS:
                self._rest()
                continue

            to_break = C.HOURS_BEFORE_BREAK - self.drive_since_break
            if to_break <= C.EPS:
                self._break()
                continue

            to_11 = C.MAX_DRIVING_HOURS - self.driving_today
            if to_11 <= C.EPS:
                self._rest()
                continue

            to_fuel = self._hours_to_next_fuel()
            if to_fuel <= C.EPS:
                self._fuel()
                continue

            chunk = min(to_break, to_11, to_window, self._cap_remaining(), to_fuel,
                        self.drive_remaining)
            self._drive_chunk(chunk)

    def _hours_to_next_fuel(self) -> float:
        if self.mph <= C.EPS or self.next_fuel_mile > self.route.total_miles + C.EPS:
            return float("inf")
        return max((self.next_fuel_mile - self.miles_done) / self.mph, 0.0)

    def _drive_chunk(self, hours: float):
        miles = hours * self.mph
        self._add(DutyStatus.DRIVING, hours, miles=miles)
        self.driving_today += hours
        self.drive_since_break += hours
        self.drive_remaining -= hours
        self.miles_done += miles
        self.cycle_used += hours

    def _break(self):
        # Rule 3: 30-min break, logged off-duty. Resets only the 8-hour counter.
        self._add(DutyStatus.OFF_DUTY, C.BREAK_DURATION_HOURS, note="30-min break")
        self.drive_since_break = 0.0

    def _fuel(self):
        start = self.clock
        self._add(DutyStatus.ON_DUTY_NOT_DRIVING, C.FUEL_DURATION_HOURS, note="Fueling stop")
        self.cycle_used += C.FUEL_DURATION_HOURS
        self.stops.append(Stop("fuel", None, None, None, start, C.FUEL_DURATION_HOURS,
                               mile_marker=self.miles_done))
        self.next_fuel_mile += C.FUEL_INTERVAL_MILES

    def _rest(self):
        # Rule 4: 10 consecutive hours of sleeper berth; resets the day's clocks.
        start = self.clock
        self._add(DutyStatus.SLEEPER_BERTH, C.REST_DURATION_HOURS, note="10-hour rest")
        self.stops.append(Stop("rest", None, None, None, start, C.REST_DURATION_HOURS,
                               mile_marker=self.miles_done))
        self.driving_today = 0.0
        self.drive_since_break = 0.0
        self.window_start = None

    def _finalize_warning(self):
        if self.incomplete:
            self.warning = (
                f"Cycle hours reached the 70-hour limit "
                f"(used {self.cycle_used:.1f}h); trip not completable this cycle."
            )
        elif self.cycle_used >= C.CYCLE_LIMIT_HOURS - C.EPS:
            self.warning = f"Cycle hours at the 70-hour limit (used {self.cycle_used:.1f}h)."
