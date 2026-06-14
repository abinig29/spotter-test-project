import type { DayLog, TripPlanResponse } from "@/lib/api-types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-[80px] flex-1 flex-col gap-0.5 border-border/70 border-l pl-3 first:border-l-0 first:pl-0">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="font-semibold text-[15px] text-foreground tabular-nums leading-none">
        {value}
      </span>
      <span className="min-h-3.5 text-[10px] text-muted-foreground tabular-nums">
        {hint ?? ""}
      </span>
    </div>
  );
}

/** Short date like "Thu, Jun 18" from an ISO yyyy-mm-dd string. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return `${WEEKDAYS[date.getUTCDay()] ?? ""}, ${MONTHS[(m ?? 1) - 1] ?? ""} ${d}`;
}

/** Trip arrival = end of the dropoff block (falls back to the last entry). */
function tripArrival(logs: DayLog[]): { date: string; time: string } | null {
  for (const log of logs) {
    const dropoff = log.entries.find((e) => e.note === "Dropoff");
    if (dropoff) return { date: log.date, time: dropoff.end };
  }
  const lastLog = logs.at(-1);
  const lastEntry = lastLog?.entries.at(-1);
  if (lastLog && lastEntry) return { date: lastLog.date, time: lastEntry.end };
  return null;
}

export function TripSummary({ plan }: { plan: TripPlanResponse }) {
  const fuelStops = plan.route.stops.filter((s) => s.type === "fuel").length;
  const restStops = plan.route.stops.filter((s) => s.type === "rest").length;
  const arrival = tripArrival(plan.logs);
  const cycleUsed = plan.total_cycle_hours_used;

  return (
    <div className="flex items-stretch gap-x-3 overflow-x-auto border-b bg-card px-4 py-3 sm:px-6">
      <Metric
        label="Distance"
        value={`${plan.route.total_miles.toLocaleString()} mi`}
      />
      <Metric
        label="Drive time"
        value={`${plan.route.total_driving_hours.toFixed(1)} h`}
      />
      {arrival && (
        <Metric
          label="Arrival"
          value={arrival.time}
          hint={shortDate(arrival.date)}
        />
      )}
      <Metric
        label="Cycle used"
        value={`${cycleUsed} / 70`}
        hint={`${Math.max(0, +(70 - cycleUsed).toFixed(1))} h left`}
      />
      <Metric label="Fuel stops" value={`${fuelStops}`} />
      <Metric label="10h rests" value={`${restStops}`} />
    </div>
  );
}
