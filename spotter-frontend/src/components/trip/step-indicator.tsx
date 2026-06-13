import { CheckCircle2, MapPin } from "lucide-react";

import type { Step } from "@/store/trip-store";

const PROMPTS: Record<Step, string> = {
  current: "Step 1 of 3: Click your current location",
  pickup: "Step 2 of 3: Now click your pickup location",
  dropoff: "Step 3 of 3: Now click your dropoff location",
  complete: "All locations set — enter cycle hours and calculate",
};

const STEP_ORDER: Step[] = ["current", "pickup", "dropoff", "complete"];

export function StepIndicator({ step }: { step: Step }) {
  const done = step === "complete";
  const activeIndex = STEP_ORDER.indexOf(step);

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2.5 text-sm"
    >
      <div className="flex items-center gap-2 font-medium">
        {done ? (
          <CheckCircle2
            className="size-4 shrink-0 text-green-500"
            aria-hidden="true"
          />
        ) : (
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
        )}
        <span className="min-w-0">{PROMPTS[step]}</span>
      </div>
      {/* Progress dots: a quiet, scannable indicator of placement progress. */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {STEP_ORDER.slice(0, 3).map((key, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex && !done;
          return (
            <span
              key={key}
              className={
                "h-1 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none " +
                (isDone || done
                  ? "bg-green-500"
                  : isActive
                    ? "bg-primary"
                    : "bg-muted")
              }
            />
          );
        })}
      </div>
    </div>
  );
}
