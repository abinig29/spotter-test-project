from __future__ import annotations

import time

import httpx

from app.geocoding.base import ReverseGeocoder

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


class NominatimGeocoder(ReverseGeocoder):
    def __init__(self, client: httpx.Client | None = None, timeout: float = 10.0,
                 user_agent: str = "spotter-eld/1.0", min_interval_s: float = 1.0):
        self.client = client or httpx.Client(timeout=timeout)
        self.user_agent = user_agent
        self.min_interval_s = min_interval_s
        self._cache: dict[tuple[float, float], str] = {}
        self._last_call = 0.0

    def reverse(self, lat: float, lng: float) -> str:
        key = (round(lat, 4), round(lng, 4))
        if key in self._cache:
            return self._cache[key]
        name = self._fetch(lat, lng)
        self._cache[key] = name
        return name

    def _fetch(self, lat: float, lng: float) -> str:
        if self.min_interval_s > 0:
            wait = self.min_interval_s - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)
        try:
            resp = self.client.get(
                NOMINATIM_URL,
                params={"lat": lat, "lon": lng, "format": "jsonv2"},
                headers={"User-Agent": self.user_agent},
            )
            self._last_call = time.monotonic()
            if resp.status_code != 200:
                return self._fallback(lat, lng)
            return self._parse(resp.json(), lat, lng)
        except httpx.HTTPError:
            return self._fallback(lat, lng)

    @staticmethod
    def _parse(data: dict, lat: float, lng: float) -> str:
        addr = data.get("address", {})
        city = (addr.get("city") or addr.get("town") or addr.get("village")
                or addr.get("county"))
        state_code = None
        iso = addr.get("ISO3166-2-lvl4")  # e.g. "US-MO"
        if iso and "-" in iso:
            state_code = iso.split("-")[-1]
        label = state_code or addr.get("state")
        if city and label:
            return f"{city}, {label}"
        if city:
            return city
        display = data.get("display_name")
        if display:
            return display.split(",")[0]
        return NominatimGeocoder._fallback(lat, lng)

    @staticmethod
    def _fallback(lat: float, lng: float) -> str:
        return f"Near {lat:.2f}, {lng:.2f}"
