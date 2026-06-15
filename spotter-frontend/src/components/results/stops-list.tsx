import { PIN_COLORS, type PinType } from "@/components/map/pin-icons";
import {
  CURRENT_KEY,
  type FocusStop,
  stopKey,
} from "@/components/map/trip-map";
import type { TripLocation, TripPlanResponse } from "@/lib/api-types";

const STOP_LABEL: Record<PinType, string> = {
  current: "Start",
  pickup: "Pickup",
  dropoff: "Dropoff",
  rest: "10hr Rest",
  fuel: "Fuel",
};

interface StopRow {
  type: PinType;
  location: string;
  time?: string;
  duration?: string;
  day: number;
  lat: number;
  lng: number;
  key: string;
}

export function StopsList({
  plan,
  current,
  onSelect,
  activeKey,
}: {
  plan: TripPlanResponse;
  current?: TripLocation;
  onSelect?: (focus: FocusStop) => void;
  /** Key of the currently focused stop, highlighted in its own color. */
  activeKey?: string;
}) {
  const multiDay = plan.logs.length > 1;
  const rows: StopRow[] = [];
  if (current) {
    const departureEntry = plan.logs[0]?.entries.find(
      (e) => e.status === "driving",
    );
    rows.push({
      type: "current",
      location: current.address,
      time: departureEntry?.start,
      day: 1,
      lat: current.lat,
      lng: current.lng,
      key: CURRENT_KEY,
    });
  }
  for (const stop of plan.route.stops) {
    rows.push({
      type: stop.type,
      location: stop.location,
      time: stop.arrival,
      duration: stop.duration_hours > 0 ? `${stop.duration_hours}h` : undefined,
      day: stop.day,
      lat: stop.lat,
      lng: stop.lng,
      key: stopKey(stop),
    });
  }

  return (
    <ol className="-mx-1 flex gap-1 overflow-x-auto scrollbar-none px-1 pt-1.5 pb-1">
      {rows.map((row, i) => {
        const last = i === rows.length - 1;
        const color = PIN_COLORS[row.type];
        const active = row.key === activeKey;
        const select = () =>
          onSelect?.({ lat: row.lat, lng: row.lng, key: row.key });
        return (
          <li
            key={row.key}
            className="flex min-w-[124px] flex-1 shrink-0 flex-col gap-1.5"
          >
            {/* Rail: dot (clickable) + connector to the next node */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={select}
                aria-label={`Show ${STOP_LABEL[row.type]} ${row.location} on the map`}
                className="shrink-0 rounded-full py-1 pr-1 pl-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="block size-2.5 rounded-full transition-shadow"
                  style={{
                    backgroundColor: color,
                    boxShadow: active ? `0 0 0 3px ${color}40` : undefined,
                  }}
                />
              </button>
              {!last && <span className="ml-1 h-px flex-1 bg-border" />}
            </div>
            {/* Label + place + time — click to focus the matching map pin */}
            <button
              type="button"
              onClick={select}
              aria-label={`Show ${STOP_LABEL[row.type]} ${row.location} on the map`}
              aria-pressed={active}
              style={
                active
                  ? {
                      backgroundColor: `${color}1f`,
                      boxShadow: `inset 0 0 0 1px ${color}59`,
                    }
                  : undefined
              }
              className="w-fit min-w-0 max-w-full self-start rounded px-1.5 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p
                className="flex items-center gap-1.5 font-medium text-[10px] uppercase tracking-wider"
                style={{ color }}
              >
                {STOP_LABEL[row.type]}
                {multiDay && (
                  <span className="rounded-sm bg-muted px-1 font-mono text-[9px] text-muted-foreground tracking-normal">
                    D{row.day}
                  </span>
                )}
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
            </button>
          </li>
        );
      })}
    </ol>
  );
}
