import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Database,
  Globe,
  Phone,
  CreditCard,
  RefreshCw,
  Calendar,
  MapPin,
  Mail,
  BarChart3,
  Loader2,
  AlertCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

interface SystemStatus {
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  description: string;
  lastChecked: string;
  responseTime?: number;
  uptime?: number;
  error?: string;
}

interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  startTime: string;
  resolvedTime?: string;
  updates: {
    time: string;
    message: string;
    status: string;
  }[];
}

interface SystemStatusResponse {
  systems: SystemStatus[];
  incidents: Incident[];
  overallStatus: "operational" | "degraded" | "outage";
  overallUptime: number;
  lastUpdated: string;
  servicesMonitored: number;
}

export default function StatusPage() {
  const [systems, setSystems] = useState<SystemStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [overallStatus, setOverallStatus] = useState<
    "operational" | "degraded" | "outage"
  >("operational");
  const [overallUptime, setOverallUptime] = useState<number>(99.9);
  const [servicesMonitored, setServicesMonitored] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else if (systems.length === 0) {
      setIsLoading(true);
    }

    setError(null);

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/.netlify/functions/system-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to get error details from response body
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        } catch {
          // Ignore if we can't read the error body
        }
        throw new Error(errorMessage);
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Invalid response format: Expected JSON, got ${contentType || 'unknown'}. Response: ${responseText.substring(0, 200)}`);
      }

      let data: SystemStatusResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        const responseText = await response.text();
        throw new Error(`Failed to parse JSON response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}. Response: ${responseText.substring(0, 200)}`);
      }

      setSystems(data.systems);
      setIncidents(data.incidents);
      setOverallStatus(data.overallStatus);
      setOverallUptime(data.overallUptime);
      setServicesMonitored(data.servicesMonitored);
      setLastUpdated(data.lastUpdated);

      if (isManualRefresh) {
        toast.success("System status updated successfully");
      }

    } catch (error) {
      console.error('Failed to load system status:', error);

      let errorMessage: string;
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout (10s) - API may be unavailable';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Unknown error occurred';
      }

      setError(errorMessage);

      if (isManualRefresh) {
        toast.error(`Failed to update status: ${errorMessage}`);
      }

      // Development fallback - show mock data if in development mode and API fails
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('fly.dev');

      if (systems.length === 0) {
        if (isDevelopment && (errorMessage.includes('404') || errorMessage.includes('Failed to fetch') || errorMessage.includes('timeout'))) {
          // Fallback to mock data during development
          console.warn('Using fallback mock data for development');
          const mockSystems = [
            {
              name: "Core Application",
              status: "operational" as const,
              description: "Main application services (Development Mode)",
              lastChecked: new Date().toISOString(),
              responseTime: 145,
              uptime: 99.9,
            },
            {
              name: "Database",
              status: "operational" as const,
              description: "Database services (Mock)",
              lastChecked: new Date().toISOString(),
              responseTime: 12,
              uptime: 99.95,
            },
            {
              name: "API Services",
              status: "degraded" as const,
              description: "API endpoint unavailable in development",
              lastChecked: new Date().toISOString(),
              responseTime: 5000,
              uptime: 95.0,
              error: "Development mode - API function not running"
            }
          ];

          setSystems(mockSystems);
          setOverallStatus("degraded");
          setOverallUptime(98.2);
          setServicesMonitored(mockSystems.length);
          setIncidents([{
            id: "dev-001",
            title: "Development Mode Active",
            status: "monitoring",
            severity: "low",
            description: "System is running in development mode with limited functionality",
            startTime: new Date().toISOString(),
            updates: [{
              time: new Date().toISOString(),
              message: "Using fallback data due to API unavailability in development",
              status: "monitoring"
            }]
          }]);
          setError("Development mode: Using mock data because system-status API is unavailable. Deploy to production to see real status data.");
        } else {
          // Production error state
          setSystems([
            {
              name: "Core Application",
              status: "outage",
              description: "Unable to check status",
              lastChecked: new Date().toISOString(),
              error: "Status check failed"
            }
          ]);
          setOverallStatus("outage");
        }
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "outage":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "maintenance":
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge className="bg-green-500 hover:bg-green-600">Operational</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Degraded</Badge>;
      case "outage":
        return <Badge variant="destructive">Outage</Badge>;
      case "maintenance":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-red-500 hover:bg-red-600">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getSystemIcon = (systemName: string) => {
    if (systemName.includes("Database") || systemName.includes("Supabase")) return Database;
    if (systemName.includes("API") || systemName.includes("Netlify")) return Globe;
    if (systemName.includes("SMS") || systemName.includes("Twilio")) return Phone;
    if (systemName.includes("Maps") || systemName.includes("Google")) return MapPin;
    if (systemName.includes("Payment") || systemName.includes("Stripe")) return CreditCard;
    if (systemName.includes("Email") || systemName.includes("Mailgun")) return Mail;
    if (systemName.includes("SEO") || systemName.includes("DataForSEO")) return BarChart3;
    return Activity;
  };

  const formatUptime = (uptime?: number) => {
    if (uptime === undefined) return "N/A";
    return `${uptime.toFixed(2)}%`;
  };

  const formatResponseTime = (responseTime?: number) => {
    if (responseTime === undefined) return "N/A";
    return `${responseTime}ms`;
  };

  const getResponseTimeColor = (responseTime?: number) => {
    if (responseTime === undefined) return "text-gray-500";
    if (responseTime > 2000) return "text-red-500";
    if (responseTime > 1000) return "text-yellow-500";
    return "text-green-500";
  };

  const getUptimeColor = (uptime?: number) => {
    if (uptime === undefined) return "text-gray-500";
    if (uptime < 99) return "text-red-500";
    if (uptime < 99.5) return "text-yellow-500";
    return "text-green-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-xl font-semibold mb-2">Loading System Status</h2>
          <p className="text-muted-foreground">Checking all services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">System Status</h1>
          <p className="text-muted-foreground mb-4">
            Real-time status and uptime of all systems
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(overallStatus)}
              <span className="font-medium">
                {overallStatus === "operational"
                  ? "All Systems Operational"
                  : overallStatus === "degraded"
                    ? "Some Systems Degraded"
                    : "System Outage Detected"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSystemStatus(true)}
              disabled={isRefreshing}
              className="gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <div className="flex items-center gap-2 justify-center">
                <AlertCircleIcon className="h-4 w-4" />
                Status check error: {error}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
          </p>
        </div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Active Incidents ({incidents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{incident.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {incident.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {getSeverityBadge(incident.severity)}
                        {getStatusBadge(incident.status)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Updates:</h4>
                      {incident.updates.map((update, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[120px]">
                            <Calendar className="h-3 w-3" />
                            {new Date(update.time).toLocaleTimeString()}
                          </div>
                          <p>{update.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systems.map((system) => {
            const Icon = getSystemIcon(system.name);
            return (
              <Card key={system.name} className={system.status === "outage" ? "border-red-200" : system.status === "degraded" ? "border-yellow-200" : ""}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 text-primary" />
                      <h3 className="font-medium">{system.name}</h3>
                    </div>
                    {getStatusIcon(system.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {system.description}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Status:</span>
                      {getStatusBadge(system.status)}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Response Time:</span>
                      <span className={getResponseTimeColor(system.responseTime)}>
                        {formatResponseTime(system.responseTime)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Uptime:</span>
                      <span className={getUptimeColor(system.uptime)}>
                        {formatUptime(system.uptime)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Last checked:</span>
                      <span>
                        {new Date(system.lastChecked).toLocaleTimeString()}
                      </span>
                    </div>
                    {system.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                        Error: {system.error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Historical Uptime Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Real-Time Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getUptimeColor(overallUptime)}`}>
                  {formatUptime(overallUptime)}
                </div>
                <p className="text-sm text-muted-foreground">Overall Uptime</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {servicesMonitored}
                </div>
                <p className="text-sm text-muted-foreground">
                  Services Monitored
                </p>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${incidents.length > 0 ? "text-red-600" : "text-green-600"}`}>
                  {incidents.length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Active Incidents
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-refresh Notice */}
        <div className="text-center mt-6 text-xs text-muted-foreground">
          Status updates automatically every 30 seconds
        </div>
      </div>
    </div>
  );
}
