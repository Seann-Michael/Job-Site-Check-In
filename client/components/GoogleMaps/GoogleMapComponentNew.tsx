import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Maximize } from "lucide-react";
import { getGoogleMapsApiKey } from "@/lib/googleMaps";
import {
  type Waypoint as WaypointType,
  updateWaypointPosition,
  moveAllWaypointsRelative,
  calculateDistance,
  calculateBearing,
} from "@/lib/waypointGenerator";

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  content?: string;
  color?: string;
  rank?: number | null;
  icon?: string;
  enabled?: boolean;
  isCenter?: boolean;
  size?: "small" | "medium" | "large";
  outline?: boolean;
}

interface Waypoint {
  id: string;
  position: { lat: number; lng: number };
  rank: number;
  ranking?: number; // Optional ranking for report mode
  label?: string; // Optional label for waypoints
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
  // Enhanced waypoint props
  waypointData?: WaypointType[];
  onWaypointToggle?: (waypointId: string) => void;
  onWaypointDrag?: (
    waypointId: string,
    newPosition: { lat: number; lng: number },
  ) => void;
  onWaypointsDragComplete?: (waypoints: WaypointType[]) => void;
  scanConfig?: {
    unit: "miles" | "kilometers";
    distanceBetween: number;
  };
  // Report mode - makes waypoints fixed (non-draggable, non-toggleable)
  reportMode?: boolean;
  // Business name overlay
  businessName?: string;
  showBusinessOverlay?: boolean;
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
  waypointData = [],
  onWaypointToggle,
  onWaypointDrag,
  onWaypointsDragComplete,
  scanConfig,
  reportMode = false,
  businessName,
  showBusinessOverlay = false,
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [draggedWaypoint, setDraggedWaypoint] = useState<string | null>(null);
  const [tempWaypointPositions, setTempWaypointPositions] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  // Use refs to avoid re-renders when these values change
  const originalCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasInitializedBounds = useRef(false);
  const previousWaypointCount = useRef(0);

  // Center pin function that fits bounds to show all waypoints
  const centerPinFunction = useCallback(() => {
    if (map && waypointData.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      waypointData.forEach((waypoint) => {
        bounds.extend(waypoint.coordinates);
      });

      // Fit bounds to show all waypoints
      map.fitBounds(bounds);

      // Add padding around the waypoints for better visibility
      setTimeout(() => {
        map.fitBounds(bounds, {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        });
      }, 100);
    }
  }, [map, waypointData]);

  // Listen for center map event when rings are changed
  useEffect(() => {
    const handleCenterMapEvent = () => {
      centerPinFunction();
    };

    window.addEventListener('centerMapToWaypoints', handleCenterMapEvent);

    return () => {
      window.removeEventListener('centerMapToWaypoints', handleCenterMapEvent);
    };
  }, [centerPinFunction]);

