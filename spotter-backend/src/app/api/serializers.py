from __future__ import annotations

from rest_framework import serializers

from app.hos.models import DayLog, LogEntry, Stop


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    address = serializers.CharField(required=False, allow_blank=True, default="")


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = LocationSerializer()
    pickup_location = LocationSerializer()
    dropoff_location = LocationSerializer()
    cycle_hours_used = serializers.FloatField(min_value=0, max_value=70)


def serialize_entry(entry: LogEntry) -> dict:
    out = {
        "status": entry.status.value,
        "start": entry.start.strftime("%H:%M"),
        "end": entry.end.strftime("%H:%M"),
    }
    if entry.location:
        out["location"] = entry.location
    if entry.note:
        out["note"] = entry.note
    return out


def serialize_day(day: DayLog) -> dict:
    return {
        "day": day.day,
        "date": day.date,
        "total_miles_today": day.total_miles_today,
        "entries": [serialize_entry(e) for e in day.entries],
        "totals": day.totals,
        "remarks": day.remarks,
    }


def serialize_stop(stop: Stop, location: str, lat: float, lng: float) -> dict:
    return {
        "type": stop.type,
        "location": location,
        "lat": lat,
        "lng": lng,
        "arrival": stop.arrival.strftime("%H:%M"),
        "duration_hours": round(stop.duration_hours, 2),
    }
