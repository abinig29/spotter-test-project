import { afterEach, describe, expect, it, vi } from "vitest";
import { planTrip, TripPlanError } from "@/lib/api";
import type { TripPlanRequest } from "@/lib/api-types";

const REQUEST: TripPlanRequest = {
  current_location: { lat: 41.85, lng: -87.65, address: "Chicago, IL" },
  pickup_location: { lat: 40, lng: -88, address: "Pickupville, IL" },
  dropoff_location: { lat: 36.16, lng: -86.78, address: "Nashville, TN" },
  cycle_hours_used: 10,
};

const SAMPLE = {
  route: {
    total_miles: 470,
    total_driving_hours: 7.2,
    coordinates: [[41.85, -87.65]],
    stops: [],
  },
  cycle_hours_warning: null,
  logs: [],
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

describe("planTrip", () => {
  it("returns the parsed plan on 200", async () => {
    stubFetch(200, SAMPLE);
    const result = await planTrip(REQUEST);
    expect(result.route.total_miles).toBe(470);
  });

  it("maps 503 to a not_configured error", async () => {
    stubFetch(503, { error: "Routing not configured." });
    await expect(planTrip(REQUEST)).rejects.toMatchObject({
      kind: "not_configured",
    });
  });

  it("maps 422 to an unroutable error with the PRD message", async () => {
    stubFetch(422, { error: "x" });
    await expect(planTrip(REQUEST)).rejects.toMatchObject({
      kind: "unroutable",
      message:
        "Could not resolve a valid driving location. Please click on a road or city.",
    });
  });

  it("maps 502 to a service error", async () => {
    stubFetch(502, { error: "x" });
    await expect(planTrip(REQUEST)).rejects.toMatchObject({ kind: "service" });
  });

  it("maps a thrown fetch to a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    await expect(planTrip(REQUEST)).rejects.toBeInstanceOf(TripPlanError);
  });
});
