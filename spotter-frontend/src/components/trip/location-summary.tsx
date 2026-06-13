import { Flag, MapPin, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TripLocation } from "@/lib/api-types";
import type { PinKey, Step } from "@/store/trip-store";

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
  step?: Step;
  onChange: (which: PinKey) => void;
}

export function LocationSummary({
  current,
  pickup,
  dropoff,
  step,
  onChange,
}: LocationSummaryProps) {
  const rows: Row[] = [
    {
      key: "current",
      label: "Current",
      location: current,
      icon: MapPin,
      color: "text-blue-500",
    },
    {
      key: "pickup",
      label: "Pickup",
      location: pickup,
      icon: Truck,
      color: "text-green-500",
    },
    {
      key: "dropoff",
      label: "Dropoff",
      location: dropoff,
      icon: Flag,
      color: "text-red-500",
    },
  ];

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const isActive = step === row.key;
        return (
          <li
            key={row.key}
            data-active={isActive || undefined}
            className="flex min-h-11 items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors duration-150 motion-reduce:transition-none data-[active]:border-primary/60 data-[active]:bg-primary/5"
          >
            <row.icon
              className={`size-4 shrink-0 ${row.location ? row.color : "text-muted-foreground"}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p
                className={`truncate text-sm ${row.location ? "" : "text-muted-foreground italic"}`}
                title={row.location?.address}
              >
                {row.location ? row.location.address : "Not set yet"}
              </p>
            </div>
            {row.location && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3"
                onClick={() => onChange(row.key)}
                aria-label={`Change ${row.label.toLowerCase()} location`}
              >
                Change
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
