# PRD: ELD Trip Planner — Full Stack Developer Assessment

## Overview

Build a full-stack web application that helps truck drivers plan their trips while staying compliant with US federal Hours of Service (HOS) rules. The driver picks their locations directly on a map, and the app calculates exactly when they drive, when they rest, when they stop — and outputs a filled-in daily log sheet (called an ELD log) for each day of the trip, plus a map showing the full route.

---

## Background (Plain English)

The US government requires truck drivers to follow strict rules about how long they can drive without resting. These rules are called **Hours of Service (HOS)** regulations, enforced by the **FMCSA** (Federal Motor Carrier Safety Administration).

Drivers must keep a daily record called a **Driver's Daily Log** (also called an ELD log — Electronic Logging Device log). This log is a 24-hour grid showing exactly what the driver was doing at every hour of the day: driving, resting, doing paperwork, etc.

This app automates that entire process. The driver picks locations on a map → the app figures out the full schedule → the app draws the completed log sheets.

---

## The 4 Duty Statuses (What Gets Logged)

Every minute of a driver's day falls into one of these four categories. These become the 4 rows on the log sheet grid:

| Status | What it means |
|---|---|
| **Off Duty** | Driver is completely free. Not working. Personal time. |
| **Sleeper Berth** | Driver is resting/sleeping in the built-in bed inside the truck cab. |
| **Driving** | Driver is actively behind the wheel, truck is moving. |
| **On Duty (Not Driving)** | Driver is working but not driving. Examples: loading cargo, paperwork, fueling, waiting at pickup/dropoff. |

---

## HOS Rules the App Must Enforce

These are the **fixed rules** hardcoded into the app's logic. These do not change based on user input.

### Rule 1: 11-Hour Driving Limit
- A driver can drive a maximum of **11 hours** per day.
- Once they hit 11 hours of driving, they must stop driving and take a mandatory 10-hour rest.
- Hours are cumulative — 3 hours in the morning + 8 hours in the afternoon = 11 hours, stop.

### Rule 2: 14-Hour Driving Window
- The moment a driver **starts their day** (even just doing paperwork, not driving yet), a **14-hour clock** starts.
- The driver must complete ALL driving within those 14 hours.
- After 14 hours from start — no more driving allowed, even if they haven't hit 11 driving hours yet.
- Example: Driver starts at 6:00am → they cannot drive after 8:00pm, no matter what.
- Non-driving work (paperwork, waiting) CAN continue after the 14-hour window closes, but no more driving.

### Rule 3: 30-Minute Rest Break
- After **8 cumulative hours of driving**, the driver must take a **30-minute consecutive break** before driving again.
- This break can be: off duty, sleeper berth, or on duty not driving — as long as it's 30 consecutive minutes with no driving.
- This break does NOT reset the 11-hour driving clock or 14-hour window. It just must happen.

### Rule 4: 10 Consecutive Hours Off Between Shifts
- After finishing a day's driving, the driver must rest for **at least 10 consecutive hours** before starting the next day.
- During this time, log as: **Sleeper Berth**.
- This 10-hour rest completely resets the 11-hour driving limit and 14-hour window for the next day.

### Rule 5: 70-Hour / 8-Day Limit
- Across any rolling 8-day period, a driver cannot be **on duty** for more than **70 total hours**.
- This includes ALL on-duty time: driving + on duty not driving.
- The driver inputs how many hours they've already used this cycle ("Current Cycle Used"). The app must factor this in.
- Example: if driver already used 60 hours this week, they only have 10 hours left before they hit the 70-hour cap.
- Once the 70-hour cap is hit, the driver cannot drive at all until hours drop off the 8-day rolling window.

### Rule 6: Fueling Stop Every 1,000 Miles
- The driver must stop to fuel at least once every 1,000 miles.
- Log fueling time as: **On Duty (Not Driving)**.
- Duration: assume **30 minutes** per fueling stop.
- Place fueling stops automatically at approximately every 1,000-mile mark along the route.

### Rule 7: 1 Hour for Pickup and Dropoff
- When the driver arrives at the **pickup location**: log **1 hour** as On Duty (Not Driving).
- When the driver arrives at the **dropoff location**: log **1 hour** as On Duty (Not Driving).
- These 1-hour stops count toward the 14-hour window and the 70-hour weekly limit.

