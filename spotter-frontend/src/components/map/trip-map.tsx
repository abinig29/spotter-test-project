import "leaflet/dist/leaflet.css";

import type {
  LatLngBoundsExpression,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";
import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
}: {
  type: PinType;
  location: string;
  arrival?: string;
  durationHours?: number;
}) {
  return (
    <div className="text-xs leading-snug">
      <p className="flex items-center gap-1.5 font-semibold">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: PIN_COLORS[type] }}
        />
        {STOP_LABEL[type]}
      </p>
      <p className="mt-0.5 text-foreground">{location}</p>
      {arrival && (
        <p className="mt-0.5 font-mono text-muted-foreground tabular-nums">
          Arrive {arrival}
          {durationHours ? ` · ${durationHours}h stop` : ""}
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
}: TripMapProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);

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
        className="h-full w-full bg-muted [&_.leaflet-control-attribution]:bg-card/80 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:text-muted-foreground [&_.spotter-pin]:drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
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
                  key="current"
                  position={[pin.location.lat, pin.location.lng]}
                  icon={pinIcon("current")}
                >
                  <Popup>
                    <StopPopup type="current" location={pin.location.address} />
                  </Popup>
                </Marker>
              ))}
            {route.stops.map((stop) => (
              <Marker
                key={`${stop.type}-${stop.lat}-${stop.lng}-${stop.arrival}`}
                position={[stop.lat, stop.lng]}
                icon={pinIcon(stop.type)}
              >
                <Popup>
                  <StopPopup
                    type={stop.type}
                    location={stop.location}
                    arrival={stop.arrival}
                    durationHours={stop.duration_hours}
                  />
                </Popup>
              </Marker>
            ))}
            <FitBounds coordinates={route.coordinates} />
          </>
        )}
      </MapContainer>

      {recenterBounds && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter map"
          title="Recenter map"
          className="absolute top-3 right-3 z-1000 inline-flex size-9 items-center justify-center rounded-md border border-border bg-card/95 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LocateFixed className="size-4" />
        </button>
      )}
    </div>
  );
}
