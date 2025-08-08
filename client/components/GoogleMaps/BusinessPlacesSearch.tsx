import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  X,
  Building2,
  CheckCircle,
  AlertCircle,
  Phone,
  Globe,
  Clock,
  Star,
  ExternalLink,
} from "lucide-react";
import { loadGoogleMapsAPI, getGoogleMapsApiKey } from "@/lib/googleMaps";
import { cn } from "@/lib/utils";

interface BusinessPlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  businessStatus: string;
  types: string[];
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
  lat: number;
  lng: number;
  photos?: string[];
  url?: string;
  cid?: string; // Google Customer ID extracted from URL
}

interface BusinessPlacesSearchProps {
  value?: string;
  onChange?: (businessName: string, placeResult?: BusinessPlaceResult) => void;
  onPlaceSelect?: (place: BusinessPlaceResult) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export const BusinessPlacesSearch: React.FC<BusinessPlacesSearchProps> = ({
  value = "",
  onChange,
  onPlaceSelect,
  placeholder = "Search for your business...",
  label,
  className,
  required,
  disabled,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<BusinessPlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] =
    useState<BusinessPlaceResult | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if Google Maps API key is available
  useEffect(() => {
    const checkApiKey = () => {
      const apiKey = getGoogleMapsApiKey();
      setApiKeyAvailable(!!apiKey);
      if (!apiKey) {
        console.warn(
          "❌ BusinessPlacesSearch: Google Maps API key not configured.",
        );
      }
    };

    checkApiKey();
    // Recheck periodically in case of delayed initialization
    const interval = setInterval(checkApiKey, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue && inputValue.length >= 3 && apiKeyAvailable) {
        searchBusinesses(inputValue);
        setShowSuggestions(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, apiKeyAvailable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchBusinesses = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await loadGoogleMapsAPI();

      const service = new google.maps.places.PlacesService(
        document.createElement("div"),
      );

      // Search for business establishments
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
          "🏢 Business search - Status:",
          status,
          "Results:",
          results?.length,
        );

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const businessResults: BusinessPlaceResult[] = results
            .filter((place) => place.business_status === "OPERATIONAL")
            .slice(0, 8)
            .map((place) => {
              // Extract CID from Google Maps URL if available
              let cid = "";
              if (place.url) {
                const cidMatch = place.url.match(
                  /!1s0x[a-f0-9]+:0x([a-f0-9]+)/,
                );
                if (cidMatch) {
                  // Convert hex to decimal for CID
                  cid = parseInt(cidMatch[1], 16).toString();
                }
              }

              return {
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
                cid: cid,
              };
            });

          console.log(
            "✅ Business search results processed:",
            businessResults.length,
          );
          setSuggestions(businessResults);
        } else {
          console.log("❌ No business results or bad status:", status);
          setSuggestions([]);
        }
        setIsLoading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSuggestions([]);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedPlace(null);

    if (onChange) {
      onChange(newValue);
    }

    if (newValue.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handlePlaceSelect = (place: BusinessPlaceResult) => {
    setInputValue(place.name);
    setSelectedPlace(place);
    setShowSuggestions(false);

    if (onChange) {
      onChange(place.name, place);
    }

    if (onPlaceSelect) {
      onPlaceSelect(place);
    }
  };

  const clearInput = () => {
    setInputValue("");
    setSelectedPlace(null);
    setSuggestions([]);
    setShowSuggestions(false);

    if (onChange) {
      onChange("");
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatBusinessTypes = (types: string[]) => {
    const relevantTypes = types
      .filter((type) => !["establishment", "point_of_interest"].includes(type))
      .slice(0, 2);

    return relevantTypes.map((type) =>
      type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    );
  };

  return (
    <div className={cn("relative", className)}>
      {label && (
        <Label htmlFor="business-search" className="mb-2 block">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            id="business-search"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
              apiKeyAvailable
                ? placeholder
                : "Enter business name manually (search disabled)"
            }
            className="pl-10 pr-24"
            disabled={disabled}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
          />

          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            )}

            {selectedPlace && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  selectedPlace.url && window.open(selectedPlace.url, "_blank")
                }
                className="h-6 w-6 p-0"
                title="View on Google Maps"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}

            {inputValue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearInput}
                className="h-6 w-6 p-0"
                title="Clear"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 mt-1">
          {selectedPlace && (
            <Badge variant="default" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Google Business Profile
            </Badge>
          )}

          {error && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              {error}
            </Badge>
          )}

          {!apiKeyAvailable && (
            <div className="space-y-1">
              <Badge variant="secondary" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Business search disabled
              </Badge>
              <p className="text-xs text-muted-foreground">
                Configure Google Places API key in Super Admin → API →
                Third-Party APIs
              </p>
            </div>
          )}
        </div>

        {/* Business Search Results Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            {suggestions.map((place, index) => (
              <button
                key={`${place.placeId}-${index}`}
                type="button"
                className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-start gap-3"
                onClick={() => handlePlaceSelect(place)}
              >
                <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {place.name}
                    </h4>
                    {place.rating && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        <span className="text-xs text-gray-600">
                          {place.rating} ({place.userRatingsTotal})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{place.formattedAddress}</span>
                  </div>

                  {place.phoneNumber && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Phone className="h-3 w-3" />
                      <span>{place.phoneNumber}</span>
                    </div>
                  )}

                  {place.website && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Globe className="h-3 w-3" />
                      <span className="truncate">{place.website}</span>
                    </div>
                  )}

                  {place.types && place.types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formatBusinessTypes(place.types).map((type, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Manual entry notice */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Search className="h-3 w-3" />
                <span>
                  Can't find your business? You can type it manually above.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Business Details */}
      {selectedPlace && (
        <div className="mt-3 p-4 border rounded-lg bg-green-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Business Profile Connected</span>
              </div>

              <div className="grid gap-2 text-sm">
                <div>
                  <strong>Name:</strong> {selectedPlace.name}
                </div>
                <div>
                  <strong>Address:</strong> {selectedPlace.formattedAddress}
                </div>
                {selectedPlace.phoneNumber && (
                  <div>
                    <strong>Phone:</strong> {selectedPlace.phoneNumber}
                  </div>
                )}
                {selectedPlace.website && (
                  <div>
                    <strong>Website:</strong> {selectedPlace.website}
                  </div>
                )}
                {selectedPlace.rating && (
                  <div>
                    <strong>Rating:</strong> {selectedPlace.rating} stars (
                    {selectedPlace.userRatingsTotal} reviews)
                  </div>
                )}
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Technical Details
                </summary>
                <div className="mt-1 p-2 bg-white rounded text-muted-foreground space-y-1">
                  <div>
                    <strong>Place ID:</strong> {selectedPlace.placeId}
                  </div>
                  <div>
                    <strong>Coordinates:</strong> {selectedPlace.lat.toFixed(6)}
                    , {selectedPlace.lng.toFixed(6)}
                  </div>
                  <div>
                    <strong>Business Status:</strong>{" "}
                    {selectedPlace.businessStatus}
                  </div>
                </div>
              </details>
            </div>

            {selectedPlace.url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedPlace.url, "_blank")}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View on Google
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
