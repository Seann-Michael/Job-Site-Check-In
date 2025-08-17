import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AppLayout } from "@/components/AppLayout";
import {
  MapPin,
  Target,
  Play,
  Settings,
  Zap,
  Building2,
  Search,
  Grid3X3,
  Circle,
  Crosshair,
  Clock,
  Info,
  ArrowRight,
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCredits } from "@/components/CreditProvider";
import {
  calculateScanCost,
  deductCredits,
  hasSufficientCredits,
  formatCredits,
} from "@/lib/creditSystem";

export default function OneTimeScan() {
  const navigate = useNavigate();
  const { balance } = useCredits();
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [gridPattern, setGridPattern] = useState("circular");
  const [gridRadius, setGridRadius] = useState("10");
  const [searchDepth, setSearchDepth] = useState("20");
  const [isRunning, setIsRunning] = useState(false);

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
      toast.success("Keyword added");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusinessAddress(e.target.value);
  };

  // Calculate scan cost based on current settings
  const scanCost = useMemo(() => {
    const waypointCount = parseInt(searchDepth) || 0;
    const keywordCount = keywords.length;
    return calculateScanCost(waypointCount, keywordCount, false);
  }, [searchDepth, keywords.length]);

  const startScan = async () => {
    if (!businessName || !businessAddress || keywords.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Check if user has sufficient credits
    if (!hasSufficientCredits(scanCost)) {
      toast.error(
        `Insufficient credits. Need ${formatCredits(scanCost)} credits, but only have ${formatCredits(balance.remaining)} remaining.`,
      );
      return;
    }

    setIsRunning(true);

    try {
      // Deduct credits for the scan
      const scanId = `scan_${Date.now()}`;
      const success = deductCredits(
        scanCost,
        `One-time scan: ${businessName} (${keywords.length} keywords, ${searchDepth} waypoints)`,
        {
          scanId,
          scanType: "one-time",
          waypointCount: parseInt(searchDepth),
          keywordCount: keywords.length,
        },
      );

      if (!success) {
        toast.error("Failed to deduct credits. Please try again.");
        return;
      }

      toast.success(
        `Scan started! ${formatCredits(scanCost)} credits deducted.`,
      );

      // Navigate to Maps page with scan data
      navigate("/admin/maps/geo-grid-scan", {
        state: {
          scanType: "one-time",
          businessName,
          businessAddress,
          keywords,
          gridPattern,
          gridRadius,
          searchDepth,
          scanId,
        },
      });
    } catch (error) {
      toast.error("Failed to start scan. Please try again.");
      console.error("Scan start error:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const estimatedCredits = scanCost;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">One Time Scan</h1>
          </div>
          <p className="text-gray-600">
            Run a comprehensive local ranking analysis to see how your business
            ranks across multiple locations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Enter your business name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessAddress">Business Address *</Label>
                  <Input
                    id="businessAddress"
                    value={businessAddress}
                    onChange={handleAddressChange}
                    placeholder="Enter your business address"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Keywords */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Target Keywords
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Enter a keyword (e.g., pizza restaurant)"
                    onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                  />
                  <Button onClick={addKeyword} disabled={!newKeyword.trim()}>
                    Add
                  </Button>
                </div>

                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeKeyword(keyword)}
                      >
                        {keyword} ×
                      </Badge>
                    ))}
                  </div>
                )}

                {keywords.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Add keywords to analyze your rankings for
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Scan Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Scan Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Grid Pattern</Label>
                    <Select value={gridPattern} onValueChange={setGridPattern}>
                      <SelectTrigger className="mt-1">
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
                    <Label>Search Radius</Label>
                    <Select value={gridRadius} onValueChange={setGridRadius}>
                      <SelectTrigger className="mt-1">
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

                  <div>
                    <Label>Search Depth</Label>
                    <Select value={searchDepth} onValueChange={setSearchDepth}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">Top 10</SelectItem>
                        <SelectItem value="20">Top 20</SelectItem>
                        <SelectItem value="50">Top 50</SelectItem>
                        <SelectItem value="100">Top 100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 mb-1">
                        Analysis Coverage
                      </p>
                      <p className="text-sm text-blue-700">
                        This scan will analyze <strong>24 locations</strong> in
                        a {gridRadius}km radius around your business for{" "}
                        <strong>
                          {keywords.length} keyword
                          {keywords.length !== 1 ? "s" : ""}
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scan Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Business:</span>
                    <span className="text-sm font-medium">
                      {businessName || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Keywords:</span>
                    <span className="text-sm font-medium">
                      {keywords.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Locations:</span>
                    <span className="text-sm font-medium">24</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Radius:</span>
                    <span className="text-sm font-medium">{gridRadius} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Depth:</span>
                    <span className="text-sm font-medium">
                      Top {searchDepth}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">
                      API Credits:
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {estimatedCredits.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Estimated cost based on DataForSEO pricing
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What You'll Get</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-sm">Ranking Positions</p>
                    <p className="text-xs text-gray-600">
                      See where you rank for each keyword at every location
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-sm">Competitor Analysis</p>
                    <p className="text-xs text-gray-600">
                      Identify who's ranking above you and their details
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-sm">Visual Map Report</p>
                    <p className="text-xs text-gray-600">
                      Interactive map showing all ranking data
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-sm">Exportable Data</p>
                    <p className="text-xs text-gray-600">
                      Download results as CSV for further analysis
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {/* Credit Cost Display */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Scan Cost
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {formatCredits(scanCost)} credits
                  </div>
                  {balance.remaining < scanCost && (
                    <div className="text-xs text-red-600">
                      Insufficient credits
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={startScan}
                className="w-full"
                size="lg"
                disabled={
                  !businessName ||
                  !businessAddress ||
                  keywords.length === 0 ||
                  balance.remaining < scanCost ||
                  isRunning
                }
              >
                {isRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Starting Scan...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Start One Time Scan
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              {/* Insufficient Credits Warning */}
              {balance.remaining < scanCost && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="text-red-600">⚠️</div>
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Insufficient Credits
                      </p>
                      <p className="text-xs text-red-700">
                        You need {formatCredits(scanCost)} credits but only have{" "}
                        {formatCredits(balance.remaining)} remaining.
                        <button
                          onClick={() => navigate("/admin/credits/purchase")}
                          className="text-red-800 underline ml-1"
                        >
                          Purchase more credits
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
