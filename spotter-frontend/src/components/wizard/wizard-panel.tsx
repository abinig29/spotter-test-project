import { Check, Loader2, LocateFixed, Pencil, RotateCcw } from "lucide-react";

import { PIN_COLORS } from "@/components/map/pin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/wizard/address-search";
import type { TripLocation } from "@/lib/api-types";
import type { AddressResult } from "@/lib/geocode";
import type { PinKey } from "@/store/trip-store";
import { selectIsReady, useTripStore } from "@/store/trip-store";

/** Neutral color for the whole stepper rail + nodes. */
const STEPPER = "#64748b";

type NodeState = "done" | "active" | "upcoming";

interface StepMeta {
  index: number;
  label: string;
  prompt: string;
  color: string;
}

const STEP_META: Record<PinKey, StepMeta> = {
  current: {
    index: 0,
    label: "Current location",
    prompt: "Where are you starting from?",
    color: PIN_COLORS.current,
  },
  pickup: {
    index: 1,
    label: "Pickup location",
    prompt: "Where do you pick up the cargo?",
    color: PIN_COLORS.pickup,
  },
  dropoff: {
    index: 2,
    label: "Dropoff location",
    prompt: "Where do you drop off the cargo?",
    color: PIN_COLORS.dropoff,
  },
};

const PIN_ORDER: PinKey[] = ["current", "pickup", "dropoff"];

function StepNode({
  state,
  n,
  last,
}: {
  state: NodeState;
  n: number;
  last: boolean;
}) {
  return (
    <div className="flex flex-col items-center self-stretch">
      {state === "done" ? (
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: STEPPER }}
        >
          <Check className="size-3.5" />
        </span>
      ) : state === "active" ? (
        /* Donut style: outer ring filled, inner cutout reveals bg, number on top */
        <span
          className="relative flex size-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: STEPPER }}
        >
          <span className="absolute inset-[3px] rounded-full bg-background" />
          <span
            className="relative font-semibold text-[10px]"
            style={{ color: STEPPER }}
          >
            {n}
          </span>
        </span>
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background font-medium text-[10px] text-muted-foreground">
          {n}
        </span>
      )}
      {!last && (
        <span
          className="my-1 w-px flex-1"
          style={{
            backgroundColor: state === "done" ? STEPPER : "var(--border)",
          }}
        />
      )}
    </div>
  );
}

interface WizardPanelProps {
  resolving: boolean;
  calculating: boolean;
  errorMessage: string | null;
  candidate: TripLocation | null;
  onCalculate: () => void;
  onSearchSelect: (result: AddressResult) => void;
  onUseMyLocation: () => void;
  onConfirm: () => void;
  onChangePin: (key: PinKey) => void;
  onStartOver: () => void;
}

