import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Download,
  Filter,
  Search,
  Settings,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  FileText,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  Building2,
  Target,
  Star,
  Map,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  LineChart,
  PieChart,
} from "lucide-react";

// Enhanced Types
interface ReportField {
  id: string;
  label: string;
  type:
    | "text"
    | "number"
    | "date"
    | "status"
    | "currency"
    | "percentage"
    | "rating";
  sortable: boolean;
  filterable: boolean;
  required?: boolean;
}

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<any>;
  fields: ReportField[];
  filters: FilterConfig[];
  defaultSort?: { field: string; direction: "asc" | "desc" };
}

interface FilterConfig {
  id: string;
  label: string;
  type:
    | "select"
    | "multiSelect"
    | "dateRange"
    | "numberRange"
    | "text"
    | "boolean";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

interface ReportData {
  [key: string]: any;
}

interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

// Report Configurations
const reportConfigs: ReportConfig[] = [
  {
    id: "scan-performance",
    name: "Scan Performance Report",
    description: "Analyze scan results, success rates, and credit consumption",
    category: "Analytics",
    icon: Target,
    fields: [
      {
        id: "scanId",
        label: "Scan ID",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "businessName",
        label: "Business Name",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "scanType",
        label: "Scan Type",
        type: "status",
        sortable: true,
        filterable: true,
      },
      {
        id: "keywords",
        label: "Keywords",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "waypoints",
        label: "Waypoints",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "creditsUsed",
        label: "Credits Used",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "successRate",
        label: "Success Rate",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
      {
        id: "avgRanking",
        label: "Avg Ranking",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "executionTime",
        label: "Execution Time (min)",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "scanDate",
        label: "Scan Date",
        type: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "priority",
        label: "Priority",
        type: "status",
        sortable: true,
        filterable: true,
      },
      {
        id: "status",
        label: "Status",
        type: "status",
        sortable: true,
        filterable: true,
      },
    ],
    filters: [
      {
        id: "scanType",
        label: "Scan Type",
        type: "select",
        options: [
          { value: "one-time", label: "One-time Scan" },
          { value: "recurring", label: "Recurring Scan" },
          { value: "bulk", label: "Bulk Scan" },
        ],
      },
      {
        id: "priority",
        label: "Priority Level",
        type: "select",
        options: [
          { value: "standard", label: "Standard" },
          { value: "expedited", label: "Expedited" },
          { value: "priority", label: "Priority" },
        ],
      },
      {
        id: "dateRange",
        label: "Scan Date Range",
        type: "dateRange",
      },
      {
        id: "creditsRange",
        label: "Credits Used Range",
        type: "numberRange",
      },
      {
        id: "status",
        label: "Status",
        type: "multiSelect",
        options: [
          { value: "completed", label: "Completed" },
          { value: "running", label: "Running" },
          { value: "failed", label: "Failed" },
          { value: "queued", label: "Queued" },
        ],
      },
    ],
    defaultSort: { field: "scanDate", direction: "desc" },
  },
  {
    id: "credit-usage",
    name: "Credit Usage Report",
    description:
      "Track credit consumption patterns and optimization opportunities",
    category: "Financial",
    icon: Zap,
    fields: [
      {
        id: "userId",
        label: "User ID",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "userName",
        label: "User Name",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "transactionDate",
        label: "Date",
        type: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "transactionType",
        label: "Type",
        type: "status",
        sortable: true,
        filterable: true,
      },
      {
        id: "creditsAmount",
        label: "Credits",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "description",
        label: "Description",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "scanDetails",
        label: "Scan Details",
        type: "text",
        sortable: false,
        filterable: true,
      },
      {
        id: "remainingBalance",
        label: "Balance After",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "costEfficiency",
        label: "Cost Efficiency",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
    ],
    filters: [
      {
        id: "transactionType",
        label: "Transaction Type",
        type: "select",
        options: [
          { value: "scan", label: "Scan Usage" },
          { value: "purchase", label: "Credit Purchase" },
          { value: "bonus", label: "Bonus Credits" },
          { value: "refund", label: "Refund" },
        ],
      },
      {
        id: "dateRange",
        label: "Date Range",
        type: "dateRange",
      },
      {
        id: "creditsRange",
        label: "Credits Amount Range",
        type: "numberRange",
      },
      {
        id: "userName",
        label: "User Name",
        type: "text",
        placeholder: "Search by user name...",
      },
    ],
    defaultSort: { field: "transactionDate", direction: "desc" },
  },
  {
    id: "business-rankings",
    name: "Business Rankings Report",
    description:
      "Analyze ranking performance across different businesses and keywords",
    category: "Local Visibility",
    icon: TrendingUp,
    fields: [
      {
        id: "businessName",
        label: "Business Name",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "keyword",
        label: "Keyword",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "currentRank",
        label: "Current Rank",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "previousRank",
        label: "Previous Rank",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "rankChange",
        label: "Rank Change",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "averageRank",
        label: "Average Rank",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "bestRank",
        label: "Best Rank",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "worstRank",
        label: "Worst Rank",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "trackingDays",
        label: "Tracking Days",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "lastUpdated",
        label: "Last Updated",
        type: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "competitorCount",
        label: "Competitors",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "visibility",
        label: "Visibility Score",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
    ],
    filters: [
      {
        id: "businessName",
        label: "Business Name",
        type: "text",
        placeholder: "Search businesses...",
      },
      {
        id: "keyword",
        label: "Keyword",
        type: "text",
        placeholder: "Search keywords...",
      },
      {
        id: "rankRange",
        label: "Current Rank Range",
        type: "numberRange",
      },
      {
        id: "dateRange",
        label: "Date Range",
        type: "dateRange",
      },
      {
        id: "performanceType",
        label: "Performance Type",
        type: "select",
        options: [
          { value: "improving", label: "Improving" },
          { value: "declining", label: "Declining" },
          { value: "stable", label: "Stable" },
          { value: "new", label: "New Tracking" },
        ],
      },
    ],
    defaultSort: { field: "currentRank", direction: "asc" },
  },
  {
    id: "location-analysis",
    name: "Location Performance Report",
    description:
      "Analyze ranking performance across different geographic locations",
    category: "Geographic",
    icon: Map,
    fields: [
      {
        id: "businessName",
        label: "Business",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "location",
        label: "Location",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "coordinates",
        label: "Coordinates",
        type: "text",
        sortable: false,
        filterable: false,
      },
      {
        id: "averageRank",
        label: "Avg Rank",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "topKeywords",
        label: "Top Keywords",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "visibilityScore",
        label: "Visibility",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
      {
        id: "competitorDensity",
        label: "Competitor Density",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "scanFrequency",
        label: "Scan Frequency",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "lastScan",
        label: "Last Scan",
        type: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "improvement",
        label: "30-day Change",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "marketPotential",
        label: "Market Potential",
        type: "status",
        sortable: true,
        filterable: true,
      },
    ],
    filters: [
      {
        id: "location",
        label: "Location",
        type: "text",
        placeholder: "Search locations...",
      },
      {
        id: "visibilityRange",
        label: "Visibility Score Range",
        type: "numberRange",
      },
      {
        id: "marketPotential",
        label: "Market Potential",
        type: "select",
        options: [
          { value: "high", label: "High Potential" },
          { value: "medium", label: "Medium Potential" },
          { value: "low", label: "Low Potential" },
          { value: "saturated", label: "Saturated Market" },
        ],
      },
      {
        id: "dateRange",
        label: "Date Range",
        type: "dateRange",
      },
    ],
    defaultSort: { field: "visibilityScore", direction: "desc" },
  },
  {
    id: "system-performance",
    name: "System Performance Report",
    description:
      "Monitor system health, API response times, and operational metrics",
    category: "Operations",
    icon: Database,
    fields: [
      {
        id: "timestamp",
        label: "Timestamp",
        type: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "endpoint",
        label: "API Endpoint",
        type: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "responseTime",
        label: "Response Time (ms)",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "statusCode",
        label: "Status Code",
        type: "status",
        sortable: true,
        filterable: true,
      },
      {
        id: "requestCount",
        label: "Request Count",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "errorRate",
        label: "Error Rate",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
      {
        id: "throughput",
        label: "Throughput (req/sec)",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "cpuUsage",
        label: "CPU Usage",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
      {
        id: "memoryUsage",
        label: "Memory Usage",
        type: "percentage",
        sortable: true,
        filterable: true,
      },
      {
        id: "activeUsers",
        label: "Active Users",
        type: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "queueLength",
        label: "Queue Length",
        type: "number",
        sortable: true,
        filterable: true,
      },
    ],
    filters: [
      {
        id: "endpoint",
        label: "API Endpoint",
        type: "select",
        options: [
          { value: "/api/scan", label: "Scan API" },
          { value: "/api/rankings", label: "Rankings API" },
          { value: "/api/credits", label: "Credits API" },
          { value: "/api/auth", label: "Authentication API" },
        ],
      },
      {
        id: "statusCode",
        label: "Status Code",
        type: "select",
        options: [
          { value: "200", label: "200 - Success" },
          { value: "400", label: "400 - Bad Request" },
          { value: "401", label: "401 - Unauthorized" },
          { value: "500", label: "500 - Server Error" },
        ],
      },
      {
        id: "dateRange",
        label: "Date Range",
        type: "dateRange",
      },
      {
        id: "responseTimeRange",
        label: "Response Time Range (ms)",
        type: "numberRange",
      },
    ],
    defaultSort: { field: "timestamp", direction: "desc" },
  },
];

// Mock Data Generators
const generateScanPerformanceData = (): ReportData[] => [
  {
    scanId: "SCN_001",
    businessName: "Pizza Palace Downtown",
    scanType: "one-time",
    keywords: 5,
    waypoints: 10,
    creditsUsed: 145,
    successRate: 95.2,
    avgRanking: 3.8,
    executionTime: 8.5,
    scanDate: "2024-01-20",
    priority: "expedited",
    status: "completed",
  },
  {
    scanId: "SCN_002",
    businessName: "Fresh Dental Care",
    scanType: "recurring",
    keywords: 8,
    waypoints: 15,
    creditsUsed: 280,
    successRate: 88.7,
    avgRanking: 5.2,
    executionTime: 12.3,
    scanDate: "2024-01-19",
    priority: "standard",
    status: "completed",
  },
  {
    scanId: "SCN_003",
    businessName: "TechCorp Solutions",
    scanType: "one-time",
    keywords: 12,
    waypoints: 25,
    creditsUsed: 425,
    successRate: 92.1,
    avgRanking: 2.9,
    executionTime: 15.7,
    scanDate: "2024-01-18",
    priority: "priority",
    status: "completed",
  },
  {
    scanId: "SCN_004",
    businessName: "Local Fitness Gym",
    scanType: "bulk",
    keywords: 20,
    waypoints: 40,
    creditsUsed: 780,
    successRate: 97.5,
    avgRanking: 4.1,
    executionTime: 22.4,
    scanDate: "2024-01-17",
    priority: "standard",
    status: "running",
  },
];

const generateCreditUsageData = (): ReportData[] => [
  {
    userId: "USR_001",
    userName: "John Smith",
    transactionDate: "2024-01-20",
    transactionType: "scan",
    creditsAmount: -145,
    description: "One-time scan: Pizza Palace (5 keywords, 10 waypoints)",
    scanDetails: "Expedited priority, Circle pattern",
    remainingBalance: 4855,
    costEfficiency: 87.3,
  },
  {
    userId: "USR_002",
    userName: "Sarah Johnson",
    transactionDate: "2024-01-19",
    transactionType: "purchase",
    creditsAmount: 10000,
    description: "Credit package purchase - Professional Plan",
    scanDetails: "-",
    remainingBalance: 15000,
    costEfficiency: 95.2,
  },
  {
    userId: "USR_001",
    userName: "John Smith",
    transactionDate: "2024-01-18",
    transactionType: "scan",
    creditsAmount: -280,
    description: "Recurring scan: Fresh Dental (8 keywords, 15 waypoints)",
    scanDetails: "Standard priority, Grid pattern",
    remainingBalance: 5000,
    costEfficiency: 92.1,
  },
];

const generateBusinessRankingsData = (): ReportData[] => [
  {
    businessName: "Pizza Palace Downtown",
    keyword: "pizza delivery",
    currentRank: 3,
    previousRank: 5,
    rankChange: 2,
    averageRank: 4.2,
    bestRank: 1,
    worstRank: 8,
    trackingDays: 45,
    lastUpdated: "2024-01-20",
    competitorCount: 12,
    visibility: 78.5,
  },
  {
    businessName: "Pizza Palace Downtown",
    keyword: "italian restaurant",
    currentRank: 7,
    previousRank: 6,
    rankChange: -1,
    averageRank: 6.8,
    bestRank: 4,
    worstRank: 11,
    trackingDays: 45,
    lastUpdated: "2024-01-20",
    competitorCount: 18,
    visibility: 52.3,
  },
  {
    businessName: "Fresh Dental Care",
    keyword: "dentist near me",
    currentRank: 2,
    previousRank: 3,
    rankChange: 1,
    averageRank: 2.8,
    bestRank: 1,
    worstRank: 5,
    trackingDays: 60,
    lastUpdated: "2024-01-19",
    competitorCount: 8,
    visibility: 89.2,
  },
];

const generateLocationAnalysisData = (): ReportData[] => [
  {
    businessName: "Pizza Palace",
    location: "Downtown District",
    coordinates: "40.7128, -74.0060",
    averageRank: 3.8,
    topKeywords: 3,
    visibilityScore: 78.5,
    competitorDensity: 12,
    scanFrequency: "Daily",
    lastScan: "2024-01-20",
    improvement: 2.3,
    marketPotential: "high",
  },
  {
    businessName: "Pizza Palace",
    location: "Suburban Area",
    coordinates: "40.7589, -73.9851",
    averageRank: 5.2,
    topKeywords: 2,
    visibilityScore: 62.1,
    competitorDensity: 8,
    scanFrequency: "Weekly",
    lastScan: "2024-01-18",
    improvement: -0.8,
    marketPotential: "medium",
  },
];

const generateSystemPerformanceData = (): ReportData[] => [
  {
    timestamp: "2024-01-20 14:30:00",
    endpoint: "/api/scan",
    responseTime: 245,
    statusCode: "200",
    requestCount: 156,
    errorRate: 2.1,
    throughput: 12.8,
    cpuUsage: 45.2,
    memoryUsage: 67.8,
    activeUsers: 23,
    queueLength: 3,
  },
  {
    timestamp: "2024-01-20 14:25:00",
    endpoint: "/api/rankings",
    responseTime: 123,
    statusCode: "200",
    requestCount: 89,
    errorRate: 0.5,
    throughput: 15.2,
    cpuUsage: 42.1,
    memoryUsage: 65.3,
    activeUsers: 23,
    queueLength: 1,
  },
];

const dataGenerators: { [key: string]: () => ReportData[] } = {
  "scan-performance": generateScanPerformanceData,
  "credit-usage": generateCreditUsageData,
  "business-rankings": generateBusinessRankingsData,
  "location-analysis": generateLocationAnalysisData,
  "system-performance": generateSystemPerformanceData,
};

export default function ReportGenerator() {
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<{
    [key: string]: boolean;
  }>({});
  const [filters, setFilters] = useState<{ [key: string]: any }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const currentConfig = reportConfigs.find(
    (config) => config.id === selectedReport,
  );

  // Initialize column visibility when report changes
  React.useEffect(() => {
    if (currentConfig) {
      const visibility: { [key: string]: boolean } = {};
      currentConfig.fields.forEach((field) => {
        visibility[field.id] = true; // Show all columns by default
      });
      setColumnVisibility(visibility);

      // Set default sort
      if (currentConfig.defaultSort) {
        setSortConfig(currentConfig.defaultSort);
      }
    }
  }, [currentConfig]);

  const runReport = async () => {
    if (!selectedReport) return;

    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const generator = dataGenerators[selectedReport];
    if (generator) {
      setReportData(generator());
    }
    setCurrentPage(1);
    setLoading(false);
  };

  const handleSort = (fieldId: string) => {
    const field = currentConfig?.fields.find((f) => f.id === fieldId);
    if (!field?.sortable) return;

    setSortConfig((prev) => {
      if (prev?.field === fieldId) {
        return {
          field: fieldId,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field: fieldId, direction: "asc" };
    });
  };

  const sortedAndFilteredData = useMemo(() => {
    let filtered = [...reportData];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchLower),
        ),
      );
    }

    // Apply other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "") {
        if (key.includes("Range")) {
          // Handle range filters
          const [min, max] = value;
          const fieldName = key.replace("Range", "");
          if (min !== undefined) {
            filtered = filtered.filter((row) => row[fieldName] >= min);
          }
          if (max !== undefined) {
            filtered = filtered.filter((row) => row[fieldName] <= max);
          }
        } else if (Array.isArray(value)) {
          // Handle multi-select
          filtered = filtered.filter((row) => value.includes(row[key]));
        } else {
          // Handle single value filters
          filtered = filtered.filter((row) =>
            String(row[key])
              .toLowerCase()
              .includes(String(value).toLowerCase()),
          );
        }
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.field];
        const bVal = b[sortConfig.field];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [reportData, searchTerm, filters, sortConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFilteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / itemsPerPage);

  const formatCellValue = (value: any, type: string) => {
    if (value === null || value === undefined) return "-";

    switch (type) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      case "date":
        return new Date(value).toLocaleDateString();
      case "percentage":
        return `${Number(value).toFixed(1)}%`;
      case "rating":
        return `★ ${Number(value).toFixed(1)}`;
      case "status":
        const getStatusVariant = (status: string) => {
          const positive = [
            "completed",
            "active",
            "success",
            "improving",
            "high",
          ];
          const warning = ["pending", "running", "medium", "stable"];
          const negative = ["failed", "error", "declined", "low", "declining"];

          if (positive.some((p) => status.toLowerCase().includes(p)))
            return "default";
          if (warning.some((w) => status.toLowerCase().includes(w)))
            return "secondary";
          return "destructive";
        };

        return (
          <Badge variant={getStatusVariant(String(value))}>
            {String(value)}
          </Badge>
        );
      case "number":
        return typeof value === "number" ? value.toLocaleString() : value;
      default:
        return String(value);
    }
  };

  const getSortIcon = (fieldId: string) => {
    if (!sortConfig || sortConfig.field !== fieldId) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const visibleFields =
    currentConfig?.fields.filter((field) => columnVisibility[field.id]) || [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-full">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Report Generator
            </h1>
            <p className="text-muted-foreground">
              Generate comprehensive reports with customizable parameters and
              data visualization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!reportData.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!reportData.length}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </div>
        </div>

        {/* Report Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Report Configuration
            </CardTitle>
            <CardDescription>
              Select a report type and configure parameters to generate insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report Type Selection */}
            <div>
              <Label className="text-base font-medium">Report Type</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                {reportConfigs.map((config) => {
                  const Icon = config.icon;
                  return (
                    <Card
                      key={config.id}
                      className={`cursor-pointer transition-colors hover:border-primary/50 ${
                        selectedReport === config.id
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                      onClick={() => setSelectedReport(config.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              selectedReport === config.id
                                ? "bg-primary text-white"
                                : "bg-muted"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm">
                              {config.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {config.description}
                            </p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {config.category}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Filters */}
            {currentConfig && currentConfig.filters.length > 0 && (
              <div>
                <Label className="text-base font-medium">
                  Filters & Parameters
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                  {currentConfig.filters.map((filter) => (
                    <div key={filter.id} className="space-y-2">
                      <Label className="text-sm">{filter.label}</Label>
                      {filter.type === "select" && (
                        <Select
                          value={filters[filter.id] || ""}
                          onValueChange={(value) =>
                            setFilters((prev) => ({
                              ...prev,
                              [filter.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                filter.placeholder ||
                                `Select ${filter.label.toLowerCase()}`
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options?.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {filter.type === "text" && (
                        <Input
                          placeholder={
                            filter.placeholder ||
                            `Enter ${filter.label.toLowerCase()}`
                          }
                          value={filters[filter.id] || ""}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [filter.id]: e.target.value,
                            }))
                          }
                        />
                      )}
                      {filter.type === "dateRange" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            placeholder="Start date"
                            value={filters[`${filter.id}_start`] || ""}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                [`${filter.id}_start`]: e.target.value,
                              }))
                            }
                          />
                          <Input
                            type="date"
                            placeholder="End date"
                            value={filters[`${filter.id}_end`] || ""}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                [`${filter.id}_end`]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}
                      {filter.type === "numberRange" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={filters[`${filter.id}_min`] || ""}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                [`${filter.id}`]: [
                                  e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                  filters[`${filter.id}`]?.[1],
                                ],
                              }))
                            }
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filters[`${filter.id}_max`] || ""}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                [`${filter.id}`]: [
                                  filters[`${filter.id}`]?.[0],
                                  e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                ],
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Run Report Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4">
                <Button
                  onClick={runReport}
                  disabled={!selectedReport || loading}
                  size="lg"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
                {currentConfig && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">
                      {currentConfig.fields.length}
                    </span>{" "}
                    available fields
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Results */}
        {reportData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Report Results
                  </CardTitle>
                  <CardDescription>
                    Showing {paginatedData.length} of{" "}
                    {sortedAndFilteredData.length} records
                    {sortedAndFilteredData.length !== reportData.length &&
                      ` (filtered from ${reportData.length} total)`}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search records..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {currentConfig?.fields.map((field) => (
                        <DropdownMenuCheckboxItem
                          key={field.id}
                          checked={columnVisibility[field.id]}
                          onCheckedChange={() =>
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [field.id]: !prev[field.id],
                            }))
                          }
                        >
                          {field.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Data Table */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleFields.map((field) => (
                          <TableHead
                            key={field.id}
                            className={
                              field.sortable
                                ? "cursor-pointer hover:bg-muted/50"
                                : ""
                            }
                            onClick={() =>
                              field.sortable && handleSort(field.id)
                            }
                          >
                            <div className="flex items-center space-x-2">
                              <span>{field.label}</span>
                              {field.sortable && getSortIcon(field.id)}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((row, index) => (
                        <TableRow key={index}>
                          {visibleFields.map((field) => (
                            <TableCell key={field.id}>
                              {formatCellValue(row[field.id], field.type)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Items per page:</Label>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => prev - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!selectedReport && (
          <Card>
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Select a Report Type</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Choose from our comprehensive report types above to generate
                detailed insights about your business performance, scan results,
                and system metrics.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
