import { beforeEach, describe, expect, it } from "vitest";
import { selectIsReady, useTripStore } from "@/store/trip-store";

const loc = (lat: number, lng: number) => ({
  lat,
  lng,
  address: `${lat},${lng}`,
});

beforeEach(() => useTripStore.getState().reset());

describe("trip store", () => {
  it("advances the step machine as pins are placed", () => {
    const s = useTripStore.getState();
    expect(s.step).toBe("current");
    s.placePin(loc(1, 1));
    expect(useTripStore.getState().step).toBe("pickup");
    useTripStore.getState().placePin(loc(2, 2));
    expect(useTripStore.getState().step).toBe("dropoff");
    useTripStore.getState().placePin(loc(3, 3));
    expect(useTripStore.getState().step).toBe("complete");
  });

  it("changePin clears that pin and re-enters its step", () => {
    const s = useTripStore.getState();
    s.placePin(loc(1, 1));
    s.placePin(loc(2, 2));
    s.placePin(loc(3, 3));
    useTripStore.getState().changePin("pickup");
    expect(useTripStore.getState().pickup).toBeUndefined();
    expect(useTripStore.getState().step).toBe("pickup");
    useTripStore.getState().placePin(loc(9, 9));
    expect(useTripStore.getState().step).toBe("complete");
  });

  it("isReady requires three pins and valid cycle hours", () => {
    const s = useTripStore.getState();
    expect(selectIsReady(useTripStore.getState())).toBe(false);
    s.placePin(loc(1, 1));
    s.placePin(loc(2, 2));
    s.placePin(loc(3, 3));
    expect(selectIsReady(useTripStore.getState())).toBe(true);
    useTripStore.getState().setCycleHours(80);
    expect(selectIsReady(useTripStore.getState())).toBe(false);
  });
});
