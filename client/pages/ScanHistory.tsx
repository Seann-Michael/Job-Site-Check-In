import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  keyword: string; // Single keyword instead of array
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
  keyword: string; // Single keyword instead of array
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
    keyword: "pizza restaurant",
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
    id: "r1b",
    name: "Daily Italian Food Rankings",
    keyword: "italian food",
    schedule: "Every day at 9:00 AM",
    frequency: "daily",
    status: "active",
    nextRun: "2024-01-19T09:00:00Z",
    lastRun: "2024-01-18T09:00:00Z",
    totalRuns: 45,
    averageRank: 2.8,
    creditsPerRun: 12,
    created: "2023-12-01T10:00:00Z",
  },
  {
    id: "r1c",
    name: "Daily Pizza Delivery Rankings",
    keyword: "pizza delivery",
    schedule: "Every day at 9:00 AM",
    frequency: "daily",
    status: "active",
    nextRun: "2024-01-19T09:00:00Z",
    lastRun: "2024-01-18T09:00:00Z",
    totalRuns: 45,
    averageRank: 4.1,
    creditsPerRun: 12,
    created: "2023-12-01T10:00:00Z",
  },
  {
    id: "r2",
    name: "Weekly Auto Repair Check",
    keyword: "auto repair",
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
    keyword: "medical clinic",
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
    keyword: "pizza restaurant",
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
    id: "1b",
    scanName: "Weekend Italian Analysis",
    keyword: "italian food",
    scanType: "one-time",
    status: "completed",
    startTime: "2024-01-18T14:45:00Z",
    endTime: "2024-01-18T15:00:00Z",
    duration: "15m 30s",
    locationsScanned: 24,
    averageRank: 2.8,
    topRankings: 10,
    improvementChange: 0.8,
    creditsUsed: 1440,
  },
  {
    id: "1c",
    scanName: "Weekend Delivery Analysis",
    keyword: "pizza delivery",
    scanType: "one-time",
    status: "completed",
    startTime: "2024-01-18T15:00:00Z",
    endTime: "2024-01-18T15:15:00Z",
    duration: "15m 30s",
    locationsScanned: 24,
    averageRank: 4.5,
    topRankings: 5,
    improvementChange: -0.2,
    creditsUsed: 1440,
  },
  {
    id: "2",
    scanName: "Local Pizza Rankings",
    keyword: "pizza restaurant",
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
    id: "2b",
    scanName: "Local Italian Rankings",
    keyword: "italian food",
    scanType: "recurring",
    status: "completed",
    startTime: "2024-01-15T09:12:00Z",
    endTime: "2024-01-15T09:24:00Z",
    duration: "12m 15s",
    locationsScanned: 24,
    averageRank: 3.5,
    topRankings: 8,
    improvementChange: 0.4,
    creditsUsed: 960,
  },
  {
    id: "3",
    scanName: "Competitor Analysis",
    keyword: "pizza near me",
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
    keyword: "pizza restaurant",
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
    keyword: "pizza",
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
    keyword: "pizza restaurant",
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
    keyword: "italian food",
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
    keyword: "pizza delivery",
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

  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Recurring scans state
  const [recurringScans, setRecurringScans] =
    useState<RecurringScan[]>(mockRecurringScans);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const filteredHistory = history.filter((item) => {
    const matchesStatus =
      filterStatus === "all" || item.status === filterStatus;
    const matchesType = filterType === "all" || item.scanType === filterType;
    const matchesSearch =
      !searchQuery ||
      item.scanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keyword.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesType && matchesSearch;
  });

  // Bulk selection functions
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(filteredHistory.map(item => item.id));
      setSelectedItems(allIds);
      setSelectAll(true);
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
    setSelectAll(newSelected.size === filteredHistory.length);
  };

  const handleBulkDelete = () => {
    setHistory(prev => prev.filter(item => !selectedItems.has(item.id)));
    setSelectedItems(new Set());
    setSelectAll(false);
    toast.success(`${selectedItems.size} scans deleted`);
  };

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
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "running":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            Running
          </Badge>
        );
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
        state: { duplicateFrom: scan },
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
    setRecurringScans((scans) =>
      scans.map((scan) =>
        scan.id === scanId
          ? { ...scan, status: scan.status === "active" ? "paused" : "active" }
          : scan,
      ),
    );
    const scan = recurringScans.find((s) => s.id === scanId);
    if (scan) {
      toast.success(
        `${scan.status === "active" ? "Paused" : "Resumed"} "${scan.name}"`,
      );
    }
  };

  const deleteRecurringScan = (scanId: string) => {
    setRecurringScans((scans) => scans.filter((scan) => scan.id !== scanId));
    const scan = recurringScans.find((s) => s.id === scanId);
    if (scan) {
      toast.success(`Deleted recurring scan "${scan.name}"`);
    }
    setDeleteDialogOpen(false);
    setSelectedScanId(null);
  };

  const getStatusBadgeRecurring = (status: RecurringScan["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Active
          </Badge>
        );
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

        <Tabs defaultValue="history" className="space-y-6">
          <TabsList>
            <TabsTrigger value="history">Scan History</TabsTrigger>
            <TabsTrigger value="recurring">Recurring Scans</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-6">
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
                      <p className="text-sm font-medium text-gray-600">
                        Completed
                      </p>
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
                      <p className="text-sm font-medium text-gray-600">
                        Avg Rank
                      </p>
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
                    <Select
                      value={filterStatus}
                      onValueChange={setFilterStatus}
                    >
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
                      {searchQuery ||
                      filterStatus !== "all" ||
                      filterType !== "all"
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
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectAll}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Scan Details</TableHead>
                          <TableHead>Keyword</TableHead>
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
                            className="hover:bg-gray-50"
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedItems.has(item.id)}
                                onCheckedChange={() => handleSelectItem(item.id)}
                              />
                            </TableCell>
                            <TableCell
                              className="cursor-pointer"
                              onClick={() =>
                                item.status === "completed" &&
                                viewScanDetails(item.id)
                              }
                            >
                              <div className="font-medium text-gray-900">
                                {item.scanName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(item.startTime).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.keyword}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.scanType === "one-time"
                                    ? "default"
                                    : "secondary"
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
                                  <div className="text-gray-500">
                                    {item.duration}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-gray-400" />
                                <span className="text-sm">
                                  {item.locationsScanned}
                                </span>
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
                                {item.status === "completed"
                                  ? item.topRankings
                                  : "—"}
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
                              <div className="text-sm">
                                {item.creditsUsed.toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
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
          </TabsContent>

          <TabsContent value="recurring" className="space-y-6">
            {/* Recurring Scans Content */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Recurring Scans</h2>
              <Button
                className="gap-2"
                onClick={() => navigate("/admin/maps/geo-grid-scan")}
              >
                <Plus className="h-4 w-4" />
                Create New Scan
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  Recurring Scans ({recurringScans.length} active)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recurringScans.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No recurring scans found
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Set up automated recurring scans to monitor your rankings
                      continuously.
                    </p>
                    <Button
                      onClick={() => navigate("/admin/maps/geo-grid-scan")}
                    >
                      Create Your First Recurring Scan
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scan Details</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Performance</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recurringScans.map((scan) => (
                          <TableRow key={scan.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {scan.name}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {scan.keyword}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {scan.frequency.charAt(0).toUpperCase() +
                                    scan.frequency.slice(1)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {scan.schedule}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  Next: {formatDate(scan.nextRun)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadgeRecurring(scan.status)}
                              <div className="text-xs text-gray-500 mt-1">
                                {scan.totalRuns} total runs
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Avg Rank: {scan.averageRank.toFixed(1)}
                                </div>
                                {scan.lastRun && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Last: {formatDate(scan.lastRun)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{scan.creditsPerRun} per run</div>
                                <div className="text-xs text-gray-500">
                                  {scan.totalRuns * scan.creditsPerRun} total
                                  used
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => editRecurringScan(scan.id)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Scan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toggleRecurringScan(scan.id)}
                                  >
                                    {scan.status === "active" ? (
                                      <>
                                        <Pause className="h-4 w-4 mr-2" />
                                        Pause Scan
                                      </>
                                    ) : (
                                      <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Resume Scan
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedScanId(scan.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Scan
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
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Recurring Scan</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this recurring scan? This action
                cannot be undone and will stop all future automated scans.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSelectedScanId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  selectedScanId && deleteRecurringScan(selectedScanId)
                }
              >
                Delete Scan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
