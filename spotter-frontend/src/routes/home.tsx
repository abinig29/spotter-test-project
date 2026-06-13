import { useMutation } from "@tanstack/react-query";
import { AlertCircle, MapPinned, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type MapPin, TripMap } from "@/components/map/trip-map";
import { LocationSummary } from "@/components/trip/location-summary";
import { StepIndicator } from "@/components/trip/step-indicator";
import { TripControls } from "@/components/trip/trip-controls";
import { TripWarning } from "@/components/trip/trip-warning";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TripPlanError, planTrip } from "@/lib/api";
import type { TripPlanResponse } from "@/lib/api-types";
import { reverseGeocode } from "@/lib/geocode";
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

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <Skeleton className="h-4 w-24 rounded-sm" />
      <Skeleton className="h-3 w-40 rounded-sm" />
      <Skeleton className="h-3 w-32 rounded-sm" />
    </div>
  );
}

export default function Home() {
  const store = useTripStore();
  const [resolving, setResolving] = useState(false);
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: planTrip,
    onSuccess: (data) => {
      setPlan(data);
      setErrorMessage(null);
      toast.success("Trip planned");
    },
    onError: (error) => {
      const message =
        error instanceof TripPlanError ? error.message : "Something went wrong.";
      setErrorMessage(message);
      toast.error(message, { action: { label: "Retry", onClick: handleCalculate } });
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
    setErrorMessage(null);
    mutation.mutate({
      current_location: store.current,
      pickup_location: store.pickup,
      dropoff_location: store.dropoff,
      cycle_hours_used: store.cycleHoursUsed,
    });
  }

  function handleReset() {
    store.reset();
    setPlan(null);
    setErrorMessage(null);
    mutation.reset();
  }

  const ready = selectIsReady(store);
  const pins = buildPins(store.current, store.pickup, store.dropoff);
  const hasAnyPin = pins.length > 0;

  return (
    <main className="grid h-full min-h-0 grid-rows-[minmax(320px,1fr)_auto] gap-4 p-4 lg:grid-cols-[1fr_360px] lg:grid-rows-1">
      <section className="relative min-h-[320px] overflow-hidden rounded-lg border bg-muted">
        <TripMap
          pins={pins}
          interactive={store.step !== "complete"}
          onPick={handlePick}
        />
        {resolving && (
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 rounded-md border bg-card/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
            <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
            Resolving address…
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto lg:w-[360px]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-medium text-sm">Plan a trip</h1>
          {hasAnyPin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={handleReset}
              aria-label="Reset all locations and start over"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
          )}
        </div>

        <StepIndicator step={store.step} />

        <LocationSummary
          current={store.current}
          pickup={store.pickup}
          dropoff={store.dropoff}
          step={store.step}
          onChange={store.changePin}
        />

        <TripControls
          cycleHours={store.cycleHoursUsed}
          onCycleHoursChange={store.setCycleHours}
          onCalculate={handleCalculate}
          disabled={!ready}
          loading={mutation.isPending}
        />

        {errorMessage && !mutation.isPending && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertTitle>Could not plan trip</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleCalculate}
                disabled={!ready}
              >
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}

        {mutation.isPending && <PlanSkeleton />}

        {plan?.cycle_hours_warning && (
          <TripWarning message={plan.cycle_hours_warning} />
        )}

        {plan && !mutation.isPending && (
          <div className="rounded-md border bg-card p-3 text-sm">
            <p className="font-medium">Trip planned</p>
            <p className="text-muted-foreground">
              {plan.route.total_miles} mi · {plan.logs.length} day
              {plan.logs.length === 1 ? "" : "s"}
            </p>
          </div>
        )}

        {!plan && !mutation.isPending && !errorMessage && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed bg-card/50 px-4 py-6 text-center">
            <MapPinned
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Place all three pins and enter cycle hours to calculate a trip.
            </p>
          </div>
        )}
      </aside>
    </main>
  );
}
