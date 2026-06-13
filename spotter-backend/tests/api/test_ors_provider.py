import httpx
import pytest

from app.routing.base import RouteNotFound, RouteServiceError
from app.routing.openroute import ORSRouteProvider

SAMPLE = {
    "features": [
        {
            "properties": {"summary": {"distance": 16093.4, "duration": 3600.0}},
            "geometry": {"coordinates": [[-87.65, 41.85], [-90.19, 38.62]]},
        }
    ]
}


def _provider(handler):
    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport)
    return ORSRouteProvider("k", client=client)


def test_parse_converts_units_and_flips_coords():
    provider = _provider(lambda req: httpx.Response(200, json=SAMPLE))
    result = provider.get_route([(41.85, -87.65), (38.62, -90.19), (36.16, -86.78)])
    assert abs(result.total_miles - 10.0) < 0.01     # 16093.4 m / 1609.34
    assert abs(result.total_driving_hours - 1.0) < 1e-6
    assert result.coordinates[0] == [41.85, -87.65]  # [lng,lat] -> [lat,lng]


def test_404_raises_route_not_found():
    provider = _provider(lambda req: httpx.Response(404, json={"error": "no point"}))
    with pytest.raises(RouteNotFound):
        provider.get_route([(0, 0), (0, 0), (0, 0)])


def test_500_raises_service_error():
    provider = _provider(lambda req: httpx.Response(500, text="boom"))
    with pytest.raises(RouteServiceError):
        provider.get_route([(0, 0), (0, 0), (0, 0)])


def test_transport_error_raises_service_error():
    def handler(req):
        raise httpx.ConnectError("down")
    provider = _provider(handler)
    with pytest.raises(RouteServiceError):
        provider.get_route([(0, 0), (0, 0), (0, 0)])


def test_empty_geometry_raises_service_error():
    body = {"features": [{"properties": {"summary": {"distance": 1000.0, "duration": 600.0}},
                          "geometry": {"coordinates": []}}]}
    provider = _provider(lambda req: httpx.Response(200, json=body))
    with pytest.raises(RouteServiceError):
        provider.get_route([(0, 0), (0, 0), (0, 0)])
