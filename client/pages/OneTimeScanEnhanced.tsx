import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/AppLayout";
import { GoogleMapComponent } from "@/components/GoogleMaps/GoogleMapComponent";
import { BusinessPlacesSearch } from "@/components/GoogleMaps/BusinessPlacesSearch";
import {
  MapPin,
  Target,
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
  Navigation,
  Map,
  Calculator,
  Star,
  AlertCircle,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCredits } from "@/components/CreditProvider";
import {
  calculateAdvancedScanCost,
  deductCredits,
  hasSufficientCredits,
  formatCredits,
  type ScanOptions,
  type BusinessLocation,
} from "@/lib/creditSystem";
import {
  validateBusinessInput,
  type PlaceResult,
} from "@/lib/googlePlaces";
import {
  generateWaypoints,
  toggleWaypoint,
  getEnabledWaypointsCount,
  type Waypoint,
  type WaypointGenerationOptions,
} from "@/lib/waypointGenerator";

export default function OneTimeScanEnhanced() {
  const navigate = useNavigate();
  const { balance } = useCredits();

  // Business Search State
  const [businessInput, setBusinessInput] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessLocation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMethod, setSearchMethod] = useState<"search" | "manual">(
    "search",
  );

  // Manual Business Input
  const [manualBusinessName, setManualBusinessName] = useState("");
  const [manualBusinessAddress, setManualBusinessAddress] = useState("");
  const [isServiceBased, setIsServiceBased] = useState(false);

  // Keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  // Scan Configuration
  const [scanConfig, setScanConfig] = useState({
    depth: 20,
    apiCallType: "circle" as "circle" | "rectangle",
    priority: "standard" as "standard" | "expedited" | "priority",
  });

  // Waypoint Configuration
  const [waypointConfig, setWaypointConfig] = useState({
    count: 10,
    distanceBetween: 1,
    unit: "miles" as "miles" | "kilometers",
    pattern: "circle" as "circle" | "grid" | "line",
  });

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [showWaypointMap, setShowWaypointMap] = useState(false);

  const [isRunning, setIsRunning] = useState(false);

  // Handle business selection from BusinessPlacesSearch component
  const handleBusinessSelect = (businessName: string, placeResult?: any) => {
    if (placeResult) {
      setSelectedBusiness({
        name: placeResult.name,
        address: placeResult.formattedAddress,
        coordinates: { lat: placeResult.lat, lng: placeResult.lng },
        placeId: placeResult.placeId,
        cid: placeResult.cid,
      });
      setBusinessInput(businessName);
    }
  };


  // Generate waypoints when configuration changes
  useEffect(() => {
    if (selectedBusiness?.coordinates) {
      const options: WaypointGenerationOptions = {
        center: selectedBusiness.coordinates,
        count: waypointConfig.count,
        distanceBetween: waypointConfig.distanceBetween,
        unit: waypointConfig.unit,
        pattern: waypointConfig.pattern,
      };

      const newWaypoints = generateWaypoints(options);
      setWaypoints(newWaypoints);
    }
  }, [selectedBusiness, waypointConfig]);

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
      toast.success("Keyword added");
    }
  };

  // Remove keyword
  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  // Toggle waypoint
  const handleWaypointToggle = (waypointId: string) => {
    setWaypoints(toggleWaypoint(waypoints, waypointId));
  };

  // Calculate scan cost
  const scanCost = useMemo(() => {
    const enabledWaypoints = getEnabledWaypointsCount(waypoints);
    const options: ScanOptions = {
      waypointCount: enabledWaypoints,
      keywordCount: keywords.length,
      depth: scanConfig.depth,
      apiCallType: scanConfig.apiCallType,
      priority: scanConfig.priority,
      isRecurring: false,
    };
    return calculateAdvancedScanCost(options);
  }, [waypoints, keywords.length, scanConfig]);

  // Get business for scan
  const getBusinessForScan = (): BusinessLocation | null => {
    if (searchMethod === "search" && selectedBusiness) {
      return selectedBusiness;
    } else if (searchMethod === "manual" && manualBusinessName) {
      return {
        name: manualBusinessName,
        address: isServiceBased ? undefined : manualBusinessAddress,
        isServiceBased,
      };
    }
    return null;
  };

  // Start scan
  const startScan = async () => {
    const business = getBusinessForScan();

    if (!business || keywords.length === 0 || waypoints.length === 0) {
      toast.error("Please complete all required fields");
      return;
    }

    const enabledWaypoints = waypoints.filter((w) => w.enabled);
    if (enabledWaypoints.length === 0) {
      toast.error("Please enable at least one waypoint");
      return;
    }

    if (!hasSufficientCredits(scanCost)) {
      toast.error(
        `Insufficient credits. Need ${formatCredits(scanCost)} credits, but only have ${formatCredits(
          balance.remaining,
        )} remaining.`,
      );
      return;
    }

    setIsRunning(true);

    try {
      const scanId = `scan_${Date.now()}`;
      const success = deductCredits(
        scanCost,
        `One-time scan: ${business.name} (${keywords.length} keywords, ${enabledWaypoints.length} waypoints, ${scanConfig.priority} priority)`,
        {
          scanId,
          scanType: "one-time",
          waypointCount: enabledWaypoints.length,
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
      navigate("/admin/maps", {
        state: {
          scanType: "one-time",
          business,
          keywords,
          waypoints: enabledWaypoints,
          scanConfig,
          waypointConfig,
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

  // Check if form is complete
  const isFormComplete = () => {
    const business = getBusinessForScan();
    return business && keywords.length > 0 && waypoints.length > 0;
  };

  const enabledWaypointsCount = getEnabledWaypointsCount(waypoints);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Enhanced One Time Scan
            </h1>
          </div>
          <p className="text-gray-600">
            Advanced local ranking analysis with customizable waypoints,
            priority levels, and search patterns.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Configuration Panel */}
          <div className="xl:col-span-3 space-y-6">
            {/* Business Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={searchMethod}
                  onValueChange={(v) =>
                    setSearchMethod(v as "search" | "manual")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="search">Search Business</TabsTrigger>
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  </TabsList>

                  <TabsContent value="search" className="space-y-4">
                    <BusinessPlacesSearch
                      value={businessInput}
                      onChange={handleBusinessSelect}
                      onPlaceSelect={(place) => {
                        setSelectedBusiness({
                          name: place.name,
                          address: place.formattedAddress,
                          coordinates: { lat: place.lat, lng: place.lng },
                          placeId: place.placeId,
                          cid: place.cid,
                        });
                      }}
                      placeholder="Search for your business name, CID, or Google Maps URL"
                      label="Business Search"
                    />

                    {selectedBusiness && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-green-900">
                              Selected Business
                            </p>
                            <p className="text-green-800">
                              {selectedBusiness.name}
                            </p>
                            {selectedBusiness.address && (
                              <p className="text-sm text-green-700">
                                {selectedBusiness.address}
                              </p>
                            )}
                            {selectedBusiness.cid && (
                              <p className="text-xs text-green-600">
                                CID: {selectedBusiness.cid}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedBusiness(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4">
                    <div>
                      <Label htmlFor="manualBusinessName">
                        Business Name *
                      </Label>
                      <Input
                        id="manualBusinessName"
                        value={manualBusinessName}
                        onChange={(e) => setManualBusinessName(e.target.value)}
                        placeholder="Enter business name"
                        className="mt-1"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="service-based"
                        checked={isServiceBased}
                        onCheckedChange={setIsServiceBased}
                      />
                      <Label htmlFor="service-based">
                        Service-based business (no physical address)
                      </Label>
                    </div>

                    {!isServiceBased && (
                      <div>
                        <Label htmlFor="manualBusinessAddress">
                          Business Address
                        </Label>
                        <Textarea
                          id="manualBusinessAddress"
                          value={manualBusinessAddress}
                          onChange={(e) =>
                            setManualBusinessAddress(e.target.value)
                          }
                          placeholder="Enter full business address"
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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
                        {keyword} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}

                {keywords.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Add keywords to analyze rankings for
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
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Search Depth</Label>
                    <Select
                      value={scanConfig.depth.toString()}
                      onValueChange={(value) =>
                        setScanConfig({ ...scanConfig, depth: parseInt(value) })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">Top 10</SelectItem>
                        <SelectItem value="20">Top 20</SelectItem>
                        <SelectItem value="30">Top 30</SelectItem>
                        <SelectItem value="50">Top 50</SelectItem>
                        <SelectItem value="100">Top 100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>API Call Type</Label>
                    <Select
                      value={scanConfig.apiCallType}
                      onValueChange={(value) =>
                        setScanConfig({
                          ...scanConfig,
                          apiCallType: value as "circle" | "rectangle",
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4" />
                            Circle (Standard)
                          </div>
                        </SelectItem>
                        <SelectItem value="rectangle">
                          <div className="flex items-center gap-2">
                            <Grid3X3 className="h-4 w-4" />
                            Rectangle (+20%)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Priority Level</Label>
                    <Select
                      value={scanConfig.priority}
                      onValueChange={(value) =>
                        setScanConfig({
                          ...scanConfig,
                          priority: value as
                            | "standard"
                            | "expedited"
                            | "priority",
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="expedited">
                          Expedited (+50%)
                        </SelectItem>
                        <SelectItem value="priority">
                          Priority (+100%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Waypoint Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  Waypoint Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Map Grid</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <Select
                      value={waypointConfig.pattern}
                      onValueChange={(value) =>
                        setWaypointConfig({
                          ...waypointConfig,
                          pattern: value as "circle" | "grid" | "line",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4" />
                            Circle
                          </div>
                        </SelectItem>
                        <SelectItem value="grid">
                          <div className="flex items-center gap-2">
                            <Grid3X3 className="h-4 w-4" />
                            Grid
                          </div>
                        </SelectItem>
                        <SelectItem value="line">
                          <div className="flex items-center gap-2">
                            <Crosshair className="h-4 w-4" />
                            Linear
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={`${waypointConfig.count}-${waypointConfig.distanceBetween}`}
                      onValueChange={(value) => {
                        const [count, distance] = value.split('-');
                        setWaypointConfig({
                          ...waypointConfig,
                          count: parseInt(count),
                          distanceBetween: parseFloat(distance)
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="5-0.5">5 Pins | ⌀0.5</SelectItem>
                        <SelectItem value="5-1">5 Pins | ⌀1</SelectItem>
                        <SelectItem value="5-2">5 Pins | ⌀2</SelectItem>
                        <SelectItem value="8-0.5">8 Pins | ⌀0.5</SelectItem>
                        <SelectItem value="8-1">8 Pins | ⌀1</SelectItem>
                        <SelectItem value="8-2">8 Pins | ⌀2</SelectItem>
                        <SelectItem value="10-0.5">10 Pins | ⌀0.5</SelectItem>
                        <SelectItem value="10-1">10 Pins | ⌀1</SelectItem>
                        <SelectItem value="10-2">10 Pins | ⌀2</SelectItem>
                        <SelectItem value="15-0.5">15 Pins | ⌀0.5</SelectItem>
                        <SelectItem value="15-1">15 Pins | ⌀1</SelectItem>
                        <SelectItem value="15-2">15 Pins | ⌀2</SelectItem>
                        <SelectItem value="20-0.5">20 Pins | ⌀0.5</SelectItem>
                        <SelectItem value="20-1">20 Pins | ⌀1</SelectItem>
                        <SelectItem value="20-2">20 Pins | ⌀2</SelectItem>
                        <SelectItem value="25-1">25 Pins | ⌀1</SelectItem>
                        <SelectItem value="25-2">25 Pins | ⌀2</SelectItem>
                        <SelectItem value="30-1">30 Pins | ⌀1</SelectItem>
                        <SelectItem value="30-2">30 Pins | ⌀2</SelectItem>
                        <SelectItem value="30-3">30 Pins | ⌀3</SelectItem>
                        <SelectItem value="40-2">40 Pins | ⌀2</SelectItem>
                        <SelectItem value="40-3">40 Pins | ⌀3</SelectItem>
                        <SelectItem value="50-2">50 Pins | ⌀2</SelectItem>
                        <SelectItem value="50-3">50 Pins | ⌀3</SelectItem>
                        <SelectItem value="50-5">50 Pins | ⌀5</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex rounded-md border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setWaypointConfig({ ...waypointConfig, unit: "kilometers" })}
                        className={`flex-1 px-3 py-2 text-sm font-medium border-r transition-colors ${
                          waypointConfig.unit === "kilometers"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        km
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaypointConfig({ ...waypointConfig, unit: "miles" })}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          waypointConfig.unit === "miles"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        mi
                      </button>
                    </div>
                  </div>
                </div>

                {waypoints.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>
                        Generated Waypoints ({enabledWaypointsCount} of{" "}
                        {waypoints.length} enabled)
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowWaypointMap(!showWaypointMap)}
                      >
                        <Map className="h-4 w-4 mr-1" />
                        {showWaypointMap ? "Hide" : "Show"} Map
                      </Button>
                    </div>

                    <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
                      {waypoints.map((waypoint) => (
                        <div
                          key={waypoint.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={waypoint.enabled}
                              onCheckedChange={() =>
                                handleWaypointToggle(waypoint.id)
                              }
                              size="sm"
                            />
                            <span
                              className={waypoint.isCenter ? "font-bold" : ""}
                            >
                              {waypoint.isCenter
                                ? "📍 Center"
                                : `📌 ${waypoint.id}`}
                            </span>
                          </div>
                          <div className="text-gray-500">
                            {waypoint.distance?.toFixed(1)}{" "}
                            {waypointConfig.unit}
                            {waypoint.bearing !== undefined &&
                              ` • ${waypoint.bearing.toFixed(0)}°`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Panel */}
          <div className="space-y-6">
            {/* Scan Summary */}
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
                      {searchMethod === "search"
                        ? selectedBusiness?.name || "Not selected"
                        : manualBusinessName || "Not set"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Keywords:</span>
                    <span className="text-sm font-medium">
                      {keywords.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Waypoints:</span>
                    <span className="text-sm font-medium">
                      {enabledWaypointsCount} enabled
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Search Depth:</span>
                    <span className="text-sm font-medium">
                      Top {scanConfig.depth}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">API Type:</span>
                    <span className="text-sm font-medium capitalize">
                      {scanConfig.apiCallType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Priority:</span>
                    <span className="text-sm font-medium capitalize">
                      {scanConfig.priority}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">
                      API Credits:
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCredits(scanCost)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Cost includes all selected options and multipliers
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Credit Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Credit Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Available:</span>
                  <span className="text-sm font-medium">
                    {formatCredits(balance.remaining)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Required:</span>
                  <span className="text-sm font-medium">
                    {formatCredits(scanCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">After Scan:</span>
                  <span
                    className={`text-sm font-medium ${
                      balance.remaining >= scanCost
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCredits(Math.max(0, balance.remaining - scanCost))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Start Scan */}
            <div className="space-y-3">
              <Button
                onClick={startScan}
                className="w-full"
                size="lg"
                disabled={
                  !isFormComplete() || balance.remaining < scanCost || isRunning
                }
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Starting Scan...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Start Enhanced Scan
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              {balance.remaining < scanCost && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
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

              {!isFormComplete() && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Complete Required Fields
                      </p>
                      <ul className="text-xs text-orange-700 mt-1 space-y-1">
                        {!getBusinessForScan() && (
                          <li>• Select or enter business information</li>
                        )}
                        {keywords.length === 0 && (
                          <li>• Add at least one keyword</li>
                        )}
                        {waypoints.length === 0 && (
                          <li>• Configure waypoints</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Waypoint Map Display */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Search Locations Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <iframe
                  src={
                    selectedBusiness?.coordinates
                      ? `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d12000!2d${selectedBusiness.coordinates.lng}!3d${selectedBusiness.coordinates.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus`
                      : "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3179676.4675463075!2d-98.5795!3d39.8283!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDIzJzI3LjAiTiA5OMKwMzQnNDcuMCJX!5e0!3m2!1sen!2sus!4v1234567890"
                  }
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-lg"
                />

                {/* Waypoint Markers Overlay */}
                {selectedBusiness?.coordinates && waypoints.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {waypoints.filter(w => w.enabled).map((waypoint, index) => {
                      // Simple positioning calculation - center markers around the business location
                      const offsetX = (waypoint.coordinates.lng - selectedBusiness.coordinates.lng) * 8000 + 200;
                      const offsetY = (selectedBusiness.coordinates.lat - waypoint.coordinates.lat) * 8000 + 200;

                      return (
                        <div
                          key={waypoint.id}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                          style={{
                            left: `${50 + offsetX}%`,
                            top: `${50 + offsetY}%`,
                            maxWidth: 'none'
                          }}
                          title={waypoint.isCenter ? `Business Center: ${selectedBusiness.name}` : `Search Location ${index + 1}`}
                        >
                          {waypoint.isCenter ? (
                            // Business center marker
                            <div className="relative">
                              <div className="w-6 h-6 bg-green-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                                <Building2 className="w-3 h-3 text-white" />
                              </div>
                              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                Business
                              </div>
                            </div>
                          ) : (
                            // Search location marker
                            <div className="relative">
                              <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{index}</span>
                              </div>
                              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                Search {index + 1}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-600 mt-4">
                <p className="mb-2">
                  {selectedBusiness ? `📍 Showing: ${selectedBusiness.name}` : '🗺️ Select a business to focus the map'}
                </p>
                {waypoints.length > 0 && (
                  <div className="space-y-2">
                    <p>📌 {waypoints.filter(w => w.enabled).length} search locations visible on map</p>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded-full border border-white"></div>
                        <span>Search Locations</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-600 rounded-full border border-white"></div>
                        <span>Business Center</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