  const apiKey = getGoogleMapsApiKey();
  console.log(
    "GoogleMapComponent: Using API key:",
    apiKey ? `${apiKey.substring(0, 10)}...` : "MISSING",
  );

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
  });

  console.log("GoogleMapComponent: Load state:", {
    isLoaded,
    loadError: loadError?.message,
  });

  const mapContainerStyle = useMemo(
    () => ({
      width: "100%",
      height: height === "100%" ? "700px" : height || "384px",
    }),
    [height],
  );

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: !showControls,
      zoomControl: showControls,
      streetViewControl: showControls,
      fullscreenControl: showControls,
      mapTypeControl: showControls,
      gestureHandling: "cooperative",
      scrollwheel: true,
      clickableIcons: false,
    }),
    [showControls],
  );

  // Determine the center of the map
  const mapCenter = useMemo(() => {
    try {
      if (center) return center;
      if (lat !== undefined && lng !== undefined) return { lat, lng };
      if (waypointData.length > 0) {
        const centerWaypoint = waypointData.find(
          (w) => w.isCenter && w.coordinates,
        );
        if (centerWaypoint && centerWaypoint.coordinates)
          return centerWaypoint.coordinates;

        const validWaypoints = waypointData.filter(
          (w) =>
            w.coordinates &&
            typeof w.coordinates.lat === "number" &&
            typeof w.coordinates.lng === "number",
        );
        if (validWaypoints.length > 0) {
          const avgLat =
            validWaypoints.reduce((sum, w) => sum + w.coordinates.lat, 0) /
            validWaypoints.length;
          const avgLng =
            validWaypoints.reduce((sum, w) => sum + w.coordinates.lng, 0) /
            validWaypoints.length;
          return { lat: avgLat, lng: avgLng };
        }
      }
      if (markers.length > 0) {
        const validMarkers = markers.filter(
          (m) =>
            m.position &&
            typeof m.position.lat === "number" &&
            typeof m.position.lng === "number",
        );
        if (validMarkers.length > 0) {
          const avgLat =
            validMarkers.reduce((sum, m) => sum + m.position.lat, 0) /
            validMarkers.length;
          const avgLng =
            validMarkers.reduce((sum, m) => sum + m.position.lng, 0) /
            validMarkers.length;
          return { lat: avgLat, lng: avgLng };
        }
      }
      if (waypoints.length > 0) {
        const validWaypoints = waypoints.filter(
          (w) =>
            w.position &&
            typeof w.position.lat === "number" &&
            typeof w.position.lng === "number",
        );
        if (validWaypoints.length > 0) {
          const avgLat =
            validWaypoints.reduce((sum, w) => sum + w.position.lat, 0) /
            validWaypoints.length;
          const avgLng =
            validWaypoints.reduce((sum, w) => sum + w.position.lng, 0) /
            validWaypoints.length;
          return { lat: avgLat, lng: avgLng };
        }
      }
      return { lat: 40.7128, lng: -74.006 }; // Default to NYC
    } catch (error) {
      console.warn("Error calculating map center:", error);
      return { lat: 40.7128, lng: -74.006 }; // Default to NYC
    }
  }, [center, lat, lng, markers, waypoints, waypointData]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      console.log("GoogleMapComponent: Map loaded successfully", map);
      setMap(map);

      // Create info window (but keep it closed)
      const infoWindowInstance = new google.maps.InfoWindow();
      setInfoWindow(infoWindowInstance);

      if (onMapLoad) {
        onMapLoad(map);
      }
    },
    [onMapLoad],
  );

  const onUnmount = useCallback(() => {
    setMap(null);
    setInfoWindow(null);
  }, []);

  // Handle waypoint click (toggle enabled/disabled) with stable memoization
  const handleWaypointClick = useCallback(
    (waypoint: WaypointType, event?: any) => {
      if (isDragging) return; // Don't toggle during drag

      // Prevent default but allow event to propagate for Google Maps
      if (event && event.preventDefault) {
        event.preventDefault();
      }

      // Close any open info windows
      if (infoWindow) {
        infoWindow.close();
      }

      // Toggle waypoint enabled state (only for non-center waypoints)
      if (!waypoint.isCenter && onWaypointToggle) {
        onWaypointToggle(waypoint.id);
      }

      if (onWaypointClick) {
        onWaypointClick(waypoint.id);
      }
    },
    [onWaypointClick, onWaypointToggle, isDragging, infoWindow],
  );

  // Handle marker click with stable memoization
  const handleMarkerClick = useCallback(
    (marker: MapMarker) => {
      if (infoWindow) {
        infoWindow.close();
      }

      if (onMarkerClick) {
        onMarkerClick(marker);
      }
    },
    [onMarkerClick, infoWindow],
  );

  // Handle drag start with stable memoization
  const handleDragStart = useCallback(
    (waypointId: string, event?: any) => {
      setIsDragging(true);
      setDraggedWaypoint(waypointId);
      setTempWaypointPositions({}); // Clear any previous temp positions

      // Store original center position
      const centerWaypoint = waypointData.find((w) => w.isCenter);
      if (centerWaypoint) {
        originalCenterRef.current = centerWaypoint.coordinates;
      }

      if (infoWindow) {
        infoWindow.close();
      }
    },
    [waypointData, infoWindow],
  );

  // Handle real-time drag for visual feedback
  const handleDrag = useCallback(
    (waypointId: string, event: google.maps.MapMouseEvent) => {
      if (!isDragging || !event.latLng || !scanConfig) {
        return;
      }

      try {
        const newPosition = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };

        const draggedWaypoint = waypointData.find((w) => w.id === waypointId);
        if (!draggedWaypoint) return;

        // Calculate offset from the dragged waypoint's original position
        const latOffset = newPosition.lat - draggedWaypoint.coordinates.lat;
        const lngOffset = newPosition.lng - draggedWaypoint.coordinates.lng;

        // Create temp positions for all waypoints to show them moving together
        const newTempPositions: Record<string, { lat: number; lng: number }> =
          {};
        waypointData.forEach((waypoint) => {
          newTempPositions[waypoint.id] = {
            lat: waypoint.coordinates.lat + latOffset,
            lng: waypoint.coordinates.lng + lngOffset,
          };
        });

        setTempWaypointPositions(newTempPositions);
      } catch (error) {
        console.warn("Error handling waypoint drag:", error);
      }
    },
    [isDragging, waypointData, scanConfig],
  );

  // Handle drag end with stable memoization and proper error handling
  const handleDragEnd = useCallback(
    (waypointId: string, event: google.maps.MapMouseEvent) => {
      setIsDragging(false);
      setDraggedWaypoint(null);
      setTempWaypointPositions({}); // Clear temp positions

      if (
        !event.latLng ||
        !scanConfig ||
        !originalCenterRef.current ||
        !onWaypointsDragComplete
      ) {
        return;
      }

      // Use setTimeout to debounce the update and prevent immediate re-renders
      setTimeout(() => {
        try {
          const newPosition = {
            lat: event.latLng!.lat(),
            lng: event.latLng!.lng(),
          };

          const draggedWaypoint = waypointData.find((w) => w.id === waypointId);
          if (!draggedWaypoint) return;

          // Calculate offset from the dragged waypoint's original position
          const latOffset = newPosition.lat - draggedWaypoint.coordinates.lat;
          const lngOffset = newPosition.lng - draggedWaypoint.coordinates.lng;

          // Find the new center position
          const centerWaypoint = waypointData.find((w) => w.isCenter);
          const newCenter = centerWaypoint
            ? {
                lat: centerWaypoint.coordinates.lat + latOffset,
                lng: centerWaypoint.coordinates.lng + lngOffset,
              }
            : {
                lat: waypointData[0].coordinates.lat + latOffset,
                lng: waypointData[0].coordinates.lng + lngOffset,
              };

          // Apply this offset to all waypoints
          const updatedWaypoints = waypointData.map((waypoint) => {
            const newCoordinates = {
              lat: waypoint.coordinates.lat + latOffset,
              lng: waypoint.coordinates.lng + lngOffset,
            };

            // Calculate distance and bearing from new center
            const distance = waypoint.isCenter
              ? 0
              : calculateDistance(newCenter, newCoordinates, scanConfig.unit);
            const bearing = waypoint.isCenter
              ? 0
              : calculateBearing(newCenter, newCoordinates);

            return {
              ...waypoint,
              coordinates: newCoordinates,
              distance,
              bearing,
            };
          });

          onWaypointsDragComplete(updatedWaypoints);
        } catch (error) {
          console.warn("Error handling waypoint drag:", error);
        } finally {
          originalCenterRef.current = null;
        }
      }, 50); // 50ms debounce to prevent excessive updates
    },
    [waypointData, scanConfig, onWaypointsDragComplete],
  );

  // Get ranking color based on position
  const getRankingColor = useCallback((ranking: number | null): string => {
    if (ranking === null) return "#6B7280"; // Gray for unranked
    if (ranking >= 1 && ranking <= 3) return "#10B981"; // Green (1-3)
    if (ranking >= 4 && ranking <= 9) return "#F59E0B"; // Yellow (4-9)
    if (ranking >= 10 && ranking <= 15) return "#FB923C"; // Orange (10-15)
    return "#EF4444"; // Red (16-20+)
  }, []);

  // Create marker icon for waypoints - classic teardrop pin shape
  const createWaypointIcon = useCallback(
    (waypoint: WaypointType, rank?: number) => {
      const isCenter = waypoint.isCenter;
      const isEnabled = waypoint.enabled;

      // In report mode, use ranking colors; otherwise use default colors
      const color = reportMode
        ? (isCenter ? "#9333ea" : getRankingColor(waypoint.ranking || rank || null))
        : (isCenter ? "#9333ea" : isEnabled ? "#2563eb" : "#6b7280"); // Purple for center, blue for enabled, grey for disabled

      const strokeWidth = isEnabled ? 4 : 3; // Thicker stroke
      const strokeOpacity = isEnabled ? 1.0 : 0.6;

      // In report mode, show ranking number inside waypoints
      const displayText = reportMode && !isCenter && (waypoint.ranking || rank)
        ? (waypoint.ranking || rank).toString()
        : "";

      if (isCenter) {
        // Purple center hollow teardrop pin
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
            <path d="M16 2 C8.268 2 2 8.268 2 16 C2 23.732 16 40 16 40 C16 40 30 23.732 30 16 C30 8.268 23.732 2 16 2 Z"
                  fill="${reportMode ? color : 'transparent'}" stroke="${color}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="16" cy="16" r="4" fill="transparent" stroke="${color}" stroke-width="2" stroke-opacity="${strokeOpacity}"/>
            ${displayText ? `<text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white">${displayText}</text>` : ''}
          </svg>
        `)}`,
          scaledSize: new google.maps.Size(32, 42),
          anchor: new google.maps.Point(16, 40),
        };
      } else {
        // Filled teardrop pin for waypoints in report mode, hollow for normal mode
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
            <path d="M13 2 C6.925 2 2 6.925 2 13 C2 19.075 13 32 13 32 C13 32 24 19.075 24 13 C24 6.925 19.075 2 13 2 Z"
                  fill="${reportMode ? color : 'transparent'}" stroke="${color}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"/>
            ${displayText ? `<text x="13" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white">${displayText}</text>` : ''}
          </svg>
        `)}`,
          scaledSize: new google.maps.Size(26, 34),
          anchor: new google.maps.Point(13, 32),
        };
      }
    },
    [reportMode, getRankingColor],
  );

  // Create marker icon for regular markers
  const createMarkerIcon = useCallback((marker: MapMarker) => {
    if (marker.rank) {
      const getRankColor = (rank: number) => {
        if (rank <= 3) return "#10b981"; // green
        if (rank <= 10) return "#f59e0b"; // yellow
        return "#ef4444"; // red
      };

      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z"
                  fill="${getRankColor(marker.rank)}" stroke="#fff" stroke-width="2"/>
            <circle cx="16" cy="16" r="10" fill="${getRankColor(marker.rank)}"/>
            <text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif"
                  font-size="12" font-weight="bold" fill="#ffffff">
              ${marker.rank}
            </text>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(32, 40),
        anchor: new google.maps.Point(16, 40),
      };
    }

    const color = marker.color || "#DC2626";
    const isOutlined = marker.outline || marker.color === "transparent";

    if (isOutlined) {
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 12 18 12 18s12-11.373 12-18C24 5.373 18.627 0 12 0z"
                  fill="transparent" stroke="#DC2626" stroke-width="2"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(24, 30),
        anchor: new google.maps.Point(12, 30),
      };
    }

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
  }, []);

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
                API Key: {apiKey ? "Found" : "Missing"} | Center:{" "}
                {mapCenter.lat.toFixed(3)}, {mapCenter.lng.toFixed(3)}
              </span>
              <span className="text-xs text-blue-600">
                Markers: {markers.length} | Waypoints: {waypointData.length} |
                Legacy: {waypoints.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardContent className="p-3 space-y-4">
          <div
            style={{
              width: "100%",
              height: height || "384px",
              minHeight: height || "300px",
              position: "relative", // Ensure proper positioning context
            }}
          >
            <GoogleMap
              key="stable-geo-grid-map"
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={zoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
            >
              {/* Business Name Overlay */}
              {showBusinessOverlay && businessName && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    zIndex: 1000,
                    pointerEvents: "none",
                  }}
                >
                  <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg px-4 py-3 shadow-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="text-xs text-gray-600 font-medium">Scan Target</div>
                        <div className="text-sm font-semibold text-gray-900">{businessName}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Render regular markers */}
              {markers.map((marker) => (
                <Marker
                  key={marker.id}
                  position={marker.position}
                  title={marker.title}
                  icon={createMarkerIcon(marker)}
                  onClick={(e) => {
                    e.stop();
                    handleMarkerClick(marker);
                  }}
                />
              ))}

              {/* Render legacy waypoint markers */}
              {waypoints.map((waypoint) => (
                <Marker
                  key={waypoint.id}
                  position={waypoint.position}
                  title={`Rank #${waypoint.rank}`}
                  icon={createMarkerIcon({
                    id: waypoint.id,
                    position: waypoint.position,
                    title: `Rank #${waypoint.rank}`,
                    rank: waypoint.rank,
                  })}
                  onClick={(e) => {
                    e.stop();
                    onWaypointClick && onWaypointClick(waypoint.id);
                  }}
                  animation={
                    selectedWaypoint === waypoint.id
                      ? google.maps.Animation.BOUNCE
                      : undefined
                  }
                />
              ))}

              {/* Render enhanced waypoint markers */}
              {waypointData.map((waypoint, index) => {
                const rank = waypoint.isCenter ? undefined : index;
                // Use temp position during drag, otherwise use original position
                const position =
                  tempWaypointPositions[waypoint.id] || waypoint.coordinates;

                // In report mode, show ranking info in title
                const title = reportMode
                  ? (waypoint.isCenter
                      ? "Center Location"
                      : `Waypoint ${waypoint.label || index} - ${waypoint.ranking ? `Rank ${waypoint.ranking}` : 'Not Found'}`
                    )
                  : (waypoint.isCenter ? "Center" : `Waypoint #${rank}`);

                return (
                  <Marker
                    key={waypoint.id}
                    position={position}
                    title={title}
                    icon={createWaypointIcon(waypoint, rank)}
                    onClick={(e) => {
                      // Disable clicking in report mode
                      if (!reportMode) {
                        handleWaypointClick(waypoint, e);
                      }
                    }}
                    draggable={!reportMode} // Disable dragging in report mode
                    onDragStart={!reportMode ? (event) => handleDragStart(waypoint.id, event) : undefined}
                    onDrag={!reportMode ? (event) => handleDrag(waypoint.id, event) : undefined}
                    onDragEnd={!reportMode ? (event) => handleDragEnd(waypoint.id, event) : undefined}
                    animation={
                      selectedWaypoint === waypoint.id && !reportMode
                        ? google.maps.Animation.BOUNCE
                        : undefined
                    }
                    opacity={waypoint.enabled ? 1.0 : 0.6}
                  />
                );
              })}
            </GoogleMap>
          </div>

          {/* Map Controls - Below the map (hidden in report mode) */}
          {!reportMode && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Enable all waypoints
                      if (onWaypointToggle && waypointData.length > 0) {
                        waypointData.forEach((waypoint) => {
                          if (!waypoint.enabled && !waypoint.isCenter) {
                            onWaypointToggle(waypoint.id);
                          }
                        });
                      }
                    }}
                    className="gap-2"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Enable All Pins
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Fit bounds to show all waypoints with optimal zoom
                      if (map && waypointData.length > 0) {
                        const bounds = new google.maps.LatLngBounds();
                        waypointData.forEach((waypoint) => {
                          bounds.extend(waypoint.coordinates);
                        });

                        // Fit bounds to show all waypoints
                        map.fitBounds(bounds);

                        // Add padding around the waypoints for better visibility
                        setTimeout(() => {
                          map.fitBounds(bounds, {
                            top: 50,
                            bottom: 50,
                            left: 50,
                            right: 50,
                          });
                        }, 100);
                      }
                    }}
                    className="gap-2"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="4"></circle>
                    </svg>
                    Center Pin
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  {waypointData.filter((w) => w.enabled).length} of{" "}
                  {waypointData.length} pins enabled
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default GoogleMapComponent;
