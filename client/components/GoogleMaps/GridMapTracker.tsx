import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { getGoogleMapsApiKey } from '@/lib/googleMaps';

interface GridMapTrackerProps {
  center?: { lat: number; lng: number };
  gridSize?: number;
  gridRadius?: number; // in meters
  pattern?: 'grid' | 'circle' | 'line';
  pointCount?: number;
  rankings?: Record<string, number | null>;
  onGridChange?: (gridPoints: any[]) => void;
  height?: string;
  className?: string;
}

const GridMapTracker: React.FC<GridMapTrackerProps> = ({
  center = { lat: 40.7128, lng: -74.0060 },
  gridSize = 5,
  gridRadius = 5000, // in meters
  pattern = 'grid',
  pointCount = 25,
  rankings = {},
  onGridChange = () => {},
  height = '600px',
  className = ''
}) => {
  const [markers, setMarkers] = useState<any[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const apiKey = getGoogleMapsApiKey();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: ['places']
  });

  const mapContainerStyle = {
    width: '100%',
    height: height
  };

  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true
  };

  // Generate initial grid positions
  const generateGridPositions = useCallback((centerPoint: { lat: number; lng: number }, size: number, radius: number) => {
    const positions = [];
    const earthRadius = 6371000; // Earth's radius in meters
    const halfGrid = Math.floor(size / 2);
    const spacing = (radius * 2) / (size - 1);

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const id = `${row}-${col}`;
        
        // Calculate offset from center
        const xOffset = (col - halfGrid) * spacing;
        const yOffset = (halfGrid - row) * spacing;

        // Convert meters to lat/lng offset
        const latOffset = (yOffset / earthRadius) * (180 / Math.PI);
        const lngOffset = (xOffset / earthRadius) * (180 / Math.PI) / Math.cos(centerPoint.lat * Math.PI / 180);

        positions.push({
          id,
          position: {
            lat: centerPoint.lat + latOffset,
            lng: centerPoint.lng + lngOffset
          },
          row,
          col,
          label: `${String.fromCharCode(65 + row)}${col + 1}` // A1, A2, B1, etc.
        });
      }
    }
    return positions;
  }, []);

  // Initialize markers on mount or when center/grid changes
  useEffect(() => {
    const newMarkers = generateGridPositions(center, gridSize, gridRadius);
    setMarkers(newMarkers);
  }, [center, gridSize, gridRadius, generateGridPositions]);

  // Get color based on ranking
  const getMarkerColor = useCallback((markerId: string) => {
    const ranking = rankings[markerId];
    if (!ranking) return '#808080'; // Gray for no ranking
    if (ranking <= 3) return '#00FF00'; // Green for top 3
    if (ranking <= 10) return '#FFFF00'; // Yellow for 4-10
    if (ranking <= 20) return '#FFA500'; // Orange for 11-20
    return '#FF0000'; // Red for 20+
  }, [rankings]);

  // Create custom marker icon with number and color
  const createMarkerIcon = useCallback((marker: any) => {
    const color = getMarkerColor(marker.id);
    
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.8,
      strokeColor: '#000000',
      strokeWeight: 2,
      scale: 20,
      labelOrigin: new google.maps.Point(0, 0)
    };
  }, [getMarkerColor]);

  // Handle marker drag
  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent, markerId: string) => {
    if (!e.latLng) return;

    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();

    setMarkers(prevMarkers => {
      const updatedMarkers = prevMarkers.map(marker =>
        marker.id === markerId
          ? { ...marker, position: { lat: newLat, lng: newLng } }
          : marker
      );

      // Call onGridChange - parent handles timing
      onGridChange(updatedMarkers);

      return updatedMarkers;
    });
    setIsDragging(false);
  }, [onGridChange]);

  // Generate grid lines (polylines)
  const gridLines = useMemo(() => {
    const lines = [];
    
    // Horizontal lines
    for (let row = 0; row < gridSize; row++) {
      const path = [];
      for (let col = 0; col < gridSize; col++) {
        const marker = markers.find(m => m.row === row && m.col === col);
        if (marker) path.push(marker.position);
      }
      if (path.length > 1) {
        lines.push({
          id: `h-${row}`,
          path
        });
      }
    }
    
    // Vertical lines
    for (let col = 0; col < gridSize; col++) {
      const path = [];
      for (let row = 0; row < gridSize; row++) {
        const marker = markers.find(m => m.row === row && m.col === col);
        if (marker) path.push(marker.position);
      }
      if (path.length > 1) {
        lines.push({
          id: `v-${col}`,
          path
        });
      }
    }
    
    return lines;
  }, [markers, gridSize]);

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center rounded-lg border bg-gray-50 ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading interactive map...</p>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className={`flex items-center justify-center rounded-lg border bg-red-50 ${className}`} style={{ height }}>
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
        zoom={12}
        options={mapOptions}
      >
        {/* Grid lines */}
        {gridLines.map(line => (
          <Polyline
            key={line.id}
            path={line.path}
            options={{
              strokeColor: '#0000FF',
              strokeOpacity: 0.3,
              strokeWeight: 2,
              geodesic: true
            }}
          />
        ))}

        {/* Markers */}
        {markers.map(marker => {
          const ranking = rankings[marker.id];
          return (
            <Marker
              key={marker.id}
              position={marker.position}
              draggable={true}
              icon={createMarkerIcon(marker)}
              label={{
                text: ranking ? ranking.toString() : marker.label,
                color: '#000000',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(e) => handleMarkerDragEnd(e, marker.id)}
              onClick={() => setSelectedMarker(marker)}
              animation={isDragging ? undefined : google.maps.Animation.DROP}
            />
          );
        })}

        {/* Info Window */}
        {selectedMarker && !isDragging && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              <h3 className="font-bold text-sm">{selectedMarker.label}</h3>
              <p className="text-xs mt-1">
                Ranking: {rankings[selectedMarker.id] || 'Not ranked'}
              </p>
              <p className="text-xs mt-1">
                Lat: {selectedMarker.position.lat.toFixed(6)}
              </p>
              <p className="text-xs mt-1">
                Lng: {selectedMarker.position.lng.toFixed(6)}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-bold text-sm mb-2">Ranking Legend</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border border-black"></div>
            <span className="text-xs">Top 3</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 border border-black"></div>
            <span className="text-xs">4-10</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 border border-black"></div>
            <span className="text-xs">11-20</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border border-black"></div>
            <span className="text-xs">20+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-500 border border-black"></div>
            <span className="text-xs">Not ranked</span>
          </div>
        </div>
      </div>

      {/* Grid Controls */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-bold text-sm mb-2">Grid: {gridSize}×{gridSize}</h3>
        <p className="text-xs text-gray-600">Drag markers to adjust</p>
        <p className="text-xs text-gray-600 mt-1">Click markers for details</p>
      </div>
    </div>
  );
};

export default GridMapTracker;
