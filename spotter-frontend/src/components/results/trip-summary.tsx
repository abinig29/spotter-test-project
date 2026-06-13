import type { TripPlanResponse } from "@/lib/api-types";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="font-semibold text-[15px] text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function TripSummary({ plan }: { plan: TripPlanResponse }) {
  const fuelStops = plan.route.stops.filter((s) => s.type === "fuel").length;
  const restStops = plan.route.stops.filter((s) => s.type === "rest").length;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b bg-card px-4 py-3 sm:px-6">
      <Metric
        label="Distance"
        value={`${plan.route.total_miles.toLocaleString()} mi`}
      />
      <Metric
        label="Drive time"
        value={`${plan.route.total_driving_hours.toFixed(1)} h`}
      />
      <Metric label="Days" value={`${plan.logs.length}`} />
      <Metric label="Fuel stops" value={`${fuelStops}`} />
      <Metric label="10h rests" value={`${restStops}`} />
    </div>
  );
}
