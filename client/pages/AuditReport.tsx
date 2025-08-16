import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { GoogleMapComponent } from "@/components/GoogleMaps/GoogleMapComponent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Download,
  Share2,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  Star,
  TrendingUp,
  Globe,
  Smartphone,
  Search,
} from "lucide-react";

interface GeoGridScanData {
  id: string;
  businessName: string;
  gmbProfileUrl: string;
  scanDate: string;
  scanType: string;
  overallVisibility: number;
  status: "completed" | "in-progress" | "failed";
  scanResults: {
    gridCoverage: {
      totalGridPoints: number;
      scannedPoints: number;
      visibility: number;
      averageRank: number;
    };
    localPack: {
      appearances: number;
      totalSearches: number;
      averagePosition: number;
      visibility: number;
    };
    organicResults: {
      appearances: number;
      totalSearches: number;
      averagePosition: number;
      visibility: number;
    };
    geoDistribution: {
      strongAreas: string[];
      weakAreas: string[];
      noVisibility: string[];
    };
    keywordPerformance: {
      topKeywords: Array<{
        keyword: string;
        rank: number;
        visibility: number;
      }>;
      improvementOpportunities: string[];
    };
  };
}

// Mock data for demonstration
const mockGeoScanData: GeoGridScanData = {
  id: "3",
  businessName: "Local Restaurant & Grill",
  gmbProfileUrl: "https://business.google.com/n/12345678901234567890",
  scanDate: "2024-01-20T10:30:00Z",
  scanType: "5km Grid Scan - Downtown Area",
  overallVisibility: 73,
  status: "completed",
  scanResults: {
    gridCoverage: {
      totalGridPoints: 100,
      scannedPoints: 97,
      visibility: 73,
      averageRank: 2.8,
    },
    localPack: {
      appearances: 68,
      totalSearches: 100,
      averagePosition: 2.3,
      visibility: 68,
    },
    organicResults: {
      appearances: 45,
      totalSearches: 100,
      averagePosition: 4.7,
      visibility: 45,
    },
    geoDistribution: {
      strongAreas: ["Downtown Core", "Business District", "Main Street"],
      weakAreas: ["North Suburbs", "Industrial Zone"],
      noVisibility: ["Airport Area", "Highway Corridor"],
    },
    keywordPerformance: {
      topKeywords: [
        { keyword: "restaurant near me", rank: 1.8, visibility: 85 },
        { keyword: "best local food", rank: 2.4, visibility: 72 },
        { keyword: "downtown dining", rank: 3.1, visibility: 58 },
      ],
      improvementOpportunities: [
        "Target 'lunch specials' keyword in northern areas",
        "Improve visibility for 'family restaurant' searches",
        "Optimize for 'outdoor seating' queries",
      ],
    },
  },
};

const getVisibilityColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
};

const getVisibilityVariant = (score: number) => {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
};

