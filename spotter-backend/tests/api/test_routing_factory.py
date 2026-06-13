from app.routing import factory
from app.routing.openroute import ORSRouteProvider


def test_factory_returns_none_without_key(monkeypatch):
    monkeypatch.delenv("ORS_API_KEY", raising=False)
    assert factory.get_route_provider() is None


def test_factory_returns_provider_with_key(monkeypatch):
    monkeypatch.setenv("ORS_API_KEY", "test-key")
    provider = factory.get_route_provider()
    assert isinstance(provider, ORSRouteProvider)
