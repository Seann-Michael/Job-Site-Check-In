import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { GoogleMapComponent } from "@/components/GoogleMaps/GoogleMapComponent";
import {
  MapPin,
  Target,
  Play,
  Settings,
  Download,
  CheckCircle,
  TrendingUp,
  Users,
  Star,
  Grid3X3,
  Circle,
  Crosshair,
  Zap,
  BarChart3,
  Loader2,
  Building2,
  Phone,
  Globe,
  Edit,
  Eye,
  EyeOff,
  Award,
  Crown,
  Shield,
  Search,
  Layers,
  X,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { GeoGridResultsTable } from "@/components/GeoGridResultsTable";
import { GeoGridCompareView } from "@/components/GeoGridCompareView";
import { logGeoGridScan, logBulkAction } from "@/lib/auditLog";

// Mock data for demonstration
const MOCK_BUSINESS = {
  name: "Joe's Pizza & More",
  address: "2275 Lejeune Cir, Fairfield, CA 94533",
  phone: "(707) 446-5643",
  website: "https://joespizza.com",
  rating: 4.6,
  reviewCount: 342,
  hours: "Open • Closes at 11PM",
  verified: true,
  categories: ["Pizza Restaurant", "Italian Food", "Takeout"],
};

const MOCK_KEYWORDS = [
  { id: 1, keyword: "pizza restaurant near me", active: true, generated: true },
  { id: 2, keyword: "italian food fairfield", active: false, generated: false },
  { id: 3, keyword: "best pizza delivery", active: false, generated: true },
];

// Generate mock ranking data with DataForSEO-like structure
const generateMockRankingData = () => {
  const center = { lat: 38.2493, lng: -122.0397 };
  const radius = 0.1;
  const results = [];

  const competitorNames = [
    "Tony's Pizza Palace",
    "Mario's Italian Bistro",
    "Fairfield Pizza Co",
    "Slice Heaven",
    "Papa Giuseppe's",
    "Nonna's Pizza Kitchen",
    "Milano's Pizzeria",
    "Rustic Oven",
    "Pizza Corner",
    "Italian Express",
    "Fire Stone Pizza",
    "Roma's Restaurant",
    "Sicilian Delight",
    "Pizza Hut",
    "Domino's Pizza",
    "Round Table Pizza",
    "Little Caesars",
    "Mountain Mike's",
  ];

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * 2 * Math.PI;
    const distance = 0.02 + Math.random() * radius;
    const lat = center.lat + Math.cos(angle) * distance;
    const lng = center.lng + Math.sin(angle) * distance;

    const distanceFromCenter = Math.sqrt(
      Math.pow(lat - center.lat, 2) + Math.pow(lng - center.lng, 2),
    );
    let rank = null;

    const rankProbability = Math.max(0, 1 - (distanceFromCenter / radius) * 2);

    if (Math.random() < rankProbability) {
      if (distanceFromCenter < radius * 0.3) {
        rank = Math.floor(Math.random() * 3) + 1;
      } else if (distanceFromCenter < radius * 0.6) {
        rank = Math.floor(Math.random() * 7) + 4;
      } else {
        rank = Math.floor(Math.random() * 10) + 11;
      }
    }

    // Generate competitors with more realistic data
    const numCompetitors = Math.min(
      Math.floor(Math.random() * 8) + 3,
      competitorNames.length,
    );
    const shuffledCompetitors = [...competitorNames]
      .sort(() => 0.5 - Math.random())
      .slice(0, numCompetitors);

    const competitors = shuffledCompetitors.map((name, idx) => ({
      name,
      rank: idx + 1,
      rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
      reviews: Math.floor(Math.random() * 500) + 20,
      address: `${Math.floor(Math.random() * 9999) + 1000} ${["Main St", "Oak Ave", "Elm St", "Park Blvd", "First St"][Math.floor(Math.random() * 5)]}, Fairfield, CA`,
      phone: `(707) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      website: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      category: "Pizza Restaurant",
      price_level: "$".repeat(Math.floor(Math.random() * 3) + 1),
      hours:
        "Open • Closes at " +
        [9, 10, 11, 12][Math.floor(Math.random() * 4)] +
        "PM",
      distance: (distanceFromCenter * 111).toFixed(1) + " km", // Convert degrees to km roughly
    }));

    results.push({
      id: `waypoint-${i}`,
      lat,
      lng,
      rank,
      address: `Search Point ${i + 1}`,
      searchRadius: "1.5 km",
      totalResults: competitors.length,
      searchQuery: "pizza restaurant near me",
      device: "desktop",
      language: "en",
      competitors,
      analysis: {
        topBusinessRating: Math.max(...competitors.map((c) => c.rating)),
        averageRating:
          competitors.reduce((sum, c) => sum + c.rating, 0) /
          competitors.length,
        competitionLevel:
          competitors.length > 15
            ? "High"
            : competitors.length > 10
              ? "Medium"
              : "Low",
      },
    });
  }

  return results;
};

const MOCK_RANKING_DATA = generateMockRankingData();

export default function Maps() {
  const [business] = useState(MOCK_BUSINESS);
  const [activeKeyword, setActiveKeyword] = useState(MOCK_KEYWORDS[0]);
  const [keywords] = useState(MOCK_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewMode, setViewMode] = useState<"satellite" | "roadmap">("roadmap");
  const [showCompetitors, setShowCompetitors] = useState(true);
  const [gridPattern, setGridPattern] = useState("circular");
  const [gridDensity, setGridDensity] = useState("medium");
  const [gridRadius, setGridRadius] = useState("10");
  const [searchDepth, setSearchDepth] = useState("20");
  const [deviceType, setDeviceType] = useState<"desktop" | "mobile">("desktop");
  const [languageCode, setLanguageCode] = useState("en");

  const [analysisComplete, setAnalysisComplete] = useState(true);
  const [rankingData] = useState(MOCK_RANKING_DATA);
  const [showCompareView, setShowCompareView] = useState(false);
  const [compareResults, setCompareResults] = useState<any[]>([]);

  // Calculated stats with null checks
  const totalLocations = (rankingData || []).length;
  const rankingLocations = (rankingData || []).filter(
    (r) => r?.rank !== null,
  ).length;
  const top3Count = (rankingData || []).filter(
    (r) => r?.rank && r.rank <= 3,
  ).length;
  const top10Count = (rankingData || []).filter(
    (r) => r?.rank && r.rank <= 10,
  ).length;
  const averageRank =
    rankingLocations > 0
      ? (rankingData || [])
          .filter((r) => r?.rank)
          .reduce((sum, r) => sum + (r?.rank || 0), 0) / rankingLocations
      : 0;

  const centerLocation = { lat: 38.2493, lng: -122.0397 };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisComplete(false);

    for (let i = 0; i <= 100; i += 5) {
      setProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsAnalyzing(false);
    setAnalysisComplete(true);
    toast.success("Ranking analysis completed!");
  };

  const getMapMarkers = useCallback(() => {
    const markers = [];

    // Add ranking waypoint markers
    (rankingData || []).forEach((point, index) => {
      let color = "#9CA3AF";
      let size = "small";

      if (point?.rank) {
        if (point.rank <= 3) {
          color = "#10B981";
          size = "large";
        } else if (point.rank <= 10) {
          color = "#F59E0B";
          size = "medium";
        } else {
          color = "#EF4444";
          size = "small";
        }
      }

      markers.push({
        id: point?.id || `marker-${index}`,
        position: { lat: point?.lat || 0, lng: point?.lng || 0 },
        title: point?.rank ? `Rank #${point.rank}` : "Not Ranking",
        content: `
          <div style="padding: 16px; min-width: 320px; max-width: 400px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
              <div>
                <h3 style="font-weight: 600; color: #111827; margin: 0;">${point?.address || "Search Location"}</h3>
                <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">Search Radius: ${point?.searchRadius || "1.5 km"}</p>
              </div>
              ${
                point?.rank
                  ? `<span style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 20px; ${
                      (point?.rank || 0) <= 3
                        ? "background-color: #dcfce7; color: #166534;"
                        : (point?.rank || 0) <= 10
                          ? "background-color: #fef3c7; color: #92400e;"
                          : "background-color: #fee2e2; color: #991b1b;"
                    }">RANK #${point?.rank}</span>`
                  : '<span style="padding: 6px 12px; font-size: 12px; font-weight: 500; background-color: #f3f4f6; color: #4b5563; border-radius: 20px;">NOT RANKING</span>'
              }
            </div>

            <div style="margin-bottom: 12px;">
              <p style="font-size: 13px; color: #374151; margin: 0;"><strong>Query:</strong> ${activeKeyword?.keyword || ""}</p>
              <p style="font-size: 13px; color: #374151; margin: 4px 0 0 0;"><strong>Results Found:</strong> ${point?.totalResults || 0} businesses</p>
              <p style="font-size: 13px; color: #374151; margin: 4px 0 0 0;"><strong>Competition:</strong>
                <span style="color: ${point?.analysis?.competitionLevel === "High" ? "#dc2626" : point?.analysis?.competitionLevel === "Medium" ? "#d97706" : "#059669"};">
                  ${point?.analysis?.competitionLevel || "Medium"}
                </span>
              </p>
            </div>

            ${
              (point?.competitors || []).length > 0
                ? `
              <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
                <p style="font-size: 12px; font-weight: 600; color: #374151; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">Top Ranking Businesses</p>
                ${(point?.competitors || [])
                  .slice(0, 5)
                  .map(
                    (comp, idx) => `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: ${idx < 4 ? "1px solid #f3f4f6" : "none"};">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 13px; font-weight: 500; color: #111827; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${comp?.name}</div>
                      <div style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0; display: flex; align-items: center; gap: 8px;">
                        <span>⭐ ${comp?.rating}</span>
                        <span>📍 ${comp?.distance}</span>
                        <span style="color: #059669;">${comp?.price_level || "$"}</span>
                      </div>
                    </div>
                    <div style="margin-left: 12px;">
                      <span style="background-color: ${idx === 0 ? "#fbbf24" : idx === 1 ? "#9ca3af" : idx === 2 ? "#cd7c2f" : "#e5e7eb"}; color: ${idx < 3 ? "white" : "#6b7280"}; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 12px;">#${comp?.rank}</span>
                    </div>
                  </div>
                `,
                  )
                  .join("")}
                ${
                  (point?.competitors || []).length > 5
                    ? `
                  <p style="font-size: 11px; color: #6b7280; margin: 8px 0 0 0; text-align: center;">+${(point?.competitors || []).length - 5} more businesses</p>
                `
                    : ""
                }
              </div>
            `
                : ""
            }

            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 10px; color: #9ca3af; margin: 0; text-align: center;">DataForSEO Local Rankings • ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        `,
        color,
        rank: point?.rank || null,
        size,
      });
    });

    // Add business center marker
    markers.push({
      id: "business-center",
      position: centerLocation,
      title: business.name,
      content: `
        <div style="padding: 12px;">
          <h3 style="font-weight: 600; color: #111827; margin-bottom: 4px;">${business.name}</h3>
          <p style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">${business.address}</p>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="display: flex; color: #fbbf24;">
              ${[1, 2, 3, 4, 5].map((i) => `<svg style="width: 12px; height: 12px; fill: currentColor;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`).join("")}
            </div>
            <span style="font-size: 14px; color: #4b5563;">${business.rating} (${business.reviewCount})</span>
          </div>
          <p style="font-size: 12px; color: #2563eb; font-weight: 500;">🎯 Target Business</p>
        </div>
      `,
      color: "#DC2626",
      icon: "business",
      size: "large",
    });

    return markers;
  }, [rankingData, business, activeKeyword, centerLocation]);

  const handleCompare = (results: any[]) => {
    setCompareResults(results);
    setShowCompareView(true);
    logBulkAction('compare', results.length, 'current-user', {
      keywords: results.map(r => r.keyword),
      businesses: results.map(r => r.businessName),
    });
  };

  const handleDownload = (results: any[]) => {
    // Simulate download
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geo-grid-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logBulkAction('download', results.length, 'current-user', {
      format: 'json',
      keywords: results.map(r => r.keyword),
    });
  };

  const handleArchive = (results: any[]) => {
    // Simulate archive operation
    console.log('Archiving results:', results);

    logBulkAction('archive', results.length, 'current-user', {
      keywords: results.map(r => r.keyword),
      businesses: results.map(r => r.businessName),
    });
  };

  if (showCompareView) {
    return (
      <AppLayout>
        <GeoGridCompareView
          results={compareResults}
          onClose={() => setShowCompareView(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="flex h-screen overflow-hidden">
          {/* Enhanced Left Sidebar */}
          <div className="w-96 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 overflow-y-auto shadow-lg">
            {/* Target Business Section */}
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <h2 className="font-bold text-slate-900">Target Business</h2>
                {business.verified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Shield className="h-4 w-4 text-blue-600" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Verified Business</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-md">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 truncate text-lg">
                        {business.name}
                      </h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-slate-100"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Business Info</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {business.rating}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({business.reviewCount})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {(business.categories || []).map((category, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs bg-slate-100 text-slate-700"
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{business.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{business.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{business.website}</span>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">
                      {business.hours}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Keywords Section */}
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-slate-600" />
                  <h2 className="font-bold text-slate-900">Keywords</h2>
                  <Badge variant="outline" className="text-xs">
                    {(keywords || []).filter((k) => k?.active).length}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {(keywords || []).map((kw) => (
                  <div
                    key={kw.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      activeKeyword?.id === kw.id
                        ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setActiveKeyword(kw)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {kw.generated && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-700 text-xs"
                        >
                          Auto
                        </Badge>
                      )}
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {kw.keyword}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add new keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button size="sm" disabled={!newKeyword}>
                  Add
                </Button>
              </div>
            </div>

            {/* Advanced Configuration */}
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-slate-600" />
                <h2 className="font-bold text-slate-900">
                  Search Configuration
                </h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Device
                    </Label>
                    <Select
                      value={deviceType}
                      onValueChange={(value: "desktop" | "mobile") =>
                        setDeviceType(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Language
                    </Label>
                    <Select
                      value={languageCode}
                      onValueChange={setLanguageCode}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Search Depth (Results per location)
                  </Label>
                  <Select value={searchDepth} onValueChange={setSearchDepth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Top 10 Results</SelectItem>
                      <SelectItem value="20">Top 20 Results</SelectItem>
                      <SelectItem value="50">Top 50 Results</SelectItem>
                      <SelectItem value="100">Top 100 Results</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Pattern
                    </Label>
                    <Select value={gridPattern} onValueChange={setGridPattern}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circular">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4" />
                            Circular
                          </div>
                        </SelectItem>
                        <SelectItem value="grid">
                          <div className="flex items-center gap-2">
                            <Grid3X3 className="h-4 w-4" />
                            Grid
                          </div>
                        </SelectItem>
                        <SelectItem value="radial">
                          <div className="flex items-center gap-2">
                            <Crosshair className="h-4 w-4" />
                            Radial
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Radius
                    </Label>
                    <Select value={gridRadius} onValueChange={setGridRadius}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 km</SelectItem>
                        <SelectItem value="10">10 km</SelectItem>
                        <SelectItem value="15">15 km</SelectItem>
                        <SelectItem value="20">20 km</SelectItem>
                        <SelectItem value="30">30 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 mb-1">
                        DataForSEO Analysis
                      </p>
                      <p className="text-blue-700">
                        Using <strong>{totalLocations} waypoints</strong> ×{" "}
                        <strong>{searchDepth} results</strong> ={" "}
                        {totalLocations * parseInt(searchDepth)} total API
                        credits
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5">
              <div className="space-y-3">
                <Button
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing... {progress}%
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Start Analysis
                    </>
                  )}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    API Setup
                  </Button>
                </div>
              </div>
            </div>

            {/* Results Dashboard */}
            {analysisComplete && (
              <div className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-slate-600" />
                    <h2 className="font-bold text-slate-900">Results</h2>
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  </div>

                  {/* Performance Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <Card className="p-3 border-emerald-200 bg-emerald-50">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-700">
                          {top3Count}
                        </div>
                        <div className="text-xs text-emerald-600 flex items-center justify-center gap-1">
                          <Crown className="h-3 w-3" />
                          Top 3
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 border-amber-200 bg-amber-50">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-700">
                          {top10Count}
                        </div>
                        <div className="text-xs text-amber-600 flex items-center justify-center gap-1">
                          <Award className="h-3 w-3" />
                          Top 10
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 border-slate-200 bg-slate-50">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-700">
                          {averageRank.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-600">Avg Rank</div>
                      </div>
                    </Card>
                    <Card className="p-3 border-blue-200 bg-blue-50">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {((rankingLocations / totalLocations) * 100).toFixed(
                            0,
                          )}
                          %
                        </div>
                        <div className="text-xs text-blue-600">Coverage</div>
                      </div>
                    </Card>
                  </div>

                  {/* Quick Location Results */}
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {(rankingData || []).slice(0, 8).map((result, index) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-sm"
                      >
                        <span className="text-slate-600 flex-1 truncate">
                          {result.address}
                        </span>
                        {result.rank ? (
                          <Badge
                            variant={
                              result.rank <= 3
                                ? "default"
                                : result.rank <= 10
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs ml-2"
                          >
                            #{result.rank}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs ml-2">
                            —
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Map Area */}
          <div className="flex-1 relative bg-slate-100">
            {/* Analysis Progress Overlay */}
            {isAnalyzing && (
              <div className="absolute bottom-6 left-6 right-6 z-10">
                <Card className="bg-white/95 backdrop-blur-sm border-blue-200 shadow-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            Analyzing Rankings
                          </div>
                          <div className="text-sm text-slate-600">
                            Processing {totalLocations} locations for "
                            {activeKeyword?.keyword || ""}"
                          </div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">Progress</span>
                          <span className="font-medium text-slate-900">
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-blue-700 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Performance Summary Overlay */}
            {analysisComplete && (
              <div className="absolute top-4 left-4 z-10">
                <Card className="bg-white/95 backdrop-blur-sm border-slate-200 shadow-lg">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-600">
                          {top3Count}
                        </div>
                        <div className="text-xs text-slate-600">Top 3</div>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">
                          {top10Count}
                        </div>
                        <div className="text-xs text-slate-600">Top 10</div>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-700">
                          {averageRank.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-600">Avg</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Google Map */}
            <div className="h-full">
              <GoogleMapComponent
                center={centerLocation}
                zoom={12}
                markers={getMapMarkers()}
                height="100%"
                showControls={true}
                showDirectionsButton={false}
                className="h-full border-0 rounded-none"
              />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
