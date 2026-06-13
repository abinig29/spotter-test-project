# Frontend Phase A (Input Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Every component task must follow the `design-engineer` skill** (full states, motion with `prefers-reduced-motion`, stable layout, a11y, match the existing dark theme + Tailwind tokens).

**Goal:** Build the trip-planner input flow — Leaflet map with step-by-step pin placement, Nominatim geocoding, a summary panel, cycle-hours input, and the Calculate action that calls `POST /api/trip/plan` with loading/error/empty states.

**Architecture:** A single planner page in the existing app shell. Trip-input state lives in a Zustand store; the API call is a TanStack Query mutation; the response is held in page state and rendered minimally (Phase B makes it polished). Pure logic (API mapping, geocode parsing, store transitions) is unit-tested; the visual surface is verified in a browser.

**Tech Stack:** React 19, Vite, TypeScript (strict, `verbatimModuleSyntax`), Tailwind v4, shadcn/Radix/Base UI, react-leaflet + leaflet, Zustand, TanStack Query, Motion, lucide-react, sonner, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-06-13-frontend-design.md](../specs/2026-06-13-frontend-design.md)

---

## File Structure

| File | Responsibility |
|---|---|
| `vite.config.ts` | (modify) add Vitest config (jsdom + setup). |
| `src/test/setup.ts` | Testing-Library/jest-dom matchers. |
| `src/lib/env.ts` | Typed `VITE_API_BASE_URL`. |
| `src/lib/api-types.ts` | TS mirror of the backend contract. |
| `src/lib/api.ts` | `planTrip(request)` + `TripPlanError`. |
| `src/lib/geocode.ts` | `reverseGeocode` + pure `parseAddress`/`fallbackLabel`. |
| `src/store/trip-store.ts` | Pin-placement state machine. |
| `src/components/map/pin-icons.ts` | Colored Leaflet divIcons. |
| `src/components/map/trip-map.tsx` | Presentational map (tiles, click, markers). |
| `src/components/trip/step-indicator.tsx` | Active-step prompt. |
| `src/components/trip/location-summary.tsx` | Placed locations + Change. |
| `src/components/trip/trip-controls.tsx` | Cycle-hours input + Calculate. |
| `src/components/trip/trip-warning.tsx` | `cycle_hours_warning` banner. |
| `src/routes/home.tsx` | (replace) TripPlanner page composing everything. |
| `src/components/app-shell.tsx` (`src/app-shell.tsx`) | (modify) wrap in `QueryClientProvider`. |

**Run:** `pnpm vitest run` (tests), `pnpm check-types` (tsc), `pnpm check` (Biome), `pnpm build`, `pnpm dev` (browser check).

---

## Task 1: Tooling, providers, shadcn components

**Files:**
- Modify: `vite.config.ts`, `src/app-shell.tsx`, `package.json` (via installs)
- Create: `src/test/setup.ts`, `src/lib/env.ts`, `src/test/env.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd spotter-frontend
pnpm add react-leaflet leaflet
pnpm add -D @types/leaflet
pnpm dlx shadcn@latest add badge alert separator scroll-area tooltip slider
```
(If the `shadcn add` prompts, accept defaults; it writes into `src/components/ui/`.)

- [ ] **Step 2: Add Vitest config to `vite.config.ts`**

Add a `test` block and the triple-slash reference. The full file:
```ts
/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create `src/lib/env.ts`**

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_BASE_URL: z.string().default("http://localhost:8000"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
```

- [ ] **Step 5: Write the env smoke test `src/test/env.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

describe("env", () => {
  it("provides an API base URL", () => {
    expect(typeof env.VITE_API_BASE_URL).toBe("string");
    expect(env.VITE_API_BASE_URL.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Wrap the app in `QueryClientProvider`** — edit `src/app-shell.tsx`

Add the import and a single shared client, wrapping the existing tree:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

function RoutedLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className="grid h-svh grid-rows-[auto_1fr]">
          <Header />
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default function AppShell() {
  return <RoutedLayout />;
}
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm vitest run && pnpm check-types`
Expected: env test passes; tsc reports no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts src/test/setup.ts src/lib/env.ts src/test/env.test.ts src/app-shell.tsx src/components/ui
git commit -m "chore(fe): vitest + leaflet/shadcn deps, env, query provider"
```

---

## Task 2: API types + client

**Files:**
- Create: `src/lib/api-types.ts`, `src/lib/api.ts`, `src/test/api.test.ts`

- [ ] **Step 1: Write the failing test `src/test/api.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { planTrip, TripPlanError } from "@/lib/api";
import type { TripPlanRequest } from "@/lib/api-types";

