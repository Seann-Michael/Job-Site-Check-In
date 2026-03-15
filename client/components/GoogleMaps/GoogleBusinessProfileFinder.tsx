import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  MapPin,
  Building2,
  Phone,
  Globe,
  Star,
  Clock,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { loadGoogleMapsAPI, getGoogleMapsApiKey } from "@/lib/googleMaps";
import { AddressAutocomplete } from "@/components/GoogleMaps/AddressAutocomplete";
import { BusinessPlacesSearch } from "@/components/GoogleMaps/BusinessPlacesSearch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BusinessProfile {
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
  cid?: string;
  priceLevel?: number;
}

interface GoogleBusinessProfileFinderProps {
  onProfileFound?: (profile: BusinessProfile) => void;
  onAddressChange?: (address: string, addressComponents: any) => void;
  className?: string;
}

export const GoogleBusinessProfileFinder: React.FC<
  GoogleBusinessProfileFinderProps
> = ({ onProfileFound, onAddressChange, className }) => {
  // Search states
  const [cidQuery, setCidQuery] = useState("");
  const [urlQuery, setUrlQuery] = useState("");
  const [isSearchingCid, setIsSearchingCid] = useState(false);
  const [isSearchingUrl, setIsSearchingUrl] = useState(false);

  const [foundProfile, setFoundProfile] = useState<BusinessProfile | null>(
    null,
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(true);

  // Address components for manual entry
  const [manualAddress, setManualAddress] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
  });

  // Check API key availability
  React.useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    setApiKeyAvailable(!!apiKey);
  }, []);

  // Keep CID extractor for the Business Name search path (placeResult.url)
  const extractCidFromUrl = (url: string): string | null => {
    const m = url.match(/!1s0x[a-f0-9]+:0x([a-f0-9]+)/i);
    if (m) {
      try { return BigInt("0x" + m[1]).toString(); } catch { return null; }
    }
    return null;
  };

  // Multiple search results for user to pick from
  const [searchResults, setSearchResults] = useState<BusinessProfile[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [isSearchingName, setIsSearchingName] = useState(false);

  /** Shared helper: search Google Maps by text query, returns up to 5 results */
  const textSearch = (query: string): Promise<google.maps.places.PlaceResult[]> => {
    return new Promise(async (resolve) => {
      await loadGoogleMapsAPI();
      const service = new google.maps.places.PlacesService(document.createElement("div"));
      service.textSearch({ query }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
          resolve(results.slice(0, 5));
        } else {
          resolve([]);
        }
      });
    });
  };

  /** Convert a JS SDK PlaceResult to our BusinessProfile shape */
  const placeResultToProfile = (place: google.maps.places.PlaceResult): BusinessProfile => {
    const url = place.url || "";
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
      photos: place.photos?.slice(0, 3).map((p) => p.getUrl({ maxWidth: 400, maxHeight: 300 })),
      url,
      cid: extractCidFromUrl(url) || "",
      priceLevel: place.price_level,
    };
  };

  /** Run a text search and show results for the user to pick */
  const runTextSearch = async (query: string, setSearching: (v: boolean) => void) => {
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setFoundProfile(null);
    try {
      const results = await textSearch(query);
      if (!results.length) {
        setSearchError(`No results found for "${query}". Try a more specific name or include the city.`);
        return;
      }
      if (results.length === 1) {
        // Only one result – auto-select it and fetch full details
        const profile = await searchByPlaceId(results[0].place_id!);
        if (profile) {
          setFoundProfile(profile);
          setSearchError(null);
          if (onProfileFound) onProfileFound(profile);
          toast.success("Business profile found!");
        }
      } else {
        // Multiple results – show list so user can pick the right one
        setSearchResults(results.map(placeResultToProfile));
      }
    } catch (err: any) {
      setSearchError("Search failed. Make sure the Google Maps API is configured.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (profile: BusinessProfile) => {
    const full = await searchByPlaceId(profile.placeId);
    const resolved = full || profile;
    setFoundProfile(resolved);
    setSearchResults([]);
    setSearchError(null);
    if (onProfileFound) onProfileFound(resolved);
    toast.success("Business profile selected!");
  };

  const handleBusinessNameSelect = (businessName: string, placeResult?: any) => {
    if (placeResult) {
      const url = placeResult.url || "";
      const profile: BusinessProfile = {
        placeId: placeResult.placeId || "",
        name: placeResult.name || businessName,
        formattedAddress: placeResult.formattedAddress || "",
        businessStatus: placeResult.businessStatus || "",
        types: placeResult.types || [],
        rating: placeResult.rating,
        userRatingsTotal: placeResult.userRatingsTotal,
        phoneNumber: placeResult.phoneNumber,
        website: placeResult.website,
        openingHours: placeResult.openingHours,
        lat: placeResult.lat || 0,
        lng: placeResult.lng || 0,
        photos: placeResult.photos,
        url,
        cid: extractCidFromUrl(url) || "",
        priceLevel: placeResult.priceLevel,
      };
      setFoundProfile(profile);
      setSearchResults([]);
      setSearchError(null);
      if (onProfileFound) onProfileFound(profile);
      toast.success("Business profile found!");
    }
  };

  /** Name-based text search (works for SABs — no location required) */
  const handleNameSearch = () => {
    if (!nameQuery.trim()) { toast.error("Enter a business name"); return; }
    runTextSearch(nameQuery.trim(), setIsSearchingName);
  };

  /** URL-based search: extract name from URL, then text search via JS SDK */
  const handleUrlSearch = async () => {
    if (!urlQuery.trim()) { toast.error("Please enter a Google Maps URL"); return; }

    setIsSearchingUrl(true);
    setSearchError(null);
    setSearchResults([]);
    setFoundProfile(null);

    try {
      let resolvedUrl = urlQuery.trim();

      // Expand short links (maps.app.goo.gl / share.google) server-side
      const isShort =
        resolvedUrl.includes("maps.app.goo.gl") ||
        resolvedUrl.includes("share.google") ||
        resolvedUrl.includes("goo.gl/maps");

      if (isShort) {
        try {
          const r = await fetch(`/api/resolve-url?url=${encodeURIComponent(resolvedUrl)}`);
          const d = await r.json();
          resolvedUrl = d.resolvedUrl || resolvedUrl;
        } catch {
          // If resolution fails, fall through and try to extract name anyway
        }
      }

      // Extract business name from the URL path
      const nameMatch = resolvedUrl.match(/\/place\/([^/@?#]+)/);
      if (!nameMatch) {
        setSearchError("Could not find a business name in this URL. Paste the full Google Maps URL for a specific business.");
        return;
      }
      const businessName = decodeURIComponent(nameMatch[1].replace(/\+/g, " ")).trim();

      // Extract coordinates for location bias (helps pick the right listing)
      const coordMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const lat = coordMatch ? parseFloat(coordMatch[1]) : null;
      const lng = coordMatch ? parseFloat(coordMatch[2]) : null;

      await loadGoogleMapsAPI();
      const service = new google.maps.places.PlacesService(document.createElement("div"));

      const request: google.maps.places.TextSearchRequest = {
        query: businessName,
        ...(lat !== null && lng !== null
          ? { location: new google.maps.LatLng(lat, lng), radius: 50000 }
          : {}),
      };

      service.textSearch(request, async (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
          if (results.length === 1) {
            const profile = await searchByPlaceId(results[0].place_id!);
            if (profile) {
              setFoundProfile(profile);
              if (onProfileFound) onProfileFound(profile);
              toast.success("Business profile found!");
            }
          } else {
            setSearchResults(results.slice(0, 5).map(placeResultToProfile));
          }
        } else {
          setSearchError(`Could not find "${businessName}" on Google Maps. Try the Name Search tab.`);
        }
        setIsSearchingUrl(false);
      });
      return; // loading state cleared in callback
    } catch (error: any) {
      console.error("URL search error:", error);
      setSearchError("Search failed. Please try the Name Search tab.");
    } finally {
      setIsSearchingUrl(false);
    }
  };

  const searchByPlaceId = async (
    placeId: string,
  ): Promise<BusinessProfile | null> => {
    await loadGoogleMapsAPI();

    return new Promise((resolve) => {
      const service = new google.maps.places.PlacesService(
        document.createElement("div"),
      );

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
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
          "price_level",
        ],
      };

      service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          let cid = "";
          if (place.url) {
            cid = extractCidFromUrl(place.url) || "";
          }

          const profile: BusinessProfile = {
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
              ?.slice(0, 3)
              .map((photo) => photo.getUrl({ maxWidth: 400, maxHeight: 300 })),
            url: place.url,
            cid: cid,
            priceLevel: place.price_level,
          };

          resolve(profile);
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleManualAddressChange = (field: string, value: string) => {
    const updated = { ...manualAddress, [field]: value };
    setManualAddress(updated);

    if (onAddressChange) {
      const fullAddress =
        `${updated.street}, ${updated.city}, ${updated.state} ${updated.zipCode}`.trim();
      onAddressChange(fullAddress, updated);
    }
  };

  const formatBusinessTypes = (types: string[]) => {
    return types
      .filter((type) => !["establishment", "point_of_interest"].includes(type))
      .slice(0, 3)
      .map((type) =>
        type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      );
  };

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs defaultValue="name" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="name">Business Name</TabsTrigger>
          <TabsTrigger value="cid">CID</TabsTrigger>
          <TabsTrigger value="url">Google Maps URL</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="name" className="space-y-4">
          <div>
            <Label htmlFor="business-name-search">
              Search by Business Name
            </Label>
            <BusinessPlacesSearch
              value=""
              onChange={handleBusinessNameSelect}
              placeholder="Start typing your business name..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use Google Places autocomplete to find your business profile
            </p>
          </div>
        </TabsContent>

        <TabsContent value="cid" className="space-y-4">
          <div>
            <Label htmlFor="cid-search">Search by Customer ID (CID)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="cid-search"
                placeholder="Enter Google Customer ID..."
                value={cidQuery}
                onChange={(e) => setCidQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCidSearch()}
                className="font-mono"
              />
              <Button
                onClick={handleCidSearch}
                disabled={isSearchingCid || !apiKeyAvailable}
              >
                {isSearchingCid ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the numeric Customer ID from Google My Business (e.g.,
              1234567890123456789)
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div>
            <Label htmlFor="url-search">Search by Google Maps URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="url-search"
                placeholder="Paste any Google Maps link (full URL, maps.app.goo.gl, or share.google)..."
                value={urlQuery}
                onChange={(e) => setUrlQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleUrlSearch()}
              />
              <Button
                onClick={handleUrlSearch}
                disabled={isSearchingUrl || !apiKeyAvailable}
              >
                {isSearchingUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Supports full Google Maps URLs, short links (maps.app.goo.gl), and share links (share.google)
            </p>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div>
            <Label>Manual Business Information Entry</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Enter business information manually or use address search to
              auto-populate fields
            </p>

            <div className="space-y-4">
              <AddressAutocomplete
                label="Address Search"
                placeholder="Search for business address..."
                onChange={(address, placeResult) => {
                  if (placeResult && onAddressChange) {
                    const addressParts =
                      placeResult.formattedAddress.split(", ");
                    const fullAddress = addressParts.slice(0, -2).join(", ");
                    const city = addressParts[addressParts.length - 2];
                    const stateZip = addressParts[addressParts.length - 1];

                    let state = "";
                    let zipCode = "";
                    if (stateZip) {
                      const stateZipMatch = stateZip.match(
                        /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,
                      );
                      if (stateZipMatch) {
                        state = stateZipMatch[1];
                        zipCode = stateZipMatch[2];
                      } else {
                        const parts = stateZip.split(" ");
                        state = parts[0] || "";
                        zipCode = parts[1] || "";
                      }
                    }

                    const components = {
                      street: fullAddress || "",
                      city: city || "",
                      state: state,
                      zipCode: zipCode,
                      country: "United States",
                    };

                    setManualAddress(components);
                    onAddressChange(placeResult.formattedAddress, components);
                  }
                }}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="manual-street">Street Address</Label>
                  <Input
                    id="manual-street"
                    value={manualAddress.street}
                    onChange={(e) =>
                      handleManualAddressChange("street", e.target.value)
                    }
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-city">City</Label>
                  <Input
                    id="manual-city"
                    value={manualAddress.city}
                    onChange={(e) =>
                      handleManualAddressChange("city", e.target.value)
                    }
                    placeholder="New York"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-state">State</Label>
                  <Input
                    id="manual-state"
                    value={manualAddress.state}
                    onChange={(e) =>
                      handleManualAddressChange("state", e.target.value)
                    }
                    placeholder="NY"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-zipCode">Zip Code</Label>
                  <Input
                    id="manual-zipCode"
                    value={manualAddress.zipCode}
                    onChange={(e) =>
                      handleManualAddressChange("zipCode", e.target.value)
                    }
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Search Status */}
      {!apiKeyAvailable && (
        <div className="p-3 border rounded-lg bg-yellow-50">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Google Maps API Required</span>
          </div>
          <p className="text-sm text-yellow-600 mt-1">
            Configure Google Maps API key in Super Admin → API Settings to
            enable business profile search.
          </p>
        </div>
      )}

      {searchError && (
        <div className="p-3 border rounded-lg bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Search Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{searchError}</p>
        </div>
      )}

      {/* Found Profile Display */}
      {foundProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Business Profile Found
            </CardTitle>
            <CardDescription>
              Google Business Profile information retrieved successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold text-lg">{foundProfile.name}</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{foundProfile.formattedAddress}</span>
                  </div>

                  {foundProfile.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{foundProfile.phoneNumber}</span>
                    </div>
                  )}

                  {foundProfile.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <a
                        href={foundProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {foundProfile.website}
                      </a>
                    </div>
                  )}

                  {foundProfile.rating && (
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span>
                        {foundProfile.rating} ({foundProfile.userRatingsTotal}{" "}
                        reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {foundProfile.types && foundProfile.types.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">
                      Business Categories
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formatBusinessTypes(foundProfile.types).map(
                        (type, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs"
                          >
                            {type}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Place ID
                    </Label>
                    <p className="font-mono text-xs truncate">
                      {foundProfile.placeId}
                    </p>
                  </div>
                  {foundProfile.cid && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        CID
                      </Label>
                      <p className="font-mono text-xs">{foundProfile.cid}</p>
                    </div>
                  )}
                </div>

                {foundProfile.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(foundProfile.url, "_blank")}
                    className="w-full gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Google Maps
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
