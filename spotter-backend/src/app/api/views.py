"""HTTP endpoints."""

from datetime import datetime, time

from django.http import JsonResponse
from rest_framework import status as http
from rest_framework.decorators import api_view
from rest_framework.response import Response

import app.geocoding.factory as geo_factory
import app.routing.factory as route_factory
from app.api.serializers import TripPlanRequestSerializer
from app.api.service import build_trip_plan
from app.routing.base import RouteNotFound, RouteResult, RouteServiceError


def root(request):
    return JsonResponse({"message": "Welcome to spotter-backend!"})


def health(request):
    return JsonResponse({"status": "healthy"})


@api_view(["GET"])
def api_status(request):
    return Response({"status": "ok", "framework": "django-rest-framework"})


@api_view(["POST"])
def trip_plan(request):
    serializer = TripPlanRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=http.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data

    provider = route_factory.get_route_provider()
    if provider is None:
        return Response({"error": "Routing not configured."},
                        status=http.HTTP_503_SERVICE_UNAVAILABLE)

    cur, pick, drop = data["current_location"], data["pickup_location"], data["dropoff_location"]
    waypoints = [(cur["lat"], cur["lng"]), (pick["lat"], pick["lng"]), (drop["lat"], drop["lng"])]

    if waypoints[0] == waypoints[1] == waypoints[2]:
        route = RouteResult(0.0, 0.0, [[cur["lat"], cur["lng"]]])
    else:
        try:
            route = provider.get_route(waypoints)
        except RouteNotFound:
            return Response(
                {"error": "Could not resolve a valid driving location. "
                          "Please click on a road or city."},
                status=http.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except RouteServiceError:
            return Response({"error": "Routing service unavailable."},
                            status=http.HTTP_502_BAD_GATEWAY)

    start_dt = datetime.combine(datetime.now().date(), time(6, 0))
    geocoder = geo_factory.get_reverse_geocoder()
    body = build_trip_plan(data, route, geocoder, start_dt)
    return Response(body, status=http.HTTP_200_OK)
