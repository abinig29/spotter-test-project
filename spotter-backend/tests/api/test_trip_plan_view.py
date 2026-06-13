import json

import pytest
from django.test import Client

from app.routing.base import RouteNotFound, RouteResult, RouteServiceError

VALID = {
    "current_location": {"lat": 41.85, "lng": -87.65, "address": "Chicago, IL"},
    "pickup_location": {"lat": 40.0, "lng": -88.0, "address": "Pickupville, IL"},
    "dropoff_location": {"lat": 36.16, "lng": -86.78, "address": "Nashville, TN"},
    "cycle_hours_used": 10,
}


class FakeProvider:
    def __init__(self, result=None, exc=None):
        self.result = result
        self.exc = exc

    def get_route(self, waypoints):
        if self.exc:
            raise self.exc
        return self.result


class FakeGeocoder:
    def reverse(self, lat, lng):
        return "Near Testville, TS"


def _route():
    return RouteResult(1400.0, 14.0, [[41.85, -87.65], [36.16, -86.78]])


@pytest.fixture
def client():
    return Client()


def _post(client, payload):
    return client.post("/api/trip/plan", data=json.dumps(payload),
                       content_type="application/json")


def _patch(monkeypatch, provider):
    import app.routing.factory as rf
    import app.geocoding.factory as gf
    monkeypatch.setattr(rf, "get_route_provider", lambda: provider)
    monkeypatch.setattr(gf, "get_reverse_geocoder", lambda: FakeGeocoder())


def test_happy_path_returns_plan(monkeypatch, client):
    _patch(monkeypatch, FakeProvider(result=_route()))
    resp = _post(client, VALID)
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["total_miles"] == 1400.0
    assert "logs" in body and len(body["logs"]) >= 1
    assert "cycle_hours_warning" in body


def test_no_key_returns_503(monkeypatch, client):
    import app.routing.factory as rf
    monkeypatch.setattr(rf, "get_route_provider", lambda: None)
    resp = _post(client, VALID)
    assert resp.status_code == 503


def test_unroutable_point_returns_422(monkeypatch, client):
    _patch(monkeypatch, FakeProvider(exc=RouteNotFound("no point")))
    resp = _post(client, VALID)
    assert resp.status_code == 422
    assert "Could not resolve" in resp.json()["error"]


def test_service_error_returns_502(monkeypatch, client):
    _patch(monkeypatch, FakeProvider(exc=RouteServiceError("down")))
    resp = _post(client, VALID)
    assert resp.status_code == 502


def test_invalid_cycle_hours_returns_400(monkeypatch, client):
    _patch(monkeypatch, FakeProvider(result=_route()))
    resp = _post(client, {**VALID, "cycle_hours_used": 99})
    assert resp.status_code == 400


def test_identical_points_skip_routing(monkeypatch, client):
    # Provider would raise if called; identical points must short-circuit before it.
    _patch(monkeypatch, FakeProvider(exc=RouteServiceError("should not be called")))
    same = {"lat": 41.85, "lng": -87.65, "address": "Chicago, IL"}
    payload = {"current_location": same, "pickup_location": same,
               "dropoff_location": same, "cycle_hours_used": 0}
    resp = _post(client, payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["total_miles"] == 0.0
    assert len(body["logs"]) == 1
