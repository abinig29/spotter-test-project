from django.urls import path

from app.api.views import api_status, health, root, trip_plan

urlpatterns = [
    path("", root),
    path("health", health),
    path("api/status", api_status),
    path("api/trip/plan", trip_plan),
]
