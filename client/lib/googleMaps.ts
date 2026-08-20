import { toast } from "sonner";

// Google Maps Configuration
const GOOGLE_MAPS_CONFIG = {
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "", // Use env var first, fallback to third-party integrations
  libraries: ["places", "geometry", "drawing"] as (
    | "places"
    | "geometry"
    | "drawing"
  )[],
  version: "weekly",
};

// Types
export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  formattedAddress: string;
  // Structured address components (parsed from Google address_components)
  streetNumber?: string;
  route?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

// Parse Google address_components into structured fields
export const parseAddressComponents = (
  components:
    | google.maps.GeocoderAddressComponent[]
    | google.maps.places.PlaceResult["address_components"]
    | undefined,
): {
  streetNumber?: string;
  route?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
} => {
  const parsed: {
    streetNumber?: string;
    route?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } = {};

  if (!components) return parsed;

  for (const component of components) {
    const types = component.types || [];

    if (types.includes("street_number")) {
      parsed.streetNumber = component.long_name;
    }
    if (types.includes("route")) {
      parsed.route = component.long_name;
    }
    // City: prefer locality, fall back to sublocality / postal_town
    if (types.includes("locality")) {
      parsed.city = component.long_name;
    } else if (
      !parsed.city &&
      (types.includes("sublocality") ||
        types.includes("sublocality_level_1") ||
        types.includes("postal_town"))
    ) {
      parsed.city = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      parsed.state = component.short_name;
    }
    if (types.includes("postal_code")) {
      parsed.postalCode = component.long_name;
    }
    if (types.includes("country")) {
      parsed.country = component.short_name;
    }
  }

  parsed.street = [parsed.streetNumber, parsed.route].filter(Boolean).join(" ");

  return parsed;
};

// Google Maps API Key Management
export const getGoogleMapsApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) {
    console.warn("VITE_GOOGLE_MAPS_API_KEY is not set. Google Maps features will be disabled.");
  }
  return apiKey;
};

// Load Google Maps API
export const loadGoogleMapsAPI = (): Promise<typeof google> => {
  return new Promise((resolve, reject) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve(google);
      return;
    }

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      reject(new Error("Google Maps API key not configured"));
      return;
    }

    // Check if script is already loading
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Wait for existing script to load
      const checkGoogleMaps = setInterval(() => {
        if (typeof google !== "undefined" && google.maps) {
          clearInterval(checkGoogleMaps);
          resolve(google);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGoogleMaps);
        reject(new Error("Google Maps API failed to load"));
      }, 10000);
      return;
    }

    // Create script element
    const script = document.createElement("script");
    const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${GOOGLE_MAPS_CONFIG.libraries.join(",")}&v=${GOOGLE_MAPS_CONFIG.version}`;
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (typeof google !== "undefined" && google.maps) {
        resolve(google);
      } else {
        console.error("Google Maps script loaded but API not available");
        reject(
          new Error(
            "Google Maps API failed to initialize - API object not found",
          ),
        );
      }
    };

    script.onerror = (error) => {
      console.error("Failed to load Google Maps API script:", error);
      console.error("Script src:", script.src);
      console.error("Error type:", typeof error);
      console.error("Error details:", error);

      // Provide more detailed error information
      let errorMessage = "Failed to load Google Maps API script";
      if (error instanceof ErrorEvent) {
        errorMessage += `: ${error.message}`;
      } else if (error instanceof Event) {
        errorMessage += ": Network or loading error";
      }

      reject(new Error(errorMessage));
    };

    document.head.appendChild(script);
  });
};

// Initialize Google Maps for a container
export const initializeMap = async (
  container: HTMLElement,
  options: google.maps.MapOptions = {},
): Promise<google.maps.Map> => {
  try {
    await loadGoogleMapsAPI();

    const defaultOptions: google.maps.MapOptions = {
      zoom: 14,
      center: { lat: 40.7128, lng: -74.006 }, // Default to NYC
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      ...options,
    };

    return new google.maps.Map(container, defaultOptions);
  } catch (error) {
    console.error("Failed to initialize Google Maps:", error);
    throw error;
  }
};

// Address Autocomplete
export const initializeAutocomplete = async (
  input: HTMLInputElement,
  options: google.maps.places.AutocompleteOptions = {},
): Promise<google.maps.places.Autocomplete> => {
  try {
    await loadGoogleMapsAPI();

    const defaultOptions: google.maps.places.AutocompleteOptions = {
      types: ["address"],
      componentRestrictions: { country: "us" }, // Adjust as needed
      fields: [
        "address_components",
        "formatted_address",
        "geometry",
        "place_id",
      ],
      ...options,
    };

    return new google.maps.places.Autocomplete(input, defaultOptions);
  } catch (error) {
    console.error("Failed to initialize Google Places Autocomplete:", error);
    throw error;
  }
};

// Geocoding
export const geocodeAddress = async (
  address: string,
): Promise<PlaceResult | null> => {
  try {
    await loadGoogleMapsAPI();
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const result = results[0];
          const location = result.geometry.location;
          const parsed = parseAddressComponents(result.address_components);

          resolve({
            address: address,
            lat: location.lat(),
            lng: location.lng(),
            placeId: result.place_id || "",
            formattedAddress: result.formatted_address,
            ...parsed,
          });
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
};

// Fetch full Place Details (including address_components) for a place ID.
// Autocomplete predictions only carry placeId + description, so structured
// address fields must be resolved via a Place Details lookup.
export const getPlaceDetails = async (
  placeId: string,
): Promise<PlaceResult | null> => {
  if (!placeId) return null;
  try {
    await loadGoogleMapsAPI();

    const service = new google.maps.places.PlacesService(
      document.createElement("div"),
    );

    return new Promise((resolve) => {
      service.getDetails(
        {
          placeId,
          fields: [
            "address_components",
            "formatted_address",
            "geometry",
            "place_id",
            "name",
          ],
        },
        (place, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            place
          ) {
            const location = place.geometry?.location;
            const parsed = parseAddressComponents(place.address_components);

            resolve({
              address: place.formatted_address || place.name || "",
              lat: location?.lat() || 0,
              lng: location?.lng() || 0,
              placeId: place.place_id || placeId,
              formattedAddress: place.formatted_address || "",
              ...parsed,
            });
          } else {
            resolve(null);
          }
        },
      );
    });
  } catch (error) {
    console.error("Failed to fetch place details:", error);
    return null;
  }
};

// Reverse Geocoding
export const reverseGeocode = async (
  lat: number,
  lng: number,
): Promise<string | null> => {
  try {
    await loadGoogleMapsAPI();
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return null;
  }
};

// Get directions
export const getDirections = async (
  origin: string | google.maps.LatLng,
  destination: string | google.maps.LatLng,
  travelMode: google.maps.TravelMode = google.maps.TravelMode.DRIVING,
): Promise<google.maps.DirectionsResult | null> => {
  try {
    await loadGoogleMapsAPI();
    const directionsService = new google.maps.DirectionsService();

    return new Promise((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          travelMode,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            resolve(null);
          }
        },
      );
    });
  } catch (error) {
    console.error("Failed to get directions:", error);
    return null;
  }
};

// Utility: Create embed URL for iframe
export const createMapEmbedUrl = (
  location: string | { lat: number; lng: number },
): string => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return "";

  let query = "";
  if (typeof location === "string") {
    query = encodeURIComponent(location);
  } else {
    query = `${location.lat},${location.lng}`;
  }

  return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&zoom=14`;
};

