import { LogGrid } from "@/components/logs/log-grid";
import type { DayLog } from "@/lib/api-types";

export function LogSheet({ log }: { log: DayLog }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Day {log.day}</h3>
          <p className="text-muted-foreground text-xs">{log.date}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground text-xs sm:grid-cols-4">
          <div>
            <dt className="inline">Miles: </dt>
            <dd className="inline text-foreground">{log.total_miles_today}</dd>
          </div>
          <div>
            <dt className="inline">Carrier: </dt>
            <dd className="inline">N/A</dd>
          </div>
          <div>
            <dt className="inline">Driver: </dt>
            <dd className="inline">—</dd>
          </div>
          <div>
            <dt className="inline">Vehicle: </dt>
            <dd className="inline">—</dd>
          </div>
        </dl>
      </header>

      <div className="overflow-hidden rounded-md border">
        <LogGrid entries={log.entries} totals={log.totals} />
      </div>

      {log.remarks.length > 0 && (
        <section>
          <h4 className="mb-1 font-medium text-muted-foreground text-xs">
            Remarks
          </h4>
          <ul className="flex flex-col gap-0.5 text-xs">
            {log.remarks.map((remark) => (
              <li key={remark}>{remark}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
