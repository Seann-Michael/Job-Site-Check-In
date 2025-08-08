import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, RotateCcw, Save, Settings } from "lucide-react";
import { toast } from "sonner";

// Types for grid system
interface GridPoint {
  id: string;
  label: string;
  position: { lat: number; lng: number };
  ranking?: number | null;
  isDragging?: boolean;
}

interface GridOverlayMapProps {
  center: { lat: number; lng: number };
  gridSize: number; // 3, 5, 7, etc.
  gridRadius: number; // meters
  rankings?: Record<string, number | null>;
  onGridChange?: (gridPoints: GridPoint[]) => void;
  onRankingUpdate?: (pointId: string, ranking: number | null) => void;
  height?: string;
  className?: string;
  showGridLines?: boolean;
  showRankingColors?: boolean;
  editable?: boolean;
}

export const GridOverlayMap: React.FC<GridOverlayMapProps> = ({
  center,
  gridSize = 5,
  gridRadius = 5000,
  rankings = {},
  onGridChange,
  onRankingUpdate,
  height = "500px",
  className = "",
  showGridLines = true,
  showRankingColors = true,
  editable = true,
}) => {
  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);
  const [gridLines, setGridLines] = useState<google.maps.Polyline[]>([]);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);

  const mapOptions: google.maps.MapOptions = {
    zoom: 12,
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: true,
    fullscreenControl: true,
    mapTypeControl: false,
  };

  const { mapRef, map, isLoaded, error } = useGoogleMaps(mapOptions);

  // Generate initial grid pattern
  const generateGridPattern = useCallback(
    (
      centerPoint: { lat: number; lng: number },
      size: number,
      radius: number,
    ): GridPoint[] => {
      const points: GridPoint[] = [];
      const half = Math.floor(size / 2);

      // Calculate degrees per meter (approximate)
      const latDegPerMeter = 1 / 111320;
      const lngDegPerMeter =
        1 / (111320 * Math.cos((centerPoint.lat * Math.PI) / 180));

      // Calculate spacing between grid points
      const spacing = (radius * 2) / (size - 1);

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const offsetLat = (row - half) * spacing * latDegPerMeter;
          const offsetLng = (col - half) * spacing * lngDegPerMeter;

          const id = `${String.fromCharCode(65 + row)}${col + 1}`; // A1, A2, B1, B2, etc.
          const label = id;

          points.push({
            id,
            label,
            position: {
              lat: centerPoint.lat + offsetLat,
              lng: centerPoint.lng + offsetLng,
            },
            ranking: rankings[id] || null,
          });
        }
      }

      return points;
    },
    [rankings],
  );

  // Initialize grid when map loads or center changes
  useEffect(() => {
    if (map) {
      const initialGrid = generateGridPattern(center, gridSize, gridRadius);
      setGridPoints(initialGrid);
      map.setCenter(center);
    }
  }, [map, center, gridSize, gridRadius, generateGridPattern]);

  // Get ranking color based on position
  const getRankingColor = useCallback(
    (ranking: number | null): string => {
      if (!showRankingColors || ranking === null || ranking === undefined) {
        return "#6B7280"; // Default gray
      }

      if (ranking <= 3) return "#10B981"; // Green for top 3
      if (ranking <= 10) return "#F59E0B"; // Yellow for 4-10
      if (ranking <= 20) return "#EF4444"; // Red for 11-20
      return "#8B5CF6"; // Purple for 20+
    },
    [showRankingColors],
  );

  // Create custom marker icon
  const createMarkerIcon = useCallback(
    (point: GridPoint, isSelected: boolean = false): google.maps.Icon => {
      const color = getRankingColor(point.ranking);
      const borderColor = isSelected ? "#000000" : "#FFFFFF";
      const borderWidth = isSelected ? 3 : 2;

      const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.163 24.837 0 16 0z"
              fill="${color}" stroke="${borderColor}" stroke-width="${borderWidth}"/>
        <circle cx="16" cy="16" r="10" fill="${color}"/>
        <text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif"
              font-size="10" font-weight="bold" fill="white">
          ${point.ranking || point.label}
        </text>
      </svg>
    `;

      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(32, 40),
        anchor: new google.maps.Point(16, 40),
      };
    },
    [getRankingColor],
  );

  // Create grid lines (polylines)
  const createGridLines = useCallback(
    (points: GridPoint[]): google.maps.Polyline[] => {
      if (!map || !showGridLines) return [];

      const lines: google.maps.Polyline[] = [];

      // Create horizontal lines
      for (let row = 0; row < gridSize; row++) {
        const rowPoints = points.filter((p) => p.id.charCodeAt(0) === 65 + row);
        if (rowPoints.length > 1) {
          const path = rowPoints
            .sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)))
            .map((p) => p.position);

          const line = new google.maps.Polyline({
            path,
            geodesic: false,
            strokeColor: "#94A3B8",
            strokeOpacity: 0.6,
            strokeWeight: 1,
            map,
          });
          lines.push(line);
        }
      }

      // Create vertical lines
      for (let col = 1; col <= gridSize; col++) {
        const colPoints = points.filter(
          (p) => p.id.slice(1) === col.toString(),
        );
        if (colPoints.length > 1) {
          const path = colPoints
            .sort((a, b) => a.id.charCodeAt(0) - b.id.charCodeAt(0))
            .map((p) => p.position);

          const line = new google.maps.Polyline({
            path,
            geodesic: false,
            strokeColor: "#94A3B8",
            strokeOpacity: 0.6,
            strokeWeight: 1,
            map,
          });
          lines.push(line);
        }
      }

      return lines;
    },
    [map, gridSize, showGridLines],
  );

  // Update grid lines when points change
  const updateGridLines = useCallback(
    (points: GridPoint[]) => {
      // Clear existing lines
      gridLines.forEach((line) => line.setMap(null));

      // Create new lines
      const newLines = createGridLines(points);
      setGridLines(newLines);
    },
    [gridLines, createGridLines],
  );

  // Create markers
  const createMarkers = useCallback(
    (points: GridPoint[]) => {
      if (!map) return;

      // Clear existing markers
      markers.forEach((marker) => marker.setMap(null));

      const newMarkers: google.maps.Marker[] = [];

      points.forEach((point) => {
        const marker = new google.maps.Marker({
          position: point.position,
          map,
          icon: createMarkerIcon(point, selectedPoint === point.id),
          draggable: editable,
          title: `${point.label}${point.ranking ? ` (Rank: ${point.ranking})` : ""}`,
          zIndex: selectedPoint === point.id ? 1000 : 100,
        });

        // Add click listener
        marker.addListener("click", () => {
          setSelectedPoint(selectedPoint === point.id ? null : point.id);
        });

        // Add drag listeners
        if (editable) {
          marker.addListener("dragstart", () => {
            setIsDraggingAny(true);
            setGridPoints((prev) =>
              prev.map((p) =>
                p.id === point.id ? { ...p, isDragging: true } : p,
              ),
            );
          });

          marker.addListener("drag", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              const newPosition = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              };

              setGridPoints((prev) =>
                prev.map((p) =>
                  p.id === point.id ? { ...p, position: newPosition } : p,
                ),
              );
            }
          });

          marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
            setIsDraggingAny(false);

            if (e.latLng) {
              const newPosition = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              };

              setGridPoints((prev) => {
                const updated = prev.map((p) =>
                  p.id === point.id
                    ? { ...p, position: newPosition, isDragging: false }
                    : { ...p, isDragging: false },
                );

                // Notify parent of change
                if (onGridChange) {
                  onGridChange(updated);
                }

                return updated;
              });

              toast.success(`Moved ${point.label} to new position`);
            }
          });
        }

        newMarkers.push(marker);
      });

      setMarkers(newMarkers);
    },
    [map, createMarkerIcon, selectedPoint, editable, onGridChange],
  );

  // Update markers when grid points change
  useEffect(() => {
    if (gridPoints.length > 0) {
      createMarkers(gridPoints);
      updateGridLines(gridPoints);
    }
  }, [gridPoints, createMarkers, updateGridLines]);

  // Reset grid to original pattern
  const resetGrid = useCallback(() => {
    const originalGrid = generateGridPattern(center, gridSize, gridRadius);
    setGridPoints(originalGrid);
    setSelectedPoint(null);
    toast.success("Grid reset to original pattern");
  }, [center, gridSize, gridRadius, generateGridPattern]);

  // Update ranking for selected point
  const updateRanking = useCallback(
    (ranking: number | null) => {
      if (!selectedPoint) return;

      setGridPoints((prev) =>
        prev.map((p) => (p.id === selectedPoint ? { ...p, ranking } : p)),
      );

      if (onRankingUpdate) {
        onRankingUpdate(selectedPoint, ranking);
      }

      toast.success(`Updated ${selectedPoint} ranking to ${ranking || "none"}`);
    },
    [selectedPoint, onRankingUpdate],
  );

  // Memoized grid statistics
  const gridStats = useMemo(() => {
    const totalPoints = gridPoints.length;
    const rankedPoints = gridPoints.filter(
      (p) => p.ranking !== null && p.ranking !== undefined,
    ).length;
    const avgRanking =
      gridPoints
        .filter((p) => p.ranking !== null && p.ranking !== undefined)
        .reduce((sum, p) => sum + (p.ranking || 0), 0) / rankedPoints || 0;

    return { totalPoints, rankedPoints, avgRanking };
  }, [gridPoints]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <MapPin className="h-12 w-12 mx-auto mb-2" />
            <p>Failed to load map: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Loading interactive grid map...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {/* Grid Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {gridSize}×{gridSize} Grid
              </Badge>
              <Badge variant="secondary">
                {gridStats.rankedPoints}/{gridStats.totalPoints} Ranked
              </Badge>
              {gridStats.rankedPoints > 0 && (
                <Badge variant="default">
                  Avg: {gridStats.avgRanking.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPoint && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Selected: {selectedPoint}
                </span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="w-16 px-2 py-1 text-xs border rounded"
                  placeholder="Rank"
                  value={
                    gridPoints.find((p) => p.id === selectedPoint)?.ranking ||
                    ""
                  }
                  onChange={(e) =>
                    updateRanking(
                      e.target.value ? parseInt(e.target.value) : null,
                    )
                  }
                />
              </div>
            )}

            <Button variant="outline" size="sm" onClick={resetGrid}>
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div
          ref={mapRef}
          style={{ height }}
          className="w-full rounded-lg border overflow-hidden"
        />

        {/* Grid Legend */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Rank 1-3</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Rank 4-10</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Rank 11-20</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span>Unranked</span>
            </div>
          </div>

          <div className="text-right">
            <span>
              {editable ? "Drag markers to adjust positions" : "View-only mode"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GridOverlayMap;
