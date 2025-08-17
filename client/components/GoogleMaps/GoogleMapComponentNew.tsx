import React, { useState, useCallback, useMemo, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Navigation,
  Maximize,
  ZoomIn,
  ZoomOut,
  Target,
} from "lucide-react";
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
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [draggedWaypoint, setDraggedWaypoint] = useState<string | null>(null);
  const originalCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasInitializedBounds = useRef(false);
  const previousWaypointCount = useRef(0);

  const apiKey = getGoogleMapsApiKey();
  console.log(
    "GoogleMapComponent: Using API key:",
    apiKey ? `${apiKey.substring(0, 10)}...` : "MISSING",
  );


  // Function to calculate optimal zoom based on waypoint spread
  const calculateOptimalZoom = useCallback(
    (bounds: google.maps.LatLngBounds, waypointCount: number) => {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      // Calculate the distance span in degrees
      const latSpan = ne.lat() - sw.lat();
      const lngSpan = ne.lng() - sw.lng();
      const maxSpan = Math.max(latSpan, lngSpan);

      // Calculate base zoom from geographic spread
      let optimalZoom: number;
      if (maxSpan >= 1.0) optimalZoom = 8;
      else if (maxSpan >= 0.5) optimalZoom = 9;
      else if (maxSpan >= 0.25) optimalZoom = 10;
      else if (maxSpan >= 0.125) optimalZoom = 11;
      else if (maxSpan >= 0.0625) optimalZoom = 12;
      else if (maxSpan >= 0.03125) optimalZoom = 13;
      else if (maxSpan >= 0.015625) optimalZoom = 14;
      else if (maxSpan >= 0.0078125) optimalZoom = 15;
      else if (maxSpan >= 0.00390625) optimalZoom = 16;
      else optimalZoom = 17;

      // Fine-tune based on waypoint density
      const densityFactor = Math.log10(waypointCount + 1) / 2; // 0 to ~1 range
      const adjustedZoom = optimalZoom - densityFactor;

      // Ensure zoom is within reasonable bounds with gradual constraints
      const finalZoom = Math.max(
        7,
        Math.min(18, Math.round(adjustedZoom * 2) / 2),
      ); // Round to 0.5 increments

      console.log(
        `Optimal zoom calculation: span=${maxSpan.toFixed(6)}, count=${waypointCount}, base=${optimalZoom}, adjusted=${adjustedZoom.toFixed(2)}, final=${finalZoom}`,
      );
      return finalZoom;
    },
    [],
  );

  // Function to auto-fit map bounds to show all waypoints with gradual zoom control
  const autoFitBounds = useCallback(() => {
    if (map && waypointData.length > 0) {
      if (waypointData.length === 1) {
        // Single waypoint - center on it with a reasonable zoom
        map.setCenter(waypointData[0].coordinates);
        map.setZoom(14);
      } else {
        // Multiple waypoints - calculate optimal zoom based on spread
        const bounds = new google.maps.LatLngBounds();
        waypointData.forEach((wp) => {
          bounds.extend(wp.coordinates);
        });

        // Calculate optimal zoom before fitting bounds
        const optimalZoom = calculateOptimalZoom(bounds, waypointData.length);

        // Fit bounds first
        map.fitBounds(bounds);

        // Apply gradual zoom adjustment with smooth transitions
        setTimeout(() => {
          const currentZoom = map.getZoom();
          if (currentZoom && Math.abs(currentZoom - optimalZoom) > 0.25) {
            // Create smooth zoom transition in smaller steps
            const zoomDiff = optimalZoom - currentZoom;
            const steps = Math.ceil(Math.abs(zoomDiff) / 0.5); // 0.5 zoom level steps
            const stepSize = zoomDiff / steps;

            let currentStep = 0;
            const smoothZoom = () => {
              if (currentStep < steps) {
                const nextZoom = currentZoom + stepSize * (currentStep + 1);
                map.setZoom(Math.round(nextZoom * 4) / 4); // Quarter-level precision
                currentStep++;
                setTimeout(smoothZoom, 50); // 50ms between steps for smooth animation
              }
            };

            smoothZoom();
            console.log(
              `Gradual zoom transition: ${currentZoom.toFixed(1)} → ${optimalZoom} in ${steps} steps (${waypointData.length} waypoints)`,
            );
          }
        }, 100);
      }
    }
  }, [map, waypointData, calculateOptimalZoom]);

  // Auto-zoom when waypoints change
  React.useEffect(() => {
    const currentWaypointCount = waypointData.length;

    // Auto-fit bounds when waypoints change
    if (
      map &&
      waypointData.length > 0 &&
      hasInitializedBounds.current // Only auto-zoom after initial load
    ) {
      console.log(
        `Waypoints updated (count: ${currentWaypointCount}), auto-fitting bounds`,
      );
      setTimeout(() => {
        autoFitBounds();
      }, 100);
    }

    previousWaypointCount.current = currentWaypointCount;
  }, [waypointData, map, autoFitBounds]);

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
      // Enable smooth zoom transitions for more gradual control
      gestureHandling: "cooperative",
      scrollwheel: true,
      clickableIcons: false,
      // Custom zoom increments
      minZoom: 1,
      maxZoom: 20,
    }),
    [showControls],
  );

  // Determine the center of the map
  const mapCenter = useMemo(() => {
    try {
      if (center) return center;
      if (lat !== undefined && lng !== undefined) return { lat, lng };
      if (waypointData.length > 0) {
        const centerWaypoint = waypointData.find((w) => w.isCenter && w.coordinates);
        if (centerWaypoint && centerWaypoint.coordinates) return centerWaypoint.coordinates;

        const validWaypoints = waypointData.filter(w => w.coordinates && typeof w.coordinates.lat === 'number' && typeof w.coordinates.lng === 'number');
        if (validWaypoints.length > 0) {
          const avgLat = validWaypoints.reduce((sum, w) => sum + w.coordinates.lat, 0) / validWaypoints.length;
          const avgLng = validWaypoints.reduce((sum, w) => sum + w.coordinates.lng, 0) / validWaypoints.length;
          return { lat: avgLat, lng: avgLng };
        }
      }
      if (markers.length > 0) {
        const validMarkers = markers.filter(m => m.position && typeof m.position.lat === 'number' && typeof m.position.lng === 'number');
        if (validMarkers.length > 0) {
          const avgLat = validMarkers.reduce((sum, m) => sum + m.position.lat, 0) / validMarkers.length;
          const avgLng = validMarkers.reduce((sum, m) => sum + m.position.lng, 0) / validMarkers.length;
          return { lat: avgLat, lng: avgLng };
        }
      }
      if (waypoints.length > 0) {
        const validWaypoints = waypoints.filter(w => w.position && typeof w.position.lat === 'number' && typeof w.position.lng === 'number');
        if (validWaypoints.length > 0) {
          const avgLat = validWaypoints.reduce((sum, w) => sum + w.position.lat, 0) / validWaypoints.length;
          const avgLng = validWaypoints.reduce((sum, w) => sum + w.position.lng, 0) / validWaypoints.length;
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
      try {
        console.log("GoogleMapComponent: Map loaded successfully", map);
        setMap(map);

        // Only fit bounds on initial load to prevent page jumping during interaction
        if (waypointData.length > 1 && !hasInitializedBounds.current) {
          hasInitializedBounds.current = true;
          setTimeout(() => {
            try {
              const bounds = new google.maps.LatLngBounds();
              waypointData.forEach((wp) => {
                if (wp.coordinates && wp.coordinates.lat && wp.coordinates.lng) {
                  bounds.extend(wp.coordinates);
                }
              });
              map.fitBounds(bounds);

              // Ensure reasonable zoom level
              setTimeout(() => {
                const currentZoom = map.getZoom();
                if (currentZoom && currentZoom > 15) {
                  map.setZoom(15);
                }
              }, 300);
            } catch (error) {
              console.warn("Error fitting bounds:", error);
            }
          }, 500); // Longer delay to ensure everything is loaded
        }

        // Add custom zoom event listener for 0.5 increments
        let isUpdatingZoom = false;

        map.addListener('zoom_changed', () => {
          if (isUpdatingZoom) return;

          try {
            const newZoom = map.getZoom();
            if (newZoom !== undefined) {
              // Round to nearest 0.5
              const roundedZoom = Math.round(newZoom * 2) / 2;
              if (Math.abs(roundedZoom - newZoom) > 0.1) {
                isUpdatingZoom = true;
                setTimeout(() => {
                  try {
                    map.setZoom(roundedZoom);
                  } catch (error) {
                    console.warn("Error setting zoom:", error);
                  }
                  isUpdatingZoom = false;
                }, 100);
              }
            }
          } catch (error) {
            console.warn("Error in zoom listener:", error);
          }
        });

        // Create info window (but keep it closed)
        const infoWindowInstance = new google.maps.InfoWindow();
        setInfoWindow(infoWindowInstance);

        if (onMapLoad) {
          onMapLoad(map);
        }
      } catch (error) {
        console.error("Error in map onLoad:", error);
      }
    },
    [onMapLoad, waypointData],
  );

  const onUnmount = useCallback(() => {
    setMap(null);
    setInfoWindow(null);
  }, []);

  // Handle waypoint click (toggle enabled/disabled)
  const handleWaypointClick = useCallback(
    (waypoint: WaypointType, event?: any) => {
      if (isDragging) return; // Don't toggle during drag

      // Only prevent default, don't stop propagation for Google Maps
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

  // Handle marker click
  const handleMarkerClick = useCallback(
    (marker: MapMarker) => {
      // Close any open info windows
      if (infoWindow) {
        infoWindow.close();
      }

      if (onMarkerClick) {
        onMarkerClick(marker);
      }
    },
    [onMarkerClick, infoWindow],
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (waypointId: string, event?: any) => {
      // Don't prevent events for Google Maps drag functionality
      setIsDragging(true);
      setDraggedWaypoint(waypointId);

      // Store original positions for relative movement calculation
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

  // Handle drag end - always move all waypoints together
  const handleDragEnd = useCallback(
    (waypointId: string, event: google.maps.MapMouseEvent) => {
      setIsDragging(false);
      setDraggedWaypoint(null);

      if (
        event.latLng &&
        scanConfig &&
        originalCenterRef.current &&
        onWaypointsDragComplete
      ) {
        const newPosition = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };

        // Always move all waypoints together, regardless of which one was dragged
        const draggedWaypoint = waypointData.find((w) => w.id === waypointId);
        if (draggedWaypoint) {
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

            // Recalculate distance and bearing from new center
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

          // Auto-adjust map bounds
          if (map) {
            setTimeout(() => {
              const bounds = new google.maps.LatLngBounds();
              updatedWaypoints.forEach((wp) => {
                bounds.extend(wp.coordinates);
              });
              map.fitBounds(bounds);
            }, 100);
          }
        }
      }

      originalCenterRef.current = null;
    },
    [onWaypointsDragComplete, waypointData, scanConfig, map],
  );

  // Create marker icon for waypoints - classic teardrop pin shape
  const createWaypointIcon = useCallback(
    (waypoint: WaypointType, rank?: number) => {
      const isCenter = waypoint.isCenter;
      const isEnabled = waypoint.enabled;
      const color = isCenter ? "#9333ea" : isEnabled ? "#2563eb" : "#6b7280"; // Purple for center, blue for enabled, grey for disabled
      const strokeWidth = isEnabled ? 4 : 3; // Thicker stroke
      const strokeOpacity = isEnabled ? 1.0 : 0.6;

      if (isCenter) {
        // Purple center hollow teardrop pin
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
            <path d="M16 2 C8.268 2 2 8.268 2 16 C2 23.732 16 40 16 40 C16 40 30 23.732 30 16 C30 8.268 23.732 2 16 2 Z"
                  fill="transparent" stroke="${color}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="16" cy="16" r="4" fill="transparent" stroke="${color}" stroke-width="2" stroke-opacity="${strokeOpacity}"/>
          </svg>
        `)}`,
          scaledSize: new google.maps.Size(32, 42),
          anchor: new google.maps.Point(16, 40),
        };
      } else {
        // Hollow teardrop pin for waypoints
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
            <path d="M13 2 C6.925 2 2 6.925 2 13 C2 19.075 13 32 13 32 C13 32 24 19.075 24 13 C24 6.925 19.075 2 13 2 Z"
                  fill="transparent" stroke="${color}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
        `)}`,
          scaledSize: new google.maps.Size(26, 34),
          anchor: new google.maps.Point(13, 32),
        };
      }
    },
    [],
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
                return (
                  <Marker
                    key={waypoint.id}
                    position={waypoint.coordinates}
                    title={waypoint.isCenter ? "Center" : `Waypoint #${rank}`}
                    icon={createWaypointIcon(waypoint, rank)}
                    onClick={(e) => {
                      handleWaypointClick(waypoint, e);
                    }}
                    draggable={true}
                    onDragStart={(event) => handleDragStart(waypoint.id, event)}
                    onDragEnd={(event) => handleDragEnd(waypoint.id, event)}
                    animation={
                      selectedWaypoint === waypoint.id
                        ? google.maps.Animation.BOUNCE
                        : undefined
                    }
                    opacity={waypoint.enabled ? 1.0 : 0.6}
                  />
                );
              })}
            </GoogleMap>
          </div>


          {(showDirectionsButton ||
            address ||
            (lat !== undefined && lng !== undefined) ||
            center) && (
            <div className="flex justify-between items-center gap-2 border-t border-gray-200 pt-4">
              <div className="flex-1 min-w-0">
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
    </>
  );
};


export default GoogleMapComponent;
