const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  "ISO3166-2-lvl4"?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

export function fallbackLabel(lat: number, lng: number): string {
  return `Near ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

export function parseAddress(data: NominatimResponse, lat: number, lng: number): string {
  const address = data.address ?? {};
  const city = address.city || address.town || address.village || address.county;
  const iso = address["ISO3166-2-lvl4"];
  const stateCode = iso && iso.includes("-") ? iso.split("-").pop() : undefined;
  const label = stateCode || address.state;
  if (city && label) return `${city}, ${label}`;
  if (city) return city;
  if (data.display_name) return data.display_name.split(",")[0] ?? fallbackLabel(lat, lng);
  return fallbackLabel(lat, lng);
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return fallbackLabel(lat, lng);
    return parseAddress((await response.json()) as NominatimResponse, lat, lng);
  } catch {
    return fallbackLabel(lat, lng);
  }
}
