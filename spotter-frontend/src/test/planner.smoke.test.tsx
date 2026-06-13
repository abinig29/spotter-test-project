import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/routes/home";
import { useTripStore } from "@/store/trip-store";

// Leaflet needs DOM APIs jsdom lacks; stub the map module to a placeholder.
vi.mock("@/components/map/trip-map", () => ({
  TripMap: () => <div data-testid="trip-map" />,
}));

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

beforeEach(() => useTripStore.getState().reset());

describe("TripPlanner page", () => {
  it("renders the first placement step", () => {
    renderPage();
    expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByTestId("trip-map")).toBeInTheDocument();
  });
});
