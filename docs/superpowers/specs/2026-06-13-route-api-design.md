# Route Service + REST API — Design Spec

**Date:** 2026-06-13
**Sub-project:** 2 of 3 (route service + `POST /api/trip/plan`)
**Source of truth:** [ELD-Trip-Planner-PRD.md](../../../ELD-Trip-Planner-PRD.md) (§ API Design, § Trip Calculation Logic, § Edge Cases)
**Depends on:** Sub-project 1 (HOS engine), merged to `main`.

## Context

Sub-project 1 delivered a pure-Python HOS engine: `plan_trip(route, cycle_hours_used,
start_dt) -> TripPlan`, fully offline-tested. This sub-project wraps it in a Django REST
endpoint that fetches real route data and returns the PRD's JSON contract. The frontend
(sub-project 3) consumes this endpoint.

### Decisions locked during brainstorming

- **No-key behavior:** when `ORS_API_KEY` is unset, `POST /api/trip/plan` returns **503**
  (no fallback estimator). Tests never depend on a live key — the route provider is behind
  an interface and faked.
- **Stop names:** the backend reverse-geocodes interpolated fuel/rest stop coordinates via
  Nominatim to embed "Near City, ST" names. Pickup/dropoff reuse the addresses supplied in
  the request. Geocoding is behind an interface and faked in tests.
- **Trip date:** Day 1 defaults to the server's current date at 6:00am (PRD's fixed 6am
  assumption). No new request field.
- **Route geometry:** `route.coordinates` is the full decoded ORS road polyline as
  `[lat, lng]` pairs so the frontend draws an accurate line.

## Architecture

Restructure the single-file backend (`src/app/main.py` with inline `settings.configure`)
into focused modules. Each external service sits behind an ABC so view tests inject fakes;
no network calls in the test suite.

```
src/app/
  settings.py        # real Django settings module (replaces inline settings.configure)
  urls.py            # ROOT_URLCONF: root, health, api/status, api/trip/plan
  main.py            # entry point: set DJANGO_SETTINGS_MODULE, django.setup, runserver
  api/
    serializers.py   # TripPlanRequest validation + response builder
    views.py         # trip_plan view: routing -> engine -> geocoding -> response
    interpolate.py   # pure: coordinate at a given mile-marker along a polyline
  routing/
    base.py          # RouteResult dataclass + RouteProvider ABC
    openroute.py     # ORSRouteProvider (httpx, driving-hgv/geojson)
    factory.py       # get_route_provider() -> RouteProvider | None  (None when no key)
  geocoding/
    base.py          # ReverseGeocoder ABC
    nominatim.py     # NominatimGeocoder (httpx; in-memory cache; throttle; fallback)
    factory.py       # get_reverse_geocoder()
  hos/               # existing engine + one additive change (Stop.mile_marker)
```

**New dependencies:** `httpx` (runtime, used by both adapters); `pytest-django` (dev) with
`DJANGO_SETTINGS_MODULE = app.settings` in `[tool.pytest.ini_options]`. Configuring real
settings also fixes the scaffold's currently-failing `tests/test_main.py`.

### Interfaces

```python
# routing/base.py
@dataclass(frozen=True)
class RouteResult:
    total_miles: float
    total_driving_hours: float
    coordinates: list[list[float]]   # [[lat, lng], ...] full road polyline

class RouteProvider(ABC):
    @abstractmethod
    def get_route(self, waypoints: list[tuple[float, float]]) -> RouteResult: ...
    # waypoints are (lat, lng) for current, pickup, dropoff (in order)

# routing exceptions
class RouteNotFound(Exception): ...     # -> 422 (unroutable point: ocean/invalid)
class RouteServiceError(Exception): ...  # -> 502 (timeout/5xx/parse failure)

# geocoding/base.py
class ReverseGeocoder(ABC):
    @abstractmethod
    def reverse(self, lat: float, lng: float) -> str: ...  # "City, ST"; never raises
```

## Data flow — `POST /api/trip/plan`

1. **Validate** with `TripPlanRequest` serializer: `current_location`, `pickup_location`,
   `dropoff_location` each `{lat, lng, address}`; `cycle_hours_used` in `[0, 70]`.
   Invalid → **400** with field errors.
2. **Route provider:** `get_route_provider()`. `None` (no `ORS_API_KEY`) → **503**
   `{"error": "Routing not configured."}`.
3. **Identical points shortcut:** if all three lat/lng are equal, skip ORS;
   `RouteResult(0.0, 0.0, [[lat, lng]])`.
4. **Fetch route:** `provider.get_route([...])`. `driving-hgv` profile (property-carrying
   truck), GeoJSON response: `properties.summary.distance` (m → miles ÷ 1609.34),
   `.duration` (s → hours ÷ 3600), `geometry.coordinates` ([lng,lat] → [lat,lng]).
   `RouteNotFound` → **422** `{"error": "Could not resolve a valid driving location.
   Please click on a road or city."}`; `RouteServiceError` → **502**.