### Fixed Assumptions (Do Not Build UI for These)
- Driver type: **property-carrying** (cargo truck, not passengers)
- Schedule: **70 hours / 8 days** (not 60/7)
- No adverse driving conditions exception
- No sleeper berth split provision (complex rule, not needed)
- Speed assumption: use the route API's estimated drive time directly

---

## Inputs

### Location Inputs — Picked Directly on the Map (NOT typed text fields)

All three location inputs must be selected by the user **clicking on the map**. There is no free-text address box for these. The flow works like this:

1. The app loads showing a full interactive map (Leaflet.js)
2. The user is shown a clear instruction: **"Click on the map to set your Current Location"**
3. They click → a pin drops → the app reverse-geocodes the coordinates to get a human-readable address (e.g. "Chicago, IL") and displays it next to the pin
4. The app then prompts: **"Now click to set your Pickup Location"**
5. They click → second pin drops with a different color
6. The app then prompts: **"Now click to set your Dropoff Location"**
7. They click → third pin drops with a different color
8. All 3 pins are visible on the map simultaneously with labels

**Why this matters:** the map pins give the backend exact latitude/longitude coordinates — which are more precise than typed addresses and don't require address parsing.

**Reverse geocoding** (turning coordinates into a readable place name for the remarks section) should use **Nominatim** — the free OpenStreetMap geocoding API. No API key required.

### The Input Form Fields

| Field | Input Method | Description |
|---|---|---|
| Current Location | **Click on map** | Where the driver is right now. Pin color: Blue |
| Pickup Location | **Click on map** | Where they pick up cargo. Pin color: Green |
| Dropoff Location | **Click on map** | Where they deliver cargo. Pin color: Red |
| Current Cycle Used (Hrs) | Number input (0–70) | Hours already used this 8-day window. This is the only typed input. |

### Location Input UX Detail
- Show a step indicator so the driver knows which pin they're placing: e.g. **Step 1 of 3: Click your current location**
- After all 3 pins are placed, show a summary panel listing all 3 locations with their resolved addresses
- Allow the user to **reset** any pin by clicking a small "change" button next to each location in the summary — this re-enters that step
- The "Calculate Trip" button should only be enabled once all 3 pins are placed and cycle hours are entered

---

## Outputs

### Output 1: Route Map
- After calculation, the same map updates to show the full driving route as a drawn line
- Must show markers/pins at:
  - Current location (start) — Blue pin
  - Pickup location — Green pin
  - Dropoff location — Red pin
  - Mandatory rest stops — Orange pin labeled "10hr Rest"
  - Fueling stops — Yellow pin labeled "Fuel"
- The route line connects all stops in order
- Clicking any pin shows a popup with: location name, stop type, arrival time, and duration

### Output 2: Daily Log Sheets (ELD Logs)
- One log sheet per day of the trip
- A 3-day trip = 3 log sheets. A 5-day trip = 5 log sheets.
- Each sheet is a visual recreation of the official Driver's Daily Log form (see reference image `blank-paper-log.png`)
- Each sheet must include:

#### The Grid (most important part)
- A 24-hour horizontal timeline from Midnight → Midnight
- 4 rows: Off Duty / Sleeper Berth / Driving / On Duty (Not Driving)
- A **horizontal line drawn** in the correct row for each time period
- Lines connect across the grid to show exactly when each status was active
- Vertical lines drop between rows when the status changes

#### The Header Info
- Date (month/day/year)
- Total miles driven that day
- Carrier name: placeholder "N/A"
- Main office address: placeholder acceptable
- Driver signature: placeholder acceptable
- Vehicle numbers: placeholder acceptable

#### The Remarks Section
- Below the grid
- List every location where the driver's status changed
- Format: City, State — reason (e.g., "Chicago, IL — Begin driving", "Gary, IN — Fueling stop", "Detroit, MI — 10hr rest")

#### Total Hours Column
- Right side of the grid
- Total hours spent in each of the 4 statuses
- All 4 numbers must add up to exactly **24 hours**

---

## Trip Calculation Logic (How the Backend Thinks)

This is the core algorithm the Django backend must implement.

### Step 1: Get Route Data
- Call OpenRouteService API with: current location (lat/lng) → pickup (lat/lng) → dropoff (lat/lng)
- Get back: total distance in miles, estimated driving time in hours, broken into segments

### Step 2: Initialize the Driver's State
```
current_time = start of trip (assume 6:00am Day 1)
driving_hours_today = 0
on_duty_hours_today = 0
hours_since_last_break = 0  # tracks cumulative driving since last 30-min break
window_start_time = None    # set when driver first starts their day
cycle_hours_used = [input from driver]
day = 1
log_entries = []
```

