import { Calculator, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TripControlsProps {
  cycleHours: number;
  onCycleHoursChange: (value: number) => void;
  onCalculate: () => void;
  disabled: boolean;
  loading: boolean;
}

export function TripControls({
  cycleHours,
  onCycleHoursChange,
  onCalculate,
  disabled,
  loading,
}: TripControlsProps) {
  const outOfRange =
    Number.isFinite(cycleHours) && (cycleHours < 0 || cycleHours > 70);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cycle-hours">Current cycle used (hrs)</Label>
        <Input
          id="cycle-hours"
          type="number"
          inputMode="decimal"
          min={0}
          max={70}
          step={0.5}
          className="h-11"
          aria-invalid={outOfRange || undefined}
          aria-describedby="cycle-hours-hint"
          value={Number.isNaN(cycleHours) ? "" : cycleHours}
          onChange={(event) => onCycleHoursChange(event.target.valueAsNumber)}
        />
        <p
          id="cycle-hours-hint"
          className={`text-xs ${outOfRange ? "text-destructive" : "text-muted-foreground"}`}
        >
          {outOfRange
            ? "Enter a value between 0 and 70 hours."
            : "Hours already used in your 70-hour / 8-day cycle (0–70)."}
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        onClick={onCalculate}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className="h-11 w-full"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Calculator className="size-4" aria-hidden="true" />
        )}
        {loading ? "Calculating…" : "Calculate Trip"}
      </Button>
    </div>
  );
}
