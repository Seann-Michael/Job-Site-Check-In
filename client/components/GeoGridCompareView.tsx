import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  GitCompare,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  Pause,
  Download,
  Settings,
  ArrowRight,
  ArrowLeft,
  Zap,
  FileImage,
} from "lucide-react";
import { GeoGridResult } from "./GeoGridResultsTable";
import { toast } from "sonner";

interface ComparisonData {
  before: GeoGridResult;
  after: GeoGridResult;
  improvement: number;
  trend: "up" | "down" | "stable";
}

interface GeoGridCompareViewProps {
  results: GeoGridResult[];
  onClose?: () => void;
}

export function GeoGridCompareView({ results, onClose }: GeoGridCompareViewProps) {
  const [sortOrder, setSortOrder] = useState<"chronological" | "improvement" | "custom">("chronological");
  const [showGifDialog, setShowGifDialog] = useState(false);
  const [gifSettings, setGifSettings] = useState({
    duration: [500], // milliseconds per frame
    quality: [80], // 1-100
    frames: results.length,
  });

  // Create comparison pairs from results
  const createComparisons = (): ComparisonData[] => {
    const businessKeywordGroups: { [key: string]: GeoGridResult[] } = {};
    
    // Group by business + keyword
    results.forEach(result => {
      const key = `${result.businessName}-${result.keyword}`;
      if (!businessKeywordGroups[key]) {
        businessKeywordGroups[key] = [];
      }
      businessKeywordGroups[key].push(result);
    });

    const comparisons: ComparisonData[] = [];

    // Create before/after pairs for each group
    Object.values(businessKeywordGroups).forEach(group => {
      if (group.length >= 2) {
        const sorted = group.sort((a, b) => 
          new Date(a.dateRun + " " + a.timeRun).getTime() - 
          new Date(b.dateRun + " " + b.timeRun).getTime()
        );

        for (let i = 0; i < sorted.length - 1; i++) {
          const before = sorted[i];
          const after = sorted[i + 1];
          
          if (before.status === "completed" && after.status === "completed") {
            const improvement = before.averageRanking - after.averageRanking;
            const trend = improvement > 0.5 ? "up" : improvement < -0.5 ? "down" : "stable";
            
            comparisons.push({
              before,
              after,
              improvement,
              trend,
            });
          }
        }
      }
    });

    return comparisons;
  };

  const sortComparisons = (comparisons: ComparisonData[]) => {
    switch (sortOrder) {
      case "improvement":
        return [...comparisons].sort((a, b) => b.improvement - a.improvement);
      case "custom":
        // Custom sorting logic could be implemented here
        return comparisons;
      default: // chronological
        return [...comparisons].sort((a, b) => 
          new Date(a.after.dateRun + " " + a.after.timeRun).getTime() - 
          new Date(b.after.dateRun + " " + b.after.timeRun).getTime()
        );
    }
  };

  const comparisons = sortComparisons(createComparisons());

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "text-green-600 bg-green-50 border-green-200";
      case "down":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const handleCreateGif = async () => {
    try {
      // This would create a GIF animation of the map changes
      console.log("Creating GIF with settings:", gifSettings);
      toast.success("GIF creation started! This may take a few moments...");
      
      // Simulate GIF creation
      setTimeout(() => {
        toast.success("GIF created successfully!");
        setShowGifDialog(false);
      }, 3000);
    } catch (error) {
      toast.error("Failed to create GIF");
    }
  };

  const GifCreationDialog = () => (
    <Dialog open={showGifDialog} onOpenChange={setShowGifDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Map Animation GIF</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Animation Speed (ms per frame)</Label>
            <Slider
              value={gifSettings.duration}
              onValueChange={(value) =>
                setGifSettings(prev => ({ ...prev, duration: value }))
              }
              min={100}
              max={2000}
              step={100}
              className="mt-2"
            />
            <div className="text-sm text-muted-foreground mt-1">
              {gifSettings.duration[0]}ms ({(1000 / gifSettings.duration[0]).toFixed(1)} fps)
            </div>
          </div>

          <div>
            <Label>Quality</Label>
            <Slider
              value={gifSettings.quality}
              onValueChange={(value) =>
                setGifSettings(prev => ({ ...prev, quality: value }))
              }
              min={10}
              max={100}
              step={10}
              className="mt-2"
            />
            <div className="text-sm text-muted-foreground mt-1">
              {gifSettings.quality[0]}%
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium mb-1">Preview Info</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Frames: {gifSettings.frames}</div>
              <div>Duration: ~{(gifSettings.frames * gifSettings.duration[0] / 1000).toFixed(1)}s</div>
              <div>Est. Size: ~{(gifSettings.frames * gifSettings.quality[0] / 20).toFixed(1)}MB</div>
            </div>
          </div>

          <Button onClick={handleCreateGif} className="w-full">
            <FileImage className="h-4 w-4 mr-2" />
            Create GIF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Geo Grid Comparison View
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chronological">Chronological</SelectItem>
                  <SelectItem value="improvement">By Improvement</SelectItem>
                  <SelectItem value="custom">Custom Order</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setShowGifDialog(true)} variant="outline">
                <FileImage className="h-4 w-4 mr-2" />
                Create GIF
              </Button>
              {onClose && (
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Comparing {comparisons.length} ranking changes across {results.length} total scans
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {comparisons.map((comparison, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{comparison.before.businessName}</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Keyword: {comparison.before.keyword}
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getTrendColor(comparison.trend)}`}>
                  {getTrendIcon(comparison.trend)}
                  <span className="font-medium">
                    {comparison.improvement > 0 
                      ? `+${comparison.improvement.toFixed(1)} positions`
                      : comparison.improvement < 0
                      ? `${comparison.improvement.toFixed(1)} positions`
                      : "No change"
                    }
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Before */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <h4 className="font-medium">Before</h4>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {comparison.before.dateRun} {comparison.before.timeRun}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg Ranking</span>
                        <div className="font-medium text-lg">#{comparison.before.averageRanking}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Results Found</span>
                        <div className="font-medium text-lg">{comparison.before.resultCount}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Grid Size</span>
                        <div className="font-medium">{comparison.before.gridSize}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Credits Used</span>
                        <div className="font-medium">{comparison.before.creditsUsed}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center md:col-span-0">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>

                {/* After */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <h4 className="font-medium">After</h4>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {comparison.after.dateRun} {comparison.after.timeRun}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg Ranking</span>
                        <div className="font-medium text-lg">#{comparison.after.averageRanking}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Results Found</span>
                        <div className="font-medium text-lg">{comparison.after.resultCount}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Grid Size</span>
                        <div className="font-medium">{comparison.after.gridSize}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Credits Used</span>
                        <div className="font-medium">{comparison.after.creditsUsed}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual representation placeholder */}
              <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <div className="text-muted-foreground">
                  Interactive map comparison view would be displayed here
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Before vs After grid overlay visualization
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {comparisons.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <GitCompare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Comparisons Available</h3>
            <p className="text-muted-foreground">
              You need at least 2 completed scans for the same business and keyword to create a comparison.
            </p>
          </CardContent>
        </Card>
      )}

      <GifCreationDialog />
    </div>
  );
}
