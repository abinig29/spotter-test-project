import { describe, expect, it } from "vitest";
import type { LogEntry } from "@/lib/api-types";
import { buildRowSegments, timeToX } from "@/lib/log-grid";

describe("log-grid helpers", () => {
  it("maps times to x across the full width", () => {
    expect(timeToX("00:00", 1440)).toBe(0);
    expect(timeToX("12:00", 1440)).toBe(720);
    expect(timeToX("24:00", 1440)).toBe(1440);
  });

  it("builds pixel segments for an entry", () => {
    const entries: LogEntry[] = [
      { status: "driving", start: "07:00", end: "14:00" },
    ];
    const segs = buildRowSegments(entries, 1440);
    expect(segs).toEqual([{ status: "driving", x1: 420, x2: 840 }]);
  });

  it("treats an end of 00:00 as end-of-day", () => {
    const entries: LogEntry[] = [
      { status: "off_duty", start: "07:30", end: "00:00" },
    ];
    const segs = buildRowSegments(entries, 1440);
    expect(segs[0]?.x2).toBe(1440);
  });
});
