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
import {
  BarChart3,
  Download,
  Search,
  RefreshCw,
  FileText,
  Target,
  Zap,
  TrendingUp,
  Map,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// Simple Types
interface ReportConfig {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface ReportData {
  [key: string]: any;
}

// Report Configurations
const reportConfigs: ReportConfig[] = [
  {
    id: "scan-performance",
    name: "Scan Performance Report",
    description: "Analyze scan results, success rates, and credit consumption",
    category: "Analytics",
  },
  {
    id: "credit-usage",
    name: "Credit Usage Report",
    description:
      "Track credit consumption patterns and optimization opportunities",
    category: "Financial",
  },
  {
    id: "business-rankings",
    name: "Business Rankings Report",
    description:
      "Analyze ranking performance across different businesses and keywords",
    category: "SEO",
  },
  {
    id: "location-analysis",
    name: "Location Performance Report",
    description:
      "Analyze ranking performance across different geographic locations",
    category: "Geographic",
  },
  {
    id: "system-performance",
    name: "System Performance Report",
    description:
      "Monitor system health, API response times, and operational metrics",
    category: "Operations",
  },
];

// Mock Data
const generateSampleData = (reportType: string): ReportData[] => {
  switch (reportType) {
    case "scan-performance":
      return [
        {
          scanId: "SCN_001",
          businessName: "Pizza Palace Downtown",
          scanType: "one-time",
          keywords: 5,
          waypoints: 10,
          creditsUsed: 145,
          successRate: "95.2%",
          avgRanking: 3.8,
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
          successRate: "88.7%",
          avgRanking: 5.2,
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
          successRate: "92.1%",
          avgRanking: 2.9,
          scanDate: "2024-01-18",
          priority: "priority",
          status: "completed",
        },
      ];
    case "credit-usage":
      return [
        {
          userId: "USR_001",
          userName: "John Smith",
          transactionDate: "2024-01-20",
          transactionType: "scan",
          creditsAmount: -145,
          description: "One-time scan: Pizza Palace (5 keywords, 10 waypoints)",
          remainingBalance: 4855,
        },
        {
          userId: "USR_002",
          userName: "Sarah Johnson",
          transactionDate: "2024-01-19",
          transactionType: "purchase",
          creditsAmount: 10000,
          description: "Credit package purchase - Professional Plan",
          remainingBalance: 15000,
        },
        {
          userId: "USR_001",
          userName: "John Smith",
          transactionDate: "2024-01-18",
          transactionType: "scan",
          creditsAmount: -280,
          description:
            "Recurring scan: Fresh Dental (8 keywords, 15 waypoints)",
          remainingBalance: 5000,
        },
      ];
    case "business-rankings":
      return [
        {
          businessName: "Pizza Palace Downtown",
          keyword: "pizza delivery",
          currentRank: 3,
          previousRank: 5,
          rankChange: "+2",
          averageRank: 4.2,
          lastUpdated: "2024-01-20",
          visibility: "78.5%",
        },
        {
          businessName: "Fresh Dental Care",
          keyword: "dentist near me",
          currentRank: 2,
          previousRank: 3,
          rankChange: "+1",
          averageRank: 2.8,
          lastUpdated: "2024-01-19",
          visibility: "89.2%",
        },
      ];
    case "location-analysis":
      return [
        {
          businessName: "Pizza Palace",
          location: "Downtown District",
          averageRank: 3.8,
          topKeywords: 3,
          visibilityScore: "78.5%",
          competitorDensity: 12,
          lastScan: "2024-01-20",
          improvement: "+2.3",
          marketPotential: "high",
        },
        {
          businessName: "Fresh Dental Care",
          location: "Medical District",
          averageRank: 2.1,
          topKeywords: 4,
          visibilityScore: "91.3%",
          competitorDensity: 6,
          lastScan: "2024-01-19",
          improvement: "+1.7",
          marketPotential: "high",
        },
      ];
    case "system-performance":
      return [
        {
          timestamp: "2024-01-20 14:30:00",
          endpoint: "/api/scan",
          responseTime: "245ms",
          statusCode: "200",
          requestCount: 156,
          errorRate: "2.1%",
          throughput: "12.8 req/sec",
          cpuUsage: "45.2%",
          memoryUsage: "67.8%",
          activeUsers: 23,
        },
        {
          timestamp: "2024-01-20 14:25:00",
          endpoint: "/api/rankings",
          responseTime: "123ms",
          statusCode: "200",
          requestCount: 89,
          errorRate: "0.5%",
          throughput: "15.2 req/sec",
          cpuUsage: "42.1%",
          memoryUsage: "65.3%",
          activeUsers: 23,
        },
      ];
    default:
      return [];
  }
};

const getIcon = (category: string) => {
  switch (category) {
    case "Analytics":
      return Target;
    case "Financial":
      return Zap;
    case "Local Visibility":
      return TrendingUp;
    case "Geographic":
      return Map;
    case "Operations":
      return Database;
    default:
      return BarChart3;
  }
};

export default function BasicReportGenerator() {
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const currentConfig = reportConfigs.find(
    (config) => config.id === selectedReport,
  );

  const runReport = async () => {
    if (!selectedReport) return;

    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const data = generateSampleData(selectedReport);
    setReportData(data);
    setLoading(false);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
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

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [reportData, searchTerm, sortField, sortDirection]);

  const formatCellValue = (value: any, key: string) => {
    if (value === null || value === undefined) return "-";

    // Handle status badges
    if (
      key === "status" ||
      key === "transactionType" ||
      key === "priority" ||
      key === "marketPotential"
    ) {
      const getVariant = (val: string) => {
        const positive = [
          "completed",
          "active",
          "success",
          "improving",
          "high",
          "purchase",
          "priority",
        ];
        const warning = ["pending", "running", "medium", "stable", "expedited"];

        if (positive.some((p) => val.toLowerCase().includes(p)))
          return "default";
        if (warning.some((w) => val.toLowerCase().includes(w)))
          return "secondary";
        return "destructive";
      };

      return <Badge variant={getVariant(String(value))}>{String(value)}</Badge>;
    }

    // Handle numbers with formatting
    if (typeof value === "number") {
      if (
        key.includes("Amount") ||
        key.includes("Balance") ||
        key.includes("credits")
      ) {
        return value.toLocaleString();
      }
      return value.toString();
    }

    return String(value);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const getTableHeaders = (data: ReportData[]) => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Report Generator
            </h1>
            <p className="text-muted-foreground">
              Generate comprehensive reports with customizable parameters and
              data analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!reportData.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Report Configuration */}
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
                  const Icon = getIcon(config.category);
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

            {/* Generate Report Button */}
            <div className="flex items-center justify-between pt-4 border-t">
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
                  {currentConfig.category} &#8226; {currentConfig.name}
                </div>
              )}
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
                    Showing {filteredAndSortedData.length} of{" "}
                    {reportData.length} records
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {getTableHeaders(reportData).map((header) => (
                        <TableHead
                          key={header}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort(header)}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="capitalize">
                              {header.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            {getSortIcon(header)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedData.map((row, index) => (
                      <TableRow key={index}>
                        {getTableHeaders(reportData).map((header) => (
                          <TableCell key={header}>
                            {formatCellValue(row[header], header)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
