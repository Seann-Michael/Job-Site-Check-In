import React, { useState, useEffect, useCallback } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminBroadcast from "./SuperAdminBroadcast";
import SuperAdminMessageTemplatesEmbedded from "./SuperAdminMessageTemplatesEmbedded";
import SuperAdminAnalytics from "./SuperAdminAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  FileText,
  BarChart3,
  Send,
  Eye,
  TrendingUp,
  MessageSquare,
  Clock,
  Target,
  Plus,
  RefreshCw,
  Mail,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface OverviewStats {
  totalMessages: number;
  activeTemplates: number;
  totalViews: number;
  engagementRate: number;
  scheduledMessages: number;
  activeMessages: number;
}

interface RecentActivity {
  id: string;
  type: "broadcast" | "template";
  title: string;
  status: string;
  recipients: string;
  created_at: string;
  view_count?: number;
}

export default function SuperAdminCommunications() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [stats, setStats] = useState<OverviewStats>({
    totalMessages: 0,
    activeTemplates: 0,
    totalViews: 0,
    engagementRate: 0,
    scheduledMessages: 0,
    activeMessages: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const [messagesRes, templatesRes] = await Promise.all([
        supabaseClient
          .from("broadcast_messages")
          .select("id, title, status, target_audience, view_count, dismiss_count, is_active, created_at")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("message_templates")
          .select("id, name, status, usage_count, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (templatesRes.error) throw templatesRes.error;

      const messages = messagesRes.data || [];
      const templates = templatesRes.data || [];

      const totalViews = messages.reduce((s, m) => s + (m.view_count || 0), 0);
      const totalDismissals = messages.reduce((s, m) => s + (m.dismiss_count || 0), 0);
      const engagementRate =
        totalViews > 0 ? ((totalViews - totalDismissals) / totalViews) * 100 : 0;

      setStats({
        totalMessages: messages.length,
        activeTemplates: templates.filter((t) => t.status === "active").length,
        totalViews,
        engagementRate,
        scheduledMessages: messages.filter((m) => m.status === "scheduled").length,
        activeMessages: messages.filter((m) => m.is_active).length,
      });

      // Build recent activity from latest messages + templates
      const broadcastActivity: RecentActivity[] = messages.slice(0, 5).map((m) => ({
        id: m.id,
        type: "broadcast",
        title: m.title,
        status: m.status,
        recipients: m.target_audience === "all" ? "All Users" : m.target_audience,
        created_at: m.created_at,
        view_count: m.view_count,
      }));

      const templateActivity: RecentActivity[] = templates.slice(0, 3).map((t) => ({
        id: t.id,
        type: "template",
        title: t.name,
        status: t.status,
        recipients: `Used ${t.usage_count} times`,
        created_at: t.created_at,
      }));

      const combined = [...broadcastActivity, ...templateActivity].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecentActivity(combined.slice(0, 8));
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load communications overview");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500">Sent</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500">Scheduled</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "broadcast":
        return <Megaphone className="h-4 w-4 text-blue-500" />;
      case "template":
        return <FileText className="h-4 w-4 text-green-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const skeletonCard = (
    <div className="h-16 bg-muted animate-pulse rounded" />
  );

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Communications Center</h1>
              <p className="text-muted-foreground">
                Manage broadcasts, templates, and communication analytics
              </p>
              {!isLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  Live data · Last refreshed {lastRefreshed.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={fetchOverview}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                className="gap-2"
                onClick={() => setActiveTab("broadcast")}
              >
                <Plus className="h-4 w-4" />
                Create Message
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">
                <BarChart3 className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="broadcast">
                <Megaphone className="h-4 w-4 mr-2" />
                Broadcast
              </TabsTrigger>
              <TabsTrigger value="templates">
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {/* Stats Overview */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? skeletonCard : (
                      <>
                        <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Broadcast messages created</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? skeletonCard : (
                      <>
                        <div className="text-2xl font-bold">{stats.activeTemplates}</div>
                        <p className="text-xs text-muted-foreground">Ready to use</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? skeletonCard : (
                      <>
                        <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Across all broadcasts</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? skeletonCard : (
                      <>
                        <div className="text-2xl font-bold">
                          {Math.round(stats.engagementRate)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Views not dismissed</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics */}
              <div className="grid gap-4 md:grid-cols-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      size="sm"
                      onClick={() => setActiveTab("broadcast")}
                    >
                      <Send className="h-4 w-4" />
                      Send Broadcast
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      size="sm"
                      onClick={() => setActiveTab("templates")}
                    >
                      <FileText className="h-4 w-4" />
                      Manage Templates
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      size="sm"
                      onClick={() => setActiveTab("analytics")}
                    >
                      <BarChart3 className="h-4 w-4" />
                      View Analytics
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity yet. Send your first broadcast to get started.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div
                          key={`${activity.type}-${activity.id}`}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getTypeIcon(activity.type)}
                            <div>
                              <div className="font-medium">{activity.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {activity.type === "broadcast"
                                  ? `Audience: ${activity.recipients}`
                                  : activity.recipients}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {activity.view_count !== undefined && activity.view_count > 0 && (
                              <div className="text-sm text-muted-foreground hidden md:block">
                                {activity.view_count} views
                              </div>
                            )}
                            {getStatusBadge(activity.status)}
                            <div className="text-xs text-muted-foreground hidden lg:block">
                              {new Date(activity.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Scheduled Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? skeletonCard : (
                      <div className="text-center py-4">
                        <div className="text-2xl font-bold">{stats.scheduledMessages}</div>
                        <p className="text-sm text-muted-foreground">Messages pending delivery</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Active Broadcasts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? skeletonCard : (
                      <div className="text-center py-4">
                        <div className="text-2xl font-bold">{stats.activeMessages}</div>
                        <p className="text-sm text-muted-foreground">Currently visible to users</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Broadcast Tab */}
            <TabsContent value="broadcast">
              <SuperAdminBroadcast embedded />
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates">
              <SuperAdminMessageTemplatesEmbedded />
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <SuperAdminAnalytics embedded />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
