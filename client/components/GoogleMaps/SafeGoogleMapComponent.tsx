import React from "react";
import { GoogleMapComponent } from "./GoogleMapComponent";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, MapPin } from "lucide-react";

interface SafeGoogleMapComponentProps {
  address?: string;
  lat?: number;
  lng?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  showControls?: boolean;
  showDirectionsButton?: boolean;
  className?: string;
}

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  content?: string;
  color?: string;
  rank?: number | null;
  icon?: string;
}

export const SafeGoogleMapComponent: React.FC<SafeGoogleMapComponentProps> = (props) => {
  const { address, lat, lng, height = "300px" } = props;

  // Validate coordinates
  const isValidCoordinate = (coord: number | undefined): boolean => {
    return typeof coord === 'number' && !isNaN(coord) && isFinite(coord);
  };

  // Error boundary component
  class GoogleMapErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback: React.ReactNode },
    { hasError: boolean }
  > {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): { hasError: boolean } {
      console.error("Google Maps Error:", error);
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error("Google Maps Component Error:", error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return this.props.fallback;
      }

      return this.props.children;
    }
  }

  // Fallback component when Google Maps fails
  const MapFallback = () => {
    const validCoordinates = isValidCoordinate(lat) && isValidCoordinate(lng);
    const fallbackAddress = address || (validCoordinates ? `${lat}, ${lng}` : "Location not available");

    return (
      <Card className="w-full" style={{ height }}>
        <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center space-y-3">
          <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Map temporarily unavailable</h3>
            <p className="text-sm text-gray-500 mt-1">
              Google Maps could not be loaded
            </p>
          </div>
          {validCoordinates && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{fallbackAddress}</span>
            </div>
          )}
          {validCoordinates && (
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              <MapPin className="h-4 w-4" />
              View on Google Maps
            </a>
          )}
        </CardContent>
      </Card>
    );
  };

  // Simple iframe fallback for when coordinates are available
  const IframeFallback = () => {
    if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
      return <MapFallback />;
    }

    // The key comes from the referrer-restricted browser key, never a literal.
    // A hardcoded key used to live here; because this repo is public, it was
    // world-readable and had to be rotated. Without the env var we fall back to
    // the static card rather than calling Google with no key.
    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!mapsKey) {
      return <MapFallback />;
    }

    const embedUrl = `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(mapsKey)}&center=${lat},${lng}&zoom=${props.zoom || 14}`;

    return (
      <div className="w-full" style={{ height }}>
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Location Map"
          onError={() => console.error("Google Maps iframe failed to load")}
        />
      </div>
    );
  };

  return (
    <GoogleMapErrorBoundary fallback={<IframeFallback />}>
      <GoogleMapComponent {...props} />
    </GoogleMapErrorBoundary>
  );
};
