import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadGoogleMapsAPI,
  initializeMap,
  initializeAutocomplete,
  geocodeAddress,
  PlaceResult,
} from "@/lib/googleMaps";
import { toast } from "sonner";

// Hook for Google Maps
export const useGoogleMaps = (options: google.maps.MapOptions = {}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        if (!mapRef.current) return;

        const mapInstance = await initializeMap(mapRef.current, options);
        setMap(mapInstance);
        setIsLoaded(true);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load map";
        setError(errorMessage);
        toast.error(`Google Maps: ${errorMessage}`);
      }
    };

    initMap();
  }, []);

  const addMarker = useCallback(
    (
      position: google.maps.LatLngLiteral,
      options: google.maps.MarkerOptions = {},
    ) => {
      if (!map) return null;

      return new google.maps.Marker({
        position,
        map,
        ...options,
      });
    },
    [map],
  );

  const setCenter = useCallback(
    (position: google.maps.LatLngLiteral) => {
      if (map) {
        map.setCenter(position);
      }
    },
    [map],
  );

  const setZoom = useCallback(
    (zoom: number) => {
      if (map) {
        map.setZoom(zoom);
      }
    },
    [map],
  );

  return {
    mapRef,
    map,
    isLoaded,
    error,
    addMarker,
    setCenter,
    setZoom,
  };
};

// Hook for Google Places Autocomplete
export const useGooglePlacesAutocomplete = (
  options: google.maps.places.AutocompleteOptions = {},
) => {
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initAutocomplete = async () => {
      try {
        if (!inputRef.current) return;

        const autocompleteInstance = await initializeAutocomplete(
          inputRef.current,
          options,
        );

        setAutocomplete(autocompleteInstance);
        setIsLoaded(true);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load autocomplete";
        setError(errorMessage);
        console.error("Google Places Autocomplete error:", err);
      }
    };

    initAutocomplete();
  }, []);

  const getPlace = useCallback((): google.maps.places.PlaceResult | null => {
    if (!autocomplete) return null;
    return autocomplete.getPlace();
  }, [autocomplete]);

  const addPlaceChangedListener = useCallback(
    (callback: () => void) => {
      if (autocomplete) {
        autocomplete.addListener("place_changed", callback);
      }
    },
    [autocomplete],
  );

  return {
    inputRef,
    autocomplete,
    isLoaded,
    error,
    predictions,
    getPlace,
    addPlaceChangedListener,
  };
};