export function WizardPanel({
  resolving,
  calculating,
  errorMessage,
  candidate,
  onCalculate,
  onSearchSelect,
  onUseMyLocation,
  onConfirm,
  onChangePin,
  onStartOver,
}: WizardPanelProps) {
  const store = useTripStore();
  const ready = selectIsReady(store);
  const placedCount = PIN_ORDER.filter((k) => store[k]).length;
  const isComplete = store.step === "complete";
  const cycleInvalid = store.cycleHoursUsed < 0 || store.cycleHoursUsed > 70;
  const stepNumber = isComplete ? 4 : placedCount + 1;

  return (
    <>
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-2.5">
        <span className="font-semibold text-sm tracking-tight">Spotter</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {stepNumber}
            <span className="mx-0.5 opacity-40">/</span>4
          </span>
          {placedCount > 0 && (
            <button
              type="button"
              onClick={onStartOver}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              <RotateCcw className="size-3" />
              Start over
            </button>
          )}
        </div>
      </header>

      {/* Guided form */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md">
          <h1 className="font-medium text-base tracking-tight">
            Plan your trip
          </h1>
          <p className="mt-1 text-muted-foreground text-xs">
            Set three locations and your current cycle hours to generate an
            HOS-compliant schedule.
          </p>

          {/* Connected vertical timeline (3 locations + cycle hours) */}
          <ol className="mt-5">
            {PIN_ORDER.map((key) => {
              const meta = STEP_META[key];
              const value = store[key];
              const isActive = store.step === key;
              const done = !!value && !isActive;
              const showCandidate = isActive && !!candidate;
              const state: NodeState = done
                ? "done"
                : isActive
                  ? "active"
                  : "upcoming";

              return (
                <li key={key} className="flex gap-3.5">
                  <StepNode state={state} n={meta.index + 1} last={false} />

                  <div className="min-w-0 flex-1 pb-6">
                    {/* Header */}
                    <div className="flex min-h-7 items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            isActive
                              ? "font-medium text-foreground text-sm leading-tight"
                              : "font-medium text-muted-foreground text-xs leading-tight"
                          }
                        >
                          {meta.label}
                        </p>
                        {done && (
                          <p className="mt-0.5 truncate font-medium text-foreground text-sm leading-tight">
                            {value?.address}
                          </p>
                        )}
                        {isActive && !showCandidate && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {meta.prompt}
                          </p>
                        )}
                      </div>
                      {done && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onChangePin(key)}
                          aria-label={`Change ${meta.label}`}
                          className="text-muted-foreground"
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {/* Active: search input + persistent confirm */}
                    {isActive && (
                      <div className="mt-2.5">
                        <AddressSearch
                          value={candidate?.address ?? ""}
                          onSelect={onSearchSelect}
                          accent={meta.color}
                          placeholder={`Search ${meta.label.toLowerCase()}…`}
                        />
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {resolving ? (
                              <>
                                <Loader2 className="size-3 animate-spin motion-reduce:hidden" />
                                Updating address…
                              </>
                            ) : (
                              "Search, click the map, or drag the pin."
                            )}
                          </p>
                          {key === "current" && (
                            <button
                              type="button"
                              onClick={onUseMyLocation}
                              disabled={resolving}
                              className="inline-flex shrink-0 items-center gap-1 font-medium text-[11px] text-primary underline-offset-2 hover:underline disabled:opacity-50"
                            >
                              <LocateFixed className="size-3" />
                              Use my location
                            </button>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="mt-2 w-full"
                          onClick={onConfirm}
                          disabled={!showCandidate || resolving}
                        >
                          <Check className="size-3.5" />
                          Confirm {meta.label.split(" ")[0]?.toLowerCase()}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}

            {/* Step 4 — cycle hours */}
            <li className="flex gap-3.5">
              <StepNode state={isComplete ? "active" : "upcoming"} n={4} last />
              <div className="min-w-0 flex-1">
                {isComplete ? (
                  <>
                    <div className="flex min-h-7 items-center">
                      <p className="font-medium text-foreground text-sm leading-tight">
                        Current cycle used
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Hours already used in your 70-hour / 8-day window (0–70).
                    </p>
                    <div className="relative mt-2.5">
                      <Input
                        id="cycle-hours"
                        type="number"
                        min={0}
                        max={70}
                        step={1}
                        value={
                          Number.isFinite(store.cycleHoursUsed)
                            ? store.cycleHoursUsed
                            : ""
                        }
                        onChange={(e) =>
                          store.setCycleHours(e.target.valueAsNumber)
                        }
                        aria-invalid={cycleInvalid}
                        aria-label="Current cycle used in hours"
                        className="h-10 w-full pr-14 text-sm tabular-nums"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-xs">
                        hours
                      </span>
                    </div>

                    {(cycleInvalid ||
                      !Number.isFinite(store.cycleHoursUsed)) && (
                      <p className="mt-1.5 text-[11px] text-destructive">
                        Enter a number between 0 and 70.
                      </p>
                    )}

                    {errorMessage && (
                      <p className="mt-3 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                        {errorMessage}
                      </p>
                    )}

                    <Button
                      onClick={onCalculate}
                      disabled={!ready || calculating}
                      size="lg"
                      className="mt-3 w-full"
                    >
                      {calculating ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Calculating…
                        </>
                      ) : (
                        "Calculate trip"
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex min-h-7 items-center">
                    <p className="font-medium text-muted-foreground text-xs">
                      Current cycle used
                    </p>
                  </div>
                )}
              </div>
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
