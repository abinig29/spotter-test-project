import "leaflet/dist/leaflet.css";

import type { Marker as LeafletMarker } from "leaflet";
import { useEffect } from "react";
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

import { type PinType, pinIcon } from "@/components/map/pin-icons";
import type { Stop, TripLocation } from "@/lib/api-types";

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
  return (
    <MapContainer
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
                <Tooltip direction="top" offset={[0, -30]}>
                  <span className="font-medium">Current:</span>{" "}
                  {pin.location.address}
                </Tooltip>
              </Marker>
            ))}
          {route.stops.map((stop) => (
            <Marker
              key={`${stop.type}-${stop.lat}-${stop.lng}-${stop.arrival}`}
              position={[stop.lat, stop.lng]}
              icon={pinIcon(stop.type)}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold capitalize">{stop.type}</p>
                  <p>{stop.location}</p>
                  <p>
                    Arrival {stop.arrival} · {stop.duration_hours}h
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
          <FitBounds coordinates={route.coordinates} />
        </>
      )}
    </MapContainer>
  );
}
