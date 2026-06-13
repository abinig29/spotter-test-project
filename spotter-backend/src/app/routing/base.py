from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class RouteResult:
    total_miles: float
    total_driving_hours: float
    coordinates: list[list[float]]  # [[lat, lng], ...] full road polyline


class RouteNotFound(Exception):
    """Raised when a waypoint is not routable (ocean/invalid)."""


class RouteServiceError(Exception):
    """Raised on timeout / 5xx / unparseable routing response."""


class RouteProvider(ABC):
    @abstractmethod
    def get_route(self, waypoints: list[tuple[float, float]]) -> RouteResult:
        """waypoints are (lat, lng) for current, pickup, dropoff, in order."""
