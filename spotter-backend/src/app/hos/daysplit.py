from __future__ import annotations

from datetime import datetime, timedelta

from app.hos.models import DayLog, LogEntry
from app.hos.statuses import DutyStatus


def _day_start(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _miles_part(e: LogEntry, seg_start: datetime, seg_end: datetime) -> float:
    total = (e.end - e.start).total_seconds()
    if total <= 0:
        return 0.0
    return e.miles * ((seg_end - seg_start).total_seconds() / total)


def _split_at_midnights(entries: list[LogEntry]) -> list[LogEntry]:
    out: list[LogEntry] = []
    for e in entries:
        seg_start = e.start
        first = True
        while True:
            next_midnight = _day_start(seg_start) + timedelta(days=1)
            seg_end = min(e.end, next_midnight)
            out.append(
                LogEntry(
                    e.status,
                    seg_start,
                    seg_end,
                    e.location if first else None,
                    e.note if first else None,
                    _miles_part(e, seg_start, seg_end),
                )
            )
            first = False
            if e.end <= next_midnight:
                break
            seg_start = next_midnight
    return out


def _build_remarks(entries: list[LogEntry]) -> list[str]:
    remarks: list[str] = []
    for e in entries:
        if e.note:
            location = e.location or "En route"
            remarks.append(f"{location} — {e.note}")
    return remarks


def build_day_logs(entries: list[LogEntry], start_dt: datetime) -> list[DayLog]:
    if not entries:
        return []

    full: list[LogEntry] = []

    # Fill Day 1 from 00:00 to the first entry's start with off-duty.
    day1_midnight = _day_start(start_dt)
    if entries[0].start > day1_midnight:
        full.append(LogEntry(DutyStatus.OFF_DUTY, day1_midnight, entries[0].start))

    full.extend(entries)

    # Fill the tail of the final day to the next midnight with off-duty.
    last_end = entries[-1].end
    midnight_of_last = _day_start(last_end)
    next_midnight = midnight_of_last + timedelta(days=1)
    if last_end != midnight_of_last and last_end < next_midnight:
        full.append(LogEntry(DutyStatus.OFF_DUTY, last_end, next_midnight))

    split = _split_at_midnights(full)

    # Group by calendar day, preserving order.
    order: list[datetime] = []
    buckets: dict[datetime, list[LogEntry]] = {}
    for e in split:
        key = _day_start(e.start)
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(e)

    logs: list[DayLog] = []
    for day_number, key in enumerate(order, start=1):
        day_entries = buckets[key]
        totals = {s.value: 0.0 for s in DutyStatus}
        miles = 0.0
        for e in day_entries:
            totals[e.status.value] += e.duration_hours
            miles += e.miles
        logs.append(
            DayLog(
                day=day_number,
                date=key.strftime("%Y-%m-%d"),
                total_miles_today=round(miles, 1),
                entries=day_entries,
                totals={k: round(v, 2) for k, v in totals.items()},
                remarks=_build_remarks(day_entries),
            )
        )
    return logs
