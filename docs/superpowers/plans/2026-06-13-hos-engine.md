# HOS Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-Python Hours-of-Service calculation engine and its 7 rule-named test suites, the graded core of the Spotter ELD Trip Planner.

**Architecture:** A Django-free package `src/app/hos/` exposing one entry point, `plan_trip(route, cycle_hours_used, start_dt) -> TripPlan`. A continuous-clock simulation emits `LogEntry` blocks using an advance-to-next-threshold loop; `daysplit.py` slices the timeline at midnight into per-day log sheets whose four status totals sum to exactly 24h. Tests construct `RouteInput` directly — no network, no DB.

**Tech Stack:** Python 3.11+, pytest, `uv`. Standard library only (`dataclasses`, `datetime`, `enum`).

**Spec:** [docs/superpowers/specs/2026-06-13-hos-engine-design.md](../specs/2026-06-13-hos-engine-design.md)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/app/hos/__init__.py` | Package marker; re-exports `plan_trip`. |
| `src/app/hos/statuses.py` | `DutyStatus` enum. |
| `src/app/hos/constants.py` | All HOS rule numbers. |
| `src/app/hos/models.py` | `RouteInput`, `LogEntry`, `Stop`, `DayLog`, `TripPlan`. |
| `src/app/hos/daysplit.py` | Midnight-split + per-day totals/remarks. |
| `src/app/hos/engine.py` | `plan_trip` + `_Simulation`. |
| `tests/hos/test_rule1_eleven_hour_driving_limit.py` … `test_rule7_*` | The 7 rule suites. |
| `tests/hos/test_daysplit_invariants.py` | 24-hour sum invariant. |

**Running engine tests** (the pre-existing `tests/test_main.py` is unrelated and currently failing on Django settings — do not run the whole suite; target the `hos` dir):

```bash
cd spotter-backend && uv run --extra dev pytest tests/hos -v
```

---

## Task 1: Package scaffold — enum, constants, models

**Files:**
- Create: `src/app/hos/__init__.py`
- Create: `src/app/hos/statuses.py`
- Create: `src/app/hos/constants.py`
- Create: `src/app/hos/models.py`
- Create: `tests/hos/__init__.py`
- Test: `tests/hos/test_models.py`

- [ ] **Step 1: Write the failing test**

`tests/hos/test_models.py`:
```python
from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput, LogEntry


def test_duty_status_values():
    assert DutyStatus.OFF_DUTY.value == "off_duty"
    assert DutyStatus.SLEEPER_BERTH.value == "sleeper_berth"
    assert DutyStatus.DRIVING.value == "driving"
    assert DutyStatus.ON_DUTY_NOT_DRIVING.value == "on_duty_not_driving"


def test_log_entry_duration_hours():
    e = LogEntry(DutyStatus.DRIVING, datetime(2026, 1, 1, 7), datetime(2026, 1, 1, 9))
    assert e.duration_hours == 2.0


def test_route_input_fields():
    r = RouteInput(total_miles=470.0, total_driving_hours=7.2)
    assert r.total_miles == 470.0
    assert r.total_driving_hours == 7.2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --extra dev pytest tests/hos/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.hos'`.

- [ ] **Step 3: Create the package files**

`src/app/hos/__init__.py`:
```python
"""Pure-Python Hours-of-Service calculation engine (no Django imports)."""

from app.hos.engine import plan_trip

__all__ = ["plan_trip"]
```

`src/app/hos/statuses.py`:
```python
from enum import Enum


class DutyStatus(str, Enum):
    OFF_DUTY = "off_duty"
    SLEEPER_BERTH = "sleeper_berth"
    DRIVING = "driving"
    ON_DUTY_NOT_DRIVING = "on_duty_not_driving"
```

