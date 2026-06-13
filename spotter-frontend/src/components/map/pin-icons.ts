import L from "leaflet";

export const PIN_COLORS = {
  current: "#2563eb", // blue
  pickup: "#16a34a", // green
  dropoff: "#dc2626", // red
  rest: "#f97316", // orange
  fuel: "#eab308", // yellow
} as const;

export type PinType = keyof typeof PIN_COLORS;

export function pinIcon(type: PinType): L.DivIcon {
  const color = PIN_COLORS[type];
  const html = `
    <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 21 13 21s13-11.75 13-21C26 5.82 20.18 0 13 0z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="0.75"/>
      <circle cx="13" cy="13" r="5" fill="white"/>
    </svg>`;
  return L.divIcon({
    className: "spotter-pin",
    html,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  });
}
