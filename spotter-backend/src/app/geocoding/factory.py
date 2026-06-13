from app.geocoding.nominatim import NominatimGeocoder


def get_reverse_geocoder():
    return NominatimGeocoder()
