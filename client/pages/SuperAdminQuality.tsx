import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Bug,
  TestTube,
  Shield,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Download,
  Filter,
  Search,
  Bell,
  Activity,
  Zap,
  Gauge,
  FileText,
  Heart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface TestSuite {
  id: string;
  name: string;
  type: "unit" | "integration" | "e2e" | "performance" | "security";
  status: "running" | "passed" | "failed" | "skipped";
  tests: TestCase[];
  coverage: number;
  duration: number;
  lastRun: string;
  environment: string;
}

interface TestCase {
  id: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  errorMessage?: string;
  retries: number;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  level: "error" | "warning" | "info" | "debug";
  message: string;
  stack?: string;
  user?: string;
  url: string;
  userAgent: string;
  resolved: boolean;
  frequency: number;
}

interface HealthCheck {
  id: string;
  name: string;
  type: "http" | "database" | "redis" | "external_api" | "file_system";
  status: "healthy" | "warning" | "critical" | "unknown";
  responseTime: number;
  lastCheck: string;
  endpoint?: string;
  enabled: boolean;
  alertThreshold: number;
}

interface PerformanceAlert {
  id: string;
  title: string;
  type:
    | "response_time"
    | "error_rate"
    | "memory_usage"
    | "cpu_usage"
    | "disk_space";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  value: number;
  threshold: number;
  triggeredAt: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

interface ValidationRule {
  id: string;
  name: string;
  type: "input" | "api" | "database" | "business";
  pattern: string;
  errorMessage: string;
  enabled: boolean;
  violationCount: number;
  lastViolation?: string;
}

export default function SuperAdminQuality() {
  const [activeTab, setActiveTab] = useState("overview");
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [performanceAlerts, setPerformanceAlerts] = useState<
    PerformanceAlert[]
  >([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState({
    testCoverage: 87.5,
    errorRate: 0.12,
    uptime: 99.94,
    performanceScore: 92.3,
    securityScore: 96.1,
  });

  useEffect(() => {
    loadTestSuites();
    loadErrorLogs();
    loadHealthChecks();
    loadPerformanceAlerts();
    loadValidationRules();

    // Simulate real-time updates
    const interval = setInterval(() => {
      updateRealTimeData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadTestSuites = () => {
    const mockSuites: TestSuite[] = [
      {
        id: "suite-1",
        name: "API Integration Tests",
        type: "integration",
        status: "passed",
        tests: [
          {
            id: "test-1",
            name: "User Authentication",
            status: "passed",
            duration: 1234,
            retries: 0,
          },
          {
            id: "test-2",
            name: "Project Creation",
            status: "passed",
            duration: 2456,
            retries: 0,
          },
          {
            id: "test-3",
            name: "Message Broadcasting",
            status: "passed",
            duration: 1876,
            retries: 1,
          },
        ],
        coverage: 94.2,
        duration: 45678,
        lastRun: "2024-01-21T10:30:00Z",
        environment: "staging",
      },
      {
        id: "suite-2",
        name: "Unit Tests - Core Functions",
        type: "unit",
        status: "passed",
        tests: [
          {
            id: "test-4",
            name: "User Validation",
            status: "passed",
            duration: 123,
            retries: 0,
          },
          {
            id: "test-5",
            name: "Email Templates",
            status: "passed",
            duration: 456,
            retries: 0,
          },
          {
            id: "test-6",
            name: "Permission Checks",
            status: "failed",
            duration: 789,
            retries: 2,
            errorMessage: "Permission check failed for admin role",
          },
        ],
        coverage: 91.7,
        duration: 12345,
        lastRun: "2024-01-21T09:15:00Z",
        environment: "development",
      },
      {
        id: "suite-3",
        name: "End-to-End User Flows",
        type: "e2e",
        status: "running",
        tests: [
          {
            id: "test-7",
            name: "Complete Project Workflow",
            status: "passed",
            duration: 15678,
            retries: 0,
          },
          {
            id: "test-8",
            name: "User Registration Flow",
            status: "passed",
            duration: 8456,
            retries: 0,
          },
        ],
        coverage: 78.9,
        duration: 0,
        lastRun: "2024-01-21T11:00:00Z",
        environment: "production",
      },
    ];
    setTestSuites(mockSuites);
  };

  const loadErrorLogs = () => {
    const mockErrors: ErrorLog[] = [
      {
        id: "error-1",
        timestamp: "2024-01-21T10:45:00Z",
        level: "error",
        message: "Database connection timeout",
        stack:
          "Error: Connection timeout\n    at Database.connect (db.js:45)\n    at async handler (api.js:123)",
        user: "user123",
        url: "/api/projects",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        resolved: false,
        frequency: 3,
      },
      {
        id: "error-2",
        timestamp: "2024-01-21T09:30:00Z",
        level: "warning",
        message: "High memory usage detected",
        user: "system",
        url: "/admin/analytics",
        userAgent: "System Monitor",
        resolved: true,
        frequency: 1,
      },
      {
        id: "error-3",
        timestamp: "2024-01-21T08:15:00Z",
        level: "error",
        message: "Failed to send broadcast message",
        stack:
          "Error: Email service unavailable\n    at EmailService.send (email.js:78)",
        user: "admin456",
        url: "/admin/broadcast",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        resolved: false,
        frequency: 7,
      },
    ];
    setErrorLogs(mockErrors);
  };

  const loadHealthChecks = () => {
    const mockHealthChecks: HealthCheck[] = [
      {
        id: "health-1",
        name: "Main API Endpoint",
        type: "http",
        status: "healthy",
        responseTime: 234,
        lastCheck: "2024-01-21T11:05:00Z",
        endpoint: "https://api.example.com/health",
        enabled: true,
        alertThreshold: 1000,
      },
      {
        id: "health-2",
        name: "Primary Database",
        type: "database",
        status: "healthy",
        responseTime: 45,
        lastCheck: "2024-01-21T11:05:00Z",
        enabled: true,
        alertThreshold: 200,
      },
      {
        id: "health-3",
        name: "Redis Cache",
        type: "redis",
        status: "warning",
        responseTime: 156,
        lastCheck: "2024-01-21T11:04:00Z",
        enabled: true,
        alertThreshold: 100,
      },
      {
        id: "health-4",
        name: "Email Service API",
        type: "external_api",
        status: "critical",
        responseTime: 5000,
        lastCheck: "2024-01-21T11:03:00Z",
        endpoint: "https://api.emailservice.com/status",
        enabled: true,
        alertThreshold: 2000,
      },
    ];
    setHealthChecks(mockHealthChecks);
  };

  const loadPerformanceAlerts = () => {
    const mockAlerts: PerformanceAlert[] = [
      {
        id: "alert-1",
        title: "High Response Time Detected",
        type: "response_time",
        severity: "high",
        description:
          "API response time exceeded 2 seconds for /api/projects endpoint",
        value: 2340,
        threshold: 1000,
        triggeredAt: "2024-01-21T10:45:00Z",
        acknowledged: false,
      },
      {
        id: "alert-2",
        title: "Memory Usage Spike",
        type: "memory_usage",
        severity: "medium",
        description: "Server memory usage reached 85%",
        value: 85.4,
        threshold: 80,
        triggeredAt: "2024-01-21T09:30:00Z",
        acknowledged: true,
      },
      {
        id: "alert-3",
        title: "Error Rate Increase",
        type: "error_rate",
        severity: "critical",
        description: "Error rate increased to 2.3% over the last hour",
        value: 2.3,
        threshold: 1.0,
        triggeredAt: "2024-01-21T08:15:00Z",
        acknowledged: false,
        resolvedAt: "2024-01-21T08:45:00Z",
      },
    ];
    setPerformanceAlerts(mockAlerts);
  };

  const loadValidationRules = () => {
    const mockRules: ValidationRule[] = [
      {
        id: "rule-1",
        name: "Email Format Validation",
        type: "input",
        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        errorMessage: "Please enter a valid email address",
        enabled: true,
        violationCount: 12,
        lastViolation: "2024-01-21T09:45:00Z",
      },
      {
        id: "rule-2",
        name: "Password Strength Check",
        type: "input",
        pattern:
          "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
        errorMessage:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
        enabled: true,
        violationCount: 45,
        lastViolation: "2024-01-21T10:20:00Z",
      },
      {
        id: "rule-3",
        name: "API Rate Limiting",
        type: "api",
        pattern: "100 requests per minute per user",
        errorMessage:
          "Rate limit exceeded. Please wait before making more requests.",
        enabled: true,
        violationCount: 8,
        lastViolation: "2024-01-21T08:30:00Z",
      },
    ];
    setValidationRules(mockRules);
  };

  const updateRealTimeData = () => {
    // Update quality metrics with slight variations
    setQualityMetrics((prev) => ({
      testCoverage: Math.max(
        80,
        Math.min(95, prev.testCoverage + (Math.random() - 0.5) * 1),
      ),
      errorRate: Math.max(
        0,
        Math.min(2, prev.errorRate + (Math.random() - 0.5) * 0.05),
      ),
      uptime: Math.max(
        99,
        Math.min(100, prev.uptime + (Math.random() - 0.5) * 0.01),
      ),
      performanceScore: Math.max(
        85,
        Math.min(98, prev.performanceScore + (Math.random() - 0.5) * 2),
      ),
      securityScore: Math.max(
        90,
        Math.min(100, prev.securityScore + (Math.random() - 0.5) * 0.5),
      ),
    }));

    // Update health check response times
    setHealthChecks((prev) =>
      prev.map((check) => ({
        ...check,
        responseTime: Math.max(
          10,
          check.responseTime + (Math.random() - 0.5) * 50,
        ),
        lastCheck: new Date().toISOString(),
      })),
    );
  };

  const runTestSuite = (suiteId: string) => {
    setTestSuites((prev) =>
      prev.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              status: "running" as const,
              lastRun: new Date().toISOString(),
            }
          : suite,
      ),
    );

    // Simulate test completion
    setTimeout(() => {
      setTestSuites((prev) =>
        prev.map((suite) =>
          suite.id === suiteId
            ? {
                ...suite,
                status:
                  Math.random() > 0.8
                    ? ("failed" as const)
                    : ("passed" as const),
                duration: Math.floor(Math.random() * 60000) + 10000,
              }
            : suite,
        ),
      );
      toast.success("Test suite completed");
    }, 3000);

    toast.success("Test suite started");
  };

  const acknowledgeAlert = (alertId: string) => {
    setPerformanceAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert,
      ),
    );
    toast.success("Alert acknowledged");
  };

  const resolveError = (errorId: string) => {
    setErrorLogs((prev) =>
      prev.map((error) =>
        error.id === errorId ? { ...error, resolved: true } : error,
      ),
    );
    toast.success("Error marked as resolved");
  };

  const toggleValidationRule = (ruleId: string) => {
    setValidationRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule,
      ),
    );
    toast.success("Validation rule updated");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getErrorLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      case "info":
        return "text-blue-600";
      case "debug":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Quality Assurance
              </h1>
              <p className="text-muted-foreground">
                Testing, monitoring, error handling, and validation
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateRealTimeData()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Test Coverage
                </CardTitle>
                <TestTube className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qualityMetrics.testCoverage.toFixed(1)}%
                </div>
                <Progress
                  value={qualityMetrics.testCoverage}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Error Rate
                </CardTitle>
                <Bug className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qualityMetrics.errorRate.toFixed(2)}%
                </div>
                <Progress
                  value={qualityMetrics.errorRate * 50}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qualityMetrics.uptime.toFixed(2)}%
                </div>
                <Progress value={qualityMetrics.uptime} className="h-2 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Performance
                </CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qualityMetrics.performanceScore.toFixed(1)}
                </div>
                <Progress
                  value={qualityMetrics.performanceScore}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Security Score
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qualityMetrics.securityScore.toFixed(1)}
                </div>
                <Progress
                  value={qualityMetrics.securityScore}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="errors">Error Logs</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>System Health Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {healthChecks.slice(0, 4).map((check) => (
                        <div
                          key={check.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(check.status)}
                            <div>
                              <div className="font-medium">{check.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {check.responseTime}ms • {check.type}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium capitalize">
                              {check.status}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(check.lastCheck).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {performanceAlerts.slice(0, 4).map((alert) => (
                        <div key={alert.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{alert.title}</div>
                            <Badge
                              variant={
                                alert.severity === "critical"
                                  ? "destructive"
                                  : alert.severity === "high"
                                    ? "destructive"
                                    : alert.severity === "medium"
                                      ? "default"
                                      : "secondary"
                              }
                            >
                              {alert.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {alert.description}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              {new Date(alert.triggeredAt).toLocaleString()}
                            </div>
                            {!alert.acknowledged && !alert.resolvedAt && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => acknowledgeAlert(alert.id)}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Button
                      variant="outline"
                      onClick={() => runTestSuite("suite-1")}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      Run All Tests
                    </Button>
                    <Button variant="outline">
                      <Monitor className="h-4 w-4 mr-2" />
                      Health Check
                    </Button>
                    <Button variant="outline">
                      <Bug className="h-4 w-4 mr-2" />
                      Error Analysis
                    </Button>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="testing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Suites</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Suite Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Coverage</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Last Run</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testSuites.map((suite) => (
                          <TableRow key={suite.id}>
                            <TableCell className="font-medium">
                              {suite.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{suite.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(suite.status)}
                                <span className="capitalize">
                                  {suite.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${suite.coverage}%` }}
                                  />
                                </div>
                                <span className="text-sm">
                                  {suite.coverage.toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {suite.duration > 0
                                ? `${(suite.duration / 1000).toFixed(1)}s`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(suite.lastRun).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => runTestSuite(suite.id)}
                                  disabled={suite.status === "running"}
                                >
                                  {suite.status === "running" ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Health Checks</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Response Time</TableHead>
                          <TableHead>Threshold</TableHead>
                          <TableHead>Last Check</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {healthChecks.map((check) => (
                          <TableRow key={check.id}>
                            <TableCell className="font-medium">
                              {check.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{check.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(check.status)}
                                <span className="capitalize">
                                  {check.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`${
                                  check.responseTime > check.alertThreshold
                                    ? "text-red-600"
                                    : check.responseTime >
                                        check.alertThreshold * 0.8
                                      ? "text-yellow-600"
                                      : "text-green-600"
                                }`}
                              >
                                {check.responseTime}ms
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {check.alertThreshold}ms
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(check.lastCheck).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Error Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errorLogs.map((error) => (
                          <TableRow key={error.id}>
                            <TableCell className="text-sm">
                              {new Date(error.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  error.level === "error"
                                    ? "destructive"
                                    : error.level === "warning"
                                      ? "default"
                                      : "secondary"
                                }
                              >
                                {error.level}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="truncate font-medium">
                                {error.message}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {error.url}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {error.user || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{error.frequency}</Badge>
                            </TableCell>
                            <TableCell>
                              {error.resolved ? (
                                <Badge variant="default">Resolved</Badge>
                              ) : (
                                <Badge variant="outline">Open</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {!error.resolved && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => resolveError(error.id)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Rules</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Pattern</TableHead>
                          <TableHead>Violations</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Violation</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">
                              {rule.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="text-sm font-mono truncate">
                                {rule.pattern}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  rule.violationCount > 20
                                    ? "destructive"
                                    : "default"
                                }
                              >
                                {rule.violationCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={() =>
                                    toggleValidationRule(rule.id)
                                  }
                                />
                                <span className="text-sm">
                                  {rule.enabled ? "Active" : "Disabled"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {rule.lastViolation
                                ? new Date(
                                    rule.lastViolation,
                                  ).toLocaleDateString()
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
