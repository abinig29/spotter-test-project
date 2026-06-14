from __future__ import annotations

from datetime import datetime

from app.api.interpolate import point_at_mile
from app.api.serializers import serialize_day, serialize_stop
from app.hos.daysplit import build_day_logs
from app.hos.engine import plan_trip
from app.hos.models import RouteInput


def build_trip_plan(data: dict, route, geocoder, start_dt: datetime) -> dict:
    """Run the HOS engine over a fetched route, place + name stops, serialize.

    `route` is a RouteResult; `geocoder` is a ReverseGeocoder; both are injected
    so this function performs no network or env access and is fully unit-testable.
    """
    pickup = data["pickup_location"]
    dropoff = data["dropoff_location"]

    plan = plan_trip(
        RouteInput(
            route.total_miles,
            route.total_driving_hours,
            pickup_miles=route.pickup_miles,
            pickup_driving_hours=route.pickup_driving_hours,
        ),
        float(data["cycle_hours_used"]),
        start_dt=start_dt,
        pickup_location=pickup.get("address") or "Pickup",
        dropoff_location=dropoff.get("address") or "Dropoff",
    )

    response_stops = []
    name_by_entry_start = {}
    for stop in plan.stops:
        if stop.type == "pickup":
            lat, lng, name = pickup["lat"], pickup["lng"], (pickup.get("address") or "Pickup")
        elif stop.type == "dropoff":
            lat, lng, name = dropoff["lat"], dropoff["lng"], (dropoff.get("address") or "Dropoff")
        else:  # fuel or rest
            point = point_at_mile(route.coordinates, route.total_miles, stop.mile_marker)
            lat, lng = (point or route.coordinates[0])
            name = geocoder.reverse(lat, lng)
            name_by_entry_start[stop.arrival] = name
        # 1-based day index of the stop, relative to the trip's start date, so
        # the frontend can disambiguate stops that share a clock time.
        day = (stop.arrival.date() - start_dt.date()).days + 1
        response_stops.append(serialize_stop(stop, name, lat, lng, day))

    # Inject geocoded names onto the matching fuel/rest entries, then rebuild the
    # per-day logs so remarks carry real place names.
    for entry in plan.entries:
        if entry.start in name_by_entry_start:
            entry.location = name_by_entry_start[entry.start]
    logs = build_day_logs(plan.entries, start_dt)

    return {
        "route": {
            "total_miles": round(route.total_miles, 1),
            "total_driving_hours": round(route.total_driving_hours, 2),
            "coordinates": route.coordinates,
            "stops": response_stops,
        },
        "cycle_hours_warning": plan.cycle_hours_warning,
        "total_cycle_hours_used": round(plan.total_cycle_hours_used, 1),
        "logs": [serialize_day(d) for d in logs],
    }
