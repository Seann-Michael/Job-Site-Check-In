import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppLayout } from "@/components/AppLayout";
import {
  History,
  Download,
  Eye,
  Filter,
  Search,
  Calendar,
  MapPin,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Pause,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ScanHistoryItem {
  id: string;
  scanName: string;
  business: string;
  keywords: string[];
  scanType: "one-time" | "recurring";
  status: "completed" | "running" | "failed";
  startTime: string;
  endTime?: string;
  duration?: string;
  locationsScanned: number;
  averageRank: number;
  topRankings: number;
  improvementChange: number;
  creditsUsed: number;
}

interface RecurringScan {
  id: string;
  name: string;
  business: string;
  keywords: string[];
  schedule: string;
  frequency: "daily" | "weekly" | "monthly";
  status: "active" | "paused" | "stopped";
  nextRun: string;
  lastRun?: string;
  totalRuns: number;
  averageRank: number;
  creditsPerRun: number;
  created: string;
}

const mockRecurringScans: RecurringScan[] = [
  {
    id: "r1",
    name: "Daily Pizza Rankings",
    business: "Joe's Pizza & More",
    keywords: ["pizza restaurant", "italian food", "pizza delivery"],
    schedule: "Every day at 9:00 AM",
    frequency: "daily",
    status: "active",
    nextRun: "2024-01-19T09:00:00Z",
    lastRun: "2024-01-18T09:00:00Z",
    totalRuns: 45,
    averageRank: 3.1,
    creditsPerRun: 12,
    created: "2023-12-01T10:00:00Z",
  },
  {
    id: "r2",
    name: "Weekly Auto Repair Check",
    business: "Mike's Auto Repair",
    keywords: ["auto repair", "car service", "brake repair"],
    schedule: "Every Monday at 8:00 AM",
    frequency: "weekly",
    status: "active",
    nextRun: "2024-01-22T08:00:00Z",
    lastRun: "2024-01-15T08:00:00Z",
    totalRuns: 12,
    averageRank: 2.8,
    creditsPerRun: 8,
    created: "2023-11-15T12:00:00Z",
  },
  {
    id: "r3",
    name: "Monthly Clinic Analysis",
    business: "Sunshine Medical Clinic",
    keywords: ["medical clinic", "family doctor", "health clinic"],
    schedule: "First Monday of each month at 7:00 AM",
    frequency: "monthly",
    status: "paused",
    nextRun: "2024-02-05T07:00:00Z",
    lastRun: "2024-01-01T07:00:00Z",
    totalRuns: 3,
    averageRank: 4.2,
    creditsPerRun: 15,
    created: "2023-10-01T15:00:00Z",
  },
];

const mockHistory: ScanHistoryItem[] = [
  {
    id: "1",
    scanName: "Weekend Pizza Analysis",
    business: "Joe's Pizza & More",
    keywords: ["pizza restaurant", "italian food", "pizza delivery"],
    scanType: "one-time",
    status: "completed",
    startTime: "2024-01-18T14:30:00Z",
    endTime: "2024-01-18T14:45:00Z",
    duration: "15m 30s",
    locationsScanned: 24,
    averageRank: 3.2,
    topRankings: 8,
    improvementChange: 1.2,
    creditsUsed: 1440,
  },
  {
    id: "2",
    scanName: "Joe's Pizza Local Rankings",
    business: "Joe's Pizza & More",
    keywords: ["pizza restaurant", "italian food"],
    scanType: "recurring",
    status: "completed",
    startTime: "2024-01-15T09:00:00Z",
    endTime: "2024-01-15T09:12:00Z",
    duration: "12m 15s",
    locationsScanned: 24,
    averageRank: 4.1,
    topRankings: 6,
    improvementChange: -0.3,
    creditsUsed: 960,
  },
  {
    id: "3",
    scanName: "Competitor Analysis",
    business: "Joe's Pizza & More",
    keywords: ["pizza near me", "best pizza", "pizza delivery"],
    scanType: "one-time",
    status: "completed",
    startTime: "2024-01-12T16:20:00Z",
    endTime: "2024-01-12T16:38:00Z",
    duration: "18m 45s",
    locationsScanned: 32,
    averageRank: 5.8,
    topRankings: 4,
    improvementChange: 0.0,
    creditsUsed: 1920,
  },
  {
    id: "4",
    scanName: "Daily Monitoring",
    business: "Joe's Pizza & More",
    keywords: ["pizza restaurant"],
    scanType: "recurring",
    status: "failed",
    startTime: "2024-01-10T08:00:00Z",
    duration: "2m 15s",
    locationsScanned: 0,
    averageRank: 0,
    topRankings: 0,
    improvementChange: 0,
    creditsUsed: 0,
  },
  {
    id: "5",
    scanName: "Monthly Performance Review",
    business: "Joe's Pizza & More",
    keywords: ["pizza", "italian restaurant", "takeout", "delivery"],
    scanType: "recurring",
    status: "completed",
    startTime: "2024-01-01T10:00:00Z",
    endTime: "2024-01-01T10:25:00Z",
    duration: "25m 12s",
    locationsScanned: 48,
    averageRank: 2.9,
    topRankings: 15,
    improvementChange: 2.1,
    creditsUsed: 3840,
  },
  {
    id: "6",
    scanName: "Geo Grid Scan - Pizza Restaurant",
    business: "Joe's Pizza & More",
    keywords: ["pizza restaurant"],
    scanType: "one-time",
    status: "completed",
    startTime: "2024-01-17T11:15:00Z",
    endTime: "2024-01-17T11:28:00Z",
    duration: "13m 45s",
    locationsScanned: 25,
    averageRank: 2.8,
    topRankings: 12,
    improvementChange: 1.5,
    creditsUsed: 1200,
  },
  {
    id: "7",
    scanName: "Geo Grid Scan - Italian Food",
    business: "Joe's Pizza & More",
    keywords: ["italian food"],
    scanType: "one-time",
    status: "completed",
    startTime: "2024-01-17T11:15:00Z",
    endTime: "2024-01-17T11:28:00Z",
    duration: "13m 45s",
    locationsScanned: 25,
    averageRank: 4.2,
    topRankings: 7,
    improvementChange: 0.8,
    creditsUsed: 1200,
  },
  {
    id: "8",
    scanName: "Weekly Rankings Check",
    business: "Joe's Pizza & More",
    keywords: ["pizza delivery", "pizza near me"],
    scanType: "recurring",
    status: "running",
    startTime: "2024-01-18T16:00:00Z",
    locationsScanned: 0,
    averageRank: 0,
    topRankings: 0,
    improvementChange: 0,
    creditsUsed: 0,
  },
];

export default function ScanHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ScanHistoryItem[]>(mockHistory);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Recurring scans state
  const [recurringScans, setRecurringScans] = useState<RecurringScan[]>(mockRecurringScans);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const filteredHistory = history.filter((item) => {
    const matchesStatus =
      filterStatus === "all" || item.status === filterStatus;
    const matchesType = filterType === "all" || item.scanType === filterType;
    const matchesSearch =
      !searchQuery ||
      item.scanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.business.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.some((k) =>
        k.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    return matchesStatus && matchesType && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case "running":
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <div className="w-4 h-1 bg-gray-400 rounded"></div>;
  };

  const viewScanDetails = (scanId: string) => {
    navigate(`/admin/audits/report/${scanId}`);
  };

  const exportScanData = (scanId: string) => {
    const scan = history.find((s) => s.id === scanId);
    if (scan) {
      toast.success(`Exporting data for "${scan.scanName}"`);
    }
  };

  const duplicateScan = (scanId: string) => {
    const scan = history.find((s) => s.id === scanId);
    if (scan) {
      toast.success(`Duplicating scan "${scan.scanName}"`);
      // Navigate to scan configuration with pre-filled data
      navigate("/admin/maps/geo-grid-scan", {
        state: { duplicateFrom: scan }
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatChange = (change: number) => {
    if (change === 0) return "—";
    return `${change > 0 ? "+" : ""}${change.toFixed(1)}`;
  };

  // Recurring scan handlers
  const editRecurringScan = (scanId: string) => {
    const scan = recurringScans.find((s) => s.id === scanId);
    if (scan) {
      toast.success(`Editing recurring scan "${scan.name}"`);
      // Navigate to edit form or open modal
    }
  };

  const toggleRecurringScan = (scanId: string) => {
    setRecurringScans(scans =>
      scans.map(scan =>
        scan.id === scanId
          ? { ...scan, status: scan.status === 'active' ? 'paused' : 'active' }
          : scan
      )
    );
    const scan = recurringScans.find(s => s.id === scanId);
    if (scan) {
      toast.success(`${scan.status === 'active' ? 'Paused' : 'Resumed'} "${scan.name}"`);
    }
  };

  const deleteRecurringScan = (scanId: string) => {
    setRecurringScans(scans => scans.filter(scan => scan.id !== scanId));
    const scan = recurringScans.find(s => s.id === scanId);
    if (scan) {
      toast.success(`Deleted recurring scan "${scan.name}"`);
    }
    setDeleteDialogOpen(false);
    setSelectedScanId(null);
  };

  const getStatusBadgeRecurring = (status: RecurringScan['status']) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      case "stopped":
        return <Badge variant="destructive">Stopped</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Calculate summary stats
  const totalScans = history.length;
  const completedScans = history.filter((h) => h.status === "completed").length;
  const totalCreditsUsed = history.reduce((sum, h) => sum + h.creditsUsed, 0);
  const averageRankAcrossAll =
    completedScans > 0
      ? history
          .filter((h) => h.status === "completed")
          .reduce((sum, h) => sum + h.averageRank, 0) / completedScans
      : 0;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <History className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Scan History</h1>
          </div>
          <p className="text-gray-600">
            View and analyze all your completed ranking scans and their results.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Scans
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {totalScans}
                  </p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {completedScans}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Rank</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {averageRankAcrossAll.toFixed(1)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Credits Used
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {totalCreditsUsed.toLocaleString()}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search Scans</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by name or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="one-time">One Time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date Range</Label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Scan History ({filteredHistory.length} results)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No scan history found
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || filterStatus !== "all" || filterType !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "Start running scans to see your history here."}
                </p>
                {!searchQuery &&
                  filterStatus === "all" &&
                  filterType === "all" && (
                    <Button
                      onClick={() => navigate("/admin/maps/geo-grid-scan")}
                    >
                      Run Your First Scan
                    </Button>
                  )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scan Details</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Locations</TableHead>
                      <TableHead>Avg Rank</TableHead>
                      <TableHead>Top 3</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => item.status === "completed" && viewScanDetails(item.id)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">
                              {item.scanName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.business}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.keywords.slice(0, 2).map((keyword) => (
                                <Badge
                                  key={keyword}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {keyword}
                                </Badge>
                              ))}
                              {item.keywords.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{item.keywords.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.scanType === "one-time" ? "default" : "secondary"
                            }
                          >
                            {item.scanType === "one-time"
                              ? "One Time"
                              : "Recurring"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            {getStatusBadge(item.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{formatDate(item.startTime)}</div>
                            {item.duration && (
                              <div className="text-gray-500">{item.duration}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{item.locationsScanned}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.status === "completed" ? (
                            <Badge
                              variant={
                                item.averageRank <= 3
                                  ? "default"
                                  : item.averageRank <= 10
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              #{item.averageRank.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.status === "completed" ? item.topRankings : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getChangeIcon(item.improvementChange)}
                            <span
                              className={`text-sm ${
                                item.improvementChange > 0
                                  ? "text-green-600"
                                  : item.improvementChange < 0
                                    ? "text-red-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {formatChange(item.improvementChange)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.creditsUsed.toLocaleString()}</div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewScanDetails(item.id);
                                }}
                                disabled={item.status !== "completed"}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportScanData(item.id);
                                }}
                                disabled={item.status !== "completed"}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export Data
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateScan(item.id);
                                }}
                              >
                                <Target className="h-4 w-4 mr-2" />
                                Duplicate Scan
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
