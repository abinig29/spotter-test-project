from app.geocoding.nominatim import NominatimGeocoder


def test_parse_city_and_state_code():
    data = {"address": {"city": "St. Louis", "state": "Missouri",
                        "ISO3166-2-lvl4": "US-MO"}}
    assert NominatimGeocoder._parse(data, 38.6, -90.2) == "St. Louis, MO"


def test_parse_falls_back_to_town_then_state_name():
    data = {"address": {"town": "Cape Girardeau", "state": "Missouri"}}
    assert NominatimGeocoder._parse(data, 37.3, -89.5) == "Cape Girardeau, Missouri"


def test_parse_no_address_uses_coordinate_fallback():
    assert NominatimGeocoder._parse({}, 35.14, -90.04) == "Near 35.14, -90.04"


def test_fallback_format():
    assert NominatimGeocoder._fallback(35.14, -90.04) == "Near 35.14, -90.04"
