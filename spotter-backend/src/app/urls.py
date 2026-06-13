from django.urls import path

from app.api.views import api_status, health, root

urlpatterns = [
    path("", root),
    path("health", health),
    path("api/status", api_status),
]
