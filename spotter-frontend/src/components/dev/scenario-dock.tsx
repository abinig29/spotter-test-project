import { Popover } from "@base-ui/react/popover";
import { FlaskConical, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

interface ScenarioDockProps {
  /** Fill the wizard with a scenario; the dock closes and the user presses Calculate. */
  onSelect: (scenario: Scenario) => void;
}

/**
 * A floating launcher (bottom-right) that loads curated HOS scenarios into the
 * wizard with one click. It fills the form and jumps to the final step; the
 * user reviews and presses Calculate to run the real routing + HOS flow.
 */
export function ScenarioDock({ onSelect }: ScenarioDockProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(scenario: Scenario) {
    onSelect(scenario);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "fixed right-4 bottom-4 z-[1300] inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 py-2 pr-3.5 pl-3 font-medium text-foreground text-xs shadow-lg ring-1 ring-foreground/5 backdrop-blur transition-all",
          "hover:bg-muted hover:shadow-xl focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "data-[popup-open]:bg-muted",
        )}
        aria-label="Open test scenarios"
      >
        <FlaskConical className="size-3.5 text-muted-foreground" />
        Scenarios
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          className="z-[1300] outline-none"
          side="top"
          align="end"
          sideOffset={8}
        >
          <Popover.Popup
            className={cn(
              "flex max-h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10",
              "data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95 duration-150 data-[ending-style]:animate-out data-[starting-style]:animate-in",
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 font-semibold text-sm tracking-tight">
                  <FlaskConical className="size-3.5 text-muted-foreground" />
                  Test scenarios
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  Fills the wizard with a preset trip — then press{" "}
                  <span className="font-medium text-foreground">Calculate</span>
                  .
                </p>
              </div>
              <Popover.Close
                className="-mt-0.5 -mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Close scenarios"
              >
                <X className="size-3.5" />
              </Popover.Close>
            </div>

            {/* Scenario list */}
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => handleSelect(scenario)}
                  className="group flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm leading-tight">
                      {scenario.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[10px] text-muted-foreground"
                    >
                      {scenario.rule}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {scenario.observe}
                  </p>
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div className="shrink-0 border-t px-4 py-2">
              <p className="text-[10.5px] text-muted-foreground leading-snug">
                Runs the live route, so it needs routing configured (
                <span className="font-mono">ORS_API_KEY</span>).
              </p>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
