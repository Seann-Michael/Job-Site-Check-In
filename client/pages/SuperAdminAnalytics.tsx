import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  MessageSquare,
  Clock,
  Target,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { formatSystemDate } from "@/lib/dateUtils";
import { supabaseClient } from "@/lib/supabaseClient";

interface BroadcastRow {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  target_audience: string;
  category?: string;
  created_at: string;
  sent_at?: string;
  status: string;
  view_count: number;
  dismiss_count: number;
  is_active: boolean;
}

interface TypeStat {
  type: string;
  count: number;
  views: number;
  dismissals: number;
  engagement: number;
  color: string;
}

interface AudienceStat {
  audience: string;
  count: number;
  views: number;
  engagement: number;
}

interface TrendPoint {
  period: string;
  messages: number;
  views: number;
  dismissals: number;
  engagement: number;
}

interface AnalyticsState {
  totalMessages: number;
  totalViews: number;
  totalDismissals: number;
  activeMessages: number;
  engagementRate: number;
  typeStats: TypeStat[];
  audienceStats: AudienceStat[];
  trends: TrendPoint[];
  topMessages: BroadcastRow[];
  lowMessages: BroadcastRow[];
}

const TYPE_COLORS: Record<string, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  success: "#10b981",
  error: "#ef4444",
};

function getTypeIcon(type: string) {
  switch (type) {
    case "info": return <Info className="h-4 w-4 text-blue-500" />;
    case "warning": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error": return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
}

function engagementOf(m: BroadcastRow) {
  return m.view_count > 0
    ? ((m.view_count - m.dismiss_count) / m.view_count) * 100
    : 0;
}

function computeAnalytics(messages: BroadcastRow[], cutoff: Date): AnalyticsState {
  const filtered = messages.filter((m) => new Date(m.created_at) >= cutoff);

  const totalViews = filtered.reduce((s, m) => s + m.view_count, 0);
  const totalDismissals = filtered.reduce((s, m) => s + m.dismiss_count, 0);
  const engagementRate =
    totalViews > 0 ? ((totalViews - totalDismissals) / totalViews) * 100 : 0;

  // Type stats
  const typeStats: TypeStat[] = ["info", "warning", "success", "error"].map((type) => {
    const rows = filtered.filter((m) => m.type === type);
    const views = rows.reduce((s, m) => s + m.view_count, 0);
    const dismissals = rows.reduce((s, m) => s + m.dismiss_count, 0);
    return {
      type,
      count: rows.length,
      views,
      dismissals,
      engagement: views > 0 ? ((views - dismissals) / views) * 100 : 0,
      color: TYPE_COLORS[type],
    };
  });

  // Audience stats
  const audienceKeys = ["all", "business-owners", "agency-admins", "staff"];
  const audienceStats: AudienceStat[] = audienceKeys.map((audience) => {
    const rows = filtered.filter((m) => m.target_audience === audience);
    const views = rows.reduce((s, m) => s + m.view_count, 0);
    const dismissals = rows.reduce((s, m) => s + m.dismiss_count, 0);
    return {
      audience,
      count: rows.length,
      views,
      engagement: views > 0 ? ((views - dismissals) / views) * 100 : 0,
    };
  });

  // 7-day trend
  const trends: TrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - i);
    end.setHours(23, 59, 59, 999);

    const dayRows = filtered.filter((m) => {
      const d = new Date(m.created_at);
      return d >= start && d <= end;
    });
    const views = dayRows.reduce((s, m) => s + m.view_count, 0);
    const dismissals = dayRows.reduce((s, m) => s + m.dismiss_count, 0);
    trends.push({
      period: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      messages: dayRows.length,
      views,
      dismissals,
      engagement: views > 0 ? ((views - dismissals) / views) * 100 : 0,
    });
  }

  const sorted = [...filtered].sort((a, b) => engagementOf(b) - engagementOf(a));

  return {
    totalMessages: filtered.length,
    totalViews,
    totalDismissals,
    activeMessages: filtered.filter((m) => m.is_active).length,
    engagementRate,
    typeStats,
    audienceStats,
    trends,
    topMessages: sorted.slice(0, 5),
    lowMessages: sorted.slice(-5).reverse(),
  };
}

