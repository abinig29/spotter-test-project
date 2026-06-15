import { Maximize2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { InteractiveLogGrid } from "@/components/logs/interactive-log-grid";
import { LogGrid } from "@/components/logs/log-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DayLog } from "@/lib/api-types";
import { STATUS_META, STATUS_ROWS } from "@/lib/log-grid";

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

/** Returns a readable date like "Sun, Jun 14, 2026". */
function formatDate(iso: string): { weekday: string; long: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const weekday = WEEKDAYS[date.getUTCDay()] ?? "";
  const month = MONTHS[(m ?? 1) - 1] ?? "";
  return { weekday, long: `${month} ${d}, ${y}` };
}

/**
 * A single field from the official Driver's Daily Log header. The app is
 * stateless and carries no carrier/vehicle data, so values are placeholders.
 */
function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-0.5 truncate border-foreground/15 border-b border-dotted pb-1 text-foreground/70 text-xs">
        {value}
      </dd>
    </div>
  );
}

/**
 * The full log-sheet body, shared by the inline card and its expanded dialog.
 * `action` renders in the title band (expand button inline, omitted when
 * already expanded). `minGridWidth` keeps the SVG legible on narrow screens.
 */
function LogSheetBody({
  log,
  action,
  minGridWidth = 680,
  reserveCloseSpace = false,
  interactive = false,
}: {
  log: DayLog;
  action?: ReactNode;
  minGridWidth?: number;
  /** Pads the title band's end so the dialog close button can't overlap the date. */
  reserveCloseSpace?: boolean;
  /** Modal-only: animated trace, hover scrubber, segment popovers, synced legend. */
  interactive?: boolean;
}) {
  const { weekday, long } = formatDate(log.date);

  return (
    <>
      {/* Title band */}
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-foreground/15 border-b bg-secondary/40 px-4 py-3 ${
          reserveCloseSpace ? "pr-12" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
            Day {log.day}
          </span>
          <span className="h-3.5 w-px bg-border" />
          <div>
            <h3 className="font-medium text-sm tracking-tight">
              Driver's Daily Log
            </h3>
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {log.total_miles_today} mi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-foreground text-sm tabular-nums">
            {weekday}, {long}
          </p>
          {action}
        </div>
      </header>

      {/* Official Driver's Daily Log header fields (placeholders) */}
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-foreground/15 border-b px-4 py-3 sm:grid-cols-4">
        <FormField label="Carrier" value="N/A" />
        <FormField label="Main office address" value="N/A" />
        <FormField label="Truck / Trailer no." value="N/A" />
        <FormField label="Driver signature" value="N/A" />
      </dl>

      {/* The grid + legend. The modal gets the interactive version (animated
          trace, hover scrubber, segment popovers, synced rolling legend); the
          inline card stays static and print-friendly. */}
      {interactive ? (
        <InteractiveLogGrid day={log} minGridWidth={minGridWidth} />
      ) : (
        <>
          <div className="overflow-x-auto px-4 py-4">
            <div style={{ minWidth: minGridWidth }}>
              <LogGrid day={log} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pt-1 pb-4">
            {STATUS_ROWS.map((status) => {
              const meta = STATUS_META[status];
              return (
                <span
                  key={status}
                  className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  {meta.short}
                  <span className="font-semibold text-foreground tabular-nums">
                    {(log.totals[status] ?? 0).toFixed(1)}
                  </span>
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* Remarks */}
      {log.remarks.length > 0 && (
        <div className="border-foreground/15 border-t bg-secondary/30 px-5 py-3.5">
          <p className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
            Remarks
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {log.remarks.map((remark) => (
              <li
                key={remark}
                className="flex items-start gap-2 text-xs leading-snug"
              >
                <span
                  className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60"
                  aria-hidden="true"
                />
                <span>{remark}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function LogSheet({ log }: { log: DayLog }) {
  const [open, setOpen] = useState(false);
  const { weekday, long } = formatDate(log.date);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <article className="log-sheet overflow-hidden rounded-md border border-foreground/15 bg-card">
        <LogSheetBody
          log={log}
          action={
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="no-print text-muted-foreground"
                aria-label={`Expand day ${log.day} log sheet`}
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </DialogTrigger>
          }
        />
      </article>

      <DialogContent>
        <DialogTitle className="sr-only">
          Day {log.day} — Driver's Daily Log, {weekday}, {long}
        </DialogTitle>
        <div className="min-h-0 overflow-y-auto">
          <LogSheetBody
            log={log}
            minGridWidth={760}
            reserveCloseSpace
            interactive
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
