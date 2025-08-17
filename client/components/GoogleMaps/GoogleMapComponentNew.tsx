import React, { useState, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Maximize } from "lucide-react";
import { getGoogleMapsApiKey } from "@/lib/googleMaps";

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  content?: string;
  color?: string;
  rank?: number | null;
  icon?: string;
}

interface Waypoint {
  id: string;
  position: { lat: number; lng: number };
  rank: number;
}

interface GoogleMapComponentProps {
  address?: string;
  lat?: number;
  lng?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  showControls?: boolean;
  showDirectionsButton?: boolean;
  className?: string;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  waypoints?: Waypoint[];
  onWaypointClick?: (waypointId: string) => void;
  selectedWaypoint?: string | null;
  onMapLoad?: (map: google.maps.Map) => void;
}

export const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  address,
  lat,
  lng,
  center,
  zoom = 14,
  height = "300px",
  showControls = true,
  showDirectionsButton = true,
  className,
  markers = [],
  onMarkerClick,
  waypoints = [],
  onWaypointClick,
  selectedWaypoint,
  onMapLoad,
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const apiKey = getGoogleMapsApiKey();

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
  });

  const mapContainerStyle = useMemo(() => ({
    width: "100%",
    height: height === "100%" ? "384px" : height, // Convert 100% to fixed height
  }), [height]);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: !showControls,
    zoomControl: showControls,
    streetViewControl: showControls,
    fullscreenControl: showControls,
    mapTypeControl: showControls,
  }), [showControls]);

  // Determine the center of the map
  const mapCenter = useMemo(() => {
    if (center) return center;
    if (lat !== undefined && lng !== undefined) return { lat, lng };
    if (markers.length > 0) {
      const avgLat = markers.reduce((sum, m) => sum + m.position.lat, 0) / markers.length;
      const avgLng = markers.reduce((sum, m) => sum + m.position.lng, 0) / markers.length;
      return { lat: avgLat, lng: avgLng };
    }
    if (waypoints.length > 0) {
      const avgLat = waypoints.reduce((sum, w) => sum + w.position.lat, 0) / waypoints.length;
      const avgLng = waypoints.reduce((sum, w) => sum + w.position.lng, 0) / waypoints.length;
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 40.7128, lng: -74.006 }; // Default to NYC
  }, [center, lat, lng, markers, waypoints]);

  const onLoad = useCallback((map: google.maps.Map) => {
    console.log("GoogleMapComponent: Map loaded successfully", map);
    setMap(map);
    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [onMapLoad]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Create marker icon for waypoints with ranking
  const createWaypointIcon = useCallback((rank: number) => {
    const getRankColor = (rank: number) => {
      if (rank <= 3) return "#10b981"; // green
      if (rank <= 10) return "#f59e0b"; // yellow
      return "#ef4444"; // red
    };

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z"
                fill="${getRankColor(rank)}" stroke="#fff" stroke-width="2"/>
          <circle cx="16" cy="16" r="10" fill="${getRankColor(rank)}"/>
          <text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif"
                font-size="12" font-weight="bold" fill="#ffffff">
            ${rank}
          </text>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(32, 40),
      anchor: new google.maps.Point(16, 40),
    };
  }, []);

  // Create marker icon for regular markers
  const createMarkerIcon = useCallback((marker: MapMarker) => {
    if (marker.rank) {
      return createWaypointIcon(marker.rank);
    }
    
    const color = marker.color || "#DC2626";
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 12 18 12 18s12-11.373 12-18C24 5.373 18.627 0 12 0z"
                fill="${color}" stroke="#fff" stroke-width="2"/>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(24, 30),
      anchor: new google.maps.Point(12, 30),
    };
  }, [createWaypointIcon]);

  const openInGoogleMaps = () => {
    let url = "https://maps.google.com/";
    if (lat !== undefined && lng !== undefined) {
      url += `?q=${lat},${lng}`;
    } else if (address) {
      url += `?q=${encodeURIComponent(address)}`;
    } else if (center) {
      url += `?q=${center.lat},${center.lng}`;
    }
    window.open(url, "_blank");
  };

  const getDirections = () => {
    let url = "https://maps.google.com/maps/dir/";
    if (lat !== undefined && lng !== undefined) {
      url += `/${lat},${lng}`;
    } else if (address) {
      url += `/${encodeURIComponent(address)}`;
    } else if (center) {
      url += `/${center.lat},${center.lng}`;
    }
    window.open(url, "_blank");
  };

  if (loadError) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center flex-col space-y-3 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">Map Unavailable</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Failed to load Google Maps: {loadError.message}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openInGoogleMaps}
              className="gap-2"
            >
              <Navigation className="h-3 w-3" />
              Open in Google Maps
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center" style={{ height }}>
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">
                Loading Google Maps...
              </span>
              <span className="text-xs text-blue-600">
                API Key: {apiKey ? 'Found' : 'Missing'} | Center: {mapCenter.lat.toFixed(3)}, {mapCenter.lng.toFixed(3)}
              </span>
              <span className="text-xs text-blue-600">
                Markers: {markers.length} | Waypoints: {waypoints.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-3">
        <div style={{ width: '100%', height: height === "100%" ? "384px" : height, minHeight: '300px' }}>
          <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {/* Render regular markers */}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              title={marker.title}
              icon={createMarkerIcon(marker)}
              onClick={() => onMarkerClick && onMarkerClick(marker)}
            />
          ))}

          {/* Render waypoint markers */}
          {waypoints.map((waypoint) => (
            <Marker
              key={waypoint.id}
              position={waypoint.position}
              title={`Rank #${waypoint.rank}`}
              icon={createWaypointIcon(waypoint.rank)}
              onClick={() => onWaypointClick && onWaypointClick(waypoint.id)}
              animation={selectedWaypoint === waypoint.id ? google.maps.Animation.BOUNCE : undefined}
            />
          ))}
          </GoogleMap>
        </div>

        {(showDirectionsButton || address || (lat !== undefined && lng !== undefined) || center) && (
          <div className="flex justify-between items-center mt-3 gap-2">
            <div className="flex-1 min-w-0">
              {waypoints.length > 0 && (
                <p className="text-xs text-muted-foreground mb-1">
                  📍 {waypoints.length} waypoints configured
                </p>
              )}
              {markers.length > 0 && waypoints.length === 0 && (
                <p className="text-xs text-muted-foreground mb-1">
                  📍 {markers.length} location{markers.length > 1 ? 's' : ''} marked
                </p>
              )}
              <p className="text-xs text-green-600 mb-1">
                Map loaded: {isLoaded ? 'Yes' : 'No'} | Markers: {markers.length} | Waypoints: {waypoints.length}
              </p>
              {address && (
                <p className="text-xs text-muted-foreground truncate">
                  {address}
                </p>
              )}
              {center && !address && (
                <p className="text-xs text-muted-foreground font-mono">
                  {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                </p>
              )}
            </div>

            <div className="flex gap-1">
              {showDirectionsButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getDirections}
                  className="gap-1 text-xs px-2 h-7"
                >
                  <Navigation className="h-3 w-3" />
                  Directions
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={openInGoogleMaps}
                className="gap-1 text-xs px-2 h-7"
              >
                <Maximize className="h-3 w-3" />
                Open
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleMapComponent;
