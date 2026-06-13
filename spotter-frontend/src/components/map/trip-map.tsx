import "leaflet/dist/leaflet.css";

import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";

import { type PinType, pinIcon } from "@/components/map/pin-icons";
import type { TripLocation } from "@/lib/api-types";

const US_CENTER: [number, number] = [39.5, -98.35];

export interface MapPin {
  type: PinType;
  label: string;
  location: TripLocation;
}

interface TripMapProps {
  pins: MapPin[];
  interactive: boolean;
  onPick: (lat: number, lng: number) => void;
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

export function TripMap({ pins, interactive, onPick }: TripMapProps) {
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
      {pins.map((pin) => (
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
    </MapContainer>
  );
}
