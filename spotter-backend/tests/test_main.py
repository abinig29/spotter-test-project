"""Tests for main application."""

import pytest
from django.test import Client


@pytest.fixture
def client():
    """Create a test client."""
    return Client()


def test_root(client):
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to spotter-backend!"}


def test_health(client):
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
