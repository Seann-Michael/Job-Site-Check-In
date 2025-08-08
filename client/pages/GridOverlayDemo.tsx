import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GridOverlayMap } from "@/components/GoogleMaps/GridOverlayMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Grid3X3, 
  MapPin, 
  Target, 
  Settings,
  Download,
  Upload
} from "lucide-react";
import { toast } from "sonner";

interface GridPoint {
  id: string;
  label: string;
  position: { lat: number; lng: number };
  ranking?: number | null;
}

export default function GridOverlayDemo() {
  const [gridCenter, setGridCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // NYC
  const [gridSize, setGridSize] = useState(5);
  const [gridRadius, setGridRadius] = useState(5000);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showRankingColors, setShowRankingColors] = useState(true);
  const [editable, setEditable] = useState(true);
  const [rankings, setRankings] = useState<Record<string, number | null>>({
    A1: 1, A2: 5, A3: 12, A4: 8, A5: 3,
    B1: 15, B2: 2, B3: null, B4: 7, B5: 18,
    C1: 9, C2: null, C3: 4, C4: 14, C5: 6,
    D1: 11, D2: 13, D3: 1, D4: null, D5: 16,
    E1: 20, E2: 10, E3: 17, E4: 19, E5: null,
  });

  const [currentGrid, setCurrentGrid] = useState<GridPoint[]>([]);

  // Preset locations
  const presetLocations = [
    { name: "New York City", center: { lat: 40.7128, lng: -74.0060 } },
    { name: "Los Angeles", center: { lat: 34.0522, lng: -118.2437 } },
    { name: "Chicago", center: { lat: 41.8781, lng: -87.6298 } },
    { name: "Miami", center: { lat: 25.7617, lng: -80.1918 } },
    { name: "Seattle", center: { lat: 47.6062, lng: -122.3321 } },
  ];

  const handleGridChange = (gridPoints: GridPoint[]) => {
    setCurrentGrid(gridPoints);
    console.log("Grid updated:", gridPoints);
  };

  const handleRankingUpdate = (pointId: string, ranking: number | null) => {
    setRankings(prev => ({
      ...prev,
      [pointId]: ranking
    }));
  };

  const exportGrid = () => {
    const gridData = {
      center: gridCenter,
      gridSize,
      gridRadius,
      points: currentGrid,
      rankings,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(gridData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grid-overlay-${gridSize}x${gridSize}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Grid configuration exported");
  };

  const generateRandomRankings = () => {
    const newRankings: Record<string, number | null> = {};
    const totalPoints = gridSize * gridSize;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id = `${String.fromCharCode(65 + row)}${col + 1}`;
        // 70% chance of having a ranking
        newRankings[id] = Math.random() > 0.3 ? Math.floor(Math.random() * 20) + 1 : null;
      }
    }
    
    setRankings(newRankings);
    toast.success("Random rankings generated");
  };

  const clearAllRankings = () => {
    const clearedRankings: Record<string, number | null> = {};
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id = `${String.fromCharCode(65 + row)}${col + 1}`;
        clearedRankings[id] = null;
      }
    }
    setRankings(clearedRankings);
    toast.success("All rankings cleared");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Grid3X3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Grid Overlay System Demo
            </h1>
          </div>
          <p className="text-gray-600">
            Interactive grid overlay system for Google Maps with draggable markers, ranking visualization, and grid line connections.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Controls Panel */}
          <div className="xl:col-span-1 space-y-6">
            {/* Grid Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Grid Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Grid Size</Label>
                  <Select value={gridSize.toString()} onValueChange={(v) => setGridSize(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3×3 Grid</SelectItem>
                      <SelectItem value="5">5×5 Grid</SelectItem>
                      <SelectItem value="7">7×7 Grid</SelectItem>
                      <SelectItem value="9">9×9 Grid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Grid Radius (meters)</Label>
                  <Input
                    type="number"
                    value={gridRadius}
                    onChange={(e) => setGridRadius(parseInt(e.target.value) || 5000)}
                    placeholder="5000"
                  />
                </div>

                <div>
                  <Label>Location Preset</Label>
                  <Select onValueChange={(value) => {
                    const location = presetLocations.find(l => l.name === value);
                    if (location) setGridCenter(location.center);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presetLocations.map(location => (
                        <SelectItem key={location.name} value={location.name}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="grid-lines">Show Grid Lines</Label>
                    <Switch
                      id="grid-lines"
                      checked={showGridLines}
                      onCheckedChange={setShowGridLines}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="ranking-colors">Ranking Colors</Label>
                    <Switch
                      id="ranking-colors"
                      checked={showRankingColors}
                      onCheckedChange={setShowRankingColors}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="editable">Editable Markers</Label>
                    <Switch
                      id="editable"
                      checked={editable}
                      onCheckedChange={setEditable}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ranking Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ranking Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={generateRandomRankings} 
                  className="w-full" 
                  variant="outline"
                >
                  Generate Random Rankings
                </Button>
                
                <Button 
                  onClick={clearAllRankings} 
                  className="w-full" 
                  variant="outline"
                >
                  Clear All Rankings
                </Button>

                <Button 
                  onClick={exportGrid} 
                  className="w-full"
                  variant="default"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Grid
                </Button>
              </CardContent>
            </Card>

            {/* Grid Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Grid Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Points:</span>
                  <Badge variant="outline">{gridSize * gridSize}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Ranked Points:</span>
                  <Badge variant="default">
                    {Object.values(rankings).filter(r => r !== null).length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Average Rank:</span>
                  <Badge variant="secondary">
                    {Object.values(rankings)
                      .filter(r => r !== null)
                      .reduce((sum, r) => sum + (r || 0), 0) / 
                     Object.values(rankings).filter(r => r !== null).length || 0}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Grid Radius:</span>
                  <Badge variant="outline">{(gridRadius / 1000).toFixed(1)}km</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Map Display */}
          <div className="xl:col-span-3">
            <GridOverlayMap
              center={gridCenter}
              gridSize={gridSize}
              gridRadius={gridRadius}
              rankings={rankings}
              onGridChange={handleGridChange}
              onRankingUpdate={handleRankingUpdate}
              height="600px"
              showGridLines={showGridLines}
              showRankingColors={showRankingColors}
              editable={editable}
              className="w-full"
            />
          </div>
        </div>

        {/* Usage Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How to Use the Grid Overlay System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">🎯 Basic Controls</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Click markers to select them</li>
                  <li>• Drag markers to reposition</li>
                  <li>• Use controls to adjust grid size</li>
                  <li>• Toggle grid lines on/off</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🏷️ Ranking System</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Green: Ranks 1-3 (top positions)</li>
                  <li>• Yellow: Ranks 4-10 (good positions)</li>
                  <li>• Red: Ranks 11-20 (lower positions)</li>
                  <li>• Gray: Unranked or no data</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">⚙️ Configuration</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Adjust grid size (3×3 to 9×9)</li>
                  <li>• Set radius in meters</li>
                  <li>• Choose preset locations</li>
                  <li>• Export grid configurations</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📊 Data Management</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Generate random test data</li>
                  <li>• Clear all rankings</li>
                  <li>• Export grid as JSON</li>
                  <li>• Real-time statistics</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
