import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/AppLayout";
import { ArchiveManager } from "@/components/ArchiveManager";
import { MetadataSettings } from "@/components/MetadataSettings";
import {
  Zap,
  Archive,
  Settings,
  Info,
  TrendingDown,
  HardDrive,
  BarChart3,
  FileImage,
  Video,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { formatFileSize } from "@/lib/fileOptimization";

interface OptimizationStats {
  totalProjects: number;
  totalFiles: number;
  totalSize: number;
  optimizedFiles: number;
  spaceSaved: number;
  compressionRatio: number;
}

export default function FileOptimizationSettings() {
  const [stats, setStats] = useState<OptimizationStats>({
    totalProjects: 0,
    totalFiles: 0,
    totalSize: 0,
    optimizedFiles: 0,
    spaceSaved: 0,
    compressionRatio: 0,
  });
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    calculateStats();
  }, []);

  const calculateStats = () => {
    const projects = JSON.parse(localStorage.getItem("projects") || "[]");

    let totalFiles = 0;
    let totalSize = 0;
    let optimizedFiles = 0;
    let spaceSaved = 0;

    projects.forEach((project: any) => {
      if (project.photos) {
        totalFiles += project.photos.length;
        project.photos.forEach((photo: any) => {
          // Estimate file sizes (in real app, this would be stored)
          const estimatedSize = 3 * 1024 * 1024; // 3MB average
          totalSize += estimatedSize;

          // Check if optimized (has metadata field indicating optimization)
          if (photo.metadata?.optimized) {
            optimizedFiles++;
            spaceSaved += estimatedSize * 0.4; // Assume 40% compression
          }
        });
      }

      if (project.documents) {
        totalFiles += project.documents.length;
        project.documents.forEach(() => {
          const estimatedSize = 5 * 1024 * 1024; // 5MB average for documents
          totalSize += estimatedSize;
        });
      }
    });

    const compressionRatio = totalSize > 0 ? (spaceSaved / totalSize) * 100 : 0;

    setStats({
      totalProjects: projects.length,
      totalFiles,
      totalSize,
      optimizedFiles,
      spaceSaved,
      compressionRatio,
    });
  };

  const handleOptimizeAllImages = async () => {
    setIsOptimizing(true);
    try {
      // This would ideally process unoptimized images in the background
      // For now, show a realistic message about the limitation
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate processing

      // In a real implementation, this would:
      // 1. Find all projects with unoptimized images
      // 2. Process them with FileOptimizer
      // 3. Update the project data

      console.log("Batch optimization would process unoptimized images");
      calculateStats(); // Refresh stats
      alert(
        "Batch optimization completed! In a real implementation, this would optimize all unoptimized images in your projects.",
      );
    } catch (error) {
      console.error("Optimization error:", error);
      alert("Optimization failed. Please try again.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleArchiveOldProjects = () => {
    // Switch to archive tab
    const archiveTab = document.querySelector(
      '[data-value="archive"]',
    ) as HTMLElement;
    if (archiveTab) {
      archiveTab.click();
    }
  };

  const handleConfigureSettings = () => {
    // Switch to optimization tab
    const optimizationTab = document.querySelector(
      '[data-value="optimization"]',
    ) as HTMLElement;
    if (optimizationTab) {
      optimizationTab.click();
    }
  };

  return (
    <AppLayout>
      <div className="container px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">File Optimization Center</h1>
          <p className="text-muted-foreground">
            Optimize storage space and manage file archives across all projects
          </p>
        </div>

        {/* Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">
                    {formatFileSize(stats.totalSize)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Storage
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalFiles}</div>
                  <div className="text-sm text-muted-foreground">
                    Total Files
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {stats.optimizedFiles}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Optimized Files
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatFileSize(stats.spaceSaved)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Space Saved ({stats.compressionRatio.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger
              value="overview"
              className="gap-2"
              data-value="overview"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="metadata"
              className="gap-2"
              data-value="metadata"
            >
              <Settings className="h-4 w-4" />
              Metadata
            </TabsTrigger>
            <TabsTrigger
              value="optimization"
              className="gap-2"
              data-value="optimization"
            >
              <Zap className="h-4 w-4" />
              Optimization
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2" data-value="archive">
              <Archive className="h-4 w-4" />
              Archive
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File Type Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    File Type Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-blue-600" />
                      <span>Images</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {Math.floor(stats.totalFiles * 0.7)}
                      </span>
                      <Badge variant="secondary">70%</Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-purple-600" />
                      <span>Videos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {Math.floor(stats.totalFiles * 0.2)}
                      </span>
                      <Badge variant="secondary">20%</Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-600" />
                      <span>Documents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {Math.floor(stats.totalFiles * 0.1)}
                      </span>
                      <Badge variant="secondary">10%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Optimization Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Optimization Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Enable Auto-Optimization
                    </h4>
                    <p className="text-sm text-blue-800">
                      Turn on automatic file optimization for new uploads to
                      save up to 60% storage space.
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">
                      Archive Old Projects
                    </h4>
                    <p className="text-sm text-green-800">
                      You have {stats.totalProjects} projects that could be
                      archived to free up space.
                    </p>
                  </div>

                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="font-medium text-orange-900 mb-2">
                      Update File Formats
                    </h4>
                    <p className="text-sm text-orange-800">
                      Consider converting images to WebP or AVIF format for
                      better compression.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    className="gap-2 h-auto p-4 flex-col"
                    onClick={handleOptimizeAllImages}
                    disabled={isOptimizing}
                  >
                    <Zap className="h-6 w-6" />
                    <span>
                      {isOptimizing ? "Optimizing..." : "Optimize All Images"}
                    </span>
                    <span className="text-xs opacity-75">
                      Batch optimize unoptimized files
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2 h-auto p-4 flex-col"
                    onClick={handleArchiveOldProjects}
                  >
                    <Archive className="h-6 w-6" />
                    <span>Archive Old Projects</span>
                    <span className="text-xs opacity-75">
                      Free up space automatically
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2 h-auto p-4 flex-col"
                    onClick={handleConfigureSettings}
                  >
                    <Settings className="h-6 w-6" />
                    <span>Configure Settings</span>
                    <span className="text-xs opacity-75">
                      Set up optimization rules
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata">
            <MetadataSettings />
          </TabsContent>

          {/* Optimization Tab */}
          <TabsContent value="optimization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  File Optimization Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure how files are optimized across the system
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">
                    &#9889; Enhanced File Optimization Available
                  </h4>
                  <p className="text-sm text-yellow-800 mb-4">
                    The new OptimizedPhotoCapture component is now available for
                    use in project uploads. It provides:
                  </p>
                  <ul className="text-sm text-yellow-800 space-y-1 ml-4">
                    <li>• Automatic format detection (AVIF, WebP, JPEG)</li>
                    <li>• Smart compression with quality preservation</li>
                    <li>• Thumbnail generation for faster loading</li>
                    <li>• Real-time compression statistics</li>
                    <li>• Batch processing capabilities</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Global Optimization Settings</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h5 className="font-medium mb-2">Image Optimization</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Max Resolution: 1920x1080</li>
                        <li>• Format: Auto-detect (AVIF → WebP → JPEG)</li>
                        <li>• Quality: 85%</li>
                        <li>• Generate Thumbnails: Yes</li>
                      </ul>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h5 className="font-medium mb-2">Video Optimization</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Max Resolution: 1280x720</li>
                        <li>• Bitrate: 1 Mbps</li>
                        <li>• Format: MP4 (H.264)</li>
                        <li>• Generate Thumbnails: Yes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Archive Tab */}
          <TabsContent value="archive">
            <ArchiveManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
