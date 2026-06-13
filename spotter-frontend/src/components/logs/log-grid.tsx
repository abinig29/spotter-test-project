import type { DutyStatus, LogEntry } from "@/lib/api-types";
import { buildRowSegments } from "@/lib/log-grid";

const ROWS: { status: DutyStatus; label: string; color: string }[] = [
  { status: "off_duty", label: "Off Duty", color: "#9ca3af" },
  { status: "sleeper_berth", label: "Sleeper Berth", color: "#60a5fa" },
  { status: "driving", label: "Driving", color: "#1e3a8a" },
  { status: "on_duty_not_driving", label: "On Duty (ND)", color: "#6b7280" },
];

const LABEL_W = 118;
const GRID_W = 720;
const TOTAL_W = 70;
const TOP_H = 22;
const ROW_H = 34;
const VIEW_W = LABEL_W + GRID_W + TOTAL_W;
const VIEW_H = TOP_H + ROWS.length * ROW_H + 6;

const ROW_INDEX: Record<DutyStatus, number> = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
};

function rowCenterY(index: number): number {
  return TOP_H + index * ROW_H + ROW_H / 2;
}

function hourX(hour: number): number {
  return LABEL_W + (hour / 24) * GRID_W;
}

interface LogGridProps {
  entries: LogEntry[];
  totals: Record<DutyStatus, number>;
}

export function LogGrid({ entries, totals }: LogGridProps) {
  const segments = buildRowSegments(entries, GRID_W);
  const total = ROWS.reduce((sum, row) => sum + (totals[row.status] ?? 0), 0);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`24-hour duty status grid: off duty ${(totals.off_duty ?? 0).toFixed(1)}h, sleeper berth ${(totals.sleeper_berth ?? 0).toFixed(1)}h, driving ${(totals.driving ?? 0).toFixed(1)}h, on duty not driving ${(totals.on_duty_not_driving ?? 0).toFixed(1)}h, total ${total.toFixed(1)}h`}
    >
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#ffffff" />

      {/* hour gridlines + axis labels */}
      {Array.from({ length: 25 }, (_, hour) => (
        <g key={`h-${hour}`}>
          <line
            x1={hourX(hour)}
            y1={TOP_H}
            x2={hourX(hour)}
            y2={TOP_H + ROWS.length * ROW_H}
            stroke={hour % 6 === 0 ? "#9ca3af" : "#e5e7eb"}
            strokeWidth={hour % 6 === 0 ? 1 : 0.5}
          />
          {hour % 2 === 0 && (
            <text
              x={hourX(hour)}
              y={TOP_H - 8}
              fontSize={9}
              fill="#374151"
              textAnchor="middle"
            >
              {hour === 0 || hour === 24 ? "M" : hour === 12 ? "N" : hour}
            </text>
          )}
        </g>
      ))}

      {/* rows: labels, baselines, totals */}
      {ROWS.map((row, index) => (
        <g key={row.status}>
          <text
            x={LABEL_W - 8}
            y={rowCenterY(index) + 3}
            fontSize={11}
            fill="#111827"
            textAnchor="end"
          >
            {row.label}
          </text>
          <line
            x1={LABEL_W}
            y1={TOP_H + (index + 1) * ROW_H}
            x2={LABEL_W + GRID_W}
            y2={TOP_H + (index + 1) * ROW_H}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
          <text
            x={LABEL_W + GRID_W + TOTAL_W / 2}
            y={rowCenterY(index) + 3}
            fontSize={11}
            fill="#111827"
            textAnchor="middle"
          >
            {(totals[row.status] ?? 0).toFixed(1)}
          </text>
        </g>
      ))}

      {/* status lines */}
      {segments.map((seg, idx) => (
        <line
          key={`seg-${idx}-${seg.x1}`}
          x1={LABEL_W + seg.x1}
          y1={rowCenterY(ROW_INDEX[seg.status])}
          x2={LABEL_W + seg.x2}
          y2={rowCenterY(ROW_INDEX[seg.status])}
          stroke={ROWS[ROW_INDEX[seg.status]]?.color ?? "#111827"}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}

      {/* vertical connectors at status changes */}
      {segments.slice(1).map((seg, i) => {
        const prev = segments[i];
        if (!prev) return null;
        const x = LABEL_W + seg.x1;
        return (
          <line
            key={`conn-${i}-${x}`}
            x1={x}
            y1={rowCenterY(ROW_INDEX[prev.status])}
            x2={x}
            y2={rowCenterY(ROW_INDEX[seg.status])}
            stroke="#374151"
            strokeWidth={1.5}
          />
        );
      })}

      {/* total label */}
      <text
        x={LABEL_W + GRID_W + TOTAL_W / 2}
        y={VIEW_H - 2}
        fontSize={10}
        fill="#111827"
        textAnchor="middle"
        fontWeight="bold"
      >
        {total.toFixed(1)}
      </text>
    </svg>
  );
}
