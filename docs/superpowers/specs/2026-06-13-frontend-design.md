# Frontend — Design Spec

**Date:** 2026-06-13
**Sub-project:** 3 of 3 (React/Vite trip-planner UI)
**Source of truth:** [ELD-Trip-Planner-PRD.md](../../../ELD-Trip-Planner-PRD.md) (§ Inputs, § Outputs, § Log Sheet Visual Spec, § UI/UX Requirements, § Edge Cases)
**Depends on:** Sub-project 2 (`POST /api/trip/plan`), merged to `main`.
**Design foundation:** the `design-engineer` skill is the base for all UI work — every component covers full states (loading/empty/error/success), respects `prefers-reduced-motion`, keeps layout stable, and matches the app's existing dark theme + sharp-corner grammar.

## Context

The backend returns the full trip plan; this sub-project is the React/Vite UI that lets a
driver pick three locations on a map, enter cycle hours, and view the route + daily ELD log
sheets. The app shell (header, dark theme, sonner toaster) and react-router are already
wired; the Home route is placeholder ASCII art to replace.

### Decisions locked during brainstorming

- **Log sheets render as SVG** (declarative, testable, printable; not Canvas).
- **Frontend testing is minimal:** unit tests for the two pure helpers (`log-grid`, API
  mapping) + one smoke test of the planner page. Everything else is manual/visual.
- **Two phased implementation plans** with a review checkpoint: Phase A (input flow),
  Phase B (outputs).
- **Components:** use the existing shadcn/Radix/Base UI primitives; pull additional fitting
  shadcn components via the CLI (`pnpm dlx shadcn@latest add …`) — likely `badge`, `alert`,
  `separator`, `scroll-area`, `tooltip`, `slider`. (No shadcn MCP is connected in this
  environment; the CLI is the mechanism.)
- **Map:** `react-leaflet` + `leaflet` (added as deps), OSM tiles, per the PRD tech stack.
- **Reverse geocoding of the three picked pins** uses Nominatim from the frontend (the
  backend only geocodes its own interpolated stops).

### New dependencies

`react-leaflet`, `leaflet`, `@types/leaflet`. Leaflet's CSS is imported once. A
`QueryClientProvider` (TanStack Query, already installed) is wired into the app shell.

## Architecture & file structure

One trip-planner page inside the existing app shell. Trip-input state lives in a small
Zustand store; the API call is a TanStack Query mutation; the response lives in page state.

```
src/
  lib/
    env.ts            # @t3-oss/env-core + zod: VITE_API_BASE_URL (default http://localhost:8000)
    api-types.ts      # TS mirror of the backend response
    api.ts            # planTrip(request) -> TripPlanResponse (fetch + status->error mapping)
    geocode.ts        # reverseGeocode(lat,lng) -> "City, ST" via Nominatim (+ coord fallback)
    log-grid.ts       # pure: timeToX("HH:MM"), buildRowSegments(entries) for the SVG grid
  store/
    trip-store.ts     # pin-placement state machine + locations + cycleHoursUsed
  components/
    map/trip-map.tsx        # react-leaflet map: click-to-place, markers, route line, stop pins
    map/pin-icons.ts        # colored Leaflet divIcons per type (blue/green/red/orange/yellow)
    trip/step-indicator.tsx # "Step 1 of 3: Click your current location"
    trip/location-summary.tsx  # 3 resolved locations + "Change" buttons
    trip/trip-controls.tsx     # cycle-hours input + Calculate button
    trip/trip-warning.tsx      # cycle_hours_warning alert banner
    logs/log-sheets.tsx     # list of daily sheets (scrollable)
    logs/log-sheet.tsx      # one day: header + grid + totals + remarks
    logs/log-grid.tsx       # the SVG 24-hour grid
  routes/home.tsx     # TripPlanner page composing the above
  test/
    log-grid.test.ts        # pure helper tests
    api.test.ts             # response mapping / error mapping
    planner.smoke.test.tsx  # page renders initial step
```

### Data model (`api-types.ts`)

```ts
export type DutyStatus = "off_duty" | "sleeper_berth" | "driving" | "on_duty_not_driving";
export interface LatLng { lat: number; lng: number; }
export interface TripLocation extends LatLng { address: string; }
export interface Stop {
  type: "pickup" | "fuel" | "rest" | "dropoff";
  location: string; lat: number; lng: number; arrival: string; duration_hours: number;
}
export interface LogEntry {
  status: DutyStatus; start: string; end: string; location?: string; note?: string;
}
export interface DayLog {
  day: number; date: string; total_miles_today: number;
  entries: LogEntry[]; totals: Record<DutyStatus, number>; remarks: string[];
}
export interface TripPlanResponse {
  route: { total_miles: number; total_driving_hours: number;
           coordinates: [number, number][]; stops: Stop[] };
  cycle_hours_warning: string | null;
  logs: DayLog[];
}
export interface TripPlanRequest {
  current_location: TripLocation; pickup_location: TripLocation;
  dropoff_location: TripLocation; cycle_hours_used: number;
}
```

### Store (`trip-store.ts`)

