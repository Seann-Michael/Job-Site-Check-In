import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Users,
  Activity,
  TrendingUp,
  UserPlus,
  Building2,
  Star,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RefreshCw,
  Briefcase,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;       // logged in within time frame
  newSignups: number;        // created within time frame
  totalBusinesses: number;
  activeJobs: number;        // status active or in_progress
  totalReviews: number;
  avgReviewRating: number;
  totalClients: number;
}

interface MonthlySignup {
  month: string;
  count: number;
}

function getTimeframeCutoff(tf: string): Date {
  const now = new Date();
  const map: Record<string, number> = {
    "1d": 1, "7d": 7, "30d": 30, "60d": 60, "90d": 90, "180d": 180, "365d": 365,
  };
  const days = map[tf] ?? 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [timeFrame, setTimeFrame] = useState("30d");
  const [hideMetrics, setHideMetrics] = useState(() => {
    const saved = localStorage.getItem("super_admin_hide_metrics");
    return saved ? JSON.parse(saved) : true;
  });
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    newSignups: 0,
    totalBusinesses: 0,
    activeJobs: 0,
    totalReviews: 0,
    avgReviewRating: 0,
    totalClients: 0,
  });
  const [prevMetrics, setPrevMetrics] = useState<DashboardMetrics | null>(null);
  const [monthlySignups, setMonthlySignups] = useState<MonthlySignup[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const toggleMetrics = () => {
    const newValue = !hideMetrics;
    setHideMetrics(newValue);
    localStorage.setItem("super_admin_hide_metrics", JSON.stringify(newValue));
  };

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = getTimeframeCutoff(timeFrame);
      const cutoffIso = cutoff.toISOString();

      // Double the window to calculate a "previous period" for trend arrows
      const prevCutoff = new Date(cutoff.getTime() - (new Date().getTime() - cutoff.getTime()));
      const prevCutoffIso = prevCutoff.toISOString();

      // ── Parallel queries ────────────────────────────────────────────────────
      const [
        usersRes,
        activeUsersRes,
        newSignupsRes,
        prevSignupsRes,
        businessesRes,
        activeJobsRes,
        reviewsRes,
        avgRatingRes,
        clientsRes,
      ] = await Promise.all([
        // Total users (all time)
        supabaseClient.from("users").select("id", { count: "exact", head: true }),
        // Active users: last_login within time frame
        supabaseClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("last_login", cutoffIso),
        // New signups in current period
        supabaseClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("created_at", cutoffIso),
        // New signups in previous period (for trend comparison)
        supabaseClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("created_at", prevCutoffIso)
          .lt("created_at", cutoffIso),
        // Total businesses
        supabaseClient.from("businesses").select("id", { count: "exact", head: true }),
        // Active jobs (status in active / in_progress)
        supabaseClient
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "in_progress"]),
        // Reviews in time frame
        supabaseClient
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .gte("created_at", cutoffIso),
        // Average review rating
        supabaseClient.from("reviews").select("rating"),
        // Total clients
        supabaseClient.from("clients").select("id", { count: "exact", head: true }),
      ]);

      // Compute avg rating
      const ratings: number[] = (avgRatingRes.data ?? []).map((r: any) => Number(r.rating));
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

      const current: DashboardMetrics = {
        totalUsers: usersRes.count ?? 0,
        activeUsers: activeUsersRes.count ?? 0,
        newSignups: newSignupsRes.count ?? 0,
        totalBusinesses: businessesRes.count ?? 0,
        activeJobs: activeJobsRes.count ?? 0,
        totalReviews: reviewsRes.count ?? 0,
        avgReviewRating: Math.round(avgRating * 10) / 10,
        totalClients: clientsRes.count ?? 0,
      };

      setPrevMetrics({
        ...current,
        newSignups: prevSignupsRes.count ?? 0,
      });
      setMetrics(current);

      // ── Monthly signups for trend chart (last 7 months) ────────────────────
      const monthlyData: MonthlySignup[] = [];
      for (let i = 6; i >= 0; i--) {
        const start = new Date();
        start.setDate(1);
        start.setMonth(start.getMonth() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        const { count } = await supabaseClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString());

        const label = start.toLocaleString("default", { month: "short", year: "2-digit" });
        monthlyData.push({ month: label, count: count ?? 0 });
      }
      setMonthlySignups(monthlyData);
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error("Failed to load analytics: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [timeFrame]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ── Derived display values ─────────────────────────────────────────────────
  const signupTrend = prevMetrics
    ? pctChange(metrics.newSignups, prevMetrics.newSignups)
    : null;

  const maxMonthlyCount = Math.max(...monthlySignups.map((m) => m.count), 1);

  const kpiCards = [
    {
      label: "Total Users",
      value: metrics.totalUsers.toLocaleString(),
      sub: `${metrics.newSignups.toLocaleString()} new this period`,
      trend: signupTrend,
      trendUp: signupTrend ? !signupTrend.startsWith("-") : true,
      icon: Users,
    },
    {
      label: "Active Users",
      value: metrics.activeUsers.toLocaleString(),
      sub: "Logged in within period",
      trend: metrics.totalUsers > 0
        ? `${((metrics.activeUsers / metrics.totalUsers) * 100).toFixed(1)}% of total`
        : "—",
      trendUp: true,
      icon: Activity,
    },
    {
      label: "New Signups",
      value: metrics.newSignups.toLocaleString(),
      sub: "In selected period",
      trend: signupTrend,
      trendUp: signupTrend ? !signupTrend.startsWith("-") : true,
      icon: UserPlus,
    },
    {
      label: "Avg Review Rating",
      value: metrics.avgReviewRating > 0 ? `${metrics.avgReviewRating}★` : "N/A",
      sub: `${metrics.totalReviews.toLocaleString()} reviews total`,
      trend: metrics.avgReviewRating >= 4 ? "Good standing" : metrics.avgReviewRating > 0 ? "Needs attention" : "No data",
      trendUp: metrics.avgReviewRating >= 4,
      icon: Star,
    },
  ];

  const platformStats = [
    {
      label: "Active Jobs",
      value: metrics.activeJobs.toLocaleString(),
      icon: Briefcase,
    },
    {
      label: "Total Businesses",
      value: metrics.totalBusinesses.toLocaleString(),
      icon: Building2,
    },
    {
      label: "Total Reviews",
      value: metrics.totalReviews.toLocaleString(),
      icon: MessageSquare,
    },
    {
      label: "Total Clients",
      value: metrics.totalClients.toLocaleString(),
      icon: Users,
    },
  ];

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live data from Supabase · Last refreshed {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMetrics}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={toggleMetrics} className="gap-2">
              {hideMetrics ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {hideMetrics ? "Show Metrics" : "Hide Metrics"}
            </Button>
            <Select value={timeFrame} onValueChange={setTimeFrame}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Time frame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="60d">Last 60 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="180d">Last 180 Days</SelectItem>
                <SelectItem value="365d">Last 365 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? (
                      <div className="h-7 w-20 animate-pulse bg-muted rounded" />
                    ) : hideMetrics ? (
                      "•••"
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    {!loading && card.trend && (
                      card.trendUp
                        ? <ArrowUp className="h-3 w-3 text-green-500 shrink-0" />
                        : <ArrowDown className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    {hideMetrics ? "Hidden" : card.sub}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* User Signup Growth */}
          <Card>
            <CardHeader>
              <CardTitle>User Signup Trend</CardTitle>
              <CardDescription>New users per month (last 7 months)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="h-6 w-full animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : monthlySignups.length === 0 || monthlySignups.every((m) => m.count === 0) ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No signup data available yet
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlySignups.map((m, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-14 shrink-0 text-muted-foreground">
                        {m.month}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max((m.count / maxMonthlyCount) * 100, m.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-6 text-right">{m.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Overview</CardTitle>
              <CardDescription>Key counts from your database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {platformStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">{stat.label}</span>
                      </div>
                      {loading ? (
                        <div className="h-5 w-12 animate-pulse bg-background rounded" />
                      ) : (
                        <span className="font-bold text-lg">
                          {hideMetrics ? "•••" : stat.value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage all users and their accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full gap-2">
                  <Link to="/super-admin/users">
                    <Eye className="h-4 w-4" />
                    View All Users
                  </Link>
                </Button>
                <Button asChild className="w-full gap-2">
                  <Link to="/super-admin/users">
                    <UserPlus className="h-4 w-4" />
                    Add New User
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Management
              </CardTitle>
              <CardDescription>Manage all businesses and their accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full gap-2">
                  <Link to="/super-admin/businesses">
                    <Eye className="h-4 w-4" />
                    View All Businesses
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics & Reports
              </CardTitle>
              <CardDescription>Financial metrics and system insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full gap-2">
                  <Link to="/super-admin/settings">
                    <SettingsIcon className="h-4 w-4" />
                    System Settings
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