`src/app/hos/constants.py`:
```python
"""Fixed HOS rule numbers. These never change based on user input."""

START_HOUR = 6                  # Trip starts 6:00am on Day 1
MAX_DRIVING_HOURS = 11.0        # Rule 1
DRIVING_WINDOW_HOURS = 14.0     # Rule 2
HOURS_BEFORE_BREAK = 8.0        # Rule 3
BREAK_DURATION_HOURS = 0.5      # Rule 3
REST_DURATION_HOURS = 10.0      # Rule 4
CYCLE_LIMIT_HOURS = 70.0        # Rule 5
FUEL_INTERVAL_MILES = 1000.0    # Rule 6
FUEL_DURATION_HOURS = 0.5       # Rule 6
PICKUP_DURATION_HOURS = 1.0     # Rule 7
DROPOFF_DURATION_HOURS = 1.0    # Rule 7
EPS = 1e-6
```

`src/app/hos/models.py`:
```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.hos.statuses import DutyStatus


@dataclass(frozen=True)
class RouteInput:
    total_miles: float
    total_driving_hours: float


@dataclass
class LogEntry:
    status: DutyStatus
    start: datetime
    end: datetime
    location: str | None = None
    note: str | None = None
    miles: float = 0.0

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


@dataclass
class Stop:
    type: str  # "pickup" | "fuel" | "rest" | "dropoff"
    location: str | None
    lat: float | None
    lng: float | None
    arrival: datetime
    duration_hours: float


@dataclass
class DayLog:
    day: int
    date: str
    total_miles_today: float
    entries: list[LogEntry]
    totals: dict[str, float]
    remarks: list[str]


@dataclass
class TripPlan:
    entries: list[LogEntry] = field(default_factory=list)
    stops: list[Stop] = field(default_factory=list)
    logs: list[DayLog] = field(default_factory=list)
    cycle_hours_warning: str | None = None
    total_cycle_hours_used: float = 0.0
    incomplete: bool = False
```

`tests/hos/__init__.py`: empty file.

> Note: `__init__.py` imports `engine`, which doesn't exist yet — that's fine because Task 1's test imports `statuses`/`models` directly, not the package root. If `pytest` collection fails on the package import, temporarily comment the import in `__init__.py` and restore it in Task 3. (Simplest: leave `__init__.py` body empty until Task 3, then add the re-export.) **Do the simplest thing: make `tests/hos/__init__.py` and `src/app/hos/__init__.py` empty for now; add the `plan_trip` re-export in Task 3 Step 5.**

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --extra dev pytest tests/hos/test_models.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/app/hos/__init__.py src/app/hos/statuses.py src/app/hos/constants.py src/app/hos/models.py tests/hos/__init__.py tests/hos/test_models.py
git commit -m "feat(hos): scaffold engine package — statuses, constants, models"
```

---

## Task 2: Day-splitting module

**Files:**
- Create: `src/app/hos/daysplit.py`
- Test: `tests/hos/test_daysplit.py`

- [ ] **Step 1: Write the failing test**

`tests/hos/test_daysplit.py`:
```python
from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import LogEntry
from app.hos.daysplit import build_day_logs


def _entry(status, sh, eh, day_start=datetime(2026, 1, 1), **kw):
    return LogEntry(status, day_start.replace(hour=sh), day_start.replace(hour=eh), **kw)


def test_single_day_totals_sum_to_24():
    start = datetime(2026, 1, 1, 6)
    entries = [
        LogEntry(DutyStatus.ON_DUTY_NOT_DRIVING, datetime(2026, 1, 1, 6), datetime(2026, 1, 1, 7), note="Pickup"),
        LogEntry(DutyStatus.DRIVING, datetime(2026, 1, 1, 7), datetime(2026, 1, 1, 14), miles=420.0),
        LogEntry(DutyStatus.ON_DUTY_NOT_DRIVING, datetime(2026, 1, 1, 14), datetime(2026, 1, 1, 15), note="Dropoff"),
    ]
    logs = build_day_logs(entries, start)
    assert len(logs) == 1
    assert logs[0].day == 1
    assert logs[0].date == "2026-01-01"
    assert sum(logs[0].totals.values()) == 24.0
    # 00:00-06:00 and 15:00-24:00 are off-duty fill = 6 + 9 = 15
    assert logs[0].totals["off_duty"] == 15.0
    assert logs[0].totals["driving"] == 7.0
    assert logs[0].total_miles_today == 420.0
    assert "Pickup" in logs[0].remarks[0]


