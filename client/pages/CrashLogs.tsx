import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import {
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  Filter,
  Clock,
  User,
  Bug,
  Zap,
  Activity,
  FileText,
  Copy,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  XCircle,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ErrorLog {
  id: string;
  timestamp: string;
  severity: "critical" | "error" | "warning" | "info";
  component: string;
  message: string;
  stack?: string;
  userId?: string;
  userAgent: string;
  url: string;
  count: number;
  resolved: boolean;
}

const mockErrorLogs: ErrorLog[] = [
  {
    id: "err_001",
    timestamp: "2024-01-15T10:30:22Z",
    severity: "critical",
    component: "Settings Module",
    message: "Cannot read property 'reviewSmsTemplate' of undefined",
    stack:
      "TypeError: Cannot read property 'reviewSmsTemplate' of undefined\n    at SettingsComponent.tsx:234:12\n    at updateState\n    at Object.useState",
    userId: "user_123",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    url: "/admin/settings",
    count: 23,
    resolved: false,
  },
  {
    id: "err_002",
    timestamp: "2024-01-15T10:25:15Z",
    severity: "error",
    component: "Project Detail",
    message: "Warning: Each child in a list should have a unique key prop",
    stack: "React warning in ProjectDetail.tsx:187",
    userId: "user_456",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    url: "/admin/projects/proj_abc123",
    count: 45,
    resolved: true,
  },
  {
    id: "err_003",
    timestamp: "2024-01-15T10:20:08Z",
    severity: "critical",
    component: "API Client",
    message: "Network Error: Failed to fetch user data",
    stack:
      "AxiosError: Network Error\n    at settle\n    at XMLHttpRequest.handleLoad",
    userId: "user_789",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
    url: "/admin/dashboard",
    count: 12,
    resolved: false,
  },
  {
    id: "err_004",
    timestamp: "2024-01-15T10:15:33Z",
    severity: "warning",
    component: "Gallery Component",
    message: "Image failed to load: timeout exceeded",
    userId: "user_321",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    url: "/admin/gallery",
    count: 8,
    resolved: false,
  },
  {
    id: "err_005",
    timestamp: "2024-01-15T10:10:45Z",
    severity: "info",
    component: "Authentication",
    message: "Session expired - user redirected to login",
    userId: "user_654",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    url: "/admin/projects",
    count: 156,
    resolved: false,
  },
];

function CrashLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>(mockErrorLogs);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Bug className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "error":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredLogs = errorLogs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.component.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      severityFilter === "all" || log.severity === severityFilter;
    const matchesComponent =
      componentFilter === "all" || log.component === componentFilter;
    const matchesResolved =
      resolvedFilter === "all" ||
      (resolvedFilter === "resolved" && log.resolved) ||
      (resolvedFilter === "unresolved" && !log.resolved);

    return (
      matchesSearch && matchesSeverity && matchesComponent && matchesResolved
    );
  });

  const uniqueComponents = Array.from(
    new Set(errorLogs.map((log) => log.component)),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
    toast.success("Error logs refreshed");
  };

  const handleExport = () => {
    const csvContent = [
      [
        "Timestamp",
        "Severity",
        "Component",
        "Message",
        "User ID",
        "URL",
        "Count",
        "Resolved",
      ],
      ...filteredLogs.map((log) => [
        log.timestamp,
        log.severity,
        log.component,
        log.message,
        log.userId || "",
        log.url,
        log.count.toString(),
        log.resolved ? "Yes" : "No",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crash-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Error logs exported successfully");
  };

  const handleCopyError = (log: ErrorLog) => {
    const errorDetails = `
Error ID: ${log.id}
Timestamp: ${new Date(log.timestamp).toLocaleString()}
Severity: ${log.severity.toUpperCase()}
Component: ${log.component}
Message: ${log.message}
URL: ${log.url}
User Agent: ${log.userAgent}
${log.stack ? `Stack Trace:\n${log.stack}` : ""}
    `.trim();

    navigator.clipboard.writeText(errorDetails);
    toast.success("Error details copied to clipboard");
  };

  const toggleErrorResolution = (errorId: string) => {
    setErrorLogs((prev) =>
      prev.map((log) =>
        log.id === errorId ? { ...log, resolved: !log.resolved } : log,
      ),
    );
    toast.success("Error status updated");
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Crash Logs & Error Monitoring
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time monitoring and analysis of application errors and
              crashes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {
                      errorLogs.filter(
                        (log) => log.severity === "critical" && !log.resolved,
                      ).length
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Critical Errors
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {
                      errorLogs.filter(
                        (log) => log.severity === "error" && !log.resolved,
                      ).length
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Active Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {errorLogs.filter((log) => log.resolved).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {new Set(errorLogs.map((log) => log.userId)).size}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Affected Users
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search errors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={componentFilter}
                onValueChange={setComponentFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Components" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
                  {uniqueComponents.map((component) => (
                    <SelectItem key={component} value={component}>
                      {component}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSeverityFilter("all");
                  setComponentFilter("all");
                  setResolvedFilter("all");
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Error Logs ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4" />
                  <p>No error logs found matching your criteria.</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <Card
                    key={log.id}
                    className={`border-l-4 ${
                      log.severity === "critical"
                        ? "border-l-red-500"
                        : log.severity === "error"
                          ? "border-l-orange-500"
                          : log.severity === "warning"
                            ? "border-l-yellow-500"
                            : "border-l-blue-500"
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getSeverityIcon(log.severity)}
                            <Badge
                              className={getSeverityBadgeColor(log.severity)}
                            >
                              {log.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{log.component}</Badge>
                            {log.resolved && (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Resolved
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              Occurred {log.count} times
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">
                            {log.message}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.userId || "Anonymous"}
                            </span>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />
                              {log.url}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyError(log)}
                            className="gap-2"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleErrorResolution(log.id)}
                            className={`gap-2 ${log.resolved ? "text-green-600" : "text-orange-600"}`}
                          >
                            {log.resolved ? "Mark Unresolved" : "Mark Resolved"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedError(
                                expandedError === log.id ? null : log.id,
                              )
                            }
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                expandedError === log.id ? "rotate-180" : ""
                              }`}
                            />
                          </Button>
                        </div>
                      </div>
                      {expandedError === log.id && log.stack && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">Stack Trace:</h4>
                          <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto border">
                            {log.stack}
                          </pre>
                          <div className="mt-3 space-y-1 text-sm">
                            <p>
                              <strong>User Agent:</strong> {log.userAgent}
                            </p>
                            <p>
                              <strong>Error ID:</strong> {log.id}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default CrashLogs;
