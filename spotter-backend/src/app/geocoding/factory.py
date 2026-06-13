from app.geocoding.nominatim import NominatimGeocoder

_geocoder = None


def get_reverse_geocoder():
    global _geocoder
    if _geocoder is None:
        _geocoder = NominatimGeocoder()
    return _geocoder
