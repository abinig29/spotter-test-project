import type { DayLog } from "@/lib/api-types";
import { dutyLinePoints, STATUS_META, STATUS_ROWS } from "@/lib/log-grid";

const HOUR_W = 40;
const GRID_W = 24 * HOUR_W; // 960
const LABEL_W = 128;
const TOTAL_W = 80;
const ROW_H = 48;
const AXIS_H = 34;
const GRID_H = STATUS_ROWS.length * ROW_H; // 144
const WIDTH = LABEL_W + GRID_W + TOTAL_W;
const HEIGHT = AXIS_H + GRID_H;
const GRID_X = LABEL_W;
const GRID_Y = AXIS_H;

const INK = "#0f172a";
const GRID_LINE = "#cbd5e1";
const GRID_LINE_FAINT = "#e7ecf3";

const QUARTERS = Array.from({ length: 24 * 4 + 1 }, (_, i) => i);
const HOURS = Array.from({ length: 25 }, (_, i) => i);
const ROW_LINES = Array.from({ length: STATUS_ROWS.length + 1 }, (_, i) => i);

function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "M";
  if (hour === 12) return "N";
  return String(hour % 12);
}

export function LogGrid({ day }: { day: DayLog }) {
  const points = dutyLinePoints(day.entries, GRID_W, ROW_H)
    .map(([x, y]) => `${(GRID_X + x).toFixed(1)},${(GRID_Y + y).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Duty status grid for day ${day.day}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{`Day ${day.day} duty status grid`}</title>

      {/* Row bands + left labels */}
      {STATUS_ROWS.map((status, row) => {
        const y = GRID_Y + row * ROW_H;
        const meta = STATUS_META[status];
        return (
          <g key={status}>
            <rect
              x={GRID_X}
              y={y}
              width={GRID_W}
              height={ROW_H}
              fill={meta.band}
            />
            <rect
              x={LABEL_W - 7}
              y={y + ROW_H / 2 - 7}
              width={4}
              height={14}
              rx={1}
              fill={meta.color}
            />
            <text
              x={LABEL_W - 14}
              y={y + ROW_H / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill="#334155"
            >
              {meta.label}
            </text>
          </g>
        );
      })}

      {/* Quarter-hour faint ticks */}
      {QUARTERS.map((i) => {
        if (i % 4 === 0) return null;
        const x = GRID_X + (i / 4) * HOUR_W;
        return (
          <line
            key={`q-${i}`}
            x1={x}
            y1={GRID_Y}
            x2={x}
            y2={GRID_Y + GRID_H}
            stroke={GRID_LINE_FAINT}
            strokeWidth={1}
          />
        );
      })}

      {/* Hour gridlines + top axis labels */}
      {HOURS.map((hour) => {
        const x = GRID_X + hour * HOUR_W;
        const onClock = hour % 12 === 0;
        return (
          <g key={`h-${hour}`}>
            <line
              x1={x}
              y1={GRID_Y}
              x2={x}
              y2={GRID_Y + GRID_H}
              stroke={GRID_LINE}
              strokeWidth={onClock ? 1.5 : 1.1}
            />
            <text
              x={x}
              y={GRID_Y - 9}
              textAnchor="middle"
              fontSize={onClock ? 11 : 10}
              fontWeight={onClock ? 700 : 500}
              fill={onClock ? "#1e293b" : "#64748b"}
            >
              {hourLabel(hour)}
            </text>
          </g>
        );
      })}

      {/* Horizontal row separators */}
      {ROW_LINES.map((row) => {
        const y = GRID_Y + row * ROW_H;
        return (
          <line
            key={`row-${row}`}
            x1={GRID_X}
            y1={y}
            x2={GRID_X + GRID_W}
            y2={y}
            stroke={GRID_LINE}
            strokeWidth={1}
          />
        );
      })}

      {/* Outer grid border */}
      <rect
        x={GRID_X}
        y={GRID_Y}
        width={GRID_W}
        height={GRID_H}
        fill="none"
        stroke={INK}
        strokeWidth={1.25}
      />

      {/* The duty-status trace */}
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke={INK}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Totals column */}
      <line
        x1={GRID_X + GRID_W}
        y1={GRID_Y}
        x2={GRID_X + GRID_W}
        y2={GRID_Y + GRID_H}
        stroke={INK}
        strokeWidth={1.25}
      />
      <text
        x={GRID_X + GRID_W + TOTAL_W / 2}
        y={GRID_Y - 10}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="#64748b"
      >
        Total
      </text>
      {STATUS_ROWS.map((status, row) => {
        const y = GRID_Y + row * ROW_H + ROW_H / 2;
        return (
          <text
            key={`t-${status}`}
            x={GRID_X + GRID_W + TOTAL_W / 2}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="13"
            fontWeight="600"
            fill={INK}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {day.totals[status].toFixed(1)}
          </text>
        );
      })}
    </svg>
  );
}
