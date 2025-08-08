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

export const GoogleBusinessProfileFinder: React.FC<GoogleBusinessProfileFinderProps> = ({
  onProfileFound,
  onAddressChange,
  className,
}) => {
  // Search states
  const [cidQuery, setCidQuery] = useState("");
  const [urlQuery, setUrlQuery] = useState("");
  const [isSearchingCid, setIsSearchingCid] = useState(false);
  const [isSearchingUrl, setIsSearchingUrl] = useState(false);

  const [foundProfile, setFoundProfile] = useState<BusinessProfile | null>(null);
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

  const extractCidFromUrl = (url: string): string | null => {
    // Extract CID from various Google Maps URL formats
    const patterns = [
      /!1s0x[a-f0-9]+:0x([a-f0-9]+)/, // Standard format
      /data=.*!3m1!4b1!4m\d+!3m\d+!1s0x[a-f0-9]+:0x([a-f0-9]+)/, // Data format
      /place\/.*\/@.*\/data=.*!4m\d+!3m\d+!1s0x[a-f0-9]+:0x([a-f0-9]+)/, // Place format
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        // Convert hex to decimal for CID
        return parseInt(match[1], 16).toString();
      }
    }
    return null;
  };

  const extractPlaceIdFromUrl = (url: string): string | null => {
    // Extract place ID from Google Maps URLs
    const placeIdMatch = url.match(/place_id:([A-Za-z0-9_-]+)/);
    if (placeIdMatch) {
      return placeIdMatch[1];
    }
    
    // Alternative format
    const altMatch = url.match(/!1s([A-Za-z0-9_-]+)!/);
    if (altMatch && altMatch[1].startsWith("ChIJ")) {
      return altMatch[1];
    }
    
    return null;
  };

  const handleBusinessNameSelect = (businessName: string, placeResult?: any) => {
    if (placeResult) {
      // Convert the placeResult to BusinessProfile format
      let cid = '';
      if (placeResult.url) {
        cid = extractCidFromUrl(placeResult.url) || '';
      }

      const profile: BusinessProfile = {
        placeId: placeResult.placeId || '',
        name: placeResult.name || businessName,
        formattedAddress: placeResult.formattedAddress || '',
        businessStatus: placeResult.businessStatus || '',
        types: placeResult.types || [],
        rating: placeResult.rating,
        userRatingsTotal: placeResult.userRatingsTotal,
        phoneNumber: placeResult.phoneNumber,
        website: placeResult.website,
        openingHours: placeResult.openingHours,
        lat: placeResult.lat || 0,
        lng: placeResult.lng || 0,
        photos: placeResult.photos,
        url: placeResult.url,
        cid: cid,
        priceLevel: placeResult.priceLevel,
      };

      setFoundProfile(profile);
      setSearchError(null);
      if (onProfileFound) {
        onProfileFound(profile);
      }
      toast.success("Business profile found!");
    }
  };

  const searchByCid = async (cid: string): Promise<BusinessProfile | null> => {
    // CID search is more complex and typically requires the Place ID
    // For now, we'll search by converting CID to hex and looking for it
    toast.info("CID search functionality requires additional API setup");
    return null;
  };

  const searchByUrl = async (url: string): Promise<BusinessProfile | null> => {
    const placeId = extractPlaceIdFromUrl(url);
    const cid = extractCidFromUrl(url);
    
    if (placeId) {
      return searchByPlaceId(placeId);
    }
    
    // If no place ID found, try extracting business name from URL
    const nameMatch = url.match(/place\/([^\/]+)/);
    if (nameMatch) {
      const businessName = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));
      return searchByBusinessName(businessName);
    }
    
    return null;
  };

  const searchByPlaceId = async (placeId: string): Promise<BusinessProfile | null> => {
    await loadGoogleMapsAPI();
    
    return new Promise((resolve) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: placeId,
        fields: [
          'place_id', 'name', 'formatted_address', 'business_status', 'types',
          'rating', 'user_ratings_total', 'formatted_phone_number', 'website',
          'opening_hours', 'geometry', 'photos', 'url', 'price_level'
        ]
      };

      service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          let cid = '';
          if (place.url) {
            cid = extractCidFromUrl(place.url) || '';
          }

          const profile: BusinessProfile = {
            placeId: place.place_id || '',
            name: place.name || '',
            formattedAddress: place.formatted_address || '',
            businessStatus: place.business_status || '',
            types: place.types || [],
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            phoneNumber: place.formatted_phone_number,
            website: place.website,
            openingHours: place.opening_hours?.weekday_text,
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0,
            photos: place.photos?.slice(0, 3).map(photo => 
              photo.getUrl({ maxWidth: 400, maxHeight: 300 })
            ),
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    if (!apiKeyAvailable) {
      toast.error("Google Maps API key not configured");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setFoundProfile(null);

    try {
      let profile: BusinessProfile | null = null;

      switch (searchMode) {
        case "name":
          profile = await searchByBusinessName(searchQuery);
          break;
        case "cid":
          profile = await searchByCid(searchQuery);
          break;
        case "url":
          profile = await searchByUrl(searchQuery);
          break;
      }

      if (profile) {
        setFoundProfile(profile);
        if (onProfileFound) {
          onProfileFound(profile);
        }
        toast.success("Business profile found!");
      } else {
        setSearchError("No business profile found. Please try a different search term.");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualAddressChange = (field: string, value: string) => {
    const updated = { ...manualAddress, [field]: value };
    setManualAddress(updated);
    
    if (onAddressChange) {
      const fullAddress = `${updated.street}, ${updated.city}, ${updated.state} ${updated.zipCode}`.trim();
      onAddressChange(fullAddress, updated);
    }
  };

  const formatBusinessTypes = (types: string[]) => {
    return types
      .filter(type => !['establishment', 'point_of_interest'].includes(type))
      .slice(0, 3)
      .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
  };

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="name">Business Name</TabsTrigger>
          <TabsTrigger value="cid">CID</TabsTrigger>
          <TabsTrigger value="url">Google Maps URL</TabsTrigger>
        </TabsList>

        <TabsContent value="name" className="space-y-4">
          <div>
            <Label htmlFor="business-name-search">Search by Business Name</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="business-name-search"
                placeholder="Enter business name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching || !apiKeyAvailable}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cid" className="space-y-4">
          <div>
            <Label htmlFor="cid-search">Search by Customer ID (CID)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="cid-search"
                placeholder="Enter Google Customer ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching || !apiKeyAvailable}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the numeric Customer ID from Google My Business
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div>
            <Label htmlFor="url-search">Search by Google Maps URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="url-search"
                placeholder="Paste Google Maps URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching || !apiKeyAvailable}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Paste the full Google Maps URL of your business listing
            </p>
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
            Configure Google Maps API key in Super Admin → API Settings to enable business profile search.
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
                      <a href={foundProfile.website} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:underline">
                        {foundProfile.website}
                      </a>
                    </div>
                  )}
                  
                  {foundProfile.rating && (
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span>{foundProfile.rating} ({foundProfile.userRatingsTotal} reviews)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {foundProfile.types && foundProfile.types.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Business Categories</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formatBusinessTypes(foundProfile.types).map((type, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-xs text-muted-foreground">Place ID</Label>
                    <p className="font-mono text-xs truncate">{foundProfile.placeId}</p>
                  </div>
                  {foundProfile.cid && (
                    <div>
                      <Label className="text-xs text-muted-foreground">CID</Label>
                      <p className="font-mono text-xs">{foundProfile.cid}</p>
                    </div>
                  )}
                </div>

                {foundProfile.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(foundProfile.url, '_blank')}
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

      {/* Manual Address Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Address Entry</CardTitle>
          <CardDescription>
            Enter business address manually or use Google Places search
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddressAutocomplete
            label="Address Search"
            placeholder="Search for business address..."
            onChange={(address, placeResult) => {
              if (placeResult && onAddressChange) {
                const addressParts = placeResult.formattedAddress.split(", ");
                const fullAddress = addressParts.slice(0, -2).join(", ");
                const city = addressParts[addressParts.length - 2];
                const stateZip = addressParts[addressParts.length - 1];
                
                let state = "";
                let zipCode = "";
                if (stateZip) {
                  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
                  if (stateZipMatch) {
                    state = stateZipMatch[1];
                    zipCode = stateZipMatch[2];
                  }
                }
                
                const components = {
                  street: fullAddress || "",
                  city: city || "",
                  state: state,
                  zipCode: zipCode,
                  country: "United States"
                };
                
                setManualAddress(components);
                onAddressChange(placeResult.formattedAddress, components);
              }
            }}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={manualAddress.street}
                onChange={(e) => handleManualAddressChange("street", e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={manualAddress.city}
                onChange={(e) => handleManualAddressChange("city", e.target.value)}
                placeholder="New York"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={manualAddress.state}
                onChange={(e) => handleManualAddressChange("state", e.target.value)}
                placeholder="NY"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input
                id="zipCode"
                value={manualAddress.zipCode}
                onChange={(e) => handleManualAddressChange("zipCode", e.target.value)}
                placeholder="10001"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
