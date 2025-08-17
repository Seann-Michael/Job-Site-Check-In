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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AppLayout } from "@/components/AppLayout";
import { GoogleMapComponent } from "@/components/GoogleMaps/GoogleMapComponentNew";
import {
  MapPin,
  Target,
  Settings,
  Zap,
  Search,
  Grid3X3,
  Circle,
  Crosshair,
  Clock,
  Info,
  ArrowRight,
  Navigation,
  Map,
  Star,
  AlertCircle,
  Check,
  X,
  Loader2,
  Calendar,
  Repeat,
  CalendarDays,
} from "lucide-react";
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCredits } from "@/components/CreditProvider";
import {
  calculateAdvancedScanCost,
  deductCredits,
  hasSufficientCredits,
  formatCredits,
  type ScanOptions,
} from "@/lib/creditSystem";
import {
  generateWaypoints,
  toggleWaypoint,
  getEnabledWaypointsCount,
  updateWaypointPosition,
  moveAllWaypointsRelative,
  type Waypoint,
  type WaypointGenerationOptions,
} from "@/lib/waypointGenerator";

// Mock center location (Fairfield, CA)
const DEFAULT_CENTER = { lat: 38.2493, lng: -122.0397 };

// Mock business for admin scans (already integrated Google account)
const ADMIN_BUSINESS = {
  name: "Joe's Pizza & More",
  address: "2275 Lejeune Cir, Fairfield, CA 94533",
  coordinates: DEFAULT_CENTER,
  placeId: "ChIJN1t_tDeuQIgRtK5mJ5O0QJY",
  cid: "1234567890",
};

