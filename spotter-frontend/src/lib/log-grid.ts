import type { DutyStatus, LogEntry } from "@/lib/api-types";

const MINUTES_PER_DAY = 24 * 60;

export function timeToMinutes(hhmm: string): number {
  if (hhmm === "24:00") return MINUTES_PER_DAY;
  const [hStr, mStr] = hhmm.split(":");
  const hours = Number(hStr ?? 0);
  const minutes = Number(mStr ?? 0);
  return hours * 60 + minutes;
}

export function timeToX(hhmm: string, width: number): number {
  return (timeToMinutes(hhmm) / MINUTES_PER_DAY) * width;
}

export interface RowSegment {
  status: DutyStatus;
  x1: number;
  x2: number;
}

export function buildRowSegments(
  entries: LogEntry[],
  width: number,
): RowSegment[] {
  return entries.map((entry) => {
    const startMin = timeToMinutes(entry.start);
    let endMin = timeToMinutes(entry.end);
    // An entry ending at "00:00" (or otherwise <= its start) ends at midnight = end of day.
    if (endMin <= startMin) endMin = MINUTES_PER_DAY;
    return {
      status: entry.status,
      x1: (startMin / MINUTES_PER_DAY) * width,
      x2: (endMin / MINUTES_PER_DAY) * width,
    };
  });
}

/** The four duty-status rows, in the canonical top-to-bottom order of the FMCSA log. */
export const STATUS_ROWS: DutyStatus[] = [
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty_not_driving",
];

export interface StatusMeta {
  /** Full row label as printed on the official form. */
  label: string;
  /** Short legend label. */
  short: string;
  /** Strong color for the legend swatch and remarks dot. */
  color: string;
  /** Subtle row-band tint behind the grid. */
  band: string;
}

export const STATUS_META: Record<DutyStatus, StatusMeta> = {
  off_duty: {
    label: "Off Duty",
    short: "Off duty",
    color: "#94a3b8",
    band: "rgba(148, 163, 184, 0.06)",
  },
  sleeper_berth: {
    label: "Sleeper Berth",
    short: "Sleeper",
    color: "#38bdf8",
    band: "rgba(56, 189, 248, 0.08)",
  },
  driving: {
    label: "Driving",
    short: "Driving",
    color: "#1e3a8a",
    band: "rgba(30, 58, 138, 0.07)",
  },
  on_duty_not_driving: {
    label: "On Duty (Not Driving)",
    short: "On duty",
    color: "#6b7280",
    band: "rgba(107, 114, 128, 0.07)",
  },
};

export function rowIndex(status: DutyStatus): number {
  return STATUS_ROWS.indexOf(status);
}

/**
 * Shared SVG geometry for the duty-status grid. Lives here (not in the
 * component) so the interactive overlay can map pointer position onto the same
 * coordinate system the SVG draws in.
 */
export const GRID = {
  hourW: 40,
  labelW: 128,
  totalW: 80,
  rowH: 48,
  axisH: 34,
  get gridW() {
    return 24 * this.hourW;
  },
  get gridH() {
    return STATUS_ROWS.length * this.rowH;
  },
  get width() {
    return this.labelW + this.gridW + this.totalW;
  },
  get height() {
    return this.axisH + this.gridH;
  },
} as const;

/** Formats a minute-of-day as a zero-padded 24h clock, e.g. 870 -> "14:30". */
export function minuteToTime(minute: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minute)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The duty status active at a given minute-of-day. Boundaries belong to the
 * entry that starts there; the final minute (1440) belongs to the last entry.
 * Returns null when there are no entries.
 */
export function statusAtMinute(
  entries: LogEntry[],
  minute: number,
): DutyStatus | null {
  if (entries.length === 0) return null;
  for (const entry of entries) {
    const startMin = timeToMinutes(entry.start);
    let endMin = timeToMinutes(entry.end);
    if (endMin <= startMin) endMin = MINUTES_PER_DAY;
    if (minute >= startMin && minute < endMin) return entry.status;
  }
  // At or past end-of-day, fall to the last entry.
  return entries[entries.length - 1]?.status ?? null;
}

export interface EntrySegment extends RowSegment {
  /** The source log entry, for surfacing location/note on hover. */
  entry: LogEntry;
  /** Row index within STATUS_ROWS (0 = top). */
  row: number;
  /** Span length in hours, with end-of-day normalization. */
  durationHours: number;
}

/**
 * Like {@link buildRowSegments} but keeps each entry and adds the row index and
 * duration — the shape the interactive overlay needs for hit-testing and
 * per-segment detail popovers.
 */
export function buildEntrySegments(
  entries: LogEntry[],
  width: number,
): EntrySegment[] {
  return entries.map((entry) => {
    const startMin = timeToMinutes(entry.start);
    let endMin = timeToMinutes(entry.end);
    if (endMin <= startMin) endMin = MINUTES_PER_DAY;
    return {
      entry,
      status: entry.status,
      x1: (startMin / MINUTES_PER_DAY) * width,
      x2: (endMin / MINUTES_PER_DAY) * width,
      row: rowIndex(entry.status),
      durationHours: (endMin - startMin) / 60,
    };
  });
}

/**
 * Builds the continuous duty-status trace as polyline points. Each entry draws a
 * horizontal segment in its row; consecutive entries share an x boundary, so the
 * connecting points read as vertical drops between rows.
 */
export function dutyLinePoints(
  entries: LogEntry[],
  width: number,
  rowHeight: number,
): [number, number][] {
  const segments = buildRowSegments(entries, width);
  const centerY = (status: DutyStatus) => (rowIndex(status) + 0.5) * rowHeight;
  const points: [number, number][] = [];
  for (const seg of segments) {
    points.push([seg.x1, centerY(seg.status)]);
    points.push([seg.x2, centerY(seg.status)]);
  }
  return points;
}