def test_entry_crossing_midnight_is_split_into_two_days():
    start = datetime(2026, 1, 1, 6)
    entries = [
        LogEntry(DutyStatus.SLEEPER_BERTH, datetime(2026, 1, 1, 20), datetime(2026, 1, 2, 6), note="10-hour rest"),
    ]
    logs = build_day_logs(entries, start)
    assert len(logs) == 2
    assert sum(logs[0].totals.values()) == 24.0
    assert sum(logs[1].totals.values()) == 24.0
    # Day 1: 20:00-24:00 sleeper = 4h; Day 2: 00:00-06:00 sleeper = 6h
    assert logs[0].totals["sleeper_berth"] == 4.0
    assert logs[1].totals["sleeper_berth"] == 6.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --extra dev pytest tests/hos/test_daysplit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.hos.daysplit'`.

- [ ] **Step 3: Implement `daysplit.py`**

`src/app/hos/daysplit.py`:
```python
from __future__ import annotations

from datetime import datetime, timedelta

from app.hos.models import DayLog, LogEntry
from app.hos.statuses import DutyStatus


def _day_start(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _miles_part(e: LogEntry, seg_start: datetime, seg_end: datetime) -> float:
    total = (e.end - e.start).total_seconds()
    if total <= 0:
        return 0.0
    return e.miles * ((seg_end - seg_start).total_seconds() / total)


def _split_at_midnights(entries: list[LogEntry]) -> list[LogEntry]:
    out: list[LogEntry] = []
    for e in entries:
        seg_start = e.start
        first = True
        while True:
            next_midnight = _day_start(seg_start) + timedelta(days=1)
            seg_end = min(e.end, next_midnight)
            out.append(
                LogEntry(
                    e.status,
                    seg_start,
                    seg_end,
                    e.location if first else None,
                    e.note if first else None,
                    _miles_part(e, seg_start, seg_end),
                )
            )
            first = False
            if e.end <= next_midnight:
                break
            seg_start = next_midnight
    return out


def _build_remarks(entries: list[LogEntry]) -> list[str]:
    remarks: list[str] = []
    for e in entries:
        if e.note:
            location = e.location or "En route"
            remarks.append(f"{location} — {e.note}")
    return remarks


def build_day_logs(entries: list[LogEntry], start_dt: datetime) -> list[DayLog]:
    if not entries:
        return []

    full: list[LogEntry] = []

    # Fill Day 1 from 00:00 to the first entry's start with off-duty.
    day1_midnight = _day_start(start_dt)
    if entries[0].start > day1_midnight:
        full.append(LogEntry(DutyStatus.OFF_DUTY, day1_midnight, entries[0].start))

    full.extend(entries)

    # Fill the tail of the final day to the next midnight with off-duty.
    last_end = entries[-1].end
    midnight_of_last = _day_start(last_end)
    next_midnight = midnight_of_last + timedelta(days=1)
    if last_end != midnight_of_last and last_end < next_midnight:
        full.append(LogEntry(DutyStatus.OFF_DUTY, last_end, next_midnight))

    split = _split_at_midnights(full)

    # Group by calendar day, preserving order.
    order: list[datetime] = []
    buckets: dict[datetime, list[LogEntry]] = {}
    for e in split:
        key = _day_start(e.start)
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(e)

    logs: list[DayLog] = []
    for day_number, key in enumerate(order, start=1):
        day_entries = buckets[key]
        totals = {s.value: 0.0 for s in DutyStatus}
        miles = 0.0
        for e in day_entries:
            totals[e.status.value] += e.duration_hours
            miles += e.miles
        logs.append(
            DayLog(
                day=day_number,
                date=key.strftime("%Y-%m-%d"),
                total_miles_today=round(miles, 1),
                entries=day_entries,
                totals={k: round(v, 2) for k, v in totals.items()},
                remarks=_build_remarks(day_entries),
            )
        )
    return logs
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --extra dev pytest tests/hos/test_daysplit.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/app/hos/daysplit.py tests/hos/test_daysplit.py
git commit -m "feat(hos): day-splitting into per-day log sheets summing to 24h"
```

---

## Task 3: Simulation engine + integration test

