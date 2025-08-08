import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Zap,
  Database,
  Server,
  Monitor,
  TrendingUp,
  Clock,
  Users,
  Cpu,
  HardDrive,
  Network,
  BarChart3,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Gauge,
  CloudCog,
  Scale,
  Filter,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface CacheMetrics {
  id: string;
  name: string;
  type: "redis" | "memory" | "database" | "cdn";
  hitRate: number;
  size: string;
  requests: number;
  lastCleared: string;
  enabled: boolean;
}

interface DatabaseConnection {
  id: string;
  name: string;
  type: "postgresql" | "mongodb" | "redis" | "elasticsearch";
  status: "healthy" | "warning" | "error";
  connections: number;
  maxConnections: number;
  responseTime: number;
  lastOptimized: string;
}

interface PerformanceMetric {
  id: string;
  name: string;
  category: "response_time" | "throughput" | "memory" | "cpu" | "database";
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
  threshold: {
    warning: number;
    critical: number;
  };
  lastUpdated: string;
}

interface ScalingRule {
  id: string;
  name: string;
  trigger: {
    metric: string;
    operator: ">" | "<" | "=";
    value: number;
    duration: number;
  };
  action: {
    type: "scale_up" | "scale_down" | "restart" | "notify";
    parameters: Record<string, any>;
  };
  enabled: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

interface OptimizationJob {
  id: string;
  name: string;
  type: "cache_warmup" | "database_cleanup" | "index_rebuild" | "log_rotation";
  status: "running" | "completed" | "failed" | "scheduled";
  progress: number;
  startTime: string;
  endTime?: string;
  logs: string[];
}

export default function SuperAdminPerformance() {
  const [activeTab, setActiveTab] = useState("overview");
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics[]>([]);
  const [dbConnections, setDbConnections] = useState<DatabaseConnection[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<
    PerformanceMetric[]
  >([]);
  const [scalingRules, setScalingRules] = useState<ScalingRule[]>([]);
  const [optimizationJobs, setOptimizationJobs] = useState<OptimizationJob[]>(
    [],
  );
  const [systemHealth, setSystemHealth] = useState({
    overall: 94,
    api: 98,
    database: 89,
    cache: 96,
    storage: 92,
  });

  useEffect(() => {
    loadCacheMetrics();
    loadDatabaseConnections();
    loadPerformanceMetrics();
    loadScalingRules();
    loadOptimizationJobs();

    // Simulate real-time updates
    const interval = setInterval(() => {
      updateRealTimeMetrics();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadCacheMetrics = () => {
    const mockCache: CacheMetrics[] = [
      {
        id: "cache-1",
        name: "Redis Main Cache",
        type: "redis",
        hitRate: 94.2,
        size: "2.4GB",
        requests: 1247893,
        lastCleared: "2024-01-15T10:30:00Z",
        enabled: true,
      },
      {
        id: "cache-2",
        name: "Application Memory Cache",
        type: "memory",
        hitRate: 87.5,
        size: "512MB",
        requests: 456721,
        lastCleared: "2024-01-20T08:00:00Z",
        enabled: true,
      },
      {
        id: "cache-3",
        name: "Database Query Cache",
        type: "database",
        hitRate: 78.9,
        size: "1.1GB",
        requests: 234567,
        lastCleared: "2024-01-18T14:20:00Z",
        enabled: true,
      },
      {
        id: "cache-4",
        name: "CDN Edge Cache",
        type: "cdn",
        hitRate: 96.7,
        size: "15.2GB",
        requests: 3456789,
        lastCleared: "2024-01-10T12:00:00Z",
        enabled: true,
      },
    ];
    setCacheMetrics(mockCache || []);
  };

  const loadDatabaseConnections = () => {
    const mockDbs: DatabaseConnection[] = [
      {
        id: "db-1",
        name: "Primary PostgreSQL",
        type: "postgresql",
        status: "healthy",
        connections: 45,
        maxConnections: 200,
        responseTime: 23,
        lastOptimized: "2024-01-19T09:30:00Z",
      },
      {
        id: "db-2",
        name: "Analytics MongoDB",
        type: "mongodb",
        status: "healthy",
        connections: 12,
        maxConnections: 100,
        responseTime: 15,
        lastOptimized: "2024-01-18T16:45:00Z",
      },
      {
        id: "db-3",
        name: "Session Redis",
        type: "redis",
        status: "warning",
        connections: 89,
        maxConnections: 100,
        responseTime: 5,
        lastOptimized: "2024-01-17T11:20:00Z",
      },
      {
        id: "db-4",
        name: "Search Elasticsearch",
        type: "elasticsearch",
        status: "healthy",
        connections: 8,
        maxConnections: 50,
        responseTime: 45,
        lastOptimized: "2024-01-20T07:15:00Z",
      },
    ];
    setDbConnections(mockDbs || []);
  };

  const loadPerformanceMetrics = () => {
    const mockMetrics: PerformanceMetric[] = [
      {
        id: "metric-1",
        name: "API Response Time",
        category: "response_time",
        value: 234,
        unit: "ms",
        trend: "down",
        threshold: { warning: 500, critical: 1000 },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-2",
        name: "Requests per Second",
        category: "throughput",
        value: 1247,
        unit: "req/s",
        trend: "up",
        threshold: { warning: 2000, critical: 3000 },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-3",
        name: "Memory Usage",
        category: "memory",
        value: 78.5,
        unit: "%",
        trend: "stable",
        threshold: { warning: 80, critical: 90 },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-4",
        name: "CPU Utilization",
        category: "cpu",
        value: 45.2,
        unit: "%",
        trend: "stable",
        threshold: { warning: 70, critical: 85 },
        lastUpdated: new Date().toISOString(),
      },
      {
        id: "metric-5",
        name: "Database Query Time",
        category: "database",
        value: 45,
        unit: "ms",
        trend: "down",
        threshold: { warning: 100, critical: 200 },
        lastUpdated: new Date().toISOString(),
      },
    ];
    setPerformanceMetrics(mockMetrics || []);
  };

  const loadScalingRules = () => {
    const mockRules: ScalingRule[] = [
      {
        id: "rule-1",
        name: "CPU High Load Scale Up",
        trigger: {
          metric: "cpu_usage",
          operator: ">",
          value: 70,
          duration: 300,
        },
        action: {
          type: "scale_up",
          parameters: { instances: 2, timeout: 600 },
        },
        enabled: true,
        triggerCount: 12,
        lastTriggered: "2024-01-18T14:30:00Z",
      },
      {
        id: "rule-2",
        name: "Memory Pressure Alert",
        trigger: {
          metric: "memory_usage",
          operator: ">",
          value: 85,
          duration: 180,
        },
        action: {
          type: "notify",
          parameters: { channels: ["email", "slack"], severity: "high" },
        },
        enabled: true,
        triggerCount: 3,
        lastTriggered: "2024-01-15T09:45:00Z",
      },
      {
        id: "rule-3",
        name: "Low Traffic Scale Down",
        trigger: {
          metric: "requests_per_second",
          operator: "<",
          value: 100,
          duration: 1800,
        },
        action: {
          type: "scale_down",
          parameters: { min_instances: 2, timeout: 900 },
        },
        enabled: false,
        triggerCount: 8,
        lastTriggered: "2024-01-12T22:15:00Z",
      },
    ];
    setScalingRules(mockRules || []);
  };

  const loadOptimizationJobs = () => {
    const mockJobs: OptimizationJob[] = [
      {
        id: "job-1",
        name: "Database Index Rebuild",
        type: "index_rebuild",
        status: "running",
        progress: 67,
        startTime: "2024-01-21T02:00:00Z",
        logs: [
          "Started index rebuild for table 'projects'",
          "Rebuilding primary key index...",
          "Rebuilding foreign key indexes...",
          "Progress: 67% complete",
        ],
      },
      {
        id: "job-2",
        name: "Cache Warmup - User Data",
        type: "cache_warmup",
        status: "completed",
        progress: 100,
        startTime: "2024-01-21T01:00:00Z",
        endTime: "2024-01-21T01:15:00Z",
        logs: [
          "Cache warmup started",
          "Loading user preferences...",
          "Loading project data...",
          "Warmup completed successfully",
        ],
      },
      {
        id: "job-3",
        name: "Log Rotation",
        type: "log_rotation",
        status: "scheduled",
        progress: 0,
        startTime: "2024-01-22T03:00:00Z",
        logs: [],
      },
    ];
    setOptimizationJobs(mockJobs || []);
  };

  const updateRealTimeMetrics = () => {
    setPerformanceMetrics((prev) => {
      if (!Array.isArray(prev)) return [];
      return prev.map((metric) => ({
        ...metric,
        value: metric.value + (Math.random() - 0.5) * (metric.value * 0.1),
        lastUpdated: new Date().toISOString(),
      }));
    });

    setSystemHealth((prev) => ({
      overall: Math.max(
        85,
        Math.min(99, prev.overall + (Math.random() - 0.5) * 2),
      ),
      api: Math.max(90, Math.min(100, prev.api + (Math.random() - 0.5) * 1)),
      database: Math.max(
        80,
        Math.min(95, prev.database + (Math.random() - 0.5) * 3),
      ),
      cache: Math.max(90, Math.min(99, prev.cache + (Math.random() - 0.5) * 1)),
      storage: Math.max(
        85,
        Math.min(98, prev.storage + (Math.random() - 0.5) * 2),
      ),
    }));
  };

  const clearCache = (cacheId: string) => {
    setCacheMetrics((prev) => {
      if (!Array.isArray(prev)) return [];
      return prev.map((cache) =>
        cache.id === cacheId
          ? { ...cache, lastCleared: new Date().toISOString(), requests: 0 }
          : cache,
      );
    });
    toast.success("Cache cleared successfully");
  };

  const toggleScalingRule = (ruleId: string) => {
    setScalingRules((prev) => {
      if (!Array.isArray(prev)) return [];
      return prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule,
      );
    });
    toast.success("Scaling rule updated");
  };

  const runOptimizationJob = (type: OptimizationJob["type"]) => {
    const newJob: OptimizationJob = {
      id: `job-${Date.now()}`,
      name: `Manual ${type.replace("_", " ").toUpperCase()}`,
      type,
      status: "running",
      progress: 0,
      startTime: new Date().toISOString(),
      logs: [`Started ${type} job manually`],
    };

    setOptimizationJobs((prev) => [newJob, ...prev]);
    toast.success("Optimization job started");

    // Simulate job progress
    const interval = setInterval(() => {
      setOptimizationJobs((prev) => {
        if (!Array.isArray(prev)) return [];
        return prev.map((job) => {
          if (job.id === newJob.id && job.status === "running") {
            const newProgress = Math.min(
              100,
              job.progress + Math.random() * 15,
            );
            const updatedJob = {
              ...job,
              progress: newProgress,
              logs: [
                ...(job.logs || []),
                `Progress: ${Math.round(newProgress)}% complete`,
              ],
            };

            if (newProgress >= 100) {
              updatedJob.status = "completed";
              updatedJob.endTime = new Date().toISOString();
              updatedJob.logs.push("Job completed successfully");
              clearInterval(interval);
            }

            return updatedJob;
          }
          return job;
        });
      });
    }, 2000);
  };

  const getMetricIcon = (category: string) => {
    switch (category) {
      case "response_time":
        return Clock;
      case "throughput":
        return TrendingUp;
      case "memory":
        return HardDrive;
      case "cpu":
        return Cpu;
      case "database":
        return Database;
      default:
        return Monitor;
    }
  };

  const getMetricColor = (
    value: number,
    threshold: { warning: number; critical: number } | null | undefined,
    category: string,
  ) => {
    // Return default color if threshold is not provided
    if (!threshold) return "text-gray-600";

    const isInverted = category === "response_time" || category === "database";

    if (isInverted) {
      if (value >= threshold.critical) return "text-red-600";
      if (value >= threshold.warning) return "text-yellow-600";
      return "text-green-600";
    } else {
      if (value >= threshold.critical) return "text-red-600";
      if (value >= threshold.warning) return "text-yellow-600";
      return "text-green-600";
    }
  };

  // Ensure all arrays are properly initialized
  const safePerformanceMetrics = Array.isArray(performanceMetrics)
    ? performanceMetrics
    : [];
  const safeCacheMetrics = Array.isArray(cacheMetrics) ? cacheMetrics : [];
  const safeDbConnections = Array.isArray(dbConnections) ? dbConnections : [];
  const safeScalingRules = Array.isArray(scalingRules) ? scalingRules : [];
  const safeOptimizationJobs = Array.isArray(optimizationJobs)
    ? optimizationJobs
    : [];

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Performance & Scale
            </h1>
            <p className="text-muted-foreground">
              System optimization, caching, and scaling management
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateRealTimeMetrics()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Overall Health
              </CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(systemHealth.overall || 0).toFixed(1)}%
              </div>
              <Progress value={systemHealth.overall} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Health</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth.api.toFixed(1)}%
              </div>
              <Progress value={systemHealth.api} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth.database.toFixed(1)}%
              </div>
              <Progress value={systemHealth.database} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth.cache.toFixed(1)}%
              </div>
              <Progress value={systemHealth.cache} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth.storage.toFixed(1)}%
              </div>
              <Progress value={systemHealth.storage} className="h-2 mt-2" />
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
            <TabsTrigger value="caching">Caching</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="scaling">Scaling</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Real-time Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {safePerformanceMetrics.map((metric) => {
                      const Icon = getMetricIcon(metric.category);
                      const colorClass = getMetricColor(
                        metric.value,
                        metric.threshold,
                        metric.category,
                      );

                      return (
                        <div
                          key={metric.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${colorClass}`} />
                            <div>
                              <div className="font-medium">{metric.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Updated{" "}
                                {new Date(
                                  metric.lastUpdated,
                                ).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${colorClass}`}>
                              {(metric.value || 0).toFixed(
                                metric.unit === "%" ? 1 : 0,
                              )}
                              {metric.unit}
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              {metric.trend === "up" && (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              )}
                              {metric.trend === "down" && (
                                <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />
                              )}
                              {metric.trend === "stable" && (
                                <span className="w-3 h-0.5 bg-gray-400" />
                              )}
                              <span className="text-muted-foreground">
                                {metric.trend}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Running Optimization Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {safeOptimizationJobs
                      .filter((job) => job.status !== "completed")
                      .map((job) => (
                        <div key={job.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{job.name}</div>
                            <Badge
                              variant={
                                job.status === "running"
                                  ? "default"
                                  : job.status === "scheduled"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {job.status}
                            </Badge>
                          </div>
                          {job.status === "running" && (
                            <div className="space-y-2">
                              <Progress value={job.progress} className="h-2" />
                              <div className="text-sm text-muted-foreground">
                                {(job.progress || 0).toFixed(0)}% complete
                              </div>
                            </div>
                          )}
                          {job.status === "scheduled" && (
                            <div className="text-sm text-muted-foreground">
                              Scheduled for{" "}
                              {new Date(job.startTime).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))}

                    <div className="pt-4 border-t">
                      <div className="text-sm font-medium mb-2">
                        Quick Actions
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runOptimizationJob("cache_warmup")}
                        >
                          Cache Warmup
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runOptimizationJob("database_cleanup")}
                        >
                          DB Cleanup
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="caching" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cache Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hit Rate</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Last Cleared</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeCacheMetrics.map((cache) => (
                      <TableRow key={cache.id}>
                        <TableCell className="font-medium">
                          {cache.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{cache.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`text-sm font-medium ${
                                cache.hitRate > 90
                                  ? "text-green-600"
                                  : cache.hitRate > 75
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {(cache.hitRate || 0).toFixed(1)}%
                            </div>
                            <Progress
                              value={cache.hitRate}
                              className="h-2 w-16"
                            />
                          </div>
                        </TableCell>
                        <TableCell>{cache.size}</TableCell>
                        <TableCell>{cache.requests.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(cache.lastCleared).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => clearCache(cache.id)}
                            >
                              Clear
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Database</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Connections</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Last Optimized</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeDbConnections.map((db) => (
                      <TableRow key={db.id}>
                        <TableCell className="font-medium">{db.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{db.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {db.status === "healthy" && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {db.status === "warning" && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            {db.status === "error" && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="capitalize">{db.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>
                              {db.connections}/{db.maxConnections}
                            </span>
                            <Progress
                              value={(db.connections / db.maxConnections) * 100}
                              className="h-2 w-16"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`${
                              db.responseTime < 50
                                ? "text-green-600"
                                : db.responseTime < 100
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {db.responseTime}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(db.lastOptimized).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              Optimize
                            </Button>
                            <Button variant="outline" size="sm">
                              <Monitor className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scaling" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Auto-scaling Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Triggered</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeScalingRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {rule.name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.trigger.metric} {rule.trigger.operator}{" "}
                            {rule.trigger.value}
                            <div className="text-xs text-muted-foreground">
                              for {rule.trigger.duration}s
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {rule.action.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => toggleScalingRule(rule.id)}
                            />
                            <span className="text-sm">
                              {rule.enabled ? "Active" : "Disabled"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{rule.triggerCount} times</div>
                            {rule.lastTriggered && (
                              <div className="text-muted-foreground">
                                Last:{" "}
                                {new Date(
                                  rule.lastTriggered,
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Optimization Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeOptimizationJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          {job.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {job.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              job.status === "running"
                                ? "default"
                                : job.status === "completed"
                                  ? "default"
                                  : job.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                            }
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={job.progress}
                              className="h-2 w-16"
                            />
                            <span className="text-sm">
                              {(job.progress || 0).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(job.startTime).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
