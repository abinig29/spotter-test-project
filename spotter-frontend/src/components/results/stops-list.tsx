import { PIN_COLORS, type PinType } from "@/components/map/pin-icons";
import type { TripLocation, TripPlanResponse } from "@/lib/api-types";

const STOP_LABEL: Record<PinType, string> = {
  current: "Start",
  pickup: "Pickup",
  dropoff: "Dropoff",
  rest: "10h rest",
  fuel: "Fuel",
};

interface StopRow {
  type: PinType;
  location: string;
  time?: string;
  duration?: string;
}

export function StopsList({
  plan,
  current,
}: {
  plan: TripPlanResponse;
  current?: TripLocation;
}) {
  const rows: StopRow[] = [];
  if (current) rows.push({ type: "current", location: current.address });
  for (const stop of plan.route.stops) {
    rows.push({
      type: stop.type,
      location: stop.location,
      time: stop.arrival,
      duration: stop.duration_hours > 0 ? `${stop.duration_hours}h` : undefined,
    });
  }

  return (
    <ol className="flex gap-1 overflow-x-auto pb-1">
      {rows.map((row, i) => {
        const last = i === rows.length - 1;
        const color = PIN_COLORS[row.type];
        return (
          <li
            key={`${row.type}-${row.location}-${row.time ?? "start"}`}
            className="flex min-w-[124px] flex-1 shrink-0 flex-col gap-1.5"
          >
            {/* Rail: dot + connector to the next node */}
            <div className="flex items-center">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              {!last && <span className="ml-1 h-px flex-1 bg-border" />}
            </div>
            {/* Label + place + time */}
            <div className="min-w-0 pr-3">
              <p
                className="font-medium text-[10px] uppercase tracking-wider"
                style={{ color }}
              >
                {STOP_LABEL[row.type]}
              </p>
              <p className="truncate text-foreground text-xs leading-tight">
                {row.location}
              </p>
              {row.time && (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                  {row.time}
                  {row.duration ? ` · ${row.duration}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
