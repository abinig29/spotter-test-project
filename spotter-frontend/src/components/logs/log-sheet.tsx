import { LogGrid } from "@/components/logs/log-grid";
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

export function LogSheet({ log }: { log: DayLog }) {
  const { weekday, long } = formatDate(log.date);
  const total = STATUS_ROWS.reduce((sum, s) => sum + (log.totals[s] ?? 0), 0);

  return (
    <article className="log-sheet overflow-hidden rounded-md border border-foreground/15 bg-card">
      {/* Title band */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-foreground/15 border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
            Day {log.day}
          </span>
          <span className="h-3.5 w-px bg-border" />
          <div>
            <h3 className="font-medium text-sm tracking-tight">
              Driver's Daily Log
            </h3>
            <p className="text-[11px] text-muted-foreground">
              24-hour record ·{" "}
              <span className="font-mono tabular-nums">
                {log.total_miles_today} mi
              </span>
            </p>
          </div>
        </div>
        <p className="font-mono text-foreground text-sm tabular-nums">
          {weekday}, {long}
        </p>
      </header>

      {/* The grid */}
      <div className="overflow-x-auto px-4 py-4">
        <div className="min-w-[680px]">
          <LogGrid day={log} />
        </div>
      </div>

      {/* Legend + total */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-1 pb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {STATUS_ROWS.map((status) => {
            const meta = STATUS_META[status];
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden="true"
                />
                {meta.short}
                <span className="font-semibold text-foreground tabular-nums">
                  {(log.totals[status] ?? 0).toFixed(1)}
                </span>
              </span>
            );
          })}
        </div>
        <span className="font-semibold text-sm tabular-nums">
          Total <span className="text-primary">{total.toFixed(1)}</span> hrs
        </span>
      </div>

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
    </article>
  );
}
