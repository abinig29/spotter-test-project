import os

from app.routing.openroute import ORSRouteProvider


def get_route_provider():
    key = os.getenv("ORS_API_KEY")
    if not key:
        return None
    return ORSRouteProvider(key)
