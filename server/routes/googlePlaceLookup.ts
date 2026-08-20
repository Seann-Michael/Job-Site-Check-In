import { Request, Response } from "express";
import { getEnv } from "../lib/env";
import { logger } from "../lib/logger";
import { assertSafeUrl, GOOGLE_MAPS_HOSTS, resolveFinalUrl, SafeFetchError } from "../lib/safeFetch";

const log = logger.child({ module: "googlePlaceLookup" });

function apiKey(): string {
  return getEnv("GOOGLE_MAPS_API_KEY") || "";
}

/** Follow redirects to expand a short Google Maps URL (allowlisted hosts only). */
async function resolveUrl(url: string): Promise<string> {
  return resolveFinalUrl(url, {
    allowedHosts: GOOGLE_MAPS_HOSTS,
    maxRedirects: 5,
    timeoutMs: 8000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PlaceLookup/1.0)" },
  });
}

/** Extract the CID (decimal string) from a full Google Maps URL */
function extractCid(url: string): string | null {
  const m = url.match(/!1s0x[a-f0-9]+:0x([a-f0-9]+)/i);
  if (m) {
    try {
      return BigInt("0x" + m[1]).toString();
    } catch {
      return null;
    }
  }
  return null;
}

/** Extract business name and coordinates from a full Google Maps URL */
function extractMapsInfo(url: string): {
  name: string | null;
  lat: number | null;
  lng: number | null;
} {
  let name: string | null = null;
  const nameM = url.match(/\/place\/([^/@?]+)/);
  if (nameM) name = decodeURIComponent(nameM[1].replace(/\+/g, " "));

  let lat: number | null = null;
  let lng: number | null = null;
  const coordM = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordM) {
    lat = parseFloat(coordM[1]);
    lng = parseFloat(coordM[2]);
  }
  return { name, lat, lng };
}

/** Geocoding API: CID → standard place_id */
async function placeIdFromCid(cid: string): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=cid:${cid}&key=${apiKey()}`;
  const resp = await fetch(url);
  const data: any = await resp.json();
  return data?.results?.[0]?.place_id ?? null;
}

/** Places Find Place from Text: name + optional location → place_id */
async function findPlaceId(
  name: string,
  lat: number | null,
  lng: number | null,
): Promise<string | null> {
  let locationBias = "";
  if (lat !== null && lng !== null)
    locationBias = `&locationbias=point:${lat},${lng}`;

  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(name)}&inputtype=textquery` +
    `&fields=place_id${locationBias}&key=${apiKey()}`;
  const resp = await fetch(url);
  const data: any = await resp.json();
  return data?.candidates?.[0]?.place_id ?? null;
}

/** Places Details: place_id → full business info */
async function getPlaceDetails(placeId: string): Promise<any | null> {
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "business_status",
    "types",
    "rating",
    "user_ratings_total",
    "formatted_phone_number",
    "website",
    "opening_hours",
    "geometry",
    "url",
    "price_level",
  ].join(",");

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=${fields}&key=${apiKey()}`;
  const resp = await fetch(url);
  const data: any = await resp.json();
  if (data.status !== "OK" || !data.result) return null;
  return data.result;
}

/**
 * POST /api/google-place-lookup
 * Body: { url: string }
 * Accepts any Google Maps URL format and returns the business profile.
 */
export async function handleGooglePlaceLookup(req: Request, res: Response) {
  if (!apiKey()) {
    return res.status(503).json({ error: "Google Maps lookup is not configured" });
  }

  const { url } = req.body as { url?: string };

  if (!url || typeof url !== "string" || url.length > 2048) {
    return res.status(400).json({ error: "Missing or invalid url in request body" });
  }

  try {
    // 1. Validate host and expand short URLs. Every hop must stay on a
    //    Google Maps host and resolve to a public address.
    let fullUrl: string;
    try {
      const parsed = await assertSafeUrl(url, { allowedHosts: GOOGLE_MAPS_HOSTS });
      const host = parsed.hostname.toLowerCase();
      const isShort = host === "maps.app.goo.gl" || host === "goo.gl" || host === "share.google" || host === "g.page";
      fullUrl = isShort ? await resolveUrl(parsed.href) : parsed.href;
    } catch (e) {
      if (e instanceof SafeFetchError) {
        return res.status(400).json({ error: "Please paste a valid Google Maps link" });
      }
      throw e;
    }

    // 2. Try CID path (most precise — CID uniquely identifies the business)
    const cid = extractCid(fullUrl);
    let placeId: string | null = null;

    if (cid) {
      placeId = await placeIdFromCid(cid);
    }

    // 3. Fallback: name + coordinates
    if (!placeId) {
      const { name, lat, lng } = extractMapsInfo(fullUrl);
      if (!name) {
        return res.status(422).json({
          error:
            "Could not extract business information from this URL. Please paste a valid Google Maps business link.",
        });
      }
      placeId = await findPlaceId(name, lat, lng);
      if (!placeId) {
        return res.status(404).json({
          error: `Could not find "${name}" on Google Maps. Try the Business Name search instead.`,
        });
      }
    }

    // 4. Fetch full place details
    const place = await getPlaceDetails(placeId);
    if (!place) {
      return res.status(404).json({ error: "Could not retrieve place details." });
    }

    // 5. Return clean profile object
    const cidExtracted = (() => {
      const m = (place.url || "").match(/!1s0x[a-f0-9]+:0x([a-f0-9]+)/i);
      if (m) {
        try { return BigInt("0x" + m[1]).toString(); } catch { return ""; }
      }
      return "";
    })();

    return res.json({
      placeId: place.place_id || "",
      name: place.name || "",
      formattedAddress: place.formatted_address || "",
      businessStatus: place.business_status || "",
      types: place.types || [],
      rating: place.rating ?? null,
      userRatingsTotal: place.user_ratings_total ?? null,
      phoneNumber: place.formatted_phone_number || null,
      website: place.website || null,
      openingHours: place.opening_hours?.weekday_text || [],
      lat: place.geometry?.location?.lat ?? 0,
      lng: place.geometry?.location?.lng ?? 0,
      url: place.url || "",
      cid: cidExtracted,
      priceLevel: place.price_level ?? null,
    });
  } catch (err) {
    log.error({ err }, "Google Place lookup error");
    return res.status(502).json({ error: "Lookup failed" });
  }
}
