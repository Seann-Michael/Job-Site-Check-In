export { GoogleMapComponent } from "./GoogleMapComponent";
export { AddressAutocomplete } from "./AddressAutocomplete";
export { BusinessPlacesSearch } from "./BusinessPlacesSearch";

// Re-export hooks and utilities for convenience
export {
  useGoogleMaps,
  useGooglePlacesAutocomplete,
  useAddressSearch,
  useGeolocation,
  useBusinessPlacesSearch,
} from "@/hooks/useGoogleMaps";
export {
  loadGoogleMapsAPI,
  initializeMap,
  initializeAutocomplete,
  geocodeAddress,
  reverseGeocode,
  getDirections,
  createMapEmbedUrl,
  testGoogleMapsConnection,
  getGoogleMapsApiKey,
  type PlaceResult,
} from "@/lib/googleMaps";