### Step 3: Simulate the Trip Event by Event

**Event: Arrive at Pickup**
- Log: On Duty (Not Driving) for 1 hour
- Start 14-hour window clock if not already started
- Add 1 hour to on_duty_hours_today and cycle_hours_used

**Event: Driving Segment**
- Break the driving into chunks, checking rules after each chunk:
  - Every time cumulative driving reaches 8 hours → insert 30-min break
  - Every time driving_hours_today reaches 11 hours → mandatory 10-hour rest, new day starts
  - Every time current_time exceeds 14-hour window start → mandatory 10-hour rest, new day starts
  - Every time distance traveled reaches next 1,000-mile mark → insert 30-min fueling stop (On Duty Not Driving)

**Event: 10-Hour Rest**
- Log: Sleeper Berth for 10 hours
- Reset: driving_hours_today = 0, on_duty_hours_today = 0, hours_since_last_break = 0
- Reset: window_start_time = None
- Increment: day += 1
- Start new log sheet

**Event: Arrive at Dropoff**
- Log: On Duty (Not Driving) for 1 hour
- Add 1 hour to on_duty_hours_today and cycle_hours_used
- Trip ends

### Step 4: Check 70-Hour Cap
- At every on-duty event, check: cycle_hours_used + new hours <= 70
- If adding more hours would exceed 70 → flag this in the response

### Step 5: Build the Log Sheet Data
- For each day, collect all the time blocks with their status and timestamps
- Convert to grid coordinates (position on the 24-hour timeline)
- Pass to the frontend to render

---

## Testing Requirements

Every HOS rule must have its own dedicated test file/class named exactly after the rule. Tests are written in Django using Python's `unittest` or `pytest`.

### Test Naming Convention
Each test class is named after the rule it tests. Each test method describes the specific scenario.

---

### Test Suite: `Rule1_ElevenHourDrivingLimit`

```python
class Rule1_ElevenHourDrivingLimit(TestCase):

    def test_driving_stops_at_11_hours(self):
        # driver drives 11 hours straight
        # assert: no driving logged after hour 11
        # assert: 10-hour rest is inserted after hour 11

    def test_cumulative_driving_across_segments_stops_at_11(self):
        # driver drives 6 hours, stops 1 hour (pickup), drives 5 more hours
        # total driving = 11 hours
        # assert: driving stops after the 5th hour of second segment
        # assert: 10-hour rest inserted

    def test_driving_under_11_hours_no_forced_rest(self):
        # short trip, total driving = 7 hours
        # assert: no 10-hour rest is inserted mid-trip due to Rule 1
        # (rest may still occur at end of trip)
```

---

### Test Suite: `Rule2_FourteenHourDrivingWindow`

```python
class Rule2_FourteenHourDrivingWindow(TestCase):

    def test_driving_stops_when_14_hour_window_expires(self):
        # driver starts at 6:00am
        # drives with breaks/stops totaling 14 hours of elapsed time
        # assert: no driving is scheduled after 8:00pm (14 hours later)
        # assert: 10-hour rest starts at or before the 14-hour mark

    def test_14_hour_window_starts_on_first_on_duty_event(self):
        # driver does 1 hour of pickup (on duty not driving) before driving
        # assert: 14-hour window clock started at pickup start, not when driving began
        # assert: driving window ends 14 hours from pickup start

    def test_non_driving_work_allowed_after_14_hour_window(self):
        # driver hits 14-hour window
        # assert: on_duty_not_driving entries CAN appear after window close
        # assert: no driving entries appear after window close

    def test_11_hour_limit_and_14_hour_window_both_enforced(self):
        # set up a scenario where 14-hour window expires before driver hits 11 driving hours
        # assert: driving stops at 14-hour window, not at 11-hour driving limit
```

---

### Test Suite: `Rule3_ThirtyMinuteRestBreak`

