import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Search,
  X,
  Navigation,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAddressSearch } from "@/hooks/useGoogleMaps";
import { PlaceResult, getGoogleMapsApiKey } from "@/lib/googleMaps";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (address: string, placeResult?: PlaceResult) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value = "",
  onChange,
  onCoordinatesChange,
  placeholder = "Enter address...",
  label,
  className,
  required,
  disabled,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { suggestions, isLoading, error, searchAddress, clearSuggestions } =
    useAddressSearch();

  // Check if Google Maps API key is available
  useEffect(() => {
    const checkApiKey = () => {
      const apiKey = getGoogleMapsApiKey();
      console.log("🔍 AddressAutocomplete: API key check result:", apiKey ? "FOUND" : "NOT_FOUND");
      console.log("🔍 AddressAutocomplete: API key value:", apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 6)}` : "NONE");
      setApiKeyAvailable(!!apiKey);
      if (!apiKey) {
        console.warn("❌ AddressAutocomplete: Google Maps API key not configured. Address autocomplete disabled.");
      } else {
        console.log("✅ AddressAutocomplete: API key available, autocomplete enabled");
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
      if (inputValue !== value && apiKeyAvailable) {
        console.log("🔍 AddressAutocomplete: Searching for address:", inputValue);
        searchAddress(inputValue);
        setShowSuggestions(true);
      } else if (!apiKeyAvailable) {
        console.log("❌ AddressAutocomplete: Search skipped - API key not available");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, searchAddress, value, apiKeyAvailable]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log("📝 AddressAutocomplete: Input changed to:", newValue);
    console.log("📝 AddressAutocomplete: API key available:", apiKeyAvailable);
    console.log("📝 AddressAutocomplete: Suggestions count:", suggestions.length);
    console.log("📝 AddressAutocomplete: Is loading:", isLoading);
    console.log("📝 AddressAutocomplete: Error:", error);

    setInputValue(newValue);
    setSelectedPlace(null);

    if (onChange) {
      onChange(newValue);
    }

    if (newValue.length < 3 || !apiKeyAvailable) {
      clearSuggestions();
      setShowSuggestions(false);
      if (newValue.length < 3) {
        console.log("⚠️ AddressAutocomplete: Input too short, clearing suggestions");
      } else if (!apiKeyAvailable) {
        console.log("❌ AddressAutocomplete: API key not available, cannot search");
      }
    }
  };

  const handleSuggestionSelect = (place: PlaceResult) => {
    setInputValue(place.formattedAddress);
    setSelectedPlace(place);
    setShowSuggestions(false);

    if (onChange) {
      onChange(place.formattedAddress, place);
    }

    if (onCoordinatesChange) {
      onCoordinatesChange(place.lat, place.lng);
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue && !selectedPlace && apiKeyAvailable) {
      // Try to geocode the entered address
      try {
        const { geocodeAddress } = await import("@/lib/googleMaps");
        const result = await geocodeAddress(inputValue);
        if (result) {
          setSelectedPlace(result);
          if (onChange) {
            onChange(result.formattedAddress, result);
          }
          if (onCoordinatesChange) {
            onCoordinatesChange(result.lat, result.lng);
          }
        }
      } catch (error) {
        console.error("Geocoding failed:", error);
      }
    }
  };

  const clearInput = () => {
    setInputValue("");
    setSelectedPlace(null);
    clearSuggestions();
    setShowSuggestions(false);

    if (onChange) {
      onChange("");
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const openInMaps = () => {
    if (selectedPlace) {
      const url = `https://maps.google.com/?q=${selectedPlace.lat},${selectedPlace.lng}`;
      window.open(url, "_blank");
    } else if (inputValue) {
      const url = `https://maps.google.com/?q=${encodeURIComponent(inputValue)}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className={cn("relative", className)}>
      {label && (
        <Label htmlFor="address-input" className="mb-2 block">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            id="address-input"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={
              apiKeyAvailable
                ? placeholder
                : "Enter address manually (autocomplete disabled)"
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
                onClick={openInMaps}
                className="h-6 w-6 p-0"
                title="Open in Google Maps"
              >
                <Navigation className="h-3 w-3" />
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
              Verified Address
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
                Address autocomplete disabled
              </Badge>
              <p className="text-xs text-muted-foreground">
                To enable autocomplete: Go to Super Admin ��� API → Third-Party
                APIs → Configure Google Maps API key
              </p>
            </div>
          )}

          {inputValue &&
            !selectedPlace &&
            !error &&
            !isLoading &&
            apiKeyAvailable && (
              <span className="text-xs text-muted-foreground">
                Select from suggestions or continue typing
              </span>
            )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
          >
            {suggestions.map((place, index) => (
              <button
                key={place.placeId || index}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                onClick={() => handleSuggestionSelect(place)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {place.formattedAddress}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Coordinates Display */}
      {selectedPlace && (
        <div className="mt-2 p-2 bg-muted rounded-md">
          <div className="text-xs text-muted-foreground">
            <strong>Coordinates:</strong> {selectedPlace.lat.toFixed(6)},{" "}
            {selectedPlace.lng.toFixed(6)}
          </div>
          {selectedPlace.placeId && (
            <div className="text-xs text-muted-foreground mt-1">
              <strong>Place ID:</strong> {selectedPlace.placeId}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