**Files:**
- Create: `src/app/hos/engine.py`
- Modify: `src/app/hos/__init__.py` (add `plan_trip` re-export)
- Test: `tests/hos/test_engine_integration.py`

- [ ] **Step 1: Write the failing test**

`tests/hos/test_engine_integration.py`:
```python
from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def driving_total(plan):
    return sum(e.duration_hours for e in plan.entries if e.status == DutyStatus.DRIVING)


def test_simple_one_day_trip():
    # 7h driving @ 60mph = 420 miles, no fuel stop, no break (under 8h driving).
    plan = plan_trip(RouteInput(total_miles=420.0, total_driving_hours=7.0), 0.0, START)
    assert plan.incomplete is False
    assert round(driving_total(plan), 2) == 7.0
    # Pickup first, dropoff last, both 1h on-duty-not-driving.
    assert plan.entries[0].status == DutyStatus.ON_DUTY_NOT_DRIVING
    assert plan.entries[0].note == "Pickup"
    assert plan.entries[0].duration_hours == 1.0
    last = plan.entries[-1]
    assert last.status == DutyStatus.ON_DUTY_NOT_DRIVING
    assert last.note == "Dropoff"
    assert last.duration_hours == 1.0
    # One log sheet, totals sum to 24.
    assert len(plan.logs) == 1
    assert sum(plan.logs[0].totals.values()) == 24.0


def test_contiguous_timeline_no_gaps():
    plan = plan_trip(RouteInput(total_miles=420.0, total_driving_hours=7.0), 0.0, START)
    for a, b in zip(plan.entries, plan.entries[1:]):
        assert a.end == b.start
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --extra dev pytest tests/hos/test_engine_integration.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.hos.engine'`.

- [ ] **Step 3: Implement `engine.py`**

`src/app/hos/engine.py`:
```python
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
        self.window_start = self.clock  # Rule 2/7: window starts at the first on-duty event.
        start = self.clock
        self._add(DutyStatus.ON_DUTY_NOT_DRIVING, C.PICKUP_DURATION_HOURS,
                  self.pickup_location, "Pickup")
        self.cycle_used += C.PICKUP_DURATION_HOURS
        self.stops.append(Stop("pickup", self.pickup_location, None, None, start,
                               C.PICKUP_DURATION_HOURS))

    def _dropoff(self):
        start = self.clock
        self._add(DutyStatus.ON_DUTY_NOT_DRIVING, C.DROPOFF_DURATION_HOURS,
                  self.dropoff_location, "Dropoff")
        self.cycle_used += C.DROPOFF_DURATION_HOURS
        self.stops.append(Stop("dropoff", self.dropoff_location, None, None, start,
                               C.DROPOFF_DURATION_HOURS))

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
        self.stops.append(Stop("fuel", None, None, None, start, C.FUEL_DURATION_HOURS))
        self.next_fuel_mile += C.FUEL_INTERVAL_MILES

    def _rest(self):
        # Rule 4: 10 consecutive hours of sleeper berth; resets the day's clocks.
        start = self.clock
        self._add(DutyStatus.SLEEPER_BERTH, C.REST_DURATION_HOURS, note="10-hour rest")
        self.stops.append(Stop("rest", None, None, None, start, C.REST_DURATION_HOURS))
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
```

- [ ] **Step 4: Add the re-export**

`src/app/hos/__init__.py` (replace empty body):
```python
"""Pure-Python Hours-of-Service calculation engine (no Django imports)."""

from app.hos.engine import plan_trip

__all__ = ["plan_trip"]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run --extra dev pytest tests/hos/test_engine_integration.py -v`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/app/hos/engine.py src/app/hos/__init__.py tests/hos/test_engine_integration.py
git commit -m "feat(hos): simulation engine (pickup, driving loop, rest, fuel, dropoff)"
```

---

## Task 4: Rule 1 — 11-Hour Driving Limit

**Files:**
- Test: `tests/hos/test_rule1_eleven_hour_driving_limit.py`

- [ ] **Step 1: Write the test suite**

```python
from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)


def _day1_driving(plan):
    return plan.logs[0].totals["driving"]