```python
class Rule3_ThirtyMinuteRestBreak(TestCase):

    def test_break_inserted_after_8_cumulative_driving_hours(self):
        # driver drives 8 hours straight
        # assert: a 30-minute break entry appears immediately after 8th driving hour
        # assert: break status is off_duty OR sleeper_berth OR on_duty_not_driving

    def test_break_is_consecutive_30_minutes(self):
        # assert: the break entry duration is exactly 0.5 hours (30 minutes)
        # assert: no driving entries interrupt the break

    def test_break_does_not_reset_driving_clock(self):
        # driver drives 8hrs → takes 30min break → drives 3 more hours
        # assert: total driving hours = 11 (not reset to 0 after break)
        # assert: driving stops at 11 hours (Rule 1), not at some other point

    def test_break_does_not_reset_14_hour_window(self):
        # driver starts at 6am, drives 8hrs, takes 30min break, drives more
        # assert: 14-hour window still ends at 8:00pm (14hrs from 6am)
        # assert: break time is counted inside the 14-hour window

    def test_cumulative_driving_resets_after_break(self):
        # driver drives 8hrs → 30min break → drives again
        # assert: the 8-hour cumulative counter resets after the break
        # assert: next break is not triggered until another 8 cumulative hours of driving
```

---

### Test Suite: `Rule4_TenConsecutiveHoursOff`

```python
class Rule4_TenConsecutiveHoursOff(TestCase):

    def test_10_hour_rest_inserted_after_day_ends(self):
        # driver hits 11-hour driving limit
        # assert: exactly 10 hours of sleeper_berth is inserted
        # assert: next day's driving does not start until 10 hours have passed

    def test_rest_is_logged_as_sleeper_berth(self):
        # assert: the 10-hour rest block has status = "sleeper_berth"
        # assert: it is NOT logged as off_duty

    def test_driving_limits_reset_after_10_hour_rest(self):
        # day 1: driver uses all 11 driving hours → 10hr rest
        # day 2: assert driving_hours_today starts at 0
        # day 2: assert 14-hour window clock is reset (new window starts fresh)

    def test_new_log_sheet_created_after_rest(self):
        # multi-day trip
        # assert: each 10-hour rest produces a new log sheet for the next day
        # assert: total log sheets = number of days traveled
```

---

### Test Suite: `Rule5_SeventyHourEightDayLimit`

```python
class Rule5_SeventyHourEightDayLimit(TestCase):

    def test_trip_respects_remaining_cycle_hours(self):
        # input: cycle_hours_used = 65
        # driver only has 5 hours left
        # assert: on-duty time scheduled does not exceed 5 more hours
        # assert: response includes a warning about cycle hours being nearly exhausted

    def test_full_cycle_available_when_zero_hours_used(self):
        # input: cycle_hours_used = 0
        # assert: driver can use full 70 hours without early forced stop

    def test_cycle_hours_include_both_driving_and_on_duty_not_driving(self):
        # input: cycle_hours_used = 60
        # trip has 3hrs driving + 1hr pickup + 1hr dropoff = 5 on-duty hours
        # assert: total cycle hours at end = 65 (60 + 5)
        # assert: not just driving hours counted

    def test_warning_raised_when_cycle_hours_exceeded(self):
        # input: cycle_hours_used = 69
        # trip requires more than 1 hour of on-duty time
        # assert: response contains a cycle_hours_warning field
        # assert: schedule is adjusted or trip is flagged as not completable
```

---

### Test Suite: `Rule6_FuelingStopEvery1000Miles`

```python
class Rule6_FuelingStopEvery1000Miles(TestCase):

    def test_no_fuel_stop_for_trips_under_1000_miles(self):
        # trip total distance = 800 miles
        # assert: no fueling stop entries in the log

    def test_one_fuel_stop_for_trips_between_1000_and_2000_miles(self):
        # trip total distance = 1400 miles
        # assert: exactly 1 fueling stop entry in the log
        # assert: fueling stop occurs at approximately the 1000-mile mark

    def test_two_fuel_stops_for_trips_over_2000_miles(self):
        # trip total distance = 2200 miles
        # assert: exactly 2 fueling stop entries in the log
        # assert: stops occur at approximately mile 1000 and mile 2000

    def test_fuel_stop_logged_as_on_duty_not_driving(self):
        # assert: fueling stop entry has status = "on_duty_not_driving"

    def test_fuel_stop_duration_is_30_minutes(self):
        # assert: fueling stop entry duration = 0.5 hours (30 minutes)

    def test_fuel_stop_counts_toward_14_hour_window(self):
        # set up trip where fueling stop happens near the 14-hour window
        # assert: fueling stop time is counted inside the 14-hour window
        # assert: it reduces remaining driving time available
```

---

### Test Suite: `Rule7_OneHourPickupAndDropoff`

