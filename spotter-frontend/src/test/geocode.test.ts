import { describe, expect, it } from "vitest";
import { fallbackLabel, parseAddress } from "@/lib/geocode";

describe("geocode helpers", () => {
  it("formats city + state code from ISO", () => {
    const data = {
      address: {
        city: "St. Louis",
        state: "Missouri",
        "ISO3166-2-lvl4": "US-MO",
      },
    };
    expect(parseAddress(data, 38.6, -90.2)).toBe("St. Louis, MO");
  });

  it("falls back to town + state name", () => {
    const data = { address: { town: "Cape Girardeau", state: "Missouri" } };
    expect(parseAddress(data, 37.3, -89.5)).toBe("Cape Girardeau, Missouri");
  });

  it("uses coordinate fallback when no address", () => {
    expect(parseAddress({}, 35.14, -90.04)).toBe("Near 35.14, -90.04");
  });

  it("fallbackLabel formats two decimals", () => {
    expect(fallbackLabel(35.1437, -90.0449)).toBe("Near 35.14, -90.04");
  });
});
