// Google Places API Integration
export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  types: string[];
  rating?: number;
  userRatingsTotal?: number;
  businessStatus?: string;
  cid?: string;
}

export interface PlaceSearchOptions {
  query: string;
  location?: {
    lat: number;
    lng: number;
  };
  radius?: number;
  type?: string;
}

// Extract CID from various Google URLs
export function extractCidFromUrl(url: string): string | null {
  try {
    // Handle different Google Maps URL formats
    const cidPatterns = [
      /\/data=.*!1s(0x[a-f0-9]+):0x([a-f0-9]+)/i, // Standard format
      /cid=(\d+)/i, // Direct CID parameter
      /!4m\d+!1s(0x[a-f0-9]+):0x([a-f0-9]+)/i, // Alternative format
    ];

    for (const pattern of cidPatterns) {
      const match = url.match(pattern);
      if (match) {
        if (match[2]) {
          // Convert hex to decimal for CID
          return parseInt(match[2], 16).toString();
        } else if (match[1] && match[1].startsWith("0x")) {
          return parseInt(match[1], 16).toString();
        } else if (match[1]) {
          return match[1];
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting CID from URL:", error);
    return null;
  }
}

// Extract Place ID from Google Maps URL
export function extractPlaceIdFromUrl(url: string): string | null {
  try {
    const placeIdPattern = /place_id:([A-Za-z0-9_-]+)/i;
    const match = url.match(placeIdPattern);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Error extracting Place ID from URL:", error);
    return null;
  }
}

// Google Places API search using the existing BusinessPlacesSearch implementation
export async function searchPlaces(
  options: PlaceSearchOptions,
): Promise<PlaceResult[]> {
  // Use the real BusinessPlacesSearch implementation that's already in the component
  // This function is mainly for compatibility - the real search happens in BusinessPlacesSearch component
  console.log("Searching places with options:", options);

  // Return empty array as this is handled by the BusinessPlacesSearch component
  return [];
}

// Get place details by Place ID - handled by BusinessPlacesSearch component
export async function getPlaceDetails(
  placeId: string,
): Promise<PlaceResult | null> {
  console.log("Getting place details for:", placeId);
  // This is handled by the BusinessPlacesSearch component
  return null;
}

// Get place details by CID - handled by BusinessPlacesSearch component
export async function getPlaceByCid(cid: string): Promise<PlaceResult | null> {
  console.log("Getting place details by CID:", cid);
  // This is handled by the BusinessPlacesSearch component
  return null;
}

// Validate business input (name, CID, or URL)
export function validateBusinessInput(input: string): {
  type: "name" | "cid" | "url" | "invalid";
  value: string;
  extractedData?: {
    cid?: string;
    placeId?: string;
  };
} {
  const trimmedInput = input.trim();

  // Check if it's a URL
  if (
    trimmedInput.includes("google.com/maps") ||
    trimmedInput.includes("goo.gl/maps")
  ) {
    const cid = extractCidFromUrl(trimmedInput);
    const placeId = extractPlaceIdFromUrl(trimmedInput);

    return {
      type: "url",
      value: trimmedInput,
      extractedData: { cid, placeId },
    };
  }

  // Check if it's a CID (numeric string typically 15-21 digits)
  if (/^\d{10,25}$/.test(trimmedInput)) {
    return {
      type: "cid",
      value: trimmedInput,
    };
  }

  // Check if it's a valid business name (at least 2 characters, not all numbers)
  if (trimmedInput.length >= 2 && !/^\d+$/.test(trimmedInput)) {
    return {
      type: "name",
      value: trimmedInput,
    };
  }

  return {
    type: "invalid",
    value: trimmedInput,
  };
}