```python
class Rule7_OneHourPickupAndDropoff(TestCase):

    def test_pickup_logged_as_1_hour_on_duty_not_driving(self):
        # assert: first entry after trip starts is on_duty_not_driving for 1.0 hour
        # assert: it is labeled/noted as "Pickup"

    def test_dropoff_logged_as_1_hour_on_duty_not_driving(self):
        # assert: last entry before trip ends is on_duty_not_driving for 1.0 hour
        # assert: it is labeled/noted as "Dropoff"

    def test_pickup_starts_14_hour_window(self):
        # assert: 14-hour window clock starts at the beginning of the pickup hour
        # assert: NOT when driving begins (which is 1 hour later)

    def test_pickup_and_dropoff_count_toward_cycle_hours(self):
        # input: cycle_hours_used = 68
        # pickup = 1hr + dropoff = 1hr = 2 on-duty hours
        # assert: cycle hours at end = 70
        # assert: warning triggered (at or near the 70hr cap)

    def test_pickup_and_dropoff_both_appear_in_log_remarks(self):
        # assert: remarks section contains an entry for the pickup location
        # assert: remarks section contains an entry for the dropoff location
```

---

## Tech Stack

### Frontend: React
- Interactive Leaflet.js map for location pin selection
- Nominatim reverse geocoding for converting clicked coordinates to readable addresses
- Log sheet rendering: **HTML Canvas** or **SVG** to draw the grid and lines
- Responsive layout, clean UI

### Backend: Django (Python)
- REST API endpoint that accepts coordinates + cycle hours
- Calls OpenRouteService API for route data
- Runs the HOS calculation algorithm
- Returns structured JSON: route coordinates + array of daily log sheet data

### Maps & Geocoding
- **OpenRouteService** — free API for routing (driving distance and time)
- **Leaflet.js** + **react-leaflet** — map rendering and pin placement in React
- **OpenStreetMap tiles** — free map background
- **Nominatim** — free reverse geocoding (coordinates → human-readable address). No API key needed. Endpoint: `https://nominatim.openstreetmap.org/reverse`

### Hosting
- Frontend: **Vercel** (free)
- Backend: **Railway** or **Render** (free tier)
- Database: not required (stateless app — inputs in, outputs out)

---

## API Design

### Endpoint: `POST /api/trip/plan`

**Request body:**
```json
{
  "current_location": { "lat": 41.85, "lng": -87.65, "address": "Chicago, IL" },
  "pickup_location":  { "lat": 38.62, "lng": -90.19, "address": "St. Louis, MO" },
  "dropoff_location": { "lat": 36.16, "lng": -86.78, "address": "Nashville, TN" },
  "cycle_hours_used": 32
}
```

**Response body:**
```json
{
  "route": {
    "total_miles": 470,
    "total_driving_hours": 7.2,
    "coordinates": [[41.85, -87.65], [38.62, -90.19], [36.16, -86.78]],
    "stops": [
      { "type": "pickup", "location": "St. Louis, MO", "lat": 38.62, "lng": -90.19 },
      { "type": "rest", "location": "Near Memphis, TN", "lat": 35.14, "lng": -90.04 },
      { "type": "fuel", "location": "Near Cape Girardeau, MO", "lat": 37.30, "lng": -89.51 },
      { "type": "dropoff", "location": "Nashville, TN", "lat": 36.16, "lng": -86.78 }
    ]
  },
  "cycle_hours_warning": null,
  "logs": [
    {
      "day": 1,
      "date": "2025-06-12",
      "total_miles_today": 320,
      "entries": [
        { "status": "off_duty", "start": "00:00", "end": "06:00" },
        { "status": "on_duty_not_driving", "start": "06:00", "end": "07:00", "location": "Chicago, IL", "note": "Pickup" },
        { "status": "driving", "start": "07:00", "end": "14:00" },
        { "status": "on_duty_not_driving", "start": "14:00", "end": "14:30", "location": "Near St. Louis, MO", "note": "Fueling stop" },
        { "status": "driving", "start": "14:30", "end": "15:30" },
        { "status": "sleeper_berth", "start": "15:30", "end": "23:59" }
      ],
      "totals": {
        "off_duty": 6.0,
        "sleeper_berth": 8.5,
        "driving": 8.0,
        "on_duty_not_driving": 1.5
      },
      "remarks": [
        "Chicago, IL — Start of day / Pickup (On Duty)",
        "Near St. Louis, MO — Fueling stop",
        "Memphis, TN — End of driving window, begin 10hr rest"
      ]
    }
  ]
}
```