function getCutoff(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

export default function SuperAdminAnalytics() {
  const [data, setData] = useState<AnalyticsState | null>(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: rows, error } = await supabaseClient
        .from("broadcast_messages")
        .select("id, title, content, type, target_audience, category, created_at, sent_at, status, view_count, dismiss_count, is_active")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const cutoff = getCutoff(timeRange);
      setData(computeAnalytics(rows || [], cutoff));
      setLastUpdated(new Date());
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportReport = () => {
    if (!data) return;
    const report = { generatedAt: new Date().toISOString(), timeRange, data };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `broadcast-analytics-${timeRange}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Analytics report exported!");
  };

  const audienceLabel = (audience: string) => {
    switch (audience) {
      case "all": return "All Users";
      case "business-owners": return "Business Owners";
      case "agency-admins": return "Agency Admins";
      case "staff": return "Staff Members";
      default: return audience;
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Broadcast Analytics
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Insights into broadcast message performance and engagement
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportReport} disabled={!data} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Last updated: {lastUpdated.toLocaleString()}</span>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold">{data?.totalMessages ?? 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{(data?.totalViews ?? 0).toLocaleString()}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
                <p className="text-2xl font-bold">{Math.round(data?.engagementRate ?? 0)}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Messages</p>
                <p className="text-2xl font-bold">{data?.activeMessages ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Types Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.totalMessages === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No broadcast data for this period.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(data?.typeStats ?? []).map((stat) => (
                    <div key={stat.type} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(stat.type)}
                        <span className="font-medium capitalize">{stat.type}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Messages:</span>
                          <span className="font-medium">{stat.count}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Views:</span>
                          <span className="font-medium">{stat.views}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Engagement:</span>
                          <span className="font-medium">{Math.round(stat.engagement)}%</span>
                        </div>
                        <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${Math.min(stat.engagement, 100)}%`, backgroundColor: stat.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dismissal Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.totalViews === 0 ? (
                <p className="text-center text-muted-foreground py-8">No view data yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Total Views</span>
                    <span className="font-medium">{data.totalViews.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Total Dismissals</span>
                    <span className="font-medium">{data.totalDismissals.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Dismiss Rate</span>
                    <span className="font-medium">
                      {data.totalViews > 0
                        ? Math.round((data.totalDismissals / data.totalViews) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full"
                      style={{
                        width: `${Math.min(data.engagementRate, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(data.engagementRate)}% engagement rate (views not dismissed)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audience Tab */}
        <TabsContent value="audience" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audience Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.totalMessages === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No broadcast data for this period.
                </p>
              ) : (
                <div className="space-y-4">
                  {(data?.audienceStats ?? []).map((stat) => (
                    <div key={stat.audience} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{audienceLabel(stat.audience)}</h4>
                        <Badge variant="secondary">{stat.count} messages</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Views: </span>
                          <span className="font-medium">{stat.views.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Engagement: </span>
                          <span className="font-medium">{Math.round(stat.engagement)}%</span>
                        </div>
                      </div>
                      <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${Math.min(stat.engagement, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Top Performing Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data || data.topMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No data yet.</p>
                ) : (
                  data.topMessages.map((message, index) => (
                    <div key={message.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Badge variant="secondary" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{message.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {message.view_count} views • {message.dismiss_count} dismissed •{" "}
                          {Math.round(engagementOf(message))}% engagement
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTypeIcon(message.type)}
                          <span className="text-xs capitalize">{message.type}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Needs Improvement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data || data.lowMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No data yet.</p>
                ) : (
                  data.lowMessages.map((message, index) => (
                    <div key={message.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{message.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {message.view_count} views • {message.dismiss_count} dismissed •{" "}
                          {Math.round(engagementOf(message))}% engagement
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTypeIcon(message.type)}
                          <span className="text-xs capitalize">{message.type}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>7-Day Activity Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.trends.every((t) => t.messages === 0 && t.views === 0) ? (
                <p className="text-center text-muted-foreground py-8">
                  No broadcast activity in the selected period.
                </p>
              ) : (
                <div className="space-y-3">
                  {(data?.trends ?? []).map((point) => (
                    <div key={point.period} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-20 text-sm font-medium text-muted-foreground shrink-0">
                        {point.period}
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Messages: </span>
                          <span className="font-medium">{point.messages}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Views: </span>
                          <span className="font-medium">{point.views}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Engagement: </span>
                          <span className="font-medium">{Math.round(point.engagement)}%</span>
                        </div>
                      </div>
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${Math.min(point.engagement, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