def _has_10h_rest(plan):
    return any(
        e.status == DutyStatus.SLEEPER_BERTH and round(e.duration_hours, 2) == 10.0
        for e in plan.entries
    )


class Rule1_ElevenHourDrivingLimit:
    def test_driving_stops_at_11_hours(self):
        # 14h of driving needed @ 60mph (840mi, under fuel interval).
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert _day1_driving(plan) == 11.0
        assert _has_10h_rest(plan)

    def test_cumulative_driving_across_segments_stops_at_11(self):
        # Driving is cumulative across breaks; day 1 still caps at 11h.
        plan = plan_trip(RouteInput(840.0, 14.0), 0.0, START)
        assert _day1_driving(plan) == 11.0
        assert _has_10h_rest(plan)

    def test_driving_under_11_hours_no_forced_rest(self):
        # 7h total driving — never hits the 11h limit, no mid-trip rest.
        plan = plan_trip(RouteInput(420.0, 7.0), 0.0, START)
        assert not _has_10h_rest(plan)
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule1_eleven_hour_driving_limit.py" -v`
Expected: PASS (3 passed). If a value is off, inspect with `-v` and adjust the engine, not the rule numbers in `constants.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule1_eleven_hour_driving_limit.py
git commit -m "test(hos): Rule 1 — 11-hour driving limit"
```

---

## Task 5: Rule 2 — 14-Hour Driving Window

**Files:**
- Test: `tests/hos/test_rule2_fourteen_hour_driving_window.py`

- [ ] **Step 1: Write the test suite**

```python
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
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule2_fourteen_hour_driving_window.py" -v`
Expected: PASS (4 passed).

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule2_fourteen_hour_driving_window.py
git commit -m "test(hos): Rule 2 — 14-hour driving window"
```

---

## Task 6: Rule 3 — 30-Minute Rest Break

**Files:**
- Test: `tests/hos/test_rule3_thirty_minute_rest_break.py`

- [ ] **Step 1: Write the test suite**

```python
from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)
BREAK_STATUSES = {DutyStatus.OFF_DUTY, DutyStatus.SLEEPER_BERTH, DutyStatus.ON_DUTY_NOT_DRIVING}


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
        assert b.status in BREAK_STATUSES

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
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule3_thirty_minute_rest_break.py" -v`
Expected: PASS (5 passed).

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule3_thirty_minute_rest_break.py
git commit -m "test(hos): Rule 3 — 30-minute rest break"
```

---

## Task 7: Rule 4 — 10 Consecutive Hours Off Between Shifts

**Files:**
- Test: `tests/hos/test_rule4_ten_consecutive_hours_off.py`

- [ ] **Step 1: Write the test suite**

```python
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
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule4_ten_consecutive_hours_off.py" -v`
Expected: PASS (4 passed).

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule4_ten_consecutive_hours_off.py
git commit -m "test(hos): Rule 4 — 10 consecutive hours off"
```

---

## Task 8: Rule 5 — 70-Hour / 8-Day Limit

**Files:**
- Test: `tests/hos/test_rule5_seventy_hour_eight_day_limit.py`

- [ ] **Step 1: Write the test suite**

```python
from datetime import datetime
from app.hos.statuses import DutyStatus
from app.hos.models import RouteInput
from app.hos.engine import plan_trip

START = datetime(2026, 1, 1, 6)
ON_DUTY = {DutyStatus.DRIVING, DutyStatus.ON_DUTY_NOT_DRIVING}


def _on_duty_hours(plan):
    return sum(e.duration_hours for e in plan.entries if e.status in ON_DUTY)


