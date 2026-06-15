import { type PointerEvent, useEffect, useRef, useState } from "react";
import { SlotText } from "slot-text/react";

import { LogGrid } from "@/components/logs/log-grid";
import type { DayLog } from "@/lib/api-types";
import {
  buildEntrySegments,
  type EntrySegment,
  GRID,
  minuteToTime,
  STATUS_META,
  STATUS_ROWS,
  statusAtMinute,
} from "@/lib/log-grid";

// The plot area as fractions of the full SVG viewBox, so an HTML overlay sized
// to the SVG maps 1:1 onto the grid's coordinate system.
const PLOT_LEFT = GRID.labelW / GRID.width;
const PLOT_WIDTH = GRID.gridW / GRID.width;
const PLOT_TOP = GRID.axisH / GRID.height;
const PLOT_HEIGHT = GRID.gridH / GRID.height;
const ROW_FRACTION = 1 / STATUS_ROWS.length;
// The "Total" column, to the right of the plot, where rolling totals sit.
const TOTAL_LEFT = (GRID.labelW + GRID.gridW) / GRID.width;
const TOTAL_WIDTH = GRID.totalW / GRID.width;

const MINUTES_PER_DAY = 24 * 60;

function usePointerFine(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    setFine(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);
  return fine;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

/** A total that rolls up from 0.0 to its value when the modal opens. */
function RollingTotal({
  value,
  className = "font-semibold text-foreground tabular-nums",
}: {
  value: number;
  className?: string;
}) {
  const target = value.toFixed(1);
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState(reduced ? target : "0.0");
  useEffect(() => {
    if (reduced) {
      setText(target);
      return;
    }
    const id = window.setTimeout(() => setText(target), 220);
    return () => window.clearTimeout(id);
  }, [target, reduced]);
  return (
    <SlotText
      text={text}
      options={{ direction: "up", skipUnchanged: false }}
      className={className}
    />
  );
}

/**
 * The duty-status grid plus its interactive layer: a hover scrubber that reads
 * the time/status under the pointer, per-entry hit areas with a detail popover,
 * and a legend that highlights in sync. Used only in the expanded modal.
 */
export function InteractiveLogGrid({
  day,
  minGridWidth = 760,
}: {
  day: DayLog;
  minGridWidth?: number;
}) {
  const segments = buildEntrySegments(day.entries, GRID.gridW);
  const pointerFine = usePointerFine();
  const plotRef = useRef<HTMLDivElement>(null);

  const [cursorFraction, setCursorFraction] = useState<number | null>(null);
  const [activeSegment, setActiveSegment] = useState<EntrySegment | null>(null);

  const cursorMinute =
    cursorFraction === null ? null : cursorFraction * MINUTES_PER_DAY;
  const cursorStatus =
    cursorMinute === null ? null : statusAtMinute(day.entries, cursorMinute);
  // The row a thing belongs to wins highlight: the hovered segment, else the
  // row under the scrubber.
  const highlightRow =
    activeSegment?.row ??
    (cursorStatus ? STATUS_ROWS.indexOf(cursorStatus) : null);

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointerFine || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    setCursorFraction(Math.max(0, Math.min(1, fraction)));
  }

  function clearCursor() {
    setCursorFraction(null);
  }

  return (
    <div className="overflow-x-auto px-4 py-4">
      <div className="relative" style={{ minWidth: minGridWidth }}>
        <LogGrid day={day} animate showTotals={false} />

        {/* Rolling totals over the "Total" column (SVG values are suppressed). */}
        <div
          className="pointer-events-none absolute flex flex-col"
          style={{
            left: `${TOTAL_LEFT * 100}%`,
            width: `${TOTAL_WIDTH * 100}%`,
            top: `${PLOT_TOP * 100}%`,
            height: `${PLOT_HEIGHT * 100}%`,
          }}
          aria-hidden="true"
        >
          {STATUS_ROWS.map((status) => (
            <span
              key={status}
              className="flex flex-1 items-center justify-center"
            >
              <RollingTotal
                value={day.totals[status] ?? 0}
                className="font-semibold text-[13px] text-foreground tabular-nums"
              />
            </span>
          ))}
        </div>

        {/* Interactive overlay, inset to the plotting area only. */}
        <div
          ref={plotRef}
          className="absolute"
          style={{
            left: `${PLOT_LEFT * 100}%`,
            width: `${PLOT_WIDTH * 100}%`,
            top: `${PLOT_TOP * 100}%`,
            height: `${PLOT_HEIGHT * 100}%`,
            cursor: pointerFine ? "crosshair" : undefined,
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={clearCursor}
        >
          {/* Row highlight strip */}
          {highlightRow !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 bg-primary/[0.07] transition-[top] duration-150"
              style={{
                top: `${highlightRow * ROW_FRACTION * 100}%`,
                height: `${ROW_FRACTION * 100}%`,
              }}
              aria-hidden="true"
            />
          )}

          {/* Scrubber hairline + intersect dot + time chip */}
          {cursorFraction !== null && cursorMinute !== null && (
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ left: `${cursorFraction * 100}%` }}
              aria-hidden="true"
            >
              <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-primary/50" />
              {cursorStatus && (
                <div
                  className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary"
                  style={{
                    top: `${(STATUS_ROWS.indexOf(cursorStatus) + 0.5) * ROW_FRACTION * 100}%`,
                  }}
                />
              )}
              <div className="absolute -top-6 left-0 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] text-background tabular-nums">
                {minuteToTime(cursorMinute)}
              </div>
            </div>
          )}

          {/* Per-entry hit areas */}
          {segments.map((seg) => {
            const left = (seg.x1 / GRID.gridW) * 100;
            const width = ((seg.x2 - seg.x1) / GRID.gridW) * 100;
            return (
              <button
                type="button"
                key={`${seg.entry.start}-${seg.status}`}
                className="absolute focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: `${seg.row * ROW_FRACTION * 100}%`,
                  height: `${ROW_FRACTION * 100}%`,
                }}
                onPointerEnter={() => setActiveSegment(seg)}
                onPointerLeave={() => setActiveSegment(null)}
                onFocus={() => setActiveSegment(seg)}
                onBlur={() => setActiveSegment(null)}
                aria-label={`${STATUS_META[seg.status].label} ${seg.entry.start} to ${seg.entry.end}, ${seg.durationHours.toFixed(1)} hours`}
              />
            );
          })}

          {/* Detail popover for the active entry */}
          {activeSegment && <SegmentPopover segment={activeSegment} />}
        </div>
      </div>

      {/* Legend, synced to the highlighted row, with rolling totals */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pt-3">
        {STATUS_ROWS.map((status, row) => {
          const meta = STATUS_META[status];
          const active = highlightRow === row;
          return (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 text-[11px] transition-colors duration-150 ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span
                className="size-2 rounded-[2px] transition-opacity duration-150"
                style={{
                  backgroundColor: meta.color,
                  opacity: active ? 1 : 0.55,
                }}
                aria-hidden="true"
              />
              {meta.short}
              <RollingTotal value={day.totals[status] ?? 0} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SegmentPopover({ segment }: { segment: EntrySegment }) {
  const meta = STATUS_META[segment.status];
  // Keep the anchor away from the plot's horizontal edges so the centered card
  // doesn't spill past the grid.
  const center = Math.max(
    6,
    Math.min(94, ((segment.x1 + segment.x2) / 2 / GRID.gridW) * 100),
  );
  const detail = segment.entry.location ?? segment.entry.note;
  // The top row has no room above it inside the modal, so flip the card below.
  const below = segment.row === 0;
  const top = below
    ? (segment.row + 1) * ROW_FRACTION * 100
    : segment.row * ROW_FRACTION * 100;
  return (
    <div
      className="fade-in-0 zoom-in-95 pointer-events-none absolute z-10 w-max max-w-[240px] -translate-x-1/2 animate-in rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md duration-150"
      style={{
        left: `${center}%`,
        top: `${top}%`,
        transform: below
          ? "translate(-50%, 8px)"
          : "translate(-50%, calc(-100% - 8px))",
      }}
      role="tooltip"
    >
      <div className="flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: meta.color }}
          aria-hidden="true"
        />
        <span className="font-medium text-xs">{meta.label}</span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
        {segment.entry.start} → {segment.entry.end} ·{" "}
        {segment.durationHours.toFixed(1)} h
      </p>
      {detail && (
        <p className="mt-1 text-[11px] text-foreground/80 leading-snug">
          {detail}
        </p>
      )}
    </div>
  );
}
