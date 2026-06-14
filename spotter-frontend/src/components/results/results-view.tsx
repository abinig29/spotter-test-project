import {
  AlertTriangle,
  Download,
  MousePointerClick,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";

import { LogSheet } from "@/components/logs/log-sheet";
import {
  type FocusStop,
  TripMap,
  type MapPin as TripPin,
} from "@/components/map/trip-map";
import { StopsList } from "@/components/results/stops-list";
import { TripSummary } from "@/components/results/trip-summary";
import { Button } from "@/components/ui/button";
import type { TripLocation, TripPlanResponse } from "@/lib/api-types";

interface ResultsViewProps {
  plan: TripPlanResponse;
  current?: TripLocation;
  onReset: () => void;
  onEdit: () => void;
}

export function ResultsView({
  plan,
  current,
  onReset,
  onEdit,
}: ResultsViewProps) {
  const [focusStop, setFocusStop] = useState<FocusStop | null>(null);

  const pins: TripPin[] = current
    ? [{ type: "current", label: "Current", location: current }]
    : [];

  return (
    <main className="flex h-svh flex-col lg:flex-row">
      {/* Data panel */}
      <div className="order-2 flex min-h-0 flex-1 flex-col border-t lg:order-1 lg:border-t-0 lg:border-r">
        {/* Document title — only rendered in the printed / saved PDF */}
        <div className="print-only mb-4 border-b pb-3">
          <h1 className="font-semibold text-base tracking-tight">
            Driver's Daily Logs
          </h1>
          <p className="text-muted-foreground text-xs">
            Spotter ELD Trip Planner · {plan.logs.length} day
            {plan.logs.length === 1 ? "" : "s"} ·{" "}
            {plan.route.total_miles.toLocaleString()} mi
          </p>
        </div>

        {/* Top bar */}
        <header className="no-print flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight">
              Spotter
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit trip
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
            >
              <Download className="size-3.5" />
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              <Plus className="size-3.5" />
              New trip
            </Button>
          </div>
        </header>

        {/* Metrics */}
        <TripSummary plan={plan} />

        {/* Cycle warning */}
        {plan.cycle_hours_warning && (
          <div className="no-print flex items-start gap-2.5 border-amber-200 border-b bg-amber-50 px-4 py-2.5 text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs">
              <span className="font-semibold">Cycle hours: </span>
              {plan.cycle_hours_warning}
            </p>
          </div>
        )}

        {/* Pinned route timeline */}
        {plan.route.stops.length > 0 && (
          <section
            aria-label="Stops"
            className="shrink-0 border-b bg-card px-4 py-3"
          >
            <div className="mb-2.5 flex items-center gap-2">
              <h2 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                Route stops
              </h2>
              <span className="no-print flex items-center gap-1 text-[10px] text-muted-foreground/80">
                <MousePointerClick className="size-3" />
                Tap to locate on map
              </span>
            </div>
            <div className="relative">
              <StopsList
                plan={plan}
                current={current}
                onSelect={setFocusStop}
                activeKey={focusStop?.key}
              />
              {/* Right-edge fade hints at horizontal scroll when stops overflow */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-card to-transparent" />
            </div>
          </section>
        )}

        {/* Scrollable log sheets — the priority content */}
        <section
          aria-label="Daily log sheets"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
        >
          <div className="mb-3 flex items-baseline gap-4">
            <h2 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              Daily log sheets
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {plan.logs.length} day{plan.logs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {plan.logs.map((log) => (
              <LogSheet key={log.day} log={log} />
            ))}
          </div>
        </section>
      </div>

      {/* Map */}
      <aside className="no-print order-1 h-[38vh] shrink-0 lg:order-2 lg:h-auto lg:w-1/2 lg:max-w-none">
        <TripMap
          pins={pins}
          interactive={false}
          onPick={() => {}}
          route={plan.route}
          focusStop={focusStop}
        />
      </aside>
    </main>
  );
}
