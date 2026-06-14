from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.hos.statuses import DutyStatus


@dataclass(frozen=True)
class RouteInput:
    total_miles: float
    total_driving_hours: float
    # The current-location -> pickup leg, driven before the 1h pickup. The
    # remainder (total - pickup) is the pickup -> dropoff leg. Defaults to 0,
    # in which case pickup is effectively at the current location.
    pickup_miles: float = 0.0
    pickup_driving_hours: float = 0.0


@dataclass
class LogEntry:
    status: DutyStatus
    start: datetime
    end: datetime
    location: str | None = None
    note: str | None = None
    miles: float = 0.0

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


@dataclass
class Stop:
    type: str  # "pickup" | "fuel" | "rest" | "dropoff"
    location: str | None
    lat: float | None
    lng: float | None
    arrival: datetime
    duration_hours: float
    mile_marker: float = 0.0


@dataclass
class DayLog:
    day: int
    date: str
    total_miles_today: float
    entries: list[LogEntry]
    totals: dict[str, float]
    remarks: list[str]


@dataclass
class TripPlan:
    entries: list[LogEntry] = field(default_factory=list)
    stops: list[Stop] = field(default_factory=list)
    logs: list[DayLog] = field(default_factory=list)
    cycle_hours_warning: str | None = None
    total_cycle_hours_used: float = 0.0
    incomplete: bool = False
