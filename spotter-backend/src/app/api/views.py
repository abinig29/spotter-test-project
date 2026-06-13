"""HTTP endpoints."""

from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response


def root(request):
    return JsonResponse({"message": "Welcome to spotter-backend!"})


def health(request):
    return JsonResponse({"status": "healthy"})


@api_view(["GET"])
def api_status(request):
    return Response({"status": "ok", "framework": "django-rest-framework"})