// Utility: Create Street View embed URL for iframe
export const createStreetViewEmbedUrl = (
  location: string | { lat: number; lng: number },
  options: {
    heading?: number; // Direction to face (0-360)
    pitch?: number; // Up/down angle (-90 to 90)
    fov?: number; // Field of view (10-100)
  } = {},
): string => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return "";

  let locationParam = "";
  if (typeof location === "string") {
    locationParam = `location=${encodeURIComponent(location)}`;
  } else {
    locationParam = `location=${location.lat},${location.lng}`;
  }

  const params = new URLSearchParams({
    key: apiKey,
    [locationParam.split("=")[0]]: locationParam.split("=")[1],
    heading: (options.heading || 0).toString(),
    pitch: (options.pitch || 0).toString(),
    fov: (options.fov || 90).toString(),
  });

  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
};

// Check if Street View is available for a location
export const checkStreetViewAvailability = async (location: {
  lat: number;
  lng: number;
}): Promise<boolean> => {
  try {
    await loadGoogleMapsAPI();

    return new Promise((resolve) => {
      const streetViewService = new google.maps.StreetViewService();

      streetViewService.getPanorama(
        {
          location: new google.maps.LatLng(location.lat, location.lng),
          radius: 50, // Search within 50 meters
        },
        (data, status) => {
          resolve(status === google.maps.StreetViewStatus.OK);
        },
      );
    });
  } catch (error) {
    console.error("Failed to check Street View availability:", error);
    return false;
  }
};

// Test API key validity by making a direct request
export const validateGoogleMapsApiKey = async (
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> => {
  try {

    const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${apiKey}`;

    const response = await fetch(testUrl);
    const data = await response.json();


    if (data.status === "OK") {
      return { valid: true };
    } else if (data.status === "REQUEST_DENIED") {
      return {
        valid: false,
        error: `API key denied: ${data.error_message || "Invalid API key or restrictions"}`,
      };
    } else if (data.status === "OVER_QUERY_LIMIT") {
      return { valid: false, error: "API quota exceeded" };
    } else {
      return {
        valid: false,
        error: `API error: ${data.status} - ${data.error_message || "Unknown error"}`,
      };
    }
  } catch (error) {
    console.error(" API key validation failed:", error);
    return { valid: false, error: `Network error: ${error.message}` };
  }
};

// Test API key connection
export const testGoogleMapsConnection = async (): Promise<boolean> => {
  try {

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      console.error(" No API key available for testing");
      toast.error("Google Maps API key not configured");
      return false;
    }


    // Validate API key first with direct request
    const validation = await validateGoogleMapsApiKey(apiKey);
    if (!validation.valid) {
      console.error(" API key validation failed:", validation.error);
      toast.error(`Google Maps API key invalid: ${validation.error}`);
      return false;
    }


    // Test API loading
    try {
      await loadGoogleMapsAPI();
    } catch (loadError) {
      console.error(" Failed to load Google Maps API:", loadError);
      toast.error(`Google Maps API load failed: ${loadError.message}`);
      return false;
    }


    // Test with a simple geocoding request
    try {
      const result = await geocodeAddress(
        "1600 Amphitheatre Parkway, Mountain View, CA",
      );

      if (result) {
        toast.success("Google Maps API connection successful");
        return true;
      } else {
        console.error(" Geocoding returned no results");
        toast.error("Google Maps API test failed - no geocoding results");
        return false;
      }
    } catch (geocodeError) {
      console.error(" Geocoding test failed:", geocodeError);
      toast.error(`Google Maps geocoding failed: ${geocodeError.message}`);
      return false;
    }
  } catch (error) {
    console.error(" Google Maps API test failed:", error);
    toast.error(`Google Maps API connection failed: ${error.message}`);
    return false;
  }
};
