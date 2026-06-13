from __future__ import annotations

import math

_EARTH_RADIUS_MILES = 3958.7613


def _haversine_miles(a: list[float], b: list[float]) -> float:
    lat1, lng1 = a
    lat2, lng2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * _EARTH_RADIUS_MILES * math.asin(min(1.0, math.sqrt(h)))


def point_at_mile(polyline, total_miles, mile_marker):
    """Return [lat, lng] at `mile_marker` miles from the start along `polyline`."""
    if not polyline:
        return None
    if len(polyline) == 1 or total_miles <= 0 or mile_marker <= 0:
        return polyline[0]

    seglens = [_haversine_miles(polyline[i], polyline[i + 1]) for i in range(len(polyline) - 1)]
    geom_total = sum(seglens)
    if geom_total <= 0:
        return polyline[0]

    target = (mile_marker / total_miles) * geom_total
    if target >= geom_total:
        return polyline[-1]

    acc = 0.0
    for i, seg in enumerate(seglens):
        if acc + seg >= target:
            frac = (target - acc) / seg if seg > 0 else 0.0
            lat = polyline[i][0] + frac * (polyline[i + 1][0] - polyline[i][0])
            lng = polyline[i][1] + frac * (polyline[i + 1][1] - polyline[i][1])
            return [lat, lng]
        acc += seg
    return polyline[-1]
