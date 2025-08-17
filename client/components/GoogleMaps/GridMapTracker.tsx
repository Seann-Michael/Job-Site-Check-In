import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { getGoogleMapsApiKey } from "@/lib/googleMaps";

interface GridMapTrackerProps {
  center?: { lat: number; lng: number };
  gridSize?: number;
  gridRadius?: number;
  rankings?: Record<string, number | null>;
  onGridChange?: (gridPoints: any[]) => void;
  height?: string;
  className?: string;
}

const GridMapTracker: React.FC<GridMapTrackerProps> = ({ 
  center = { lat: 40.7128, lng: -74.0060 },
  gridSize = 5,
  gridRadius = 3000,
  rankings = {},
  onGridChange,
  height = '600px',
  className = ''
}) => {
  const [gridPoints, setGridPoints] = useState<any[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const apiKey = getGoogleMapsApiKey();

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
  });

  // Generate initial grid points
  useEffect(() => {
    generateGridPoints();
  }, [center, gridSize, gridRadius]);

  const generateGridPoints = () => {
    const points = [];
    const radiusInDegrees = gridRadius / 111000; // Convert meters to degrees (approximate)
    const step = (radiusInDegrees * 2) / (gridSize - 1);
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const lat = center.lat + (row - Math.floor(gridSize / 2)) * step;
        const lng = center.lng + (col - Math.floor(gridSize / 2)) * step;
        const id = `${row}-${col}`;
        
        points.push({
          id,
          position: { lat, lng },
          label: `${String.fromCharCode(65 + row)}${col + 1}`,
          ranking: rankings[id] || null,
          row,
          col
        });
      }
    }
    
    setGridPoints(points);
  };

  const handleMarkerDragEnd = (index: number, event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    
    const newLat = event.latLng.lat();
    const newLng = event.latLng.lng();
    
    const updatedPoints = [...gridPoints];
    updatedPoints[index] = {
      ...updatedPoints[index],
      position: { lat: newLat, lng: newLng }
    };
    
    setGridPoints(updatedPoints);
    setIsDragging(false);
    
    if (onGridChange) {
      onGridChange(updatedPoints);
    }
  };

  const getMarkerColor = (ranking: number | null) => {
    if (!ranking) return '#808080'; // Gray for unranked
    if (ranking <= 3) return '#00FF00'; // Green for top 3
    if (ranking <= 10) return '#FFFF00'; // Yellow for 4-10
    if (ranking <= 20) return '#FFA500'; // Orange for 11-20
    return '#FF0000'; // Red for 20+
  };

  const getMarkerIcon = (point: any) => {
    const color = getMarkerColor(point.ranking);
    const label = point.ranking || point.label;
    
    return {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
      fillColor: color,
      fillOpacity: 0.9,
      strokeColor: '#000',
      strokeWeight: 2,
      scale: 2,
      anchor: { x: 12, y: 24 },
      labelOrigin: { x: 12, y: 9 }
    };
  };

  const generateGridLines = () => {
    const lines = [];
    
    // Horizontal lines
    for (let row = 0; row < gridSize; row++) {
      const path = [];
      for (let col = 0; col < gridSize; col++) {
        const point = gridPoints.find(p => p.id === `${row}-${col}`);
        if (point) path.push(point.position);
      }
      if (path.length > 1) lines.push(path);
    }
    
    // Vertical lines
    for (let col = 0; col < gridSize; col++) {
      const path = [];
      for (let row = 0; row < gridSize; row++) {
        const point = gridPoints.find(p => p.id === `${row}-${col}`);
        if (point) path.push(point.position);
      }
      if (path.length > 1) lines.push(path);
    }
    
    return lines;
  };

  const mapContainerStyle = {
    width: '100%',
    height: height,
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  };

  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

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
    <div className={`w-full ${className}`}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={12}
        options={mapOptions}
        onLoad={(map) => { 
          mapRef.current = map;
          
          // Auto-fit bounds to show all markers
          if (gridPoints.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            gridPoints.forEach((point) => {
              bounds.extend(point.position);
            });
            map.fitBounds(bounds);
          }
        }}
      >
        {/* Grid Lines */}
        {gridPoints.length > 0 && generateGridLines().map((path, index) => (
          <Polyline
            key={`line-${index}`}
            path={path}
            options={{
              strokeColor: '#4A90E2',
              strokeOpacity: 0.3,
              strokeWeight: 2,
              geodesic: true
            }}
          />
        ))}
        
        {/* Grid Markers */}
        {gridPoints.map((point, index) => (
          <Marker
            key={point.id}
            position={point.position}
            draggable={true}
            icon={getMarkerIcon(point)}
            label={{
              text: String(point.ranking || point.label),
              color: '#000000',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e) => handleMarkerDragEnd(index, e)}
            onClick={() => setSelectedMarker(point)}
            animation={isDragging ? undefined : google.maps.Animation.DROP}
          />
        ))}
        
        {/* Info Window */}
        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              <h3 className="font-bold text-lg mb-2">Point {selectedMarker.label}</h3>
              <p className="text-sm">
                <strong>Ranking:</strong> {selectedMarker.ranking || 'Not ranked'}
              </p>
              <p className="text-sm">
                <strong>Lat:</strong> {selectedMarker.position.lat.toFixed(6)}
              </p>
              <p className="text-sm">
                <strong>Lng:</strong> {selectedMarker.position.lng.toFixed(6)}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      
      {/* Legend */}
      <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
        <h3 className="font-bold text-lg mb-3">Ranking Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500"></div>
            <span className="text-sm">Top 3</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-yellow-400"></div>
            <span className="text-sm">4-10</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-500"></div>
            <span className="text-sm">11-20</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500"></div>
            <span className="text-sm">20+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-500"></div>
            <span className="text-sm">Not Ranked</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">Drag markers to adjust grid positions</p>
      </div>
    </div>
  );
};

export default GridMapTracker;