---

## Log Sheet Visual Spec

Draw the grid in React using Canvas or SVG:

```
|-------- 24 hours (Midnight to Midnight) --------|
Midnight  2   4   6   8   10  Noon  14  16  18  20  22  Midnight
|---|---|---|---|---|---|---|---|---|---|---|---|---|   OFF DUTY       | 6.0 hrs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|   SLEEPER BERTH  | 8.5 hrs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|   DRIVING        | 8.0 hrs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|   ON DUTY (N.D.) | 1.5 hrs |
                                                       TOTAL:          24.0 hrs
REMARKS:
Chicago, IL — Pickup
St. Louis, MO — Fueling stop
Memphis, TN — 10hr rest begins
```

- Each hour = equal width unit across the grid
- When status is active → draw a solid horizontal line across that row for that time range
- When status changes → draw a vertical line dropping from one row to the next
- Color coding:
  - Off Duty: light gray
  - Sleeper Berth: light blue
  - Driving: dark navy
  - On Duty Not Driving: medium gray

---

## UI/UX Requirements

- Map takes up the full top portion of the page on load
- Step-by-step pin placement with clear instruction prompts
- Summary panel shows all 3 selected locations with human-readable addresses before submitting
- "Change" button on each location in the summary to re-pick that pin
- "Calculate Trip" button disabled until all 3 locations are pinned and cycle hours are entered
- After calculation: map updates with route line and all stop pins
- Log sheets displayed below the map, one per day, scrollable
- Show loading state while backend processes
- Show clear error messages if route fails or locations are invalid
- Mobile-friendly / responsive

---

## Edge Cases to Handle

| Scenario | How to Handle |
|---|---|
| Trip completable in one day | Only 1 log sheet generated |
| Cycle hours + trip hours exceed 70-hour cap | Include `cycle_hours_warning` in response, adjust schedule |
| Trip under 1,000 miles | No fueling stop |
| Trip over 1,000 miles | Insert fueling stop at each 1,000-mile interval |
| Driver starts with 0 cycle hours | Full 70 hours available |
| Clicked location is in the ocean or invalid area | Show error: "Could not resolve a valid driving location. Please click on a road or city." |
| All 3 locations are the same point | Still apply pickup and dropoff 1-hour stops, route distance = 0, no driving segments |

---

## Deliverables Checklist

- [ ] Django backend with HOS calculation logic
- [ ] All 7 test suites written, named after their rules, all tests passing
- [ ] React frontend with map-based location picking (no typed address fields for locations)
- [ ] Nominatim reverse geocoding working (coordinates → readable address)
- [ ] Route map with correct colored pins and route line
- [ ] Log sheet rendering (Canvas or SVG) matching the official form
- [ ] One log sheet generated per day of trip
- [ ] All 7 HOS rules correctly enforced in the algorithm
- [ ] App hosted live (Vercel + Railway/Render)
- [ ] GitHub repository with clean, readable code
- [ ] 3–5 minute Loom video demo

---

## What "Accuracy" Means for the Evaluators

The company will test the hosted app with real trip inputs. They will check:

1. Does the 11-hour driving limit get enforced correctly?
2. Does the 14-hour window cut off driving at the right time?
3. Is the 30-minute break inserted after exactly 8 cumulative driving hours?
4. Does the 10-hour rest appear between days, logged as sleeper berth?
5. Does the current cycle used input actually affect when the driver runs out of hours?
6. Are fueling stops placed at roughly every 1,000 miles?
7. Are pickup and dropoff each logged as 1 hour on-duty not driving?
8. Do all the hours on each log sheet add up to exactly 24?
9. Does the map show the correct route with correct stop markers?
10. Does the number of log sheets match the number of days the trip takes?
11. Do all test suites pass and are they named correctly after each rule?
12. Are locations entered by clicking the map (not typing)?

---

## References

- FMCSA HOS Guide (provided): `fmcsa-hos-395-drivers-guide-to-hos-2022-04-28.pdf`
- Official log form (provided): `blank-paper-log.png`
- OpenRouteService API docs: https://openrouteservice.org/dev/#/api-docs
- Nominatim reverse geocoding: https://nominatim.openstreetmap.org/reverse
- react-leaflet docs: https://react-leaflet.js.org
- Django REST framework: https://www.django-rest-framework.org
