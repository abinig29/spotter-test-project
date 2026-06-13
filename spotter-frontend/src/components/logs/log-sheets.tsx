import { LogSheet } from "@/components/logs/log-sheet";
import type { DayLog } from "@/lib/api-types";

export function LogSheets({ logs }: { logs: DayLog[] }) {
  if (logs.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" aria-label="Daily log sheets">
      <h2 className="font-semibold text-sm">
        Daily Log Sheets ({logs.length} day{logs.length === 1 ? "" : "s"})
      </h2>
      {logs.map((log) => (
        <LogSheet key={log.day} log={log} />
      ))}
    </section>
  );
}
