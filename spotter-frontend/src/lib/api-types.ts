export type DutyStatus =
  | "off_duty"
  | "sleeper_berth"
  | "driving"
  | "on_duty_not_driving";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripLocation extends LatLng {
  address: string;
}

export interface Stop {
  type: "pickup" | "fuel" | "rest" | "dropoff";
  location: string;
  lat: number;
  lng: number;
  arrival: string;
  duration_hours: number;
}

export interface LogEntry {
  status: DutyStatus;
  start: string;
  end: string;
  location?: string;
  note?: string;
}

export interface DayLog {
  day: number;
  date: string;
  total_miles_today: number;
  entries: LogEntry[];
  totals: Record<DutyStatus, number>;
  remarks: string[];
}

export interface TripPlanResponse {
  route: {
    total_miles: number;
    total_driving_hours: number;
    coordinates: [number, number][];
    stops: Stop[];
  };
  cycle_hours_warning: string | null;
  logs: DayLog[];
}

export interface TripPlanRequest {
  current_location: TripLocation;
  pickup_location: TripLocation;
  dropoff_location: TripLocation;
  cycle_hours_used: number;
}
