"""Fixed HOS rule numbers. These never change based on user input."""

START_HOUR = 6                  # Trip starts 6:00am on Day 1
MAX_DRIVING_HOURS = 11.0        # Rule 1
DRIVING_WINDOW_HOURS = 14.0     # Rule 2
HOURS_BEFORE_BREAK = 8.0        # Rule 3
BREAK_DURATION_HOURS = 0.5      # Rule 3
REST_DURATION_HOURS = 10.0      # Rule 4
CYCLE_LIMIT_HOURS = 70.0        # Rule 5
FUEL_INTERVAL_MILES = 1000.0    # Rule 6
FUEL_DURATION_HOURS = 0.5       # Rule 6
PICKUP_DURATION_HOURS = 1.0     # Rule 7
DROPOFF_DURATION_HOURS = 1.0    # Rule 7
EPS = 1e-6
