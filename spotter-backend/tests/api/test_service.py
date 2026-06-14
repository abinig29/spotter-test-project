from datetime import datetime

from app.api.service import build_trip_plan
from app.routing.base import RouteResult


class FakeGeocoder:
    def __init__(self, name="Near Testville, TS", fail=False):
        self.name = name
        self.fail = fail

    def reverse(self, lat, lng):
        if self.fail:
            return f"Near {lat:.2f}, {lng:.2f}"
        return self.name


VALID = {
    "current_location": {"lat": 41.85, "lng": -87.65, "address": "Chicago, IL"},
    "pickup_location": {"lat": 40.0, "lng": -88.0, "address": "Pickupville, IL"},
    "dropoff_location": {"lat": 36.16, "lng": -86.78, "address": "Nashville, TN"},
    "cycle_hours_used": 0,
}
START = datetime(2026, 6, 13, 6)


def _route(miles=1400.0, hours=14.0):
    # simple 2-point line; coordinates are [lat, lng]
    return RouteResult(miles, hours, [[41.85, -87.65], [36.16, -86.78]])


def test_response_has_route_logs_and_named_fuel_stop():
    resp = build_trip_plan(VALID, _route(), FakeGeocoder(), START)
    assert resp["route"]["total_miles"] == 1400.0
    assert resp["route"]["coordinates"][0] == [41.85, -87.65]
    # 1400mi -> exactly one fuel stop, named by the geocoder.
    fuels = [s for s in resp["route"]["stops"] if s["type"] == "fuel"]
    assert len(fuels) == 1
    assert fuels[0]["location"] == "Near Testville, TS"
    # pickup/dropoff stops use request addresses + waypoint coords.
    pickup = next(s for s in resp["route"]["stops"] if s["type"] == "pickup")
    assert pickup["location"] == "Pickupville, IL"
    assert pickup["lat"] == 40.0
    # logs present; each day sums to 24h.
    assert len(resp["logs"]) >= 1
    for day in resp["logs"]:
        assert abs(sum(day["totals"].values()) - 24.0) < 0.01


def test_drives_to_pickup_before_pickup_block():
    # Route with a real current->pickup leg: day 1 should start by driving, not
    # by the on-duty pickup block.
    route = RouteResult(700.0, 12.0, [[41.85, -87.65], [36.16, -86.78]],
                        pickup_miles=50.0, pickup_driving_hours=1.0)
    resp = build_trip_plan(VALID, route, FakeGeocoder(), START)
    entries = [e for day in resp["logs"] for e in day["entries"]]
    first_work = next(e for e in entries if e["status"] in ("driving", "on_duty_not_driving"))
    assert first_work["status"] == "driving"


def test_fuel_stop_name_appears_in_remarks():
    resp = build_trip_plan(VALID, _route(), FakeGeocoder(name="Near Cairo, IL"), START)
    all_remarks = [r for day in resp["logs"] for r in day["remarks"]]
    assert any("Near Cairo, IL" in r and "Fueling stop" in r for r in all_remarks)


def test_first_day_date_from_start_dt():
    resp = build_trip_plan(VALID, _route(), FakeGeocoder(), START)
    assert resp["logs"][0]["date"] == "2026-06-13"


def test_geocoder_failure_degrades_to_coordinate_name():
    resp = build_trip_plan(VALID, _route(), FakeGeocoder(fail=True), START)
    fuels = [s for s in resp["route"]["stops"] if s["type"] == "fuel"]
    assert fuels[0]["location"].startswith("Near ")
