"""Pure-Python Hours-of-Service calculation engine (no Django imports)."""

from app.hos.engine import plan_trip

__all__ = ["plan_trip"]
