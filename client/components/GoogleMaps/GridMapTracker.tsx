import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "@/lib/googleMaps";

interface GridMapTrackerProps {
  center?: { lat: number; lng: number };
  gridType?: "square" | "circle";
  gridSize?: number;
  pinSpacing?: number; // Distance between pins in meters
  rankings?: Record<string, number | null>;
  disabledPoints?: string[];
  onGridChange?: (gridPoints: any[]) => void;
  height?: string;
  className?: string;
}

const GridMapTracker: React.FC<GridMapTrackerProps> = ({
  center = { lat: 40.7128, lng: -74.006 },
  gridType = "square", // 'square' or 'circle'
  gridSize = 5, // For square: 3-20, For circle: see circleConfig
  pinSpacing = 1000, // Distance between pins in meters
  rankings = {},
  disabledPoints = [],
  onGridChange = () => {},
  height = "800px",
  className = "",
}) => {
  const [markers, setMarkers] = useState<any[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGridDragging, setIsGridDragging] = useState(false);
  const [isDraggingAllPins, setIsDraggingAllPins] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gridCenter, setGridCenter] = useState(center);
  const mapRef = useRef<google.maps.Map | null>(null);
  const onGridChangeRef = useRef(onGridChange);

  // Update ref when callback changes
  useEffect(() => {
    onGridChangeRef.current = onGridChange;
  }, [onGridChange]);

  // Update gridCenter when center prop changes, but only if not dragging
  useEffect(() => {
    if (!isGridDragging) {
      setGridCenter(center);
    }
  }, [center, isGridDragging]);

  const apiKey = getGoogleMapsApiKey();

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
  });

  const mapContainerStyle = {
    width: "100%",
    height: height,
  };

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: false, // Disable to avoid showing both km/miles
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
      // Force imperial units
      region: "US",
    }),
    [isLoaded],
  );

  // Circle grid configurations (10-15 options)
  const circleConfigs: Record<number, { rings: number; pattern: number[] }> = {
    7: { rings: 2, pattern: [1, 6] }, // 7 points: center + 6
    13: { rings: 2, pattern: [1, 6, 6] }, // 13 points: center + 6 + 6
    19: { rings: 2, pattern: [1, 6, 12] }, // 19 points: center + 6 + 12
    21: { rings: 3, pattern: [1, 6, 6, 8] }, // 21 points
    25: { rings: 3, pattern: [1, 8, 16] }, // 25 points
    31: { rings: 3, pattern: [1, 6, 12, 12] }, // 31 points
    37: { rings: 3, pattern: [1, 6, 12, 18] }, // 37 points
    43: { rings: 3, pattern: [1, 8, 16, 18] }, // 43 points
    49: { rings: 3, pattern: [1, 8, 16, 24] }, // 49 points
    55: { rings: 4, pattern: [1, 6, 12, 18, 18] }, // 55 points
    61: { rings: 4, pattern: [1, 6, 12, 18, 24] }, // 61 points
    69: { rings: 4, pattern: [1, 8, 16, 20, 24] }, // 69 points
    73: { rings: 4, pattern: [1, 8, 16, 24, 24] }, // 73 points
    85: { rings: 4, pattern: [1, 8, 16, 24, 36] }, // 85 points
    91: { rings: 4, pattern: [1, 6, 12, 24, 48] }, // 91 points
  };

  // Generate circle grid positions
  const generateCirclePositions = useCallback(
    (
      centerPoint: { lat: number; lng: number },
      config: { rings: number; pattern: number[] },
      spacing: number,
      disabledPointsList: string[],
    ) => {
      const positions = [];
      const earthRadius = 6371000;
      let pointIndex = 0;

      // Add center point
      positions.push({
        id: `center`,
        position: { ...centerPoint },
        label: "C",
        isCenter: true,
        disabled: disabledPointsList.includes("center"),
        ring: 0,
        index: pointIndex++,
      });

      // Add points in concentric rings
      for (let ring = 1; ring < config.pattern.length; ring++) {
        const pointsInRing = config.pattern[ring];
        const radius = ring * spacing;

        for (let i = 0; i < pointsInRing; i++) {
          const angle = (2 * Math.PI * i) / pointsInRing;

          // Calculate position
          const xOffset = radius * Math.cos(angle);
          const yOffset = radius * Math.sin(angle);

          const latOffset = (yOffset / earthRadius) * (180 / Math.PI);
          const lngOffset =
            ((xOffset / earthRadius) * (180 / Math.PI)) /
            Math.cos((centerPoint.lat * Math.PI) / 180);

          const id = `ring${ring}-${i}`;
          positions.push({
            id,
            position: {
              lat: centerPoint.lat + latOffset,
              lng: centerPoint.lng + lngOffset,
            },
            label: `R${ring}P${i + 1}`,
            isCenter: false,
            disabled: disabledPointsList.includes(id),
            ring,
            index: pointIndex++,
          });
        }
      }

      return positions;
    },
    [],
  );

  // Generate square grid positions
  const generateSquarePositions = useCallback(
    (
      centerPoint: { lat: number; lng: number },
      size: number,
      spacing: number,
      disabledPointsList: string[],
    ) => {
      const positions = [];
      const earthRadius = 6371000;
      const halfGrid = Math.floor(size / 2);

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const id = `${row}-${col}`;

          // Calculate offset from center
          const xOffset = (col - halfGrid) * spacing;
          const yOffset = (halfGrid - row) * spacing;

          // Convert meters to lat/lng offset
          const latOffset = (yOffset / earthRadius) * (180 / Math.PI);
          const lngOffset =
            ((xOffset / earthRadius) * (180 / Math.PI)) /
            Math.cos((centerPoint.lat * Math.PI) / 180);

          positions.push({
            id,
            position: {
              lat: centerPoint.lat + latOffset,
              lng: centerPoint.lng + lngOffset,
            },
            row,
            col,
            label: `${String.fromCharCode(65 + row)}${col + 1}`,
            isCenter: row === halfGrid && col === halfGrid,
            disabled: disabledPointsList.includes(id),
          });
        }
      }
      return positions;
    },
    [],
  );

  // Generate positions based on grid type
  const generateGridPositions = useCallback(
    (
      centerPoint: { lat: number; lng: number },
      type: string,
      size: number,
      spacing: number,
      disabledPointsList: string[],
    ) => {
      if (type === "circle") {
        const config = circleConfigs[size];
        if (!config) {
          console.warn(
            `Invalid circle size: ${size}, falling back to 25 points`,
          );
          // Fallback to a valid circle configuration
          const fallbackConfig = circleConfigs[25];
          if (fallbackConfig) {
            return generateCirclePositions(
              centerPoint,
              fallbackConfig,
              spacing,
              disabledPointsList,
            );
          }
          return [];
        }
        return generateCirclePositions(
          centerPoint,
          config,
          spacing,
          disabledPointsList,
        );
      } else {
        return generateSquarePositions(
          centerPoint,
          size,
          spacing,
          disabledPointsList,
        );
      }
    },
    [generateCirclePositions, generateSquarePositions],
  );

  // Initialize markers when any grid configuration changes
  useEffect(() => {
    const newMarkers = generateGridPositions(
      gridCenter,
      gridType,
      gridSize,
      pinSpacing,
      disabledPoints,
    );
    setMarkers(newMarkers);
    // Don't call onGridChange during initialization to prevent infinite loops
  }, [
    gridCenter,
    gridType,
    gridSize,
    pinSpacing,
    disabledPoints,
    generateGridPositions,
  ]);

  // Auto-fit bounds when markers change - deferred to prevent setState during render
  useEffect(() => {
    if (mapRef.current && markers.length > 0) {
      // Use setTimeout to defer the map operation and prevent render-time state updates
      const timeoutId = setTimeout(() => {
        if (mapRef.current && markers.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          markers.forEach((marker: any) => {
            bounds.extend(
              new google.maps.LatLng(marker.position.lat, marker.position.lng),
            );
          });
          mapRef.current.fitBounds(bounds);
          const zoom = mapRef.current.getZoom();
          if (zoom && zoom > 16) {
            mapRef.current.setZoom(16); // Prevent zooming too close
          }
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [markers]);

  // Get color based on marker state
  const getMarkerColor = useCallback((marker: any) => {
    if (marker.disabled) return "#808080"; // Solid grey for disabled pins
    if (marker.isCenter) return "#DC2626"; // Red for center pin
    return "#4285F4"; // Blue for regular pins
  }, []);

  // Create waypoint-style SVG icon
  const createWaypointIcon = useCallback(
    (marker: any) => {
      const color = getMarkerColor(marker);
      const isDisabled = marker.disabled;
      const opacity = 1; // Always solid, no transparency

      const svg = `
      <svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
        <g opacity="${opacity}">
          <ellipse cx="16" cy="46" rx="10" ry="2" fill="black" opacity="0.2"/>
          <path d="M16 0 C7.2 0 0 7.2 0 16 C0 24.8 16 48 16 48 S32 24.8 32 16 C32 7.2 24.8 0 16 0 Z"
                fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="16" cy="16" r="8" fill="white"/>
          ${
            marker.isCenter
              ? '<circle cx="16" cy="16" r="3" fill="' + color + '"/>'
              : '<text x="16" y="20" text-anchor="middle" font-size="10" font-weight="bold" fill="' +
                color +
                '">' +
                (gridType === "circle"
                  ? marker.index || ""
                  : marker.label?.slice(-1) || "") +
                "</text>"
          }
        </g>
      </svg>
    `;

      return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(32, 48),
        anchor: new google.maps.Point(16, 48),
        labelOrigin: new google.maps.Point(16, -8),
      };
    },
    [getMarkerColor, gridType],
  );



  // Toggle waypoint disabled state (except center pin)
  const toggleWaypointDisabled = useCallback((markerId: string) => {
    setMarkers((prevMarkers) => {
      const updatedMarkers = prevMarkers.map((marker: any) => {
        // Don't allow toggling the center pin
        if (marker.isCenter) return marker;

        return marker.id === markerId
          ? { ...marker, disabled: !marker.disabled }
          : marker;
      });
      // Defer onGridChange to prevent setState during render
      setTimeout(() => onGridChangeRef.current(updatedMarkers), 0);
      return updatedMarkers;
    });
  }, []);

  // Handle marker click to toggle disabled state
  const handleMarkerClick = useCallback((markerId: string) => {
    // Don't toggle if we're in the middle of dragging
    if (isDraggingAllPins) return;

    const marker = markers.find((m: any) => m.id === markerId);
    if (marker && !marker.isCenter) {
      toggleWaypointDisabled(markerId);
    }
  }, [isDraggingAllPins, markers, toggleWaypointDisabled]);

  // Handle marker drag to move all pins
  const handleMarkerMouseDown = useCallback(
    (markerId: string, e: google.maps.MapMouseEvent) => {
      e.stop();

      const startPosition = e.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null;
      let hasDragged = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!hasDragged && startPosition) {
          hasDragged = true;
          setIsDraggingAllPins(true);
          setDragStartPosition(startPosition);
        }
      };

      const handleMouseUp = () => {
        if (isDraggingAllPins) {
          setIsDraggingAllPins(false);
          setDragStartPosition(null);
          // Notify parent of final positions after drag-all operation completes
          setTimeout(() => onGridChangeRef.current(markers), 0);
        }

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isDraggingAllPins, markers, onGridChangeRef],
  );

  // Generate grid lines based on type
  const gridLines = useMemo(() => {
    const lines = [];
    const activeMarkers = markers.filter((m: any) => !m.disabled);

    if (gridType === "square") {
      // Square grid lines - horizontal and vertical
      const rows: Record<string, any[]> = {};
      const cols: Record<string, any[]> = {};

      activeMarkers.forEach((marker: any) => {
        if (marker.row !== undefined) {
          if (!rows[marker.row]) rows[marker.row] = [];
          rows[marker.row].push(marker.position);
        }
        if (marker.col !== undefined) {
          if (!cols[marker.col]) cols[marker.col] = [];
          cols[marker.col].push(marker.position);
        }
      });

      Object.entries(rows).forEach(([row, positions]) => {
        if (positions.length > 1) {
          positions.sort((a, b) => a.lng - b.lng);
          lines.push({ id: `h-${row}`, path: positions });
        }
      });

      Object.entries(cols).forEach(([col, positions]) => {
        if (positions.length > 1) {
          positions.sort((a, b) => b.lat - a.lat);
          lines.push({ id: `v-${col}`, path: positions });
        }
      });
    } else {
      // Circle grid lines - connect points in same ring and to center
      const rings: Record<string, any[]> = {};
      let centerMarker = null;

      activeMarkers.forEach((marker: any) => {
        if (marker.isCenter) {
          centerMarker = marker;
        } else if (marker.ring !== undefined) {
          if (!rings[marker.ring]) rings[marker.ring] = [];
          rings[marker.ring].push(marker);
        }
      });

      // Connect points in each ring
      Object.entries(rings).forEach(([ring, ringMarkers]) => {
        if (ringMarkers.length > 1) {
          const ringPath = ringMarkers
            .sort((a, b) => {
              const angleA = Math.atan2(
                a.position.lat - centerMarker.position.lat,
                a.position.lng - centerMarker.position.lng,
              );
              const angleB = Math.atan2(
                b.position.lat - centerMarker.position.lat,
                b.position.lng - centerMarker.position.lng,
              );
              return angleA - angleB;
            })
            .map((m: any) => m.position);
          ringPath.push(ringPath[0]); // Close the ring
          lines.push({ id: `ring-${ring}`, path: ringPath });
        }
      });

      // Connect center to first ring
      if (centerMarker && rings[1] && rings[1].length > 0) {
        rings[1].forEach((marker: any, i: number) => {
          lines.push({
            id: `spoke-${i}`,
            path: [centerMarker.position, marker.position],
          });
        });
      }
    }

    return lines;
  }, [markers, gridType]);

  if (!isLoaded) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-gray-50 ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading interactive map...</p>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-red-50 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-red-600">
          <p className="text-sm font-medium">Google Maps API Key Required</p>
          <p className="text-xs mt-1">Configure your API key in settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden border ${className}`}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;

          // Defer auto-fit bounds to avoid setState during render
          setTimeout(() => {
            if (markers.length > 0 && mapRef.current) {
              const bounds = new google.maps.LatLngBounds();
              markers.forEach((marker: any) => {
                bounds.extend(
                  new google.maps.LatLng(
                    marker.position.lat,
                    marker.position.lng,
                  ),
                );
              });
              mapRef.current.fitBounds(bounds);
              const zoom = mapRef.current.getZoom();
              if (zoom && zoom > 16) {
                mapRef.current.setZoom(16); // Prevent zooming too close
              }
            }
          }, 100);
        }}
        onMouseDown={(e) => {
          if (e.latLng && !isDragging && !isGridDragging) {
            setDragStartPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        }}
        onMouseUp={() => {
          if (isDraggingAllPins && dragStartPosition) {
            setIsDraggingAllPins(false);
            setDragStartPosition(null);
            // Notify parent of final positions after drag-all operation completes
            setTimeout(() => onGridChangeRef.current(markers), 0);
          }
        }}
        onMouseMove={(e) => {
          if (isDraggingAllPins && dragStartPosition && e.latLng) {
            const deltaLat = e.latLng.lat() - dragStartPosition.lat;
            const deltaLng = e.latLng.lng() - dragStartPosition.lng;

            // Throttle updates to prevent excessive renders
            setMarkers((prevMarkers) => {
              const updatedMarkers = prevMarkers.map((marker: any) => ({
                ...marker,
                position: {
                  lat: marker.position.lat + deltaLat,
                  lng: marker.position.lng + deltaLng,
                },
              }));
              return updatedMarkers;
            });

            setDragStartPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        }}
      >
        {/* Grid lines */}
        {gridLines.map((line: any) => (
          <Polyline
            key={line.id}
            path={line.path}
            options={{
              strokeColor: "#4285F4",
              strokeOpacity: 0.4,
              strokeWeight: 2,
              geodesic: true,
              strokePattern:
                gridType === "circle" && line.id.startsWith("ring")
                  ? undefined
                  : [
                      {
                        icon: {
                          path: "M 0,-1 0,1",
                          strokeOpacity: 1,
                          scale: 4,
                        },
                        offset: "0",
                        repeat: "20px",
                      },
                    ],
            }}
          />
        ))}

        {/* Markers */}
        {markers.map((marker: any) => {
          const isCenter = marker.isCenter;

          return (
            <Marker
              key={marker.id}
              position={marker.position}
              draggable={false} // No individual dragging - all pins move together
              icon={createWaypointIcon(marker)}
              label={
                marker.disabled
                  ? {
                      text: "DISABLED",
                      color: "#666666",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }
                  : undefined
              }
              // No individual drag handlers - using mouseDown for unified behavior
              onMouseDown={(e) => handleMarkerMouseDown(marker.id, e)}
              onClick={() => !isDraggingAllPins && setSelectedMarker(marker)}
              opacity={1} // Always solid, color change handles disabled state
              zIndex={isCenter ? 1000 : marker.disabled ? 1 : 100}
            />
          );
        })}

        {/* Info Window */}
        {selectedMarker && !isDragging && !isGridDragging && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              <h3 className="font-bold text-sm">{selectedMarker.label}</h3>
              {selectedMarker.isCenter && (
                <p className="text-xs text-blue-600 font-bold mt-1">
                  CENTER (Drag to move grid)
                </p>
              )}
              <p className="text-xs mt-1">
                Status: {selectedMarker.disabled ? "Disabled" : "Active"}
              </p>
              <p className="text-xs mt-1">
                Ranking: {rankings[selectedMarker.id] || "Not ranked"}
              </p>
              <p className="text-xs mt-1">
                Lat: {selectedMarker.position.lat.toFixed(6)}
              </p>
              <p className="text-xs mt-1">
                Lng: {selectedMarker.position.lng.toFixed(6)}
              </p>
              {!selectedMarker.isCenter && (
                <button
                  onClick={() => toggleWaypointDisabled(selectedMarker.id)}
                  className={`mt-2 px-2 py-1 text-xs rounded ${
                    selectedMarker.disabled
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  {selectedMarker.disabled ? "Enable" : "Disable"} Waypoint
                </button>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default GridMapTracker;
