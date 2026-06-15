import type { TripLocation } from "@/lib/api-types";

/**
 * A curated trip preset that fills the wizard so the real routing + HOS flow
 * can be exercised in one click. Each scenario is named after the HOS rule it
 * is meant to surface (see `spotter-backend/tests/hos/`). Because the route is
 * computed live by OpenRouteService, the resulting miles/hours are approximate
 * — the scenarios are chosen so the route lands in the right ballpark for the
 * behaviour described in `observe`, not to reproduce exact test assertions.
 */
export interface Scenario {
  id: string;
  title: string;
  /** Short label tying the scenario back to the HOS test suite. */
  rule: string;
  /** What you should see in the result screen for this scenario. */
  observe: string;
  current: TripLocation;
  pickup: TripLocation;
  dropoff: TripLocation;
  cycleHoursUsed: number;
}

// Real city coordinates so scenarios fill instantly without geocoding.
const CHICAGO: TripLocation = {
  lat: 41.8781,
  lng: -87.6298,
  address: "Chicago, IL",
};
const INDIANAPOLIS: TripLocation = {
  lat: 39.7684,
  lng: -86.1581,
  address: "Indianapolis, IN",
};
const NEW_YORK: TripLocation = {
  lat: 40.7128,
  lng: -74.006,
  address: "New York, NY",
};
const ATLANTA: TripLocation = {
  lat: 33.749,
  lng: -84.388,
  address: "Atlanta, GA",
};
const WASHINGTON_DC: TripLocation = {
  lat: 38.9072,
  lng: -77.0369,
  address: "Washington, DC",
};
const LOS_ANGELES: TripLocation = {
  lat: 34.0522,
  lng: -118.2437,
  address: "Los Angeles, CA",
};
const DALLAS: TripLocation = {
  lat: 32.7767,
  lng: -96.797,
  address: "Dallas, TX",
};
const ST_LOUIS: TripLocation = {
  lat: 38.627,
  lng: -90.1994,
  address: "St. Louis, MO",
};
const SACRAMENTO: TripLocation = {
  lat: 38.5816,
  lng: -121.4944,
  address: "Sacramento, CA",
};
const SAN_FRANCISCO: TripLocation = {
  lat: 37.7749,
  lng: -122.4194,
  address: "San Francisco, CA",
};

// Nearby origin suburbs, so every scenario has a short current -> pickup leg
// (~10-40 mi) rather than starting at the pickup itself.
const NAPERVILLE: TripLocation = {
  lat: 41.7508,
  lng: -88.1535,
  address: "Naperville, IL",
};
const JOLIET: TripLocation = {
  lat: 41.525,
  lng: -88.0817,
  address: "Joliet, IL",
};
const NEWARK: TripLocation = {
  lat: 40.7357,
  lng: -74.1724,
  address: "Newark, NJ",
};
const MARIETTA: TripLocation = {
  lat: 33.9526,
  lng: -84.5499,
  address: "Marietta, GA",
};
const LONG_BEACH: TripLocation = {
  lat: 33.7701,
  lng: -118.1937,
  address: "Long Beach, CA",
};
const PASADENA: TripLocation = {
  lat: 34.1478,
  lng: -118.1445,
  address: "Pasadena, CA",
};

export const SCENARIOS: Scenario[] = [
  {
    id: "simple-one-day",
    title: "Simple one-day trip",
    rule: "Engine",
    observe: "Single log sheet, no rest break, ~3h driving under every limit.",
    current: NAPERVILLE,
    pickup: CHICAGO,
    dropoff: INDIANAPOLIS,
    cycleHoursUsed: 0,
  },
  {
    id: "eleven-hour-cap",
    title: "11-hour driving cap",
    rule: "Rule 1",
    observe:
      "Driving caps at 11h on day 1, followed by a 10-hour sleeper rest.",
    current: NEWARK,
    pickup: NEW_YORK,
    dropoff: CHICAGO,
    cycleHoursUsed: 0,
  },
  {
    id: "thirty-minute-break",
    title: "30-minute rest break",
    rule: "Rule 3",
    observe: "More than 8h of driving forces a mid-day 30-minute break.",
    current: MARIETTA,
    pickup: ATLANTA,
    dropoff: WASHINGTON_DC,
    cycleHoursUsed: 0,
  },
  {
    id: "fuel-stops",
    title: "Fuel stop every 1000 mi",
    rule: "Rule 6",
    observe:
      "Long haul inserts fuel stops every ~1000 miles across multiple days.",
    current: LONG_BEACH,
    pickup: LOS_ANGELES,
    dropoff: DALLAS,
    cycleHoursUsed: 0,
  },
  {
    id: "cross-country",
    title: "Cross-country multi-day",
    rule: "Rules 1–6",
    observe: "Several days of logs with repeated fuel + 10-hour rest stops.",
    current: PASADENA,
    pickup: LOS_ANGELES,
    dropoff: NEW_YORK,
    cycleHoursUsed: 0,
  },
  {
    id: "near-cycle-limit",
    title: "Near 70-hour cycle limit",
    rule: "Rule 5",
    observe:
      "Starting at 65h used, a cycle-hours warning fires before the 70h cap.",
    current: JOLIET,
    pickup: CHICAGO,
    dropoff: ST_LOUIS,
    cycleHoursUsed: 65,
  },
  {
    id: "pickup-dropoff-legs",
    title: "Distinct pickup & dropoff legs",
    rule: "Rule 7",
    observe:
      "Three separate locations show a 1-hour pickup and 1-hour dropoff on duty.",
    current: SACRAMENTO,
    pickup: SAN_FRANCISCO,
    dropoff: LOS_ANGELES,
    cycleHoursUsed: 0,
  },
];
