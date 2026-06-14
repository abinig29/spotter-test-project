import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TripLocation } from "@/lib/api-types";

export type PinKey = "current" | "pickup" | "dropoff";
export type Step = PinKey | "complete";

const ORDER: PinKey[] = ["current", "pickup", "dropoff"];

interface TripState {
  step: Step;
  current?: TripLocation;
  pickup?: TripLocation;
  dropoff?: TripLocation;
  cycleHoursUsed: number;
  placePin: (location: TripLocation) => void;
  changePin: (which: PinKey) => void;
  back: () => void;
  setCycleHours: (value: number) => void;
  reset: () => void;
}

const STEPS: Step[] = ["current", "pickup", "dropoff", "complete"];

function nextStep(pins: Pick<TripState, PinKey>): Step {
  for (const key of ORDER) {
    if (!pins[key]) return key;
  }
  return "complete";
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      step: "current",
      cycleHoursUsed: 0,
      placePin: (location) =>
        set((state) => {
          const active: PinKey =
            state.step === "complete" ? "current" : state.step;
          const pins = {
            current: state.current,
            pickup: state.pickup,
            dropoff: state.dropoff,
            [active]: location,
          };
          return {
            [active]: location,
            step: nextStep(pins),
          } as Partial<TripState>;
        }),
      changePin: (which) =>
        set({ [which]: undefined, step: which } as Partial<TripState>),
      back: () =>
        set((state) => {
          const index = STEPS.indexOf(state.step);
          return { step: STEPS[Math.max(0, index - 1)] };
        }),
      setCycleHours: (value) => set({ cycleHoursUsed: value }),
      reset: () =>
        set({
          step: "current",
          current: undefined,
          pickup: undefined,
          dropoff: undefined,
          cycleHoursUsed: 0,
        }),
    }),
    {
      name: "spotter-trip",
      storage: createJSONStorage(() => localStorage),
      // Persist only the user's in-progress inputs, not the action functions.
      partialize: (state) => ({
        step: state.step,
        current: state.current,
        pickup: state.pickup,
        dropoff: state.dropoff,
        cycleHoursUsed: state.cycleHoursUsed,
      }),
    },
  ),
);

export function selectIsReady(state: TripState): boolean {
  return (
    !!state.current &&
    !!state.pickup &&
    !!state.dropoff &&
    Number.isFinite(state.cycleHoursUsed) &&
    state.cycleHoursUsed >= 0 &&
    state.cycleHoursUsed <= 70
  );
}