export default function GeoGridScan() {
  const navigate = useNavigate();
  const { balance } = useCredits();

  // Scan Type (One-time vs Recurring)
  const [scanType, setScanType] = useState<"one-time" | "recurring">(
    "one-time",
  );

  // Recurring Scan Settings
  const [recurringSettings, setRecurringSettings] = useState({
    frequency: "weekly" as "daily" | "weekly" | "biweekly" | "monthly",
    startDate: new Date().toISOString().split("T")[0],
    autoRenew: true,
  });

  // Keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  // Combined Scan & Waypoint Configuration
  const [scanConfig, setScanConfig] = useState({
    // Scan settings
    depth: 20,
    apiCallType: "circle" as "circle" | "rectangle",
    priority: "standard" as "standard" | "expedited" | "priority",

    // Waypoint settings
    count: 25,
    rings: 3, // New ring-based configuration for circles
    distanceBetween: 1,
    unit: "miles" as "miles" | "kilometers",
    pattern: "circle" as "circle" | "grid" | "line",
  });

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Calculate waypoint count from rings for circle pattern
  const calculateWaypointCount = (rings: number): number => {
    if (rings === 0) return 1; // Just center
    let total = 1; // Start with center
    for (let i = 1; i <= rings; i++) {
      total += i === 1 ? 6 : 6 * i; // First ring = 6, subsequent rings = 6 * ring number
    }
    return total;
  };

  // Generate waypoints when configuration changes
  useEffect(() => {
    const actualCount =
      scanConfig.pattern === "circle"
        ? calculateWaypointCount(scanConfig.rings)
        : scanConfig.count;

    const options: WaypointGenerationOptions = {
      center: ADMIN_BUSINESS.coordinates,
      count: actualCount,
      rings: scanConfig.pattern === "circle" ? scanConfig.rings : undefined,
      distanceBetween: scanConfig.distanceBetween,
      unit: scanConfig.unit,
      pattern: scanConfig.pattern,
    };

    const newWaypoints = generateWaypoints(options);
    setWaypoints(newWaypoints);
  }, [
    scanConfig.count,
    scanConfig.rings,
    scanConfig.distanceBetween,
    scanConfig.unit,
    scanConfig.pattern,
  ]);

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
  const handleWaypointToggle = useCallback((waypointId: string) => {
    setWaypoints((prevWaypoints) => toggleWaypoint(prevWaypoints, waypointId));
  }, []);

  // Handle waypoint drag (individual waypoint)
  const handleWaypointDrag = useCallback(
    (waypointId: string, newPosition: { lat: number; lng: number }) => {
      setWaypoints((prevWaypoints) =>
        updateWaypointPosition(
          prevWaypoints,
          waypointId,
          newPosition,
          ADMIN_BUSINESS.coordinates,
          scanConfig.unit,
        ),
      );
    },
    [scanConfig.unit],
  );

  // Handle when all waypoints are moved together
  const handleWaypointsDragComplete = useCallback(
    (updatedWaypoints: Waypoint[]) => {
      setWaypoints(updatedWaypoints);
    },
    [],
  );

  // Memoize scan config object to prevent unnecessary re-renders
  const memoizedScanConfig = useMemo(
    () => ({
      unit: scanConfig.unit,
      distanceBetween: scanConfig.distanceBetween,
    }),
    [scanConfig.unit, scanConfig.distanceBetween],
  );

  // Use regular GoogleMapComponent to avoid React.memo issues

  // Calculate scan cost - each keyword creates a duplicate scan
  const scanCost = useMemo(() => {
    const enabledWaypoints = getEnabledWaypointsCount(waypoints);
    const options: ScanOptions = {
      waypointCount: enabledWaypoints,
      keywordCount: 1, // Each keyword is a separate scan
      depth: scanConfig.depth,
      apiCallType: scanConfig.apiCallType,
      priority: scanConfig.priority,
      isRecurring: scanType === "recurring",
    };
    const baseCost = calculateAdvancedScanCost(options);
    return baseCost * keywords.length; // Multiply by number of keywords
  }, [waypoints, keywords.length, scanConfig, scanType]);

  // Start scan
  const startScan = async () => {
    if (keywords.length === 0 || waypoints.length === 0) {
      toast.error("Please add keywords and configure waypoints");
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
      // Create separate scan for each keyword
      const scanIds = [];

      for (const keyword of keywords) {
        const scanId = `scan_${Date.now()}_${keyword.replace(/\s+/g, "_")}`;
        const singleScanCost = scanCost / keywords.length;

        const success = deductCredits(
          singleScanCost,
          `${scanType === "one-time" ? "One-time" : "Recurring"} Geo Grid Scan: ${ADMIN_BUSINESS.name} - "${keyword}" (${enabledWaypoints.length} waypoints, ${scanConfig.priority} priority)`,
          {
            scanId,
            scanType,
            waypointCount: enabledWaypoints.length,
            keywordCount: 1,
          },
        );

        if (!success) {
          toast.error("Failed to deduct credits. Please try again.");
          return;
        }

        scanIds.push(scanId);
      }

      toast.success(
        `${keywords.length} scan${keywords.length > 1 ? "s" : ""} started! ${formatCredits(scanCost)} credits deducted total.`,
      );

      // Navigate to Maps page with scan data
      navigate("/admin/maps/geo-grid-scan", {
        state: {
          scanType,
          business: ADMIN_BUSINESS,
          keywords,
          waypoints: enabledWaypoints,
          scanConfig,
          scanIds,
          recurringSettings:
            scanType === "recurring" ? recurringSettings : undefined,
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
    return keywords.length > 0 && waypoints.length > 0;
  };

  const enabledWaypointsCount = getEnabledWaypointsCount(waypoints);

  // This is no longer needed since we're using waypointData directly
  // const getMapMarkers = useCallback(() => {
  //   // Removed to prevent unnecessary re-renders
  // }, []);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Geo Grid Scan</h1>
          </div>
          <p className="text-gray-600">
            Advanced local ranking analysis for integrated Google Business
            Profile. Configure your scan parameters and waypoints below.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Scan Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Scan Type
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={scanType}
                  onValueChange={(value) =>
                    setScanType(value as "one-time" | "recurring")
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-4 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200">
                    <RadioGroupItem value="one-time" id="one-time" />
                    <Label
                      htmlFor="one-time"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <CalendarDays className="h-4 w-4" />
                      <div>
                        <div className="font-medium">One-Time Scan</div>
                        <div className="text-sm text-gray-500">
                          Run scan once
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-4 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200">
                    <RadioGroupItem value="recurring" id="recurring" />
                    <Label
                      htmlFor="recurring"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Repeat className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Recurring Scan</div>
                        <div className="text-sm text-gray-500">
                          Automated schedule
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {scanType === "recurring" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <Label>Frequency</Label>
                      <Select
                        value={recurringSettings.frequency}
                        onValueChange={(value) =>
                          setRecurringSettings({
                            ...recurringSettings,
                            frequency: value as
                              | "daily"
                              | "weekly"
                              | "biweekly"
                              | "monthly",
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent sideOffset={4}>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={recurringSettings.startDate}
                        onChange={(e) =>
                          setRecurringSettings({
                            ...recurringSettings,
                            startDate: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Switch
                        checked={recurringSettings.autoRenew}
                        onCheckedChange={(checked) =>
                          setRecurringSettings({
                            ...recurringSettings,
                            autoRenew: checked,
                          })
                        }
                      />
                      <Label className="text-sm">Auto-renew</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target Business - Read-only display for admin */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Target Business
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-green-900">
                          {ADMIN_BUSINESS.name}
                        </p>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
                          Connected
                        </Badge>
                      </div>
                      <p className="text-sm text-green-700">
                        {ADMIN_BUSINESS.address}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Using integrated Google Business Profile
                      </p>
                    </div>
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
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
                    className="max-w-md"
                  />
                  <Button onClick={addKeyword} disabled={!newKeyword.trim()}>
                    Add
                  </Button>
                </div>

                {keywords.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Each keyword will create a separate scan with the same
                      configuration:
                    </p>
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
                  </div>
                )}

                {keywords.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Add keywords to analyze rankings for
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Combined Scan & Waypoint Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Scan & Waypoint Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scan Settings */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    Search Parameters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">
                        Search Depth
                      </Label>
                      <Select
                        value={scanConfig.depth.toString()}
                        onValueChange={(value) =>
                          setScanConfig({
                            ...scanConfig,
                            depth: parseInt(value),
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent sideOffset={4}>
                          <SelectItem value="10">Top 10</SelectItem>
                          <SelectItem value="20">Top 20</SelectItem>
                          <SelectItem value="30">Top 30</SelectItem>
                          <SelectItem value="50">Top 50</SelectItem>
                          <SelectItem value="100">Top 100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        API Call Type
                      </Label>
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
                        <SelectContent sideOffset={4}>
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
                      <Label className="text-sm font-medium">
                        Priority Level
                      </Label>
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
                        <SelectContent sideOffset={4}>
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
                </div>

                {/* Waypoint Settings */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    Waypoint Grid
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-sm font-medium">
                        Pattern Type
                      </Label>
                      <Select
                        value={scanConfig.pattern}
                        onValueChange={(value) =>
                          setScanConfig({
                            ...scanConfig,
                            pattern: value as "circle" | "grid" | "line",
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent sideOffset={4}>
                          <SelectItem value="grid">
                            <div className="flex items-center gap-2">
                              <Grid3X3 className="h-4 w-4" />
                              Square Grid
                            </div>
                          </SelectItem>
                          <SelectItem value="circle">
                            <div className="flex items-center gap-2">
                              <Circle className="h-4 w-4" />
                              Circular Pattern
                            </div>
                          </SelectItem>
                          <SelectItem value="line">
                            <div className="flex items-center gap-2">
                              <Crosshair className="h-4 w-4" />
                              Linear Pattern
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        {scanConfig.pattern === "grid"
                          ? "Grid Size"
                          : scanConfig.pattern === "circle"
                            ? "Number of Rings"
                            : "Line Points"}
                      </Label>
                      <Select
                        value={
                          scanConfig.pattern === "circle"
                            ? scanConfig.rings.toString()
                            : scanConfig.count.toString()
                        }
                        onValueChange={(value) =>
                          setScanConfig({
                            ...scanConfig,
                            ...(scanConfig.pattern === "circle"
                              ? { rings: parseInt(value) }
                              : { count: parseInt(value) }),
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent sideOffset={4} className="max-h-60">
                          {scanConfig.pattern === "grid" && (
                            <>
                              <SelectItem value="9">
                                3×3 Grid (9 pins)
                              </SelectItem>
                              <SelectItem value="16">
                                4×4 Grid (16 pins)
                              </SelectItem>
                              <SelectItem value="25">
                                5×5 Grid (25 pins)
                              </SelectItem>
                              <SelectItem value="49">
                                6×6 Grid (49 pins)
                              </SelectItem>
                              <SelectItem value="64">
                                7×7 Grid (64 pins)
                              </SelectItem>
                              <SelectItem value="81">
                                8��8 Grid (81 pins)
                              </SelectItem>
                              <SelectItem value="100">
                                9×9 Grid (100 pins)
                              </SelectItem>
                              <SelectItem value="121">
                                10×10 Grid (121 pins)
                              </SelectItem>
                              <SelectItem value="144">
                                11×11 Grid (144 pins)
                              </SelectItem>
                              <SelectItem value="169">
                                12×12 Grid (169 pins)
                              </SelectItem>
                              <SelectItem value="225">
                                13×13 Grid (225 pins)
                              </SelectItem>
                              <SelectItem value="441">
                                14×14 Grid (441 pins)
                              </SelectItem>
                            </>
                          )}
                          {scanConfig.pattern === "circle" && (
                            <>
                              <SelectItem value="1">
                                1 Ring ({calculateWaypointCount(1)} pins)
                              </SelectItem>
                              <SelectItem value="2">
                                2 Rings ({calculateWaypointCount(2)} pins)
                              </SelectItem>
                              <SelectItem value="3">
                                3 Rings ({calculateWaypointCount(3)} pins)
                              </SelectItem>
                              <SelectItem value="4">
                                4 Rings ({calculateWaypointCount(4)} pins)
                              </SelectItem>
                              <SelectItem value="5">
                                5 Rings ({calculateWaypointCount(5)} pins)
                              </SelectItem>
                              <SelectItem value="6">
                                6 Rings ({calculateWaypointCount(6)} pins)
                              </SelectItem>
                              <SelectItem value="7">
                                7 Rings ({calculateWaypointCount(7)} pins)
                              </SelectItem>
                              <SelectItem value="8">
                                8 Rings ({calculateWaypointCount(8)} pins)
                              </SelectItem>
                              <SelectItem value="9">
                                9 Rings ({calculateWaypointCount(9)} pins)
                              </SelectItem>
                              <SelectItem value="10">
                                10 Rings ({calculateWaypointCount(10)} pins)
                              </SelectItem>
                              <SelectItem value="11">
                                11 Rings ({calculateWaypointCount(11)} pins)
                              </SelectItem>
                            </>
                          )}
                          {scanConfig.pattern === "line" && (
                            <>
                              <SelectItem value="5">5 Points Line</SelectItem>
                              <SelectItem value="10">10 Points Line</SelectItem>
                              <SelectItem value="15">15 Points Line</SelectItem>
                              <SelectItem value="20">20 Points Line</SelectItem>
                              <SelectItem value="25">25 Points Line</SelectItem>
                              <SelectItem value="30">30 Points Line</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">
                        Distance Between Pins
                      </Label>
                      <Select
                        value={scanConfig.distanceBetween.toString()}
                        onValueChange={(value) =>
                          setScanConfig({
                            ...scanConfig,
                            distanceBetween: parseFloat(value),
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent sideOffset={4}>
                          <SelectItem value="0.1">
                            0.1 {scanConfig.unit}
                          </SelectItem>
                          <SelectItem value="0.25">
                            0.25 {scanConfig.unit}
                          </SelectItem>
                          <SelectItem value="0.5">
                            0.5 {scanConfig.unit}
                          </SelectItem>
                          <SelectItem value="0.75">
                            0.75 {scanConfig.unit}
                          </SelectItem>
                          <SelectItem value="1">1 {scanConfig.unit}</SelectItem>
                          <SelectItem value="1.5">
                            1.5 {scanConfig.unit}
                          </SelectItem>
                          <SelectItem value="2">2 {scanConfig.unit}</SelectItem>
                          <SelectItem value="2.5">
                            2.5 {scanConfig.unit}
                          </SelectItem>
                          <SelectItem value="3">3 {scanConfig.unit}</SelectItem>
                          <SelectItem value="5">5 {scanConfig.unit}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Distance Unit
                      </Label>
                      <div className="flex rounded-md border overflow-hidden mt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setScanConfig({
                              ...scanConfig,
                              unit: "kilometers",
                            })
                          }
                          className={`flex-1 px-3 py-2 text-sm font-medium border-r transition-colors ${
                            scanConfig.unit === "kilometers"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Kilometers
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setScanConfig({ ...scanConfig, unit: "miles" })
                          }
                          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                            scanConfig.unit === "miles"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Miles
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Waypoint Preview */}
                {waypoints.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">
                        Waypoints ({enabledWaypointsCount} of {waypoints.length}{" "}
                        enabled)
                      </Label>
                    </div>

                    <div className="max-h-32 overflow-y-auto border rounded-lg p-3 space-y-1">
                      {waypoints.map((waypoint, index) => {
                        const waypointNumber = waypoint.isCenter
                          ? 1
                          : waypoints
                              .filter((w) => !w.isCenter)
                              .indexOf(waypoint) + 2;

                        return (
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
                              />
                              <span
                                className={waypoint.isCenter ? "font-bold" : ""}
                              >
                                {waypoint.isCenter
                                  ? `#${waypointNumber} Center`
                                  : `#${waypointNumber} Waypoint`}
                              </span>
                            </div>
                            <div className="text-gray-500 text-xs">
                              {waypoint.distance?.toFixed(1)} {scanConfig.unit}
                              {waypoint.bearing !== undefined &&
                                ` • ${waypoint.bearing.toFixed(0)}°`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Google Map */}
        <div className="mt-8" style={{ overflowAnchor: "auto" }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Search Locations Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="w-full"
                style={{
                  height: "700px",
                  minHeight: "700px",
                  overflowAnchor: "auto",
                }}
              >
                <GoogleMapComponent
                  center={ADMIN_BUSINESS.coordinates}
                  zoom={12}
                  height="100%"
                  showControls={true}
                  showDirectionsButton={false}
                  className="h-full border-0 rounded-lg"
                  waypointData={waypoints}
                  onWaypointToggle={handleWaypointToggle}
                  onWaypointDrag={handleWaypointDrag}
                  onWaypointsDragComplete={handleWaypointsDragComplete}
                  scanConfig={memoizedScanConfig}
                />
              </div>
              <div className="text-sm text-gray-600 mt-4">
                <p className="mb-2">
                  📍 Geo Grid centered on: {ADMIN_BUSINESS.name}
                </p>
                {waypoints.length > 0 && (
                  <p>
                    📌 {enabledWaypointsCount} search locations configured -
                    Center waypoint is always #1
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Scan Summary - Moved under map */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scan Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Business:</span>
                      <span className="text-sm font-medium">
                        {ADMIN_BUSINESS.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Scan Type:</span>
                      <span className="text-sm font-medium capitalize">
                        {scanType === "one-time" ? "One-time" : "Recurring"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
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
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Search Depth:
                      </span>
                      <span className="text-sm font-medium">
                        Top {scanConfig.depth}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Priority:</span>
                      <span className="text-sm font-medium capitalize">
                        {scanConfig.priority}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Grid Pattern:
                      </span>
                      <span className="text-sm font-medium capitalize">
                        {scanConfig.pattern}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Available Credits:
                      </span>
                      <span className="text-sm font-medium text-blue-600">
                        {formatCredits(balance.remaining)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">
                      Total Credits Required:
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCredits(scanCost)}
                    </span>
                  </div>
                  {keywords.length > 1 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {keywords.length} keywords ×{" "}
                      {formatCredits(scanCost / keywords.length)} credits each
                    </p>
                  )}
                </div>

                {/* Status Messages */}
                <div className="space-y-3">
                  {balance.remaining < scanCost && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            Insufficient Credits
                          </p>
                          <p className="text-xs text-red-700">
                            You need {formatCredits(scanCost)} credits but only
                            have {formatCredits(balance.remaining)} remaining.
                            <button
                              onClick={() =>
                                navigate("/admin/credits/purchase")
                              }
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
              </CardContent>
            </Card>
          </div>

          {/* Start Scan Button - Below summary */}
          <div className="mt-6">
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
                  Starting {keywords.length} Scan
                  {keywords.length !== 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  Start Geo Grid Scan
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