export default function AuditReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scanData, setScanData] = useState<GeoGridScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompetitorResults, setShowCompetitorResults] = useState(false);
  const [showCompetitorLocations, setShowCompetitorLocations] = useState(false);

  useEffect(() => {
    // Simulate API call to fetch geo scan data
    const fetchGeoScanData = async () => {
      setLoading(true);
      // In a real implementation, you would fetch geo grid scan data based on the ID
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setScanData(mockGeoScanData);
      setLoading(false);
    };

    fetchGeoScanData();
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!scanData) {
    return (
      <AppLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                Geo Scan Report Not Found
              </h3>
              <p className="text-muted-foreground mb-4">
                The geo grid scan report with ID "{id}" could not be found.
              </p>
              <Button onClick={() => navigate("/admin/audits")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to GMB Scans
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/audits")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                GMB Geo Grid Scan #{scanData.id}
              </h1>
              <p className="text-muted-foreground">
                Generated on {new Date(scanData.scanDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Business Info & Overall Visibility */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="text-xl">
                  {scanData.businessName}
                </CardTitle>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm">{scanData.gmbProfileUrl}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">
                    {scanData.scanType} &#8226;{" "}
                    {new Date(scanData.scanDate).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-4xl font-bold ${getVisibilityColor(scanData.overallVisibility)}`}
                >
                  {scanData.overallVisibility}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Overall Visibility
                </div>
                <Badge
                  variant={getVisibilityVariant(scanData.overallVisibility)}
                  className="mt-2"
                >
                  {scanData.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Geo Grid Scan Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grid Coverage */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Grid Coverage
                </CardTitle>
                <Badge
                  variant={getVisibilityVariant(
                    scanData.scanResults.gridCoverage.visibility,
                  )}
                >
                  {scanData.scanResults.gridCoverage.visibility}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {scanData.scanResults.gridCoverage.scannedPoints}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Scanned Points
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {scanData.scanResults.gridCoverage.totalGridPoints}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Grid Points
                  </div>
                </div>
              </div>
              <Separator />
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  Avg Rank: {scanData.scanResults.gridCoverage.averageRank}
                </div>
                <div className="text-xs text-muted-foreground">
                  Average ranking position across all grid points
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Local Pack Performance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Local Pack
                </CardTitle>
                <Badge
                  variant={getVisibilityVariant(
                    scanData.scanResults.localPack.visibility,
                  )}
                >
                  {scanData.scanResults.localPack.visibility}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {scanData.scanResults.localPack.appearances}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Appearances
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {scanData.scanResults.localPack.averagePosition}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Avg Position
                  </div>
                </div>
              </div>
              <Separator />
              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  Appeared in {scanData.scanResults.localPack.appearances} of{" "}
                  {scanData.scanResults.localPack.totalSearches} local pack
                  searches
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organic Results */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Organic Results
                </CardTitle>
                <Badge
                  variant={getVisibilityVariant(
                    scanData.scanResults.organicResults.visibility,
                  )}
                >
                  {scanData.scanResults.organicResults.visibility}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {scanData.scanResults.organicResults.appearances}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Appearances
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {scanData.scanResults.organicResults.averagePosition}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Avg Position
                  </div>
                </div>
              </div>
              <Separator />
              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  GMB profile appeared in organic results for{" "}
                  {scanData.scanResults.organicResults.appearances} searches
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Geographic Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Geographic Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Strong Areas
                </h4>
                <div className="flex flex-wrap gap-1">
                  {scanData.scanResults.geoDistribution.strongAreas.map(
                    (area, index) => (
                      <Badge key={index} variant="default" className="text-xs">
                        {area}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Weak Areas
                </h4>
                <div className="flex flex-wrap gap-1">
                  {scanData.scanResults.geoDistribution.weakAreas.map(
                    (area, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        {area}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  No Visibility
                </h4>
                <div className="flex flex-wrap gap-1">
                  {scanData.scanResults.geoDistribution.noVisibility.map(
                    (area, index) => (
                      <Badge
                        key={index}
                        variant="destructive"
                        className="text-xs"
                      >
                        {area}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keyword Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Top Keywords
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">
                  Best Performing Keywords
                </h4>
                <div className="space-y-2">
                  {scanData.scanResults.keywordPerformance.topKeywords.map(
                    (keyword, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                      >
                        <span className="text-sm font-medium">
                          {keyword.keyword}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Rank {keyword.rank}
                          </span>
                          <Badge
                            variant={getVisibilityVariant(keyword.visibility)}
                            className="text-xs"
                          >
                            {keyword.visibility}%
                          </Badge>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Growth Opportunities
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {scanData.scanResults.keywordPerformance.improvementOpportunities.map(
                    (opportunity, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">&#8226;</span>
                        {opportunity}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Geo Grid Scan Summary</CardTitle>
              <CardDescription>
                Geographic visibility analysis and ranking performance across
                the scanned area
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div
                    className={`text-lg font-bold ${getVisibilityColor(scanData.scanResults.gridCoverage.visibility)}`}
                  >
                    {scanData.scanResults.gridCoverage.visibility}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Grid Coverage
                  </div>
                </div>
                <div>
                  <div
                    className={`text-lg font-bold ${getVisibilityColor(scanData.scanResults.localPack.visibility)}`}
                  >
                    {scanData.scanResults.localPack.visibility}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Local Pack
                  </div>
                </div>
                <div>
                  <div
                    className={`text-lg font-bold ${getVisibilityColor(scanData.scanResults.organicResults.visibility)}`}
                  >
                    {scanData.scanResults.organicResults.visibility}%
                  </div>
                  <div className="text-xs text-muted-foreground">Organic</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {scanData.scanResults.gridCoverage.averageRank}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Rank</div>
                </div>
              </div>
              <Separator />
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Insights</h4>
                <p className="text-sm text-muted-foreground">
                  This GMB profile shows strong visibility in{" "}
                  {scanData.scanResults.geoDistribution.strongAreas.length} core
                  areas. Focus on expanding presence in{" "}
                  {scanData.scanResults.geoDistribution.weakAreas.join(", ")} to
                  improve overall geographic coverage. The profile performs best
                  for location-based searches with an average local pack
                  position of {scanData.scanResults.localPack.averagePosition}.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
