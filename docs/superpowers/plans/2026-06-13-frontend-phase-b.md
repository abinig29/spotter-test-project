# Frontend Phase B (Outputs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Every component task must follow the `design-engineer` skill** (stable dimensions, full states, `prefers-reduced-motion`, a11y, theme consistency, mobile).

**Goal:** Render the trip outputs — the route line + colored stop pins on the map, and one SVG ELD daily-log sheet per day (24-hour grid, totals, remarks) — wired into the existing planner page.

**Architecture:** A pure `log-grid.ts` helper turns log entries into grid coordinates; an SVG `LogGrid` draws the official-form grid; `LogSheet`/`LogSheets` compose the daily sheets. The existing presentational `TripMap` is extended to draw the polyline + stop pins with popups and auto-fit bounds. The planner page renders the route on the map and the sheets below once a plan returns.

**Tech Stack:** React 19, Vite, TypeScript (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Tailwind v4, react-leaflet + leaflet (Polyline/Popup), Motion, lucide-react, Vitest.

**Spec:** [docs/superpowers/specs/2026-06-13-frontend-design.md](../specs/2026-06-13-frontend-design.md) (§ Phase B, § Log Sheet Visual Spec)
**Builds on:** Phase A (merged to `main`) — `src/lib/api-types.ts`, `src/components/map/trip-map.tsx`, `src/components/map/pin-icons.ts`, `src/routes/home.tsx`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/log-grid.ts` | Pure `timeToMinutes`/`timeToX`/`buildRowSegments`. |
| `src/components/logs/log-grid.tsx` | The SVG 24-hour grid (rows, lines, connectors, totals). |
| `src/components/logs/log-sheet.tsx` | One day: header + grid + remarks. |
| `src/components/logs/log-sheets.tsx` | List of daily sheets. |
| `src/components/map/trip-map.tsx` | (modify) add route polyline + stop pins + fit-bounds. |
| `src/routes/home.tsx` | (modify) pass route to the map; render sheets when a plan exists. |

**Run:** `pnpm vitest run`, `pnpm check-types`, `pnpm check`, `pnpm build`, `pnpm dev`.

---

## Task 1: Pure grid helpers

**Files:**
- Create: `src/lib/log-grid.ts`, `src/test/log-grid.test.ts`

- [ ] **Step 1: Write the failing test `src/test/log-grid.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildRowSegments, timeToX } from "@/lib/log-grid";
import type { LogEntry } from "@/lib/api-types";

