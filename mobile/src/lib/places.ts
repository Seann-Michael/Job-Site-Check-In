/**
 * Google Places autocomplete + Street View, matching the web app's
 * address-search flow (AdminAddProject). Needs EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
 * without it the new-job form falls back to manual address entry.
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export const isPlacesConfigured = API_KEY.length > 10;

export interface AddressSuggestion {
  placeId: string;
  description: string;
}

export interface PlaceDetails {
  street: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  formatted: string;
}

export async function autocompleteAddress(query: string): Promise<AddressSuggestion[]> {
  if (!isPlacesConfigured || query.trim().length < 3) return [];
  try {
    const url =
      'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
      `?input=${encodeURIComponent(query)}&types=address&components=country:us&key=${API_KEY}`;
    const response = await fetch(url);
    const json = (await response.json()) as {
      status?: string;
      predictions?: { place_id: string; description: string }[];
    };
    if (json.status !== 'OK' || !json.predictions) return [];
    return json.predictions
      .slice(0, 5)
      .map((p) => ({ placeId: p.place_id, description: p.description }));
  } catch {
    return [];
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | undefined> {
  if (!isPlacesConfigured) return undefined;
  try {
    const url =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(placeId)}&fields=address_component,formatted_address,geometry&key=${API_KEY}`;
    const response = await fetch(url);
    const json = (await response.json()) as {
      status?: string;
      result?: {
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        address_components?: { long_name: string; short_name: string; types: string[] }[];
      };
    };
    if (json.status !== 'OK' || !json.result) return undefined;

    const components = json.result.address_components ?? [];
    const part = (type: string, short = false) => {
      const match = components.find((c) => c.types.includes(type));
      return match ? (short ? match.short_name : match.long_name) : '';
    };
    const streetNumber = part('street_number');
    const route = part('route');
    return {
      street: [streetNumber, route].filter(Boolean).join(' '),
      city: part('locality') || part('sublocality') || part('postal_town'),
      state: part('administrative_area_level_1', true),
      zip: part('postal_code'),
      latitude: json.result.geometry?.location?.lat,
      longitude: json.result.geometry?.location?.lng,
      formatted: json.result.formatted_address ?? '',
    };
  } catch {
    return undefined;
  }
}

/** Street View Static API preview for a captured address. */
export function streetViewImageUrl(latitude: number, longitude: number): string | undefined {
  if (!isPlacesConfigured) return undefined;
  return (
    'https://maps.googleapis.com/maps/api/streetview' +
    `?size=640x320&location=${latitude},${longitude}&fov=80&key=${API_KEY}`
  );
}

/** Business (establishment) autocomplete, for connecting a GMB profile. */
export async function searchBusinesses(query: string): Promise<AddressSuggestion[]> {
  if (!isPlacesConfigured || query.trim().length < 3) return [];
  try {
    const url =
      'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
      `?input=${encodeURIComponent(query)}&types=establishment&components=country:us&key=${API_KEY}`;
    const response = await fetch(url);
    const json = (await response.json()) as {
      status?: string;
      predictions?: { place_id: string; description: string }[];
    };
    if (json.status !== 'OK' || !json.predictions) return [];
    return json.predictions
      .slice(0, 5)
      .map((p) => ({ placeId: p.place_id, description: p.description }));
  } catch {
    return [];
  }
}

/** The Places fields the web GMB connect/scan flow reads. */
export interface BusinessDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  has_opening_hours: boolean;
  photo_urls: string[];
  latitude?: number;
  longitude?: number;
  google_url?: string;
}

export async function getBusinessDetails(placeId: string): Promise<BusinessDetails | undefined> {
  if (!isPlacesConfigured) return undefined;
  try {
    const fields =
      'place_id,name,formatted_address,formatted_phone_number,website,rating,' +
      'user_ratings_total,types,opening_hours,photos,geometry,url';
    const url =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${API_KEY}`;
    const response = await fetch(url);
    const json = (await response.json()) as {
      status?: string;
      result?: Record<string, unknown>;
    };
    if (json.status !== 'OK' || !json.result) return undefined;
    const r = json.result;
    const photos = Array.isArray(r.photos) ? (r.photos as { photo_reference?: string }[]) : [];
    const geometry = (r.geometry ?? {}) as { location?: { lat?: number; lng?: number } };
    return {
      place_id: String(r.place_id ?? placeId),
      name: String(r.name ?? ''),
      formatted_address: typeof r.formatted_address === 'string' ? r.formatted_address : undefined,
      formatted_phone_number:
        typeof r.formatted_phone_number === 'string' ? r.formatted_phone_number : undefined,
      website: typeof r.website === 'string' ? r.website : undefined,
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      user_ratings_total: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : undefined,
      types: Array.isArray(r.types) ? (r.types as string[]) : undefined,
      has_opening_hours: Boolean(r.opening_hours),
      photo_urls: photos
        .filter((p) => typeof p.photo_reference === 'string')
        .slice(0, 5)
        .map(
          (p) =>
            'https://maps.googleapis.com/maps/api/place/photo' +
            `?maxwidth=800&photo_reference=${p.photo_reference}&key=${API_KEY}`,
        ),
      latitude: geometry.location?.lat,
      longitude: geometry.location?.lng,
      google_url: typeof r.url === 'string' ? r.url : undefined,
    };
  } catch {
    return undefined;
  }
}
