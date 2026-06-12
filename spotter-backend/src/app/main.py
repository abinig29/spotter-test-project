"""Main application entry point."""
# ruff: noqa: I001

import os

from dotenv import load_dotenv

import django
import json
from django.conf import settings
from django.http import JsonResponse
from django.urls import path
from rest_framework.decorators import api_view
from rest_framework.response import Response

load_dotenv()

if not settings.configured:
    settings.configure(
        DEBUG=os.getenv("DEBUG", "true").lower() == "true",
        ROOT_URLCONF=__name__,
        SECRET_KEY=os.getenv("SECRET_KEY", "change-me-in-production"),
        ALLOWED_HOSTS=["*"],
        INSTALLED_APPS=[
            "django.contrib.contenttypes",
            "django.contrib.auth",
            "corsheaders",
            "rest_framework",
        ],
        MIDDLEWARE=[
            "corsheaders.middleware.CorsMiddleware",
            "django.middleware.common.CommonMiddleware",
        ],
        CORS_ALLOW_ALL_ORIGINS=True,
    )
    django.setup()


def root(request):
    """Root endpoint."""
    return JsonResponse({"message": "Welcome to spotter-backend!"})


def health(request):
    """Health check endpoint."""
    return JsonResponse({"status": "healthy"})


@api_view(["GET"])
def api_status(request):
    """REST API status endpoint."""
    return Response({"status": "ok", "framework": "django-rest-framework"})




urlpatterns = [
    path("", root),
    path("health", health),
    path("api/status", api_status),
]


if __name__ == "__main__":
    from django.core.management import execute_from_command_line
    import sys

    sys.argv = ["manage.py", "runserver", f"{os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8000')}"]
    execute_from_command_line(sys.argv)
