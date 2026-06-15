import { describe, expect, it } from "vitest";
import type { LogEntry } from "@/lib/api-types";
import {
  buildEntrySegments,
  buildRowSegments,
  minuteToTime,
  statusAtMinute,
  timeToX,
} from "@/lib/log-grid";

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

describe("minuteToTime", () => {
  it("formats midnight, noon, and a quarter hour as zero-padded 24h", () => {
    expect(minuteToTime(0)).toBe("00:00");
    expect(minuteToTime(720)).toBe("12:00");
    expect(minuteToTime(870)).toBe("14:30");
    expect(minuteToTime(5)).toBe("00:05");
  });

  it("renders the final minute as 24:00, not 00:00 of the next day", () => {
    expect(minuteToTime(1440)).toBe("24:00");
  });

  it("clamps out-of-range minutes into the day", () => {
    expect(minuteToTime(-10)).toBe("00:00");
    expect(minuteToTime(2000)).toBe("24:00");
  });
});

describe("statusAtMinute", () => {
  const entries: LogEntry[] = [
    { status: "off_duty", start: "00:00", end: "06:00" },
    { status: "driving", start: "06:00", end: "14:00" },
    { status: "sleeper_berth", start: "14:00", end: "00:00" },
  ];

  it("returns the status covering a minute inside an entry", () => {
    expect(statusAtMinute(entries, 60)).toBe("off_duty");
    expect(statusAtMinute(entries, 420)).toBe("driving");
    expect(statusAtMinute(entries, 900)).toBe("sleeper_berth");
  });

  it("picks the entry that starts at a shared boundary", () => {
    expect(statusAtMinute(entries, 360)).toBe("driving");
  });

  it("returns the final entry's status at end-of-day", () => {
    expect(statusAtMinute(entries, 1440)).toBe("sleeper_berth");
  });

  it("returns null when there are no entries", () => {
    expect(statusAtMinute([], 100)).toBeNull();
  });
});

describe("buildEntrySegments", () => {
  const entries: LogEntry[] = [
    {
      status: "driving",
      start: "07:00",
      end: "14:00",
      location: "Chicago, IL",
    },
    { status: "off_duty", start: "14:00", end: "00:00" },
  ];

  it("carries the entry, row index, pixel span, and duration in hours", () => {
    const segs = buildEntrySegments(entries, 1440);
    expect(segs[0]).toMatchObject({
      entry: entries[0],
      status: "driving",
      x1: 420,
      x2: 840,
      row: 2,
      durationHours: 7,
    });
  });

  it("normalizes an end-of-day entry's span and duration", () => {
    const segs = buildEntrySegments(entries, 1440);
    expect(segs[1]).toMatchObject({ x2: 1440, durationHours: 10, row: 0 });
  });
});