// Hook for address search with suggestions
export const useAddressSearch = () => {
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use IP-based location detection instead of geolocation API
  // This is more reliable and doesn't require user permission

  const searchAddress = useCallback(async (query: string) => {
    console.log("🔍 Starting address search for:", query);

    if (!query || query.length < 3) {
      console.log("❌ Query too short, clearing suggestions");
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if API key is available before attempting to load
      console.log("🔑 Checking API key availability...");
      const { getGoogleMapsApiKey } = await import("@/lib/googleMaps");
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        console.error("❌ No API key available for address search");
        setError("Google Maps API key not configured");
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      console.log("✅ API key available, loading Google Maps API...");

      await loadGoogleMapsAPI();
      console.log("✅ Google Maps API loaded successfully");

      const service = new google.maps.places.AutocompleteService();
      console.log(
        "🏢 AutocompleteService created, making prediction request...",
      );

      // Build request options with location bias
      const requestOptions: google.maps.places.AutocompletionRequest = {
        input: query,
        types: ["address"],
        componentRestrictions: { country: "us" },
      };

      // Add location bias if user location is available
      if (userLocation) {
        requestOptions.location = new google.maps.LatLng(
          userLocation.lat,
          userLocation.lng,
        );
        requestOptions.radius = 50000; // 50km radius for bias
        console.log("📍 Using location bias:", userLocation);
      }

      // Try to detect if user is typing a specific city/state and bias accordingly
      const cityStateMatch = query.match(/,\s*([A-Z]{2})\s*$/i);
      if (cityStateMatch) {
        const state = cityStateMatch[1].toUpperCase();
        console.log("🏛️ Detected state in query:", state);
        // Enhance component restrictions for specific state
        requestOptions.componentRestrictions = {
          country: "us",
          administrativeArea: state,
        };
      }

      service.getPlacePredictions(
        requestOptions,
        async (predictions, status) => {
          console.log(
            "📍 Prediction callback - Status:",
            status,
            "Predictions:",
            predictions?.length,
          );

          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            console.log("✅ Predictions received, processing...");

            // Enhanced processing with scoring
            const resultsWithScores: Array<
              PlaceResult & {
                distance?: number;
                relevanceScore: number;
                matchScore: number;
              }
            > = [];

            for (const prediction of predictions.slice(0, 8)) {
              console.log("🌍 Geocoding prediction:", prediction.description);
              const geocodeResult = await geocodeAddress(
                prediction.description,
              );

              if (geocodeResult) {
                // Calculate relevance score based on text matching
                const description = prediction.description.toLowerCase();
                const queryLower = query.toLowerCase();

                let relevanceScore = 0;
                let matchScore = 0;

                // Exact match bonus
                if (description.includes(queryLower)) {
                  relevanceScore += 100;
                }

                // Starting match bonus (higher priority)
                if (description.startsWith(queryLower)) {
                  relevanceScore += 200;
                }

                // Word boundary matches
                const queryWords = queryLower.split(/\s+/);
                queryWords.forEach((word) => {
                  if (word.length > 2 && description.includes(word)) {
                    matchScore += 50;
                  }
                });

                // Calculate distance from user if location available
                let distance = undefined;
                if (userLocation) {
                  const R = 3959; // Earth's radius in miles
                  const dLat =
                    ((geocodeResult.lat - userLocation.lat) * Math.PI) / 180;
                  const dLng =
                    ((geocodeResult.lng - userLocation.lng) * Math.PI) / 180;
                  const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos((userLocation.lat * Math.PI) / 180) *
                      Math.cos((geocodeResult.lat * Math.PI) / 180) *
                      Math.sin(dLng / 2) *
                      Math.sin(dLng / 2);
                  distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                  // Distance bonus (closer = higher score)
                  if (distance < 10)
                    relevanceScore += 50; // Within 10 miles
                  else if (distance < 50) relevanceScore += 25; // Within 50 miles
                }

                resultsWithScores.push({
                  ...geocodeResult,
                  distance,
                  relevanceScore,
                  matchScore,
                });

                console.log(
                  `✅ Geocoded: ${prediction.description} | Score: ${relevanceScore + matchScore} | Distance: ${distance?.toFixed(1) || "N/A"} mi`,
                );
              }
            }

            // Sort by combined score (relevance + match - distance penalty)
            const sortedResults = resultsWithScores
              .sort((a, b) => {
                const scoreA = a.relevanceScore + a.matchScore;
                const scoreB = b.relevanceScore + b.matchScore;
                return scoreB - scoreA;
              })
              .slice(0, 6) // Top 6 results
              .map(
                ({ distance, relevanceScore, matchScore, ...result }) => result,
              ); // Remove scoring properties

            console.log(
              "📍 Final sorted results:",
              sortedResults.length,
              "suggestions",
            );
            setSuggestions(sortedResults);
          } else {
            console.log("❌ No predictions or bad status:", status);
            setSuggestions([]);
          }
          setIsLoading(false);
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSuggestions([]);
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    searchAddress,
    clearSuggestions,
  };
};

// Hook for geolocation
export const useGeolocation = () => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos);
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, []);

  return {
    position,
    error,
    isLoading,
    getCurrentPosition,
  };
};

// Hook for business places search
export const useBusinessPlacesSearch = () => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBusinesses = useCallback(async (query: string) => {
    console.log("🏢 Starting business search for:", query);

    if (!query || query.length < 3) {
      console.log("❌ Query too short, clearing suggestions");
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if API key is available
      console.log("🔑 Checking API key availability...");
      const { getGoogleMapsApiKey } = await import("@/lib/googleMaps");
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        console.error("❌ No API key available for business search");
        setError("Google Maps API key not configured");
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      console.log("✅ API key available, loading Google Maps API...");
      await loadGoogleMapsAPI();
      console.log("✅ Google Maps API loaded successfully");

      const service = new google.maps.places.PlacesService(
        document.createElement("div"),
      );
      console.log("🏢 PlacesService created, making text search request...");

      const request: google.maps.places.TextSearchRequest = {
        query: query,
        type: "establishment",
        fields: [
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
          "photos",
          "url",
        ],
      };

      service.textSearch(request, (results, status) => {
        console.log(
          "🏢 Business search callback - Status:",
          status,
          "Results:",
          results?.length,
        );

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          console.log("✅ Business results received, processing...");

          const businessResults = results
            .filter((place) => place.business_status === "OPERATIONAL")
            .slice(0, 8)
            .map((place) => ({
              placeId: place.place_id || "",
              name: place.name || "",
              formattedAddress: place.formatted_address || "",
              businessStatus: place.business_status || "",
              types: place.types || [],
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              phoneNumber: place.formatted_phone_number,
              website: place.website,
              openingHours: place.opening_hours?.weekday_text,
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
              photos: place.photos
                ?.slice(0, 1)
                .map((photo) =>
                  photo.getUrl({ maxWidth: 200, maxHeight: 200 }),
                ),
              url: place.url,
            }));

          console.log(
            "📍 Final business results:",
            businessResults.length,
            "businesses",
          );
          setSuggestions(businessResults);
        } else {
          console.log("❌ No business results or bad status:", status);
          setSuggestions([]);
        }
        setIsLoading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Business search failed");
      setSuggestions([]);
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    searchBusinesses,
    clearSuggestions,
  };
};
