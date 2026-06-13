import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

describe("env", () => {
  it("provides an API base URL", () => {
    expect(typeof env.VITE_API_BASE_URL).toBe("string");
    expect(env.VITE_API_BASE_URL.length).toBeGreaterThan(0);
  });
});