State machine `step: "current" | "pickup" | "dropoff" | "complete"`. Holds
`current?`, `pickup?`, `dropoff?` (each `TripLocation`) and `cycleHoursUsed: number`.
Actions: `placePin(location)` (sets the active step's pin and advances), `changePin(which)`
(clears that pin and makes it the active step), `setCycleHours(n)`, `reset()`. A derived
`isReady` is true when all three pins exist and cycle hours is a valid 0–70 number.

## Phase A — input flow

Map fills the top/left; a control panel sits beside it (desktop) or below (mobile).

- **Map** (`trip-map.tsx`): OSM `TileLayer`, default US view. A `useMapEvents` click handler
  is active only while `step !== "complete"`; on click it calls `reverseGeocode` then
  `placePin`. Markers render for every placed pin with a tooltip label.
- **Pin colors:** current = blue, pickup = green, dropoff = red (PRD).
- **Step indicator** (`step-indicator.tsx`): shows "Step N of 3: …" per active step, and a
  done state when all three are placed.
- **Location summary** (`location-summary.tsx`): each placed location shows its resolved
  address and a **Change** button that re-enters that step.
- **Controls** (`trip-controls.tsx`): cycle-hours number input (0–70, the only typed field);
  **Calculate Trip** button disabled until `isReady`. Click fires the `planTrip` mutation.
- **Geocoding feedback:** while a click resolves, show an inline "resolving address…" state.
  On Nominatim failure, fall back to a coordinate string and let the user proceed.

Phase A done = user can place 3 pins, see addresses, set cycle hours, Calculate, and receive
a response (rendered minimally; Phase B makes it polished).

## Phase B — outputs

- **Route on the map** (extend `trip-map.tsx`): draw `route.coordinates` as a `Polyline`;
  place stop pins from `route.stops` — current=blue, pickup=green, dropoff=red, rest=orange
  ("10hr Rest"), fuel=yellow ("Fuel"). Each pin `Popup` shows location, stop type, arrival,
  duration. Map auto-fits bounds to the route.
- **Cycle warning** (`trip-warning.tsx`): if `cycle_hours_warning` is non-null, an `alert`
  banner above the sheets.
- **Log sheets** (`logs/`): one `LogSheet` per day, stacked and scrollable.
  - **Header:** date, total miles that day; placeholders carrier "N/A", office/driver/vehicle.
  - **SVG grid** (`log-grid.tsx` + pure `log-grid.ts`): 24-hour axis (midnight→midnight),
    4 rows (Off Duty / Sleeper Berth / Driving / On Duty ND). Each entry draws a horizontal
    line in its row across `[timeToX(start), timeToX(end)]`, with vertical connectors at
    status changes. Colors per PRD: off-duty light gray, sleeper light blue, driving dark
    navy, on-duty-ND medium gray. Fixed `viewBox` so it never reflows.
  - **Totals column:** hours per status on the right (sum to 24).
  - **Remarks:** the day's `remarks[]` below the grid.

### Pure helper contract (`log-grid.ts`)

- `timeToX(hhmm: string, width: number): number` — maps "00:00"→0, "24:00"/"23:59"→width,
  linear in minutes. ("24:00" is accepted as end-of-day = width.)
- `buildRowSegments(entries: LogEntry[]): { status, x1, x2 }[]` — one segment per entry with
  pixel x-range; consumed by the grid to draw row lines + connectors.

## Design quality bar (design-engineer)

- **All states:** loading/skeleton (during the mutation), empty (before pins — instructional
  result area), error (per the error contract below), success (subtle confirmation), plus
  hover/focus-visible/disabled/active for controls.
- **Error contract → UI** (from the backend): 503 → "Routing isn't configured yet."; 422 →
  the PRD "Could not resolve a valid driving location. Please click on a road or city.";
  502 → "Routing service unavailable — try again."; network/other → generic retry. Surfaced
  via an `alert` + sonner toast with a retry affordance.
- **Craft:** explicit dimensions (map height, SVG `viewBox`) so nothing reflows on data load;
  `lucide` icons (map-pin, fuel, bed, truck, flag); cards only for the framed log sheets and
  summary; match the dark theme + sharp-corner grammar + Tailwind tokens already in
  `index.css`.
- **Motion (Motion lib):** pin drop, step/panel transitions, log-sheet reveal — tasteful
  only. Add `prefers-reduced-motion` handling (currently absent in the codebase); no motion
  that masks latency.
- **A11y:** visible focus rings, keyboard-operable controls, contrast-checked grid colors,
  ≥44px touch targets on mobile.
- **Responsive:** desktop = map + panel side-by-side; mobile = stacked, log sheets
  horizontally scrollable within their card.

## Edge cases (frontend)

| Scenario | UI behavior |
|---|---|
| Click resolves to ocean/invalid (backend 422) | Show the PRD error; keep pins; let the user re-pick. |
| `cycle_hours_warning` present | Alert banner above sheets; still render whatever logs returned. |
| One-day trip | One log sheet. |
| Trip < 1000 mi | No fuel pin (backend omits it) — nothing special needed. |
| All three pins identical | Backend returns zero-mile plan; map shows the single point, one log sheet. |
| Nominatim fails for a picked pin | Fall back to coordinate label; do not block Calculate. |

## Testing (minimal)

- `log-grid.test.ts`: `timeToX` endpoints + midpoint; `buildRowSegments` maps entries to
  expected x-ranges.
- `api.test.ts`: `planTrip` maps a sample 200 body to `TripPlanResponse`; maps 503/422/502
  to the right typed error.
- `planner.smoke.test.tsx`: the planner page renders and shows "Step 1 of 3".

Run via `pnpm vitest run`. Lint/format via `pnpm check`; types via `pnpm check-types`.
Manual/visual verification (design-engineer browser check) covers the rest across desktop and
mobile.

## Out of scope

Backend changes (complete), deployment config beyond the existing `vercel.json`, and
authentication (the app is stateless per the PRD).