class Rule5_SeventyHourEightDayLimit:
    def test_trip_respects_remaining_cycle_hours(self):
        # 65 used -> 5 left. Long route, but on-duty scheduled must not exceed 5 more.
        plan = plan_trip(RouteInput(1200.0, 20.0), 65.0, START)
        assert _on_duty_hours(plan) <= 5.0 + 1e-6
        assert plan.cycle_hours_warning is not None

    def test_full_cycle_available_when_zero_hours_used(self):
        # 20h driving completes (well under 70h) with no early forced stop.
        plan = plan_trip(RouteInput(1200.0, 20.0), 0.0, START)
        assert plan.incomplete is False
        assert plan.entries[-1].note == "Dropoff"

    def test_cycle_hours_include_both_driving_and_on_duty_not_driving(self):
        # 60 used + 3h driving + 1h pickup + 1h dropoff = 65.
        plan = plan_trip(RouteInput(180.0, 3.0), 60.0, START)
        assert round(plan.total_cycle_hours_used, 2) == 65.0

    def test_warning_raised_when_cycle_hours_exceeded(self):
        # 69 used: pickup pushes to 70, no driving room left.
        plan = plan_trip(RouteInput(600.0, 10.0), 69.0, START)
        assert plan.cycle_hours_warning is not None
        assert plan.incomplete is True
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule5_seventy_hour_eight_day_limit.py" -v`
Expected: PASS (4 passed).

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule5_seventy_hour_eight_day_limit.py
git commit -m "test(hos): Rule 5 — 70-hour / 8-day cycle limit"
```

---

## Task 9: Rule 6 — Fueling Stop Every 1,000 Miles

**Files:**
- Test: `tests/hos/test_rule6_fueling_stop_every_1000_miles.py`

- [ ] **Step 1: Write the test suite**

```python
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
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule6_fueling_stop_every_1000_miles.py" -v`
Expected: PASS (6 passed).

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule6_fueling_stop_every_1000_miles.py
git commit -m "test(hos): Rule 6 — fueling stop every 1000 miles"
```

---

## Task 10: Rule 7 — 1 Hour for Pickup and Dropoff

**Files:**
- Test: `tests/hos/test_rule7_one_hour_pickup_and_dropoff.py`

- [ ] **Step 1: Write the test suite**

```python
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
```

- [ ] **Step 2: Run the suite**

Run: `uv run --extra dev pytest "tests/hos/test_rule7_one_hour_pickup_and_dropoff.py" -v`
Expected: PASS (5 passed).

- [ ] **Step 3: Commit**

```bash
git add tests/hos/test_rule7_one_hour_pickup_and_dropoff.py
git commit -m "test(hos): Rule 7 — 1 hour pickup and dropoff"
```

---

## Task 11: 24-hour invariant across scenarios + full suite green

**Files:**
- Test: `tests/hos/test_daysplit_invariants.py`

- [ ] **Step 1: Write the invariant test**

```python
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
```

- [ ] **Step 2: Run the invariant test**

Run: `uv run --extra dev pytest tests/hos/test_daysplit_invariants.py -v`
Expected: PASS.

- [ ] **Step 3: Run the entire HOS suite**

Run: `uv run --extra dev pytest tests/hos -v`
Expected: ALL PASS. (Confirm the 7 rule classes are collected with their exact PRD names.)

- [ ] **Step 4: Commit**

```bash
git add tests/hos/test_daysplit_invariants.py
git commit -m "test(hos): 24-hour sum + log-sheet-count invariants"
```

---

## Self-Review Notes (for the implementer)

- **Pre-existing failure:** `tests/test_main.py` fails on Django settings — unrelated to this engine, fixed in sub-project 2. Always run `pytest tests/hos`, not the whole suite, when validating this work.
- **Numeric tuning is normal:** the test scenarios use `mph = miles / driving_hours` chosen for clean arithmetic (60 or 100 mph). If a hand-picked assertion is off by a step-ordering detail, fix the engine logic and re-run — do **not** change the rule constants in `constants.py`.
- **Rule-name requirement:** the 7 test classes are named exactly `Rule1_ElevenHourDrivingLimit` … `Rule7_OneHourPickupAndDropoff` per the PRD grading criterion. pytest collects classes without an `__init__`; these have none, so they are collected.
- **Spec coverage check:** Rule 1 → Task 4; Rule 2 → Task 5; Rule 3 → Task 6; Rule 4 → Task 7; Rule 5 → Task 8; Rule 6 → Task 9; Rule 7 → Task 10; 24-hour-sum grading check → Tasks 2 & 11; day-count = trip-days → Tasks 7 & 11; edge cases (identical points, <1000mi, 0 cycle) → integration + parametrized invariants.
