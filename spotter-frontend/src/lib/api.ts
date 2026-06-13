import type { TripPlanRequest, TripPlanResponse } from "@/lib/api-types";
import { env } from "@/lib/env";

export type TripPlanErrorKind =
  | "not_configured"
  | "unroutable"
  | "service"
  | "validation"
  | "network";

const MESSAGES: Record<TripPlanErrorKind, string> = {
  not_configured: "Routing isn't configured yet.",
  unroutable:
    "Could not resolve a valid driving location. Please click on a road or city.",
  service: "Routing service unavailable — please try again.",
  validation: "Please check the locations and cycle hours.",
  network: "Network error — please try again.",
};

export class TripPlanError extends Error {
  kind: TripPlanErrorKind;
  constructor(kind: TripPlanErrorKind) {
    super(MESSAGES[kind]);
    this.name = "TripPlanError";
    this.kind = kind;
  }
}

function kindForStatus(status: number): TripPlanErrorKind {
  if (status === 503) return "not_configured";
  if (status === 422) return "unroutable";
  if (status === 400) return "validation";
  return "service";
}

export async function planTrip(
  request: TripPlanRequest,
): Promise<TripPlanResponse> {
  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_BASE_URL}/api/trip/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new TripPlanError("network");
  }
  if (!response.ok) {
    throw new TripPlanError(kindForStatus(response.status));
  }
  return (await response.json()) as TripPlanResponse;
}
