import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GridMapTracker from "@/components/GoogleMaps/GridMapTracker";

const GridMapDemo = () => {
  // Mock ranking data showing different ranking results
  const [rankings, setRankings] = useState({
    "0-0": 1, // Top 3 - Green
    "0-1": 2, // Top 3 - Green
    "0-2": 3, // Top 3 - Green
    "1-0": 5, // 4-10 - Yellow
    "1-1": 8, // 4-10 - Yellow
    "1-2": 15, // 11-20 - Orange
    "2-0": 25, // 20+ - Red
    "2-1": null, // Not ranked - Grey
    "2-2": 12, // 11-20 - Orange
  });

  const businessCenter = { lat: 40.7128, lng: -74.006 }; // NYC

  const handleGridChange = (gridPoints: any[]) => {
    console.log("Grid points changed:", gridPoints);
  };

  const simulateNewResults = () => {
    // Simulate new scan results with different rankings
    setRankings({
      "0-0": 2,
      "0-1": 1,
      "0-2": 4,
      "1-0": 7,
      "1-1": 3,
      "1-2": 18,
      "2-0": 22,
      "2-1": 9,
      "2-2": null,
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Grid Map Tracker Demo
              </h1>
              <p className="text-gray-600">
                Your original GridMapTracker with ranking visualization and
                interactive features
              </p>
            </div>
            <Button onClick={simulateNewResults} variant="outline">
              Simulate New Scan Results
            </Button>
          </div>
        </div>

        {/* Demo Content */}
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Geo Grid Scan Results</CardTitle>
              <p className="text-sm text-gray-600">
                Interactive map showing ranking results across different
                locations. Click markers for details, drag to reposition the
                grid.
              </p>
            </CardHeader>
            <CardContent>
              <GridMapTracker
                center={businessCenter}
                gridSize={3} // 3x3 grid for demo
                pinSpacing={2000} // 2km spacing between pins
                rankings={rankings}
                onGridChange={handleGridChange}
                height="600px"
              />
            </CardContent>
          </Card>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-green-600">Top 3 Rankings</h3>
                <p className="text-sm text-gray-600">
                  Green markers indicate top 3 search results
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-yellow-600">4-10 Rankings</h3>
                <p className="text-sm text-gray-600">
                  Yellow markers show positions 4-10
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-orange-600">
                  11-20 Rankings
                </h3>
                <p className="text-sm text-gray-600">
                  Orange markers indicate positions 11-20
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-red-600">20+ Rankings</h3>
                <p className="text-sm text-gray-600">
                  Red markers show positions 20+ or not ranked
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <strong>View Rankings:</strong> Each marker is color-coded based
                on your business ranking at that location
              </p>
              <p className="text-sm">
                <strong>Click Markers:</strong> Click any marker to see detailed
                ranking information in an info window
              </p>
              <p className="text-sm">
                <strong>Drag to Reposition:</strong> Drag any marker to adjust
                the grid positions for new scan areas
              </p>
              <p className="text-sm">
                <strong>Grid Lines:</strong> Visual grid lines show the
                relationship between scan points
              </p>
              <p className="text-sm">
                <strong>Legend:</strong> Use the color-coded legend below the
                map to understand ranking performance
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default GridMapDemo;
