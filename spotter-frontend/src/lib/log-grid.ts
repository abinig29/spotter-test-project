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