5. **Simulate:** `plan_trip(RouteInput(miles, hours), cycle_hours_used,
   start_dt=today@06:00, pickup_location=req.pickup.address,
   dropoff_location=req.dropoff.address)` → `TripPlan`.
6. **Place + name stops:** for each `fuel`/`rest` `Stop`, interpolate `[lat,lng]` from the
   polyline at `stop.mile_marker` (`interpolate.py`), then
   `geocoder.reverse(lat, lng)` → "Near City, ST" (cached; fallback `"Near {lat:.2f},
   {lng:.2f}"` if it fails). Pickup/dropoff use the request addresses and their waypoint
   coordinates.
7. **Inject names + rebuild remarks:** set `location` on the matching fuel/rest log entries
   (correlate by `entry.start == stop.arrival` and note), then call `build_day_logs` again
   (it is already a separate pure function) so `remarks` carry real place names.
8. **Serialize** to the PRD response shape (below), formatting entry `start`/`end` as
   `HH:MM`.

### Response shape (per PRD)

```json
{
  "route": {
    "total_miles": 470,
    "total_driving_hours": 7.2,
    "coordinates": [[41.85, -87.65], ...],
    "stops": [
      {"type": "pickup", "location": "St. Louis, MO", "lat": 38.62, "lng": -90.19,
       "arrival": "07:00", "duration_hours": 1.0}
    ]
  },
  "cycle_hours_warning": null,
  "logs": [
    {"day": 1, "date": "2026-06-13", "total_miles_today": 320,
     "entries": [{"status": "driving", "start": "07:00", "end": "14:00"}],
     "totals": {"off_duty": 6.0, "sleeper_berth": 8.5, "driving": 8.0,
                "on_duty_not_driving": 1.5},
     "remarks": ["Chicago, IL — Pickup", "Near St. Louis, MO — Fueling stop"]}
  ]
}
```

## The one engine change (additive)

Add `mile_marker: float = 0.0` to the `Stop` dataclass in `src/app/hos/models.py` and set
it in the engine: `_pickup` → 0.0, `_fuel`/`_rest` → `self.miles_done`, `_dropoff` →
`self.route.total_miles`. Default keeps all 48 existing engine tests green. This is the only
change to sub-project 1; the engine stays pure (records a number, does no geometry or
network).

## Coordinate interpolation (`interpolate.py`)

Pure function `point_at_mile(polyline, total_miles, mile_marker) -> [lat, lng]`:
walk the polyline accumulating segment lengths (haversine between consecutive vertices),
find the segment containing `fraction = mile_marker / total_miles` of the total geometric
length, and linearly interpolate within it. `total_miles == 0` or empty polyline → return
the first/only point. Marker 0 → first point; marker == total → last point.

## Error handling summary

| Condition | Status | Body |
|---|---|---|
| Invalid/missing fields, cycle out of 0–70 | 400 | DRF field errors |
| `ORS_API_KEY` unset | 503 | `{"error": "Routing not configured."}` |
| Unroutable point (ocean/invalid) | 422 | PRD "Could not resolve…" message |
| ORS timeout / 5xx / unparseable | 502 | `{"error": "Routing service unavailable."}` |
| Geocoder failure | 200 | response with fallback stop names (never 500) |

## Testing (all offline)

- **`interpolate.py`** (pure): known polyline → expected point; marker 0 and marker==total
  hit the terminals; zero-length route returns the single point.
- **Serializers:** valid body accepted; out-of-range cycle hours, missing locations,
  non-numeric lat/lng → 400.
- **View** via Django test client with `FakeRouteProvider` + `FakeReverseGeocoder` injected
  through the factories (monkeypatched):
  - Happy path → 200, body matches PRD shape; `HH:MM` formatting; per-day totals sum to 24.
  - No key → 503.
  - `RouteNotFound` → 422 with the exact PRD message.
  - Identical points → 200, zero miles, pickup+dropoff only, one log sheet.
  - Geocoder raises internally → 200 with fallback names (graceful).
- **Adapters:** `ORSRouteProvider` and `NominatimGeocoder` parse a captured sample response
  body (unit-level, no live calls): unit conversions and `[lng,lat]→[lat,lng]` flip.
- **Scaffold:** `tests/test_main.py` (root/health) passes once real settings exist.

No test hits live ORS or Nominatim. A real `ORS_API_KEY` exercises the live adapter only
through manual/integration checks, not the graded suite.

## Out of scope (sub-project 3)

The entire frontend: Leaflet map, pin placement, the frontend's own Nominatim use for the
3 picked locations, route line rendering, and SVG log sheets.
