import "leaflet/dist/leaflet.css";

import type {
  LatLngBoundsExpression,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";
import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { PIN_COLORS, type PinType, pinIcon } from "@/components/map/pin-icons";
import type { Stop, TripLocation } from "@/lib/api-types";

/** Human-readable pin labels for map popups (per PRD route-map spec). */
const STOP_LABEL: Record<PinType, string> = {
  current: "Start",
  pickup: "Pickup",
  dropoff: "Dropoff",
  rest: "10hr Rest",
  fuel: "Fuel",
};

/** Popup body shared by every route pin: type, location, arrival + duration. */
function StopPopup({
  type,
  location,
  arrival,
  durationHours,
  day,
}: {
  type: PinType;
  location: string;
  arrival?: string;
  durationHours?: number;
  day?: number;
}) {
  const parts = [
    day ? `Day ${day}` : null,
    arrival ? arrival : null,
    durationHours ? `${durationHours}h` : null,
  ].filter(Boolean);

  return (
    <div className="min-w-[130px] max-w-[190px] px-2.5 py-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: PIN_COLORS[type] }}
      >
        {STOP_LABEL[type]}
      </p>
      <p className="text-[12px] font-medium leading-snug text-foreground">
        {location}
      </p>
      {parts.length > 0 && (
        <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {parts.join(" · ")}
        </p>
      )}
    </div>
  );
}

export interface CandidateMarker {
  lat: number;
  lng: number;
  type: PinType;
}

const US_CENTER: [number, number] = [39.5, -98.35];

export interface MapPin {
  type: PinType;
  label: string;
  location: TripLocation;
}

export interface MapRoute {
  coordinates: [number, number][];
  stops: Stop[];
}

/** A stop the user selected elsewhere (e.g. the route-stops list) to focus. */
export interface FocusStop {
  lat: number;
  lng: number;
  key: string;
}

export const CURRENT_KEY = "current";

/** Stable marker key shared by the map markers and the route-stops list. */
export function stopKey(stop: Stop): string {
  return `${stop.type}-${stop.lat}-${stop.lng}-${stop.arrival}`;
}

interface TripMapProps {
  pins: MapPin[];
  interactive: boolean;
  onPick: (lat: number, lng: number) => void;
  route?: MapRoute;
  /** When set/changed, the map flies to this coordinate (used by address search). */
  focus?: [number, number] | null;
  /** A draggable, not-yet-confirmed location for the active step. */
  candidate?: CandidateMarker | null;
  onCandidateDrag?: (lat: number, lng: number) => void;
  /** When set/changed, fly to this stop and open its popup. */
  focusStop?: FocusStop | null;
}

function RecenterOnFocus({ focus }: { focus?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo(focus, Math.max(map.getZoom(), 11), { duration: 0.8 });
    }
  }, [focus, map]);
  return null;
}

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [40, 40] });
    } else if (coordinates.length === 1) {
      const first = coordinates[0];
      if (first) map.setView(first, 9);
    }
  }, [coordinates, map]);
  return null;
}

export function TripMap({
  pins,
  interactive,
  onPick,
  route,
  focus,
  candidate,
  onCandidateDrag,
  focusStop,
}: TripMapProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const markerRefs = useRef<Record<string, LeafletMarker | null>>({});

  // Selecting a stop in the route-stops list flies to it and opens its popup.
  useEffect(() => {
    if (!map || !focusStop) return;
    map.flyTo([focusStop.lat, focusStop.lng], Math.max(map.getZoom(), 12), {
      duration: 0.6,
    });
    markerRefs.current[focusStop.key]?.openPopup();
  }, [map, focusStop]);

  // Bounds to snap back to: the full route, or any placed/candidate pins.
  const recenterBounds: LatLngBoundsExpression | null =
    route && route.coordinates.length > 0
      ? route.coordinates
      : (() => {
          const points: [number, number][] = pins.map((p) => [
            p.location.lat,
            p.location.lng,
          ]);
          if (candidate) points.push([candidate.lat, candidate.lng]);
          return points.length > 0 ? points : null;
        })();

  const recenter = useCallback(() => {
    if (!map || !recenterBounds) return;
    map.fitBounds(recenterBounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, recenterBounds]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        ref={setMap}
        center={US_CENTER}
        zoom={4}
        className="h-full w-full bg-muted [&_.leaflet-control-attribution]:bg-card/80 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:text-muted-foreground [&_.spotter-pin]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
        style={{ cursor: interactive ? "crosshair" : "grab" }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {interactive && <ClickHandler onPick={onPick} />}
        <RecenterOnFocus focus={focus} />

        {!route &&
          pins.map((pin) => (
            <Marker
              key={pin.type}
              position={[pin.location.lat, pin.location.lng]}
              icon={pinIcon(pin.type)}
            >
              <Tooltip direction="top" offset={[0, -30]}>
                <span className="font-medium">{pin.label}:</span>{" "}
                {pin.location.address}
              </Tooltip>
            </Marker>
          ))}

        {!route && candidate && (
          <Marker
            position={[candidate.lat, candidate.lng]}
            icon={pinIcon(candidate.type)}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as LeafletMarker).getLatLng();
                onCandidateDrag?.(lat, lng);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -30]}>
              Drag to fine-tune, then confirm
            </Tooltip>
          </Marker>
        )}

        {route && (
          <>
            <Polyline
              positions={route.coordinates}
              pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }}
            />
            {pins
              .filter((pin) => pin.type === "current")
              .map((pin) => (
                <Marker
                  key={CURRENT_KEY}
                  ref={(m) => {
                    markerRefs.current[CURRENT_KEY] = m;
                  }}
                  position={[pin.location.lat, pin.location.lng]}
                  icon={pinIcon("current")}
                >
                  <Popup>
                    <StopPopup type="current" location={pin.location.address} />
                  </Popup>
                </Marker>
              ))}
            {route.stops.map((stop) => {
              const key = stopKey(stop);
              return (
                <Marker
                  key={key}
                  ref={(m) => {
                    markerRefs.current[key] = m;
                  }}
                  position={[stop.lat, stop.lng]}
                  icon={pinIcon(stop.type)}
                >
                  <Popup>
                    <StopPopup
                      type={stop.type}
                      location={stop.location}
                      arrival={stop.arrival}
                      durationHours={stop.duration_hours}
                      day={stop.day}
                    />
                  </Popup>
                </Marker>
              );
            })}
            <FitBounds coordinates={route.coordinates} />
          </>
        )}
      </MapContainer>

      {/* Sits directly under Leaflet's zoom +/- control (top-left). */}
      {recenterBounds && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter map"
          title="Recenter map"
          className="absolute top-[80px] left-[10px] z-1000 inline-flex size-[30px] items-center justify-center rounded-[4px] border-2 border-black/20 bg-white text-[#333] transition-colors hover:bg-[#f4f4f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LocateFixed className="size-[15px]" />
        </button>
      )}
    </div>
  );
}