const REQUEST: TripPlanRequest = {
  current_location: { lat: 41.85, lng: -87.65, address: "Chicago, IL" },
  pickup_location: { lat: 40, lng: -88, address: "Pickupville, IL" },
  dropoff_location: { lat: 36.16, lng: -86.78, address: "Nashville, TN" },
  cycle_hours_used: 10,
};

const SAMPLE = {
  route: { total_miles: 470, total_driving_hours: 7.2, coordinates: [[41.85, -87.65]], stops: [] },
  cycle_hours_warning: null,
  logs: [],
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  ));
}

describe("planTrip", () => {
  it("returns the parsed plan on 200", async () => {
    stubFetch(200, SAMPLE);
    const result = await planTrip(REQUEST);
    expect(result.route.total_miles).toBe(470);
  });

  it("maps 503 to a not_configured error", async () => {
    stubFetch(503, { error: "Routing not configured." });
    await expect(planTrip(REQUEST)).rejects.toMatchObject({ kind: "not_configured" });
  });

  it("maps 422 to an unroutable error with the PRD message", async () => {
    stubFetch(422, { error: "x" });
    await expect(planTrip(REQUEST)).rejects.toMatchObject({
      kind: "unroutable",
      message: "Could not resolve a valid driving location. Please click on a road or city.",
    });
  });

  it("maps 502 to a service error", async () => {
    stubFetch(502, { error: "x" });
    await expect(planTrip(REQUEST)).rejects.toMatchObject({ kind: "service" });
  });

  it("maps a thrown fetch to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(planTrip(REQUEST)).rejects.toBeInstanceOf(TripPlanError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/api.test.ts`
Expected: FAIL — cannot resolve `@/lib/api`.

- [ ] **Step 3: Create `src/lib/api-types.ts`**

```ts
export type DutyStatus = "off_duty" | "sleeper_berth" | "driving" | "on_duty_not_driving";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripLocation extends LatLng {
  address: string;
}

export interface Stop {
  type: "pickup" | "fuel" | "rest" | "dropoff";
  location: string;
  lat: number;
  lng: number;
  arrival: string;
  duration_hours: number;
}

export interface LogEntry {
  status: DutyStatus;
  start: string;
  end: string;
  location?: string;
  note?: string;
}

export interface DayLog {
  day: number;
  date: string;
  total_miles_today: number;
  entries: LogEntry[];
  totals: Record<DutyStatus, number>;
  remarks: string[];
}

export interface TripPlanResponse {
  route: {
    total_miles: number;
    total_driving_hours: number;
    coordinates: [number, number][];
    stops: Stop[];
  };
  cycle_hours_warning: string | null;
  logs: DayLog[];
}

export interface TripPlanRequest {
  current_location: TripLocation;
  pickup_location: TripLocation;
  dropoff_location: TripLocation;
  cycle_hours_used: number;
}
```

- [ ] **Step 4: Create `src/lib/api.ts`**

```ts
import { env } from "@/lib/env";
import type { TripPlanRequest, TripPlanResponse } from "@/lib/api-types";

export type TripPlanErrorKind =
  | "not_configured"
  | "unroutable"
  | "service"
  | "validation"
  | "network";

const MESSAGES: Record<TripPlanErrorKind, string> = {
  not_configured: "Routing isn't configured yet.",
  unroutable: "Could not resolve a valid driving location. Please click on a road or city.",
  service: "Routing service unavailable — please try again.",
  validation: "Please check the locations and cycle hours.",
  network: "Network error — please try again.",
};

export class TripPlanError extends Error {
  kind: TripPlanErrorKind;
  constructor(kind: TripPlanErrorKind) {
    super(MESSAGES[kind]);
    this.name = "TripPlanError";
    this.kind = kind;
  }
}

function kindForStatus(status: number): TripPlanErrorKind {
  if (status === 503) return "not_configured";
  if (status === 422) return "unroutable";
  if (status === 400) return "validation";
  return "service";
}

export async function planTrip(request: TripPlanRequest): Promise<TripPlanResponse> {
  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_BASE_URL}/api/trip/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new TripPlanError("network");
  }
  if (!response.ok) {
    throw new TripPlanError(kindForStatus(response.status));
  }
  return (await response.json()) as TripPlanResponse;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/test/api.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-types.ts src/lib/api.ts src/test/api.test.ts
git commit -m "feat(fe): API types + planTrip client with typed errors"
```

---

## Task 3: Reverse geocoding

**Files:**
- Create: `src/lib/geocode.ts`, `src/test/geocode.test.ts`

- [ ] **Step 1: Write the failing test `src/test/geocode.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { fallbackLabel, parseAddress } from "@/lib/geocode";

describe("geocode helpers", () => {
  it("formats city + state code from ISO", () => {
    const data = { address: { city: "St. Louis", state: "Missouri", "ISO3166-2-lvl4": "US-MO" } };
    expect(parseAddress(data, 38.6, -90.2)).toBe("St. Louis, MO");
  });

  it("falls back to town + state name", () => {
    const data = { address: { town: "Cape Girardeau", state: "Missouri" } };
    expect(parseAddress(data, 37.3, -89.5)).toBe("Cape Girardeau, Missouri");
  });

  it("uses coordinate fallback when no address", () => {
    expect(parseAddress({}, 35.14, -90.04)).toBe("Near 35.14, -90.04");
  });

  it("fallbackLabel formats two decimals", () => {
    expect(fallbackLabel(35.1437, -90.0449)).toBe("Near 35.14, -90.04");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/geocode.test.ts`
Expected: FAIL — cannot resolve `@/lib/geocode`.

- [ ] **Step 3: Create `src/lib/geocode.ts`**

```ts
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  "ISO3166-2-lvl4"?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

export function fallbackLabel(lat: number, lng: number): string {
  return `Near ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

export function parseAddress(data: NominatimResponse, lat: number, lng: number): string {
  const address = data.address ?? {};
  const city = address.city || address.town || address.village || address.county;
  const iso = address["ISO3166-2-lvl4"];
  const stateCode = iso && iso.includes("-") ? iso.split("-").pop() : undefined;
  const label = stateCode || address.state;
  if (city && label) return `${city}, ${label}`;
  if (city) return city;
  if (data.display_name) return data.display_name.split(",")[0] ?? fallbackLabel(lat, lng);
  return fallbackLabel(lat, lng);
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return fallbackLabel(lat, lng);
    return parseAddress((await response.json()) as NominatimResponse, lat, lng);
  } catch {
    return fallbackLabel(lat, lng);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/test/geocode.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geocode.ts src/test/geocode.test.ts
git commit -m "feat(fe): Nominatim reverse geocoding with coordinate fallback"
```

---

## Task 4: Trip store (pin-placement state machine)

**Files:**
- Create: `src/store/trip-store.ts`, `src/test/trip-store.test.ts`

- [ ] **Step 1: Write the failing test `src/test/trip-store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { selectIsReady, useTripStore } from "@/store/trip-store";

const loc = (lat: number, lng: number) => ({ lat, lng, address: `${lat},${lng}` });

beforeEach(() => useTripStore.getState().reset());

describe("trip store", () => {
  it("advances the step machine as pins are placed", () => {
    const s = useTripStore.getState();
    expect(s.step).toBe("current");
    s.placePin(loc(1, 1));
    expect(useTripStore.getState().step).toBe("pickup");
    useTripStore.getState().placePin(loc(2, 2));
    expect(useTripStore.getState().step).toBe("dropoff");
    useTripStore.getState().placePin(loc(3, 3));
    expect(useTripStore.getState().step).toBe("complete");
  });

  it("changePin clears that pin and re-enters its step", () => {
    const s = useTripStore.getState();
    s.placePin(loc(1, 1));
    s.placePin(loc(2, 2));
    s.placePin(loc(3, 3));
    useTripStore.getState().changePin("pickup");
    expect(useTripStore.getState().pickup).toBeUndefined();
    expect(useTripStore.getState().step).toBe("pickup");
    useTripStore.getState().placePin(loc(9, 9));
    expect(useTripStore.getState().step).toBe("complete");
  });

  it("isReady requires three pins and valid cycle hours", () => {
    const s = useTripStore.getState();
    expect(selectIsReady(useTripStore.getState())).toBe(false);
    s.placePin(loc(1, 1));
    s.placePin(loc(2, 2));
    s.placePin(loc(3, 3));
    expect(selectIsReady(useTripStore.getState())).toBe(true);
    useTripStore.getState().setCycleHours(80);
    expect(selectIsReady(useTripStore.getState())).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/trip-store.test.ts`
Expected: FAIL — cannot resolve `@/store/trip-store`.

- [ ] **Step 3: Create `src/store/trip-store.ts`**

```ts
import { create } from "zustand";
import type { TripLocation } from "@/lib/api-types";

export type PinKey = "current" | "pickup" | "dropoff";
export type Step = PinKey | "complete";

const ORDER: PinKey[] = ["current", "pickup", "dropoff"];

interface TripState {
  step: Step;
  current?: TripLocation;
  pickup?: TripLocation;
  dropoff?: TripLocation;
  cycleHoursUsed: number;
  placePin: (location: TripLocation) => void;
  changePin: (which: PinKey) => void;
  setCycleHours: (value: number) => void;
  reset: () => void;
}

function nextStep(pins: Pick<TripState, PinKey>): Step {
  for (const key of ORDER) {
    if (!pins[key]) return key;
  }
  return "complete";
}

export const useTripStore = create<TripState>((set) => ({
  step: "current",
  cycleHoursUsed: 0,
  placePin: (location) =>
    set((state) => {
      const active: PinKey = state.step === "complete" ? "current" : state.step;
      const pins = {
        current: state.current,
        pickup: state.pickup,
        dropoff: state.dropoff,
        [active]: location,
      };
      return { [active]: location, step: nextStep(pins) } as Partial<TripState>;
    }),
  changePin: (which) => set({ [which]: undefined, step: which } as Partial<TripState>),
  setCycleHours: (value) => set({ cycleHoursUsed: value }),
  reset: () =>
    set({
      step: "current",
      current: undefined,
      pickup: undefined,
      dropoff: undefined,
      cycleHoursUsed: 0,
    }),
}));

export function selectIsReady(state: TripState): boolean {
  return (
    !!state.current &&
    !!state.pickup &&
    !!state.dropoff &&
    Number.isFinite(state.cycleHoursUsed) &&
    state.cycleHoursUsed >= 0 &&
    state.cycleHoursUsed <= 70
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/test/trip-store.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/store/trip-store.ts src/test/trip-store.test.ts
git commit -m "feat(fe): trip store pin-placement state machine"
```

---

## Task 5: Map (presentational) + pin icons

**Files:**
- Create: `src/components/map/pin-icons.ts`, `src/components/map/trip-map.tsx`

**Design-engineer acceptance:** stable map height (no reflow), accessible attribution, cursor affordance when placing, tooltips on pins, works on mobile width. No test (visual).

- [ ] **Step 1: Create `src/components/map/pin-icons.ts`**

```ts
import L from "leaflet";

export const PIN_COLORS = {
  current: "#2563eb", // blue
  pickup: "#16a34a", // green
  dropoff: "#dc2626", // red
  rest: "#f97316", // orange
  fuel: "#eab308", // yellow
} as const;

export type PinType = keyof typeof PIN_COLORS;

export function pinIcon(type: PinType): L.DivIcon {
  const color = PIN_COLORS[type];
  const html = `
    <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 21 13 21s13-11.75 13-21C26 5.82 20.18 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="white"/>
    </svg>`;
  return L.divIcon({
    className: "spotter-pin",
    html,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  });
}
```

- [ ] **Step 2: Create `src/components/map/trip-map.tsx`**

```tsx
import "leaflet/dist/leaflet.css";

import { MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

import type { TripLocation } from "@/lib/api-types";
import { type PinType, pinIcon } from "@/components/map/pin-icons";

const US_CENTER: [number, number] = [39.5, -98.35];

export interface MapPin {
  type: PinType;
  label: string;
  location: TripLocation;
}

interface TripMapProps {
  pins: MapPin[];
  interactive: boolean;
  onPick: (lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function TripMap({ pins, interactive, onPick }: TripMapProps) {
  return (
    <MapContainer
      center={US_CENTER}
      zoom={4}
      className="h-full w-full"
      style={{ cursor: interactive ? "crosshair" : "grab" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {interactive && <ClickHandler onPick={onPick} />}
      {pins.map((pin) => (
        <Marker key={pin.type} position={[pin.location.lat, pin.location.lng]} icon={pinIcon(pin.type)}>
          <Tooltip>
            {pin.label}: {pin.location.address}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check-types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/pin-icons.ts src/components/map/trip-map.tsx
git commit -m "feat(fe): presentational Leaflet map with colored pins"
```

---

## Task 6: Control-panel components

**Files:**
- Create: `src/components/trip/step-indicator.tsx`, `src/components/trip/location-summary.tsx`, `src/components/trip/trip-controls.tsx`, `src/components/trip/trip-warning.tsx`

**Design-engineer acceptance:** clear active/done states, visible focus rings, disabled state on Calculate until ready, lucide icons, sharp/clean styling matching `src/components/ui/*`, ≥44px touch targets, `prefers-reduced-motion`-respecting transitions (Motion).

- [ ] **Step 1: Create `src/components/trip/step-indicator.tsx`**

```tsx
import { CheckCircle2, MapPin } from "lucide-react";

import type { Step } from "@/store/trip-store";

const PROMPTS: Record<Step, string> = {
  current: "Step 1 of 3: Click your current location",
  pickup: "Step 2 of 3: Now click your pickup location",
  dropoff: "Step 3 of 3: Now click your dropoff location",
  complete: "All locations set — enter cycle hours and calculate",
};

export function StepIndicator({ step }: { step: Step }) {
  const done = step === "complete";
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium">
      {done ? (
        <CheckCircle2 className="size-4 text-green-500" aria-hidden="true" />
      ) : (
        <MapPin className="size-4 text-primary" aria-hidden="true" />
      )}
      <span>{PROMPTS[step]}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/trip/location-summary.tsx`**

```tsx
import { Flag, MapPin, Truck } from "lucide-react";

import type { TripLocation } from "@/lib/api-types";
import type { PinKey } from "@/store/trip-store";
import { Button } from "@/components/ui/button";

interface Row {
  key: PinKey;
  label: string;
  location?: TripLocation;
  icon: typeof MapPin;
  color: string;
}

interface LocationSummaryProps {
  current?: TripLocation;
  pickup?: TripLocation;
  dropoff?: TripLocation;
  onChange: (which: PinKey) => void;
}

export function LocationSummary({ current, pickup, dropoff, onChange }: LocationSummaryProps) {
  const rows: Row[] = [
    { key: "current", label: "Current", location: current, icon: MapPin, color: "text-blue-500" },
    { key: "pickup", label: "Pickup", location: pickup, icon: Truck, color: "text-green-500" },
    { key: "dropoff", label: "Dropoff", location: dropoff, icon: Flag, color: "text-red-500" },
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
          <row.icon className={`size-4 shrink-0 ${row.color}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="truncate text-sm">
              {row.location ? row.location.address : "Not set"}
            </p>
          </div>
          {row.location && (
            <Button variant="ghost" size="sm" onClick={() => onChange(row.key)}>
              Change
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create `src/components/trip/trip-controls.tsx`**

```tsx
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TripControlsProps {
  cycleHours: number;
  onCycleHoursChange: (value: number) => void;
  onCalculate: () => void;
  disabled: boolean;
  loading: boolean;
}

export function TripControls({
  cycleHours,
  onCycleHoursChange,
  onCalculate,
  disabled,
  loading,
}: TripControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cycle-hours">Current cycle used (hrs)</Label>
        <Input
          id="cycle-hours"
          type="number"
          min={0}
          max={70}
          step={0.5}
          value={Number.isNaN(cycleHours) ? "" : cycleHours}
          onChange={(event) => onCycleHoursChange(event.target.valueAsNumber)}
        />
      </div>
      <Button onClick={onCalculate} disabled={disabled || loading} className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {loading ? "Calculating…" : "Calculate Trip"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/trip/trip-warning.tsx`**

```tsx
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function TripWarning({ message }: { message: string }) {
  return (
    <Alert>
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle>Cycle hours warning</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm check-types`
Expected: no errors. (If `Alert` exports differ from the shadcn version pulled in Task 1, adjust the import names to match `src/components/ui/alert.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add src/components/trip
git commit -m "feat(fe): step indicator, location summary, controls, warning"
```

---

## Task 7: TripPlanner page + states + smoke test

**Files:**
- Replace: `src/routes/home.tsx`
- Create: `src/test/planner.smoke.test.tsx`

**Design-engineer acceptance:** responsive layout (map + panel side-by-side on desktop, stacked on mobile); loading skeleton during mutation; empty result state with guidance; error surfaced via `alert` + sonner toast with retry; success toast. Stable dimensions.

- [ ] **Step 1: Write the failing smoke test `src/test/planner.smoke.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/routes/home";
import { useTripStore } from "@/store/trip-store";

// Leaflet needs DOM APIs jsdom lacks; stub the map module to a placeholder.
vi.mock("@/components/map/trip-map", () => ({
  TripMap: () => <div data-testid="trip-map" />,
}));

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

beforeEach(() => useTripStore.getState().reset());

describe("TripPlanner page", () => {
  it("renders the first placement step", () => {
    renderPage();
    expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByTestId("trip-map")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/planner.smoke.test.tsx`
Expected: FAIL — the current `home.tsx` renders ASCII art, not "Step 1 of 3".

- [ ] **Step 3: Replace `src/routes/home.tsx`**

```tsx
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import type { TripPlanResponse } from "@/lib/api-types";
import { planTrip, TripPlanError } from "@/lib/api";
import { reverseGeocode } from "@/lib/geocode";
import { type MapPin, TripMap } from "@/components/map/trip-map";
import { LocationSummary } from "@/components/trip/location-summary";
import { StepIndicator } from "@/components/trip/step-indicator";
import { TripControls } from "@/components/trip/trip-controls";
import { TripWarning } from "@/components/trip/trip-warning";
import { selectIsReady, useTripStore } from "@/store/trip-store";

function buildPins(
  current?: MapPin["location"],
  pickup?: MapPin["location"],
  dropoff?: MapPin["location"],
): MapPin[] {
  const pins: MapPin[] = [];
  if (current) pins.push({ type: "current", label: "Current", location: current });
  if (pickup) pins.push({ type: "pickup", label: "Pickup", location: pickup });
  if (dropoff) pins.push({ type: "dropoff", label: "Dropoff", location: dropoff });
  return pins;
}

export default function Home() {
  const store = useTripStore();
  const [resolving, setResolving] = useState(false);
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);

  const mutation = useMutation({
    mutationFn: planTrip,
    onSuccess: (data) => {
      setPlan(data);
      toast.success("Trip planned");
    },
    onError: (error) => {
      const message = error instanceof TripPlanError ? error.message : "Something went wrong.";
      toast.error(message);
    },
  });

  async function handlePick(lat: number, lng: number) {
    setResolving(true);
    try {
      const address = await reverseGeocode(lat, lng);
      store.placePin({ lat, lng, address });
    } finally {
      setResolving(false);
    }
  }

  function handleCalculate() {
    if (!store.current || !store.pickup || !store.dropoff) return;
    mutation.mutate({
      current_location: store.current,
      pickup_location: store.pickup,
      dropoff_location: store.dropoff,
      cycle_hours_used: store.cycleHoursUsed,
    });
  }

  const ready = selectIsReady(store);
  const pins = buildPins(store.current, store.pickup, store.dropoff);

  return (
    <main className="grid h-full min-h-0 grid-rows-[1fr_auto] gap-4 p-4 lg:grid-cols-[1fr_360px] lg:grid-rows-1">
      <section className="relative min-h-[320px] overflow-hidden rounded-lg border">
        <TripMap pins={pins} interactive={store.step !== "complete"} onPick={handlePick} />
        {resolving && (
          <div className="absolute right-3 top-3 z-[1000] rounded-md border bg-card px-3 py-1.5 text-xs shadow">
            Resolving address…
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4 overflow-y-auto lg:w-[360px]">
        <StepIndicator step={store.step} />
        <LocationSummary
          current={store.current}
          pickup={store.pickup}
          dropoff={store.dropoff}
          onChange={store.changePin}
        />
        <TripControls
          cycleHours={store.cycleHoursUsed}
          onCycleHoursChange={store.setCycleHours}
          onCalculate={handleCalculate}
          disabled={!ready}
          loading={mutation.isPending}
        />
        {plan?.cycle_hours_warning && <TripWarning message={plan.cycle_hours_warning} />}
        {plan && (
          <div className="rounded-md border bg-card p-3 text-sm">
            <p className="font-medium">Trip planned</p>
            <p className="text-muted-foreground">
              {plan.route.total_miles} mi · {plan.logs.length} day
              {plan.logs.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
        {!plan && !mutation.isPending && (
          <p className="text-sm text-muted-foreground">
            Place all three pins and enter cycle hours to calculate a trip.
          </p>
        )}
      </aside>
    </main>
  );
}
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `pnpm vitest run src/test/planner.smoke.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add src/routes/home.tsx src/test/planner.smoke.test.tsx
git commit -m "feat(fe): trip planner page wiring map, panel, mutation, states"
```

---

## Task 8: Verify the whole Phase A surface

- [ ] **Step 1: Full test + types + lint + build**

```bash
pnpm vitest run && pnpm check-types && pnpm check && pnpm build
```
Expected: all tests pass; tsc clean; Biome clean (it auto-fixes formatting); production build succeeds.

- [ ] **Step 2: Browser verification (design-engineer)**

Run `pnpm dev`, open http://localhost:5173, and verify on desktop AND a mobile width:
- Map fills the area; clicking drops the blue pin and resolves an address; step advances to pickup → dropoff.
- "Change" re-enters a step; re-picking updates the pin.
- Calculate is disabled until 3 pins + valid cycle hours; while pending it shows the spinner.
- With the backend running **without** `ORS_API_KEY`, Calculate surfaces the "Routing isn't configured yet." toast (503) — confirms the error path. (With a key set, a real plan returns.)
- No console errors; layout stable; no clipped text on mobile.

- [ ] **Step 3: Commit any lint/format fixups**

```bash
git add -A
git commit -m "chore(fe): phase A lint/format pass" || echo "nothing to commit"
```

---

## Self-Review Notes (for the implementer)

- **Pure logic is tested; visual surface is verified in a browser** (per the minimal-testing decision). The map module is stubbed in the page smoke test because Leaflet needs DOM APIs jsdom lacks.
- **Type-only imports** use `import type` (the repo sets `verbatimModuleSyntax`). `noUncheckedIndexedAccess` is on — array/`split` access is guarded (see `geocode.parseAddress`).
- **shadcn component names:** Task 6 assumes `alert.tsx` exports `Alert`/`AlertTitle`/`AlertDescription`. If the pulled version differs, align imports to the actual file.
- **Design-engineer is the bar** for Tasks 5–7: full states, focus-visible, `prefers-reduced-motion`, stable dimensions, mobile. The provided code is a correct baseline; apply polish without breaking the tested logic or the smoke test.
- **Spec coverage:** map pin flow → Tasks 5/7; step indicator → Task 6; summary + Change → Task 6; cycle input + Calculate gating → Tasks 4/6/7; API + error contract → Task 2; geocoding + fallback → Task 3; loading/empty/error/success states → Task 7; warning banner → Tasks 6/7. (Route rendering + SVG log sheets are Phase B.)
