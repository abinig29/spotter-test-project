from app.api.interpolate import point_at_mile

# A straight west-to-east polyline along the equator at lng 0,1,2 (so geometric
# length splits evenly). total_miles is arbitrary; fractions are what matter.
LINE = [[0.0, 0.0], [0.0, 1.0], [0.0, 2.0]]


def test_marker_zero_returns_first_point():
    assert point_at_mile(LINE, 100.0, 0.0) == [0.0, 0.0]


def test_marker_total_returns_last_point():
    assert point_at_mile(LINE, 100.0, 100.0) == [0.0, 2.0]


def test_marker_half_is_midpoint():
    pt = point_at_mile(LINE, 100.0, 50.0)
    assert abs(pt[1] - 1.0) < 1e-6
    assert abs(pt[0] - 0.0) < 1e-6


def test_single_point_polyline_returns_that_point():
    assert point_at_mile([[5.0, 6.0]], 0.0, 0.0) == [5.0, 6.0]


def test_zero_total_miles_returns_first_point():
    assert point_at_mile(LINE, 0.0, 10.0) == [0.0, 0.0]
