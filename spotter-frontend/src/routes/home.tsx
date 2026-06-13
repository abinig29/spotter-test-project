import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  type CandidateMarker,
  type MapPin,
  TripMap,
} from "@/components/map/trip-map";
import { ResultsView } from "@/components/results/results-view";
import { WizardPanel } from "@/components/wizard/wizard-panel";
import { planTrip, TripPlanError } from "@/lib/api";
import type { TripLocation, TripPlanResponse } from "@/lib/api-types";
import { type AddressResult, reverseGeocode } from "@/lib/geocode";
import { type PinKey, useTripStore } from "@/store/trip-store";

function buildPins(
  current?: TripLocation,
  pickup?: TripLocation,
  dropoff?: TripLocation,
): MapPin[] {
  const pins: MapPin[] = [];
  if (current)
    pins.push({ type: "current", label: "Current", location: current });
  if (pickup) pins.push({ type: "pickup", label: "Pickup", location: pickup });
  if (dropoff)
    pins.push({ type: "dropoff", label: "Dropoff", location: dropoff });
  return pins;
}

export default function Home() {
  const store = useTripStore();
  const [resolving, setResolving] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [candidate, setCandidate] = useState<TripLocation | null>(null);
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
        error instanceof TripPlanError
          ? error.message
          : "Something went wrong.";
      setErrorMessage(message);
      toast.error(message, {
        action: { label: "Retry", onClick: handleCalculate },
      });
    },
  });

  // Map click drops a candidate (not yet committed) for the active step.
  async function handlePick(lat: number, lng: number) {
    setResolving(true);
    try {
      const address = await reverseGeocode(lat, lng);
      setCandidate({ lat, lng, address });
    } finally {
      setResolving(false);
    }
  }

  // Searching a place drops a candidate and recenters the map there.
  function handleSearchSelect(result: AddressResult) {
    setFocus([result.lat, result.lng]);
    setCandidate({
      lat: result.lat,
      lng: result.lng,
      address: result.label,
    });
  }

  // Dragging the candidate marker re-resolves its address.
  async function handleCandidateDrag(lat: number, lng: number) {
    setResolving(true);
    try {
      const address = await reverseGeocode(lat, lng);
      setCandidate({ lat, lng, address });
    } finally {
      setResolving(false);
    }
  }

  // Confirm commits the candidate to the active step and advances.
  function handleConfirm() {
    if (!candidate) return;
    store.placePin(candidate);
    setCandidate(null);
  }

  function handleChangePin(key: PinKey) {
    const existing = store[key];
    store.changePin(key);
    if (existing) {
      setCandidate(existing);
      setFocus([existing.lat, existing.lng]);
    } else {
      setCandidate(null);
    }
  }

  function handleStartOver() {
    store.reset();
    setCandidate(null);
    setFocus(null);
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
    setCandidate(null);
    setFocus(null);
    setPlan(null);
    setErrorMessage(null);
    mutation.reset();
  }

  if (plan) {
    return (
      <ResultsView plan={plan} current={store.current} onReset={handleReset} />
    );
  }

  const pins = buildPins(store.current, store.pickup, store.dropoff);
  const candidateMarker: CandidateMarker | null =
    candidate && store.step !== "complete"
      ? { lat: candidate.lat, lng: candidate.lng, type: store.step as PinKey }
      : null;

  return (
    <main className="flex h-svh flex-col lg:flex-row">
      {/* Guided form panel */}
      <div className="order-2 flex min-h-0 flex-1 flex-col border-t lg:order-1 lg:w-1/2 lg:border-t-0 lg:border-r">
        <WizardPanel
          resolving={resolving}
          calculating={mutation.isPending}
          errorMessage={errorMessage}
          candidate={candidate}
          onCalculate={handleCalculate}
          onSearchSelect={handleSearchSelect}
          onConfirm={handleConfirm}
          onChangePin={handleChangePin}
          onStartOver={handleStartOver}
        />
      </div>

      {/* Map */}
      <aside className="order-1 h-[38vh] shrink-0 lg:order-2 lg:h-auto lg:w-1/2 lg:max-w-none">
        <TripMap
          pins={pins}
          interactive={store.step !== "complete" && !resolving}
          onPick={handlePick}
          focus={focus}
          candidate={candidateMarker}
          onCandidateDrag={handleCandidateDrag}
        />
      </aside>
    </main>
  );
}
