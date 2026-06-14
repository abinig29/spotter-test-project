from __future__ import annotations

import httpx

from app.routing.base import (
    RouteNotFound,
    RouteProvider,
    RouteResult,
    RouteServiceError,
)

ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson"
METERS_PER_MILE = 1609.34


class ORSRouteProvider(RouteProvider):
    def __init__(self, api_key: str, client: httpx.Client | None = None, timeout: float = 20.0):
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=timeout)

    def get_route(self, waypoints):
        coords = [[lng, lat] for (lat, lng) in waypoints]
        try:
            resp = self.client.post(
                ORS_URL,
                json={"coordinates": coords},
                headers={"Authorization": self.api_key},
            )
        except httpx.HTTPError as exc:
            raise RouteServiceError(str(exc)) from exc

        if resp.status_code in (400, 404):
            raise RouteNotFound(f"ORS {resp.status_code}")
        if resp.status_code != 200:
            raise RouteServiceError(f"ORS {resp.status_code}")
        return self._parse(resp.json())

    @staticmethod
    def _parse(data: dict) -> RouteResult:
        try:
            feature = data["features"][0]
            props = feature["properties"]
            summary = props["summary"]
            distance_m = summary["distance"]
            duration_s = summary["duration"]
            geometry = feature["geometry"]["coordinates"]  # [[lng, lat], ...]
        except (KeyError, IndexError) as exc:
            raise RouteServiceError("Unexpected ORS response") from exc
        if not geometry:
            raise RouteServiceError("Empty route geometry")
        coordinates = [[lat, lng] for lng, lat in geometry]
        # The first segment is the current-location -> pickup leg (waypoints are
        # current, pickup, dropoff). Absent segments (single-leg) -> 0.
        segments = props.get("segments") or []
        pickup_seg = segments[0] if segments else {}
        return RouteResult(
            total_miles=distance_m / METERS_PER_MILE,
            total_driving_hours=duration_s / 3600.0,
            coordinates=coordinates,
            pickup_miles=pickup_seg.get("distance", 0.0) / METERS_PER_MILE,
            pickup_driving_hours=pickup_seg.get("duration", 0.0) / 3600.0,
        )
