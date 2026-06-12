# HOS Engine — Design Spec

**Date:** 2026-06-13
**Sub-project:** 1 of 3 (HOS engine + 7 test suites)
**Source of truth:** [ELD-Trip-Planner-PRD.md](../../../ELD-Trip-Planner-PRD.md)

## Context

Spotter is a full-stack ELD Trip Planner. This spec covers **only the pure HOS
calculation engine and its 7 test suites** — the graded core of the assessment.
Route fetching, the REST API, and the frontend are separate sub-projects built
afterward.

### Project decomposition

1. **HOS engine + 7 test suites** (this spec) — pure Python, no Django, no network.
2. **Route service + REST API** — `POST /api/trip/plan`, OpenRouteService behind an
   interface, DRF serializers producing the PRD response shape.
3. **Frontend** — Leaflet pin-picking, Nominatim geocoding, route + SVG log sheets,
   built with the `design-engineer` skill.

### Decisions locked during brainstorming

- **Route data is abstracted.** The engine consumes an already-normalized
  `RouteInput`; it never calls a network. A real OpenRouteService key is wired in
  sub-project 2 via env var. All 7 test suites run fully offline.
- **Build order:** engine + tests first (TDD), then API, then frontend.
- **Backend is modularized** (not the single-file scaffold) so the complex logic is
  isolated and testable.

## Architecture

Pure Python package `src/app/hos/` with **zero Django imports**:

| Module | Responsibility |
|---|---|
| `statuses.py` | `DutyStatus` enum: `off_duty`, `sleeper_berth`, `driving`, `on_duty_not_driving`. |
| `constants.py` | Rule numbers: 11h drive, 14h window, 8h-to-break, 30-min break, 10h rest, 70h cycle, 1000-mi fuel interval, 0.5h fuel, 1h pickup/dropoff, 6:00am start. |
| `models.py` | Frozen dataclasses: `RouteInput`, `LogEntry`, `Stop`, `DayLog`, `TripPlan`. |
| `engine.py` | `plan_trip(route, cycle_hours_used, start_dt) -> TripPlan` — the simulation. |
| `daysplit.py` | Slices the continuous entry timeline at midnight into per-day `DayLog`s; computes per-status totals (each day sums to exactly 24h). |

The engine has one public entry point, `plan_trip`. Tests construct `RouteInput`
directly, so no route service is needed in this sub-project.

### Data model (sketch)

- `RouteInput(total_miles: float, total_driving_hours: float, segments: list | None)`
- `LogEntry(status: DutyStatus, start: datetime, end: datetime, location: str | None, note: str | None)`
- `Stop(type: str, location, lat, lng, arrival: datetime, duration_hours: float)` where
  `type ∈ {pickup, fuel, rest, dropoff}`
- `DayLog(day: int, date, total_miles_today, entries: list[LogEntry], totals: dict, remarks: list[str])`
- `TripPlan(entries: list[LogEntry], stops: list[Stop], logs: list[DayLog], cycle_hours_warning: str | None)`

## Simulation algorithm

`plan_trip` advances a continuous virtual clock (start 6:00am Day 1) and emits
`LogEntry` blocks using an **advance-to-next-threshold** strategy (not a per-minute
loop): at each driving step, compute the distance/time to the nearest active limit,
jump there, emit the block. Exact and cheap.

**State:** `driving_today`, `on_duty_today`, `drive_since_break`, `window_start`,
`cycle_used`, `miles_done`, `day`.

**Event sequence:**

1. **Pickup** — 1h `on_duty_not_driving` at the start. Starts the 14h window. Pickup
   is the *first* event; driving begins 1h later. (Rule 7 tests.)
2. **Driving** — consumed in chunks. Each chunk drives until the *soonest* of:
   - `drive_since_break` reaches 8h → insert 30-min break (`off_duty`), reset
     `drive_since_break`. Break does not reset the 11h or 14h clocks. (Rule 3)
   - `driving_today` reaches 11h → 10-hour rest, new day. (Rule 1)
   - clock reaches `window_start + 14h` → 10-hour rest, new day. Non-driving work may
     still follow, but no driving. (Rule 2)
   - `miles_done` reaches the next 1,000-mi mark → 30-min fuel stop
     (`on_duty_not_driving`). Counts toward 14h window + cycle. (Rule 6)
   - route distance exhausted → driving complete.
3. **10-hour rest** — 10h `sleeper_berth`; reset driving/on-duty/break clocks and
   `window_start = None`; `day += 1`. (Rule 4)
4. **Dropoff** — 1h `on_duty_not_driving` at the end. (Rule 7)

**70-hour cap (Rule 5):** before any on-duty/driving block, check
`cycle_used + block <= 70`. If a block would exceed it, stop scheduling further
on-duty time, set `cycle_hours_warning`, and mark the trip incomplete (flag + stop)
rather than violating the cap. `cycle_used` accumulates **both** driving and on-duty
not-driving time.

### Modeling decisions (driven by the PRD's test expectations)

- **Driving distance/time is the total route** (current→pickup→dropoff combined). The
  PRD collapses the current→pickup leg: pickup is logged as a stationary 1h event
  first, then all driving occurs, then dropoff. This matches the Rule 7 tests.
- **The 30-minute break is logged as `off_duty`.** Rule 3 tests accept off duty,
  sleeper berth, or on-duty-not-driving; `off_duty` reads naturally on the grid.

## Day-splitting & output

`daysplit.py`:

- Fills Day 1 `00:00`→`06:00` as `off_duty`, and the final day's tail to `24:00` as
  `off_duty`.
- Splits any entry crossing midnight at the boundary so **every day's four status
  totals sum to exactly 24.0h** (explicit grading check).
- Produces per-day `date`, `total_miles_today`, `entries[]` (`HH:MM` start/end +
  optional location/note), `totals{}`, and `remarks[]` (City, State — reason per
  status change).

`TripPlan` carries `stops[]` and `cycle_hours_warning` for sub-project 2 to serialize
into the PRD response shape.

## Edge cases (engine scope)

| Scenario | Behavior |
|---|---|
| Trip < 1,000 mi | No fuel stop. |
| Trip ≥ 1,000 mi | One fuel stop per 1,000-mi interval. |
| One-day trip | One `DayLog`. |
| 0 cycle hours used | Full 70h available. |
| All three points identical | Distance 0, no driving segments, still logs pickup + dropoff 1h each. |

Ocean/invalid-click resolution is a frontend/route-service concern, not the engine.

## Testing

Seven test suites, each named exactly after its rule, in
`tests/` (pytest, no DB). Each suite constructs a `RouteInput` and asserts on the
returned `TripPlan`:

- `Rule1_ElevenHourDrivingLimit`
- `Rule2_FourteenHourDrivingWindow`
- `Rule3_ThirtyMinuteRestBreak`
- `Rule4_TenConsecutiveHoursOff`
- `Rule5_SeventyHourEightDayLimit`
- `Rule6_FuelingStopEvery1000Miles`
- `Rule7_OneHourPickupAndDropoff`

Test methods follow the scenarios enumerated in the PRD (§ Testing Requirements).
Plus an invariant test: every `DayLog`'s totals sum to 24.0h.

## Out of scope (later sub-projects)

OpenRouteService integration, Nominatim geocoding, the DRF endpoint, CORS/settings
restructuring, and the entire frontend.