describe("log-grid helpers", () => {
  it("maps times to x across the full width", () => {
    expect(timeToX("00:00", 1440)).toBe(0);
    expect(timeToX("12:00", 1440)).toBe(720);
    expect(timeToX("24:00", 1440)).toBe(1440);
  });

  it("builds pixel segments for an entry", () => {
    const entries: LogEntry[] = [{ status: "driving", start: "07:00", end: "14:00" }];
    const segs = buildRowSegments(entries, 1440);
    expect(segs).toEqual([{ status: "driving", x1: 420, x2: 840 }]);
  });

  it("treats an end of 00:00 as end-of-day", () => {
    const entries: LogEntry[] = [{ status: "off_duty", start: "07:30", end: "00:00" }];
    const segs = buildRowSegments(entries, 1440);
    expect(segs[0]?.x2).toBe(1440);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/log-grid.test.ts`
Expected: FAIL — cannot resolve `@/lib/log-grid`.

- [ ] **Step 3: Implement `src/lib/log-grid.ts`**

```ts
import type { DutyStatus, LogEntry } from "@/lib/api-types";

const MINUTES_PER_DAY = 24 * 60;

export function timeToMinutes(hhmm: string): number {
  if (hhmm === "24:00") return MINUTES_PER_DAY;
  const [hStr, mStr] = hhmm.split(":");
  const hours = Number(hStr ?? 0);
  const minutes = Number(mStr ?? 0);
  return hours * 60 + minutes;
}

export function timeToX(hhmm: string, width: number): number {
  return (timeToMinutes(hhmm) / MINUTES_PER_DAY) * width;
}

export interface RowSegment {
  status: DutyStatus;
  x1: number;
  x2: number;
}

export function buildRowSegments(entries: LogEntry[], width: number): RowSegment[] {
  return entries.map((entry) => {
    const startMin = timeToMinutes(entry.start);
    let endMin = timeToMinutes(entry.end);
    // An entry ending at "00:00" (or otherwise <= its start) ends at midnight = end of day.
    if (endMin <= startMin) endMin = MINUTES_PER_DAY;
    return {
      status: entry.status,
      x1: (startMin / MINUTES_PER_DAY) * width,
      x2: (endMin / MINUTES_PER_DAY) * width,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/test/log-grid.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/log-grid.ts src/test/log-grid.test.ts
git commit -m "feat(fe): pure log-grid time->x + segment helpers"
```

---

## Task 2: SVG log grid

**Files:**
- Create: `src/components/logs/log-grid.tsx`

**Design-engineer acceptance:** the sheet reads like the official paper form — render on a light "paper" background regardless of theme so the colored status lines have proper contrast; fixed `viewBox` (no reflow); the four totals visibly sum to 24; legible hour axis; `aria-label` summarizing the day.

- [ ] **Step 1: Create `src/components/logs/log-grid.tsx`**

```tsx
import type { DutyStatus } from "@/lib/api-types";
import type { LogEntry } from "@/lib/api-types";
import { buildRowSegments } from "@/lib/log-grid";

const ROWS: { status: DutyStatus; label: string; color: string }[] = [
  { status: "off_duty", label: "Off Duty", color: "#9ca3af" },
  { status: "sleeper_berth", label: "Sleeper Berth", color: "#60a5fa" },
  { status: "driving", label: "Driving", color: "#1e3a8a" },
  { status: "on_duty_not_driving", label: "On Duty (ND)", color: "#6b7280" },
];

const LABEL_W = 118;
const GRID_W = 720;
const TOTAL_W = 70;
const TOP_H = 22;
const ROW_H = 34;
const VIEW_W = LABEL_W + GRID_W + TOTAL_W;
const VIEW_H = TOP_H + ROWS.length * ROW_H + 6;

const ROW_INDEX: Record<DutyStatus, number> = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
};

function rowCenterY(index: number): number {
  return TOP_H + index * ROW_H + ROW_H / 2;
}

function hourX(hour: number): number {
  return LABEL_W + (hour / 24) * GRID_W;
}

interface LogGridProps {
  entries: LogEntry[];
  totals: Record<DutyStatus, number>;
}

export function LogGrid({ entries, totals }: LogGridProps) {
  const segments = buildRowSegments(entries, GRID_W);
  const total = ROWS.reduce((sum, row) => sum + (totals[row.status] ?? 0), 0);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label="24-hour duty status grid"
    >
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#ffffff" />

      {/* hour gridlines + axis labels */}
      {Array.from({ length: 25 }, (_, hour) => (
        <g key={`h-${hour}`}>
          <line
            x1={hourX(hour)}
            y1={TOP_H}
            x2={hourX(hour)}
            y2={TOP_H + ROWS.length * ROW_H}
            stroke={hour % 6 === 0 ? "#9ca3af" : "#e5e7eb"}
            strokeWidth={hour % 6 === 0 ? 1 : 0.5}
          />
          {hour % 2 === 0 && (
            <text x={hourX(hour)} y={TOP_H - 8} fontSize={9} fill="#374151" textAnchor="middle">
              {hour === 0 || hour === 24 ? "M" : hour === 12 ? "N" : hour}
            </text>
          )}
        </g>
      ))}

      {/* rows: labels, baselines, totals */}
      {ROWS.map((row, index) => (
        <g key={row.status}>
          <text x={LABEL_W - 8} y={rowCenterY(index) + 3} fontSize={11} fill="#111827" textAnchor="end">
            {row.label}
          </text>
          <line
            x1={LABEL_W}
            y1={TOP_H + (index + 1) * ROW_H}
            x2={LABEL_W + GRID_W}
            y2={TOP_H + (index + 1) * ROW_H}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
          <text
            x={LABEL_W + GRID_W + TOTAL_W / 2}
            y={rowCenterY(index) + 3}
            fontSize={11}
            fill="#111827"
            textAnchor="middle"
          >
            {(totals[row.status] ?? 0).toFixed(1)}
          </text>
        </g>
      ))}

      {/* status lines */}
      {segments.map((seg, idx) => (
        <line
          key={`seg-${idx}-${seg.x1}`}
          x1={LABEL_W + seg.x1}
          y1={rowCenterY(ROW_INDEX[seg.status])}
          x2={LABEL_W + seg.x2}
          y2={rowCenterY(ROW_INDEX[seg.status])}
          stroke={ROWS[ROW_INDEX[seg.status]]?.color ?? "#111827"}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}

      {/* vertical connectors at status changes */}
      {segments.slice(1).map((seg, i) => {
        const prev = segments[i];
        if (!prev) return null;
        const x = LABEL_W + seg.x1;
        return (
          <line
            key={`conn-${i}-${x}`}
            x1={x}
            y1={rowCenterY(ROW_INDEX[prev.status])}
            x2={x}
            y2={rowCenterY(ROW_INDEX[seg.status])}
            stroke="#374151"
            strokeWidth={1.5}
          />
        );
      })}

      {/* total label */}
      <text
        x={LABEL_W + GRID_W + TOTAL_W / 2}
        y={VIEW_H - 2}
        fontSize={10}
        fill="#111827"
        textAnchor="middle"
        fontWeight="bold"
      >
        {total.toFixed(1)}
      </text>
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check-types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/logs/log-grid.tsx
git commit -m "feat(fe): SVG ELD log grid (rows, status lines, connectors, totals)"
```

---

## Task 3: Log sheet + list

**Files:**
- Create: `src/components/logs/log-sheet.tsx`, `src/components/logs/log-sheets.tsx`

**Design-engineer acceptance:** each sheet is a framed card with the official header fields (placeholders), the grid, and remarks; stacked list scrolls; stable widths; readable in dark theme (the grid itself is light paper).

- [ ] **Step 1: Create `src/components/logs/log-sheet.tsx`**

```tsx
import type { DayLog } from "@/lib/api-types";
import { LogGrid } from "@/components/logs/log-grid";

export function LogSheet({ log }: { log: DayLog }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Day {log.day}</h3>
          <p className="text-xs text-muted-foreground">{log.date}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-4">
          <div><dt className="inline">Miles: </dt><dd className="inline text-foreground">{log.total_miles_today}</dd></div>
          <div><dt className="inline">Carrier: </dt><dd className="inline">N/A</dd></div>
          <div><dt className="inline">Driver: </dt><dd className="inline">—</dd></div>
          <div><dt className="inline">Vehicle: </dt><dd className="inline">—</dd></div>
        </dl>
      </header>

      <div className="overflow-hidden rounded-md border">
        <LogGrid entries={log.entries} totals={log.totals} />
      </div>

      {log.remarks.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">Remarks</h4>
          <ul className="flex flex-col gap-0.5 text-xs">
            {log.remarks.map((remark) => (
              <li key={remark}>{remark}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Create `src/components/logs/log-sheets.tsx`**

```tsx
import type { DayLog } from "@/lib/api-types";
import { LogSheet } from "@/components/logs/log-sheet";

export function LogSheets({ logs }: { logs: DayLog[] }) {
  if (logs.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" aria-label="Daily log sheets">
      <h2 className="text-sm font-semibold">
        Daily Log Sheets ({logs.length} day{logs.length === 1 ? "" : "s"})
      </h2>
      {logs.map((log) => (
        <LogSheet key={log.day} log={log} />
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check-types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/logs/log-sheet.tsx src/components/logs/log-sheets.tsx
git commit -m "feat(fe): daily log sheet card + list"
```

---

## Task 4: Route + stop pins on the map

**Files:**
- Modify: `src/components/map/trip-map.tsx`

**Design-engineer acceptance:** route line clearly visible on OSM tiles; stop pins use the PRD colors (rest=orange, fuel=yellow) with informative popups; the map auto-fits to the route without jarring jumps; preserves the Phase A placement behavior when there's no route.

- [ ] **Step 1: Extend `src/components/map/trip-map.tsx`**

Read the current file first. Add these imports (merge with existing react-leaflet imports): `Polyline`, `Popup`, `useMap`. Add `import { useEffect } from "react";` and `import type { Stop } from "@/lib/api-types";`.

Add a `RouteResult` prop type and a `FitBounds` helper, and extend `TripMapProps`:
```tsx
export interface MapRoute {
  coordinates: [number, number][];
  stops: Stop[];
}

function FitBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [40, 40] });
    } else if (coordinates.length === 1) {
      const first = coordinates[0];
      if (first) map.setView(first, 9);
    }
  }, [coordinates, map]);
  return null;
}
```

Change the props interface to add an optional `route`:
```tsx
interface TripMapProps {
  pins: MapPin[];
  interactive: boolean;
  onPick: (lat: number, lng: number) => void;
  route?: MapRoute;
}
```

In the component body, replace the markers block so placement markers show only when there is no route, and the route (polyline + stop pins + current pin + fit-bounds) shows when present. Keep the `MapContainer`, `TileLayer`, and `ClickHandler` exactly as they are; only change what's rendered for pins/route:
```tsx
{!route && pins.map((pin) => (
  <Marker key={pin.type} position={[pin.location.lat, pin.location.lng]} icon={pinIcon(pin.type)}>
    <Tooltip>
      {pin.label}: {pin.location.address}
    </Tooltip>
  </Marker>
))}

{route && (
  <>
    <Polyline positions={route.coordinates} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }} />
    {pins
      .filter((pin) => pin.type === "current")
      .map((pin) => (
        <Marker key="current" position={[pin.location.lat, pin.location.lng]} icon={pinIcon("current")}>
          <Tooltip>Current: {pin.location.address}</Tooltip>
        </Marker>
      ))}
    {route.stops.map((stop, index) => (
      <Marker key={`${stop.type}-${index}`} position={[stop.lat, stop.lng]} icon={pinIcon(stop.type)}>
        <Popup>
          <div className="text-xs">
            <p className="font-semibold capitalize">{stop.type}</p>
            <p>{stop.location}</p>
            <p>Arrival {stop.arrival} · {stop.duration_hours}h</p>
          </div>
        </Popup>
      </Marker>
    ))}
    <FitBounds coordinates={route.coordinates} />
  </>
)}
```

(`pinIcon` already supports `rest` and `fuel` colors from `pin-icons.ts`.)

- [ ] **Step 2: Typecheck**

Run: `pnpm check-types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/map/trip-map.tsx
git commit -m "feat(fe): render route polyline + stop pins with popups on the map"
```

---

## Task 5: Wire outputs into the planner page

**Files:**
- Modify: `src/routes/home.tsx`

**Design-engineer acceptance:** when a plan exists, the map shows the route (non-interactive) and the log sheets appear below in a scrollable region; the page layout stays stable; the existing loading/empty/error/success states are preserved.

- [ ] **Step 1: Modify `src/routes/home.tsx`**

Read the current file first (Phase A built it with states/skeleton/error/reset — preserve all of that). Apply three changes:

1. Add the import: `import { LogSheets } from "@/components/logs/log-sheets";`
2. Pass the route + correct interactivity to the map. Find the `<TripMap ... />` usage and set its props to:
```tsx
<TripMap
  pins={pins}
  interactive={store.step !== "complete" && !plan}
  onPick={handlePick}
  route={plan ? plan.route : undefined}
/>
```
3. Render the log sheets when a plan exists. After the closing tag of the map+panel layout container (so the sheets sit below, full-width), add:
```tsx
{plan && (
  <section className="pt-2">
    <LogSheets logs={plan.logs} />
  </section>
)}
```
Ensure the page root allows vertical scrolling so multiple sheets are reachable: the outer `main` should use a column layout that scrolls (e.g. `flex h-full flex-col gap-4 overflow-y-auto p-4`), with the map+panel row as the first child and the sheets section as the second. Adjust the existing grid wrapper to be a child row rather than the scroll root if needed — keep the map at a stable height (e.g. wrap the map+panel in a `div` with `lg:grid lg:grid-cols-[1fr_360px]` and give the map section `min-h-[320px] lg:h-[60vh]`).

- [ ] **Step 2: Run the smoke test + typecheck**

Run: `pnpm vitest run src/test/planner.smoke.test.tsx && pnpm check-types`
Expected: the smoke test still passes (it mocks the map and asserts "Step 1 of 3"); types clean.

- [ ] **Step 3: Commit**

```bash
git add src/routes/home.tsx
git commit -m "feat(fe): show route on map and render daily log sheets"
```

---

## Task 6: Verify the whole Phase B surface

- [ ] **Step 1: Full gate**

```bash
pnpm vitest run && pnpm check-types && pnpm check && pnpm build
```
Expected: all tests pass (17 total: 14 prior + 3 new log-grid tests; count is informational — confirm green), tsc clean, Biome clean, build succeeds.

- [ ] **Step 2: Browser verification (design-engineer)**

Run `pnpm dev` with the backend running **and an `ORS_API_KEY` set** (so a real plan returns), then on desktop AND mobile width verify:
- After Calculate, the map draws the route line, places colored stop pins (blue current, green pickup, red dropoff, orange rest, yellow fuel), and fits bounds; clicking a stop pin shows the popup (name, type, arrival, duration).
- One log sheet per day appears below; each grid shows the four rows with status lines and connectors; the four totals read and sum to 24; remarks list under each grid.
- A multi-day trip produces multiple sheets matching the day count.
- If `cycle_hours_warning` is present, the warning banner shows above the sheets.
- No console errors; log grid is legible (light paper) in the dark theme; layout stable on mobile; sheets scroll.

- [ ] **Step 3: Commit any lint/format fixups**

```bash
git add -A
git commit -m "chore(fe): phase B lint/format pass" || echo "nothing to commit"
```

---

## Self-Review Notes (for the implementer)

- **Only `log-grid.ts` is unit-tested** (per the minimal-testing decision); the SVG/map rendering is verified in a browser. The page smoke test from Phase A must stay green.
- **End-of-day handling:** backend entries that end at midnight serialize as `"00:00"`; `buildRowSegments` maps that to end-of-day (1440). Do not "fix" this by changing the backend.
- **`noUncheckedIndexedAccess`:** `segments[i]`, `coordinates[0]`, `ROWS[...]`, `.split(":")[n]` are all guarded in the provided code — keep the guards.
- **Preserve Phase A:** Tasks 4–5 modify existing files; integrate additively and keep the loading/empty/error/success/reset states and the map's placement behavior.
- **Spec coverage:** route line + colored stop pins + popups → Task 4; map auto-fit → Task 4; SVG 24h grid with 4 rows/lines/connectors/colors → Tasks 1–2; totals summing to 24 → Task 2; header placeholders + remarks → Task 3; one sheet per day, scrollable → Tasks 3/5; cycle warning banner → already wired in Phase A, shown above sheets.
