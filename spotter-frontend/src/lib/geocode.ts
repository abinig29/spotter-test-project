const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

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

interface NominatimSearchItem extends NominatimResponse {
  lat: string;
  lon: string;
}

export interface AddressResult {
  lat: number;
  lng: number;
  /** Short label, e.g. "Chicago, IL". */
  label: string;
  /** Full address line for disambiguation. */
  detail: string;
}

export function fallbackLabel(lat: number, lng: number): string {
  return `Near ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

export function parseAddress(
  data: NominatimResponse,
  lat: number,
  lng: number,
): string {
  const address = data.address ?? {};
  const city =
    address.city || address.town || address.village || address.county;
  const iso = address["ISO3166-2-lvl4"];
  const stateCode = iso?.includes("-") ? iso.split("-").pop() : undefined;
  const label = stateCode || address.state;
  if (city && label) return `${city}, ${label}`;
  if (city) return city;
  if (data.display_name)
    return data.display_name.split(",")[0] ?? fallbackLabel(lat, lng);
  return fallbackLabel(lat, lng);
}

/**
 * Forward-geocode a free-text query into ranked address candidates (US-biased).
 * Returns [] for short/blank queries or on any failure — callers treat search as
 * best-effort and always keep map-click placement available.
 */
export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(
      q,
    )}&format=jsonv2&addressdetails=1&limit=6&countrycodes=us`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return [];
    const items = (await response.json()) as NominatimSearchItem[];
    return items.map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      return {
        lat,
        lng,
        label: parseAddress(item, lat, lng),
        detail: item.display_name ?? fallbackLabel(lat, lng),
      };
    });
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallbackLabel(lat, lng);
    return parseAddress((await response.json()) as NominatimResponse, lat, lng);
  } catch {
    return fallbackLabel(lat, lng);
  }
}
