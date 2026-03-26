import { useState, useEffect, useCallback } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Star,
  MessageSquare,
  Image,
  Video,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Send,
  CheckCircle,
  Minus,
  Building2,
  UserCheck,
  MapPin,
  Zap,
  PlayCircle,
  Activity,
  LifeBuoy,
  Lightbulb,
  BookOpen,
  ThumbsUp,
  AlertTriangle,
  CheckSquare,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetricValue {
  value: number | string;
  loading: boolean;
  error?: string;
}

interface Metrics {
  // ── Jobs ──────────────────────────────────────────────────────────────────
  jobsCreated: MetricValue;
  activeJobs: MetricValue;
  completedJobs: MetricValue;
  // ── Reviews ───────────────────────────────────────────────────────────────
  totalReviews: MetricValue;
  avgReviewCountPerWorkspace: MetricValue;
  avgReviewRatingPerWorkspace: MetricValue;
  avgReviewGrowthPerWorkspace: MetricValue;
  totalReviewRequests: MetricValue;
  reviewResponseRate: MetricValue;
  avgReviewRatingChange: MetricValue;
  fiveStarRate: MetricValue;
  negativeReviewRate: MetricValue;
  // ── Media ─────────────────────────────────────────────────────────────────
  totalPhotos: MetricValue;
  avgPhotosPerWorkspace: MetricValue;
  totalVideos: MetricValue;
  avgVideosPerWorkspace: MetricValue;
  // ── Clients ───────────────────────────────────────────────────────────────
  totalClients: MetricValue;
  avgClientsPerWorkspace: MetricValue;
  // ── Platform Health ───────────────────────────────────────────────────────
  totalWorkspaces: MetricValue;
  newWorkspaces: MetricValue;
  totalUsers: MetricValue;
  gmbProfilesConnected: MetricValue;
  // ── Automation ────────────────────────────────────────────────────────────
  totalWorkflows: MetricValue;
  activeWorkflows: MetricValue;
  workflowExecutions: MetricValue;
  // ── Support & Engagement ──────────────────────────────────────────────────
  totalSupportTickets: MetricValue;
  openSupportTickets: MetricValue;
  ideasSubmitted: MetricValue;
  helpArticlesPublished: MetricValue;
}

const loading = (): MetricValue => ({ value: 0, loading: true });
const blankMetrics = (): Metrics => ({
  jobsCreated: loading(),
  activeJobs: loading(),
  completedJobs: loading(),
  totalReviews: loading(),
  avgReviewCountPerWorkspace: loading(),
  avgReviewRatingPerWorkspace: loading(),
  avgReviewGrowthPerWorkspace: loading(),
  totalReviewRequests: loading(),
  reviewResponseRate: loading(),
  avgReviewRatingChange: loading(),
  fiveStarRate: loading(),
  negativeReviewRate: loading(),
  totalPhotos: loading(),
  avgPhotosPerWorkspace: loading(),
  totalVideos: loading(),
  avgVideosPerWorkspace: loading(),
  totalClients: loading(),
  avgClientsPerWorkspace: loading(),
  totalWorkspaces: loading(),
  newWorkspaces: loading(),
  totalUsers: loading(),
  gmbProfilesConnected: loading(),
  totalWorkflows: loading(),
  activeWorkflows: loading(),
  workflowExecutions: loading(),
  totalSupportTickets: loading(),
  openSupportTickets: loading(),
  ideasSubmitted: loading(),
  helpArticlesPublished: loading(),
});

function fmt(v: number, decimals = 1): string {
  if (!isFinite(v) || isNaN(v)) return "—";
  return Number.isInteger(v) ? v.toString() : v.toFixed(decimals);
}

// ── Metric Card ────────────────────────────────────────────────────────────────
function MetricCard({
  title,
  metric,
  icon: Icon,
  iconColor,
  suffix = "",
  trend,
  description,
}: {
  title: string;
  metric: MetricValue;
  icon: React.ElementType;
  iconColor: string;
  suffix?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
}) {
  const displayValue = metric.loading
    ? null
    : metric.error
    ? "—"
    : `${typeof metric.value === "number" ? fmt(metric.value) : metric.value}${suffix}`;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium leading-snug">{title}</p>
            {metric.loading ? (
              <div className="h-8 w-24 mt-1 animate-pulse bg-muted rounded" />
            ) : (
              <p className="text-2xl font-bold mt-0.5 tracking-tight">{displayValue}</p>
            )}
            {description && !metric.loading && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {metric.error && (
              <p className="text-xs text-destructive mt-1">{metric.error}</p>
            )}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ml-3 flex-shrink-0 ${iconColor}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {trend && !metric.loading && (
          <div className="flex items-center gap-1 mt-3 text-xs">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}>
              {trend === "neutral" ? "No change" : trend === "up" ? "Trending up" : "Trending down"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4" /> {label}
    </h2>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SuperAdminAnalytics() {
  const [metrics, setMetrics] = useState<Metrics>(blankMetrics());
  const [dateRange, setDateRange] = useState("30");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const setMetric = (key: keyof Metrics, value: number | string, error?: string) =>
    setMetrics((prev) => ({
      ...prev,
      [key]: { value, loading: false, error },
    }));

  const fetchMetrics = useCallback(async () => {
    setIsRefreshing(true);
    setMetrics(blankMetrics());

    const days = parseInt(dateRange, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const prevCutoffStr = prevCutoff.toISOString();

    // ── Fire all queries in parallel ──────────────────────────────────────────
    const [
      jobsRes,
      activeJobsRes,
      completedJobsRes,
      reviewsRes,
      reviewRequestsRes,
      businessesRes,
      newWorkspacesRes,
      photosRes,
      videosRes,
      clientsRes,
      prevReviewsRes,
      totalUsersRes,
      gmbProfilesRes,
      totalWorkflowsRes,
      activeWorkflowsRes,
      workflowExecutionsRes,
      totalTicketsRes,
      openTicketsRes,
      ideasRes,
      helpArticlesRes,
    ] = await Promise.allSettled([
      // Jobs
      supabaseClient.from("jobs").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
      supabaseClient.from("jobs").select("id", { count: "exact", head: true }).in("status", ["active", "in_progress"]),
      supabaseClient.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      // Reviews (full data for computed metrics)
      supabaseClient.from("reviews").select("id, rating, response, created_at", { count: "exact" }).gte("created_at", cutoffStr),
      supabaseClient.from("review_requests").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
      // Workspaces
      supabaseClient.from("businesses").select("id", { count: "exact", head: true }),
      supabaseClient.from("businesses").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
      // Media (all-time)
      supabaseClient.from("job_media").select("id", { count: "exact", head: true }).eq("media_type", "image"),
      supabaseClient.from("job_media").select("id", { count: "exact", head: true }).eq("media_type", "video"),
      // Clients
      supabaseClient.from("users").select("id", { count: "exact", head: true }).eq("role", "admin"),
      // Previous period reviews for growth/rating-change
      supabaseClient.from("reviews").select("id, rating, created_at").gte("created_at", prevCutoffStr).lt("created_at", cutoffStr),
      // Platform health
      supabaseClient.from("users").select("id", { count: "exact", head: true }),
      supabaseClient.from("gmb_profiles").select("id", { count: "exact", head: true }),
      // Automation
      supabaseClient.from("workflows").select("id", { count: "exact", head: true }),
      supabaseClient.from("workflows").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseClient.from("workflow_executions").select("id", { count: "exact", head: true }).gte("started_at", cutoffStr),
      // Support & Engagement
      supabaseClient.from("support_tickets").select("id", { count: "exact", head: true }),
      supabaseClient.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in-progress"]),
      supabaseClient.from("ideas").select("id", { count: "exact", head: true }),
      supabaseClient.from("help_articles").select("id", { count: "exact", head: true }).eq("status", "published"),
    ]);

    // ── Workspace count (used as divisor) ─────────────────────────────────────
    const businessCount =
      businessesRes.status === "fulfilled" && !businessesRes.value.error
        ? (businessesRes.value.count ?? 0)
        : 1;
    const workspaces = Math.max(businessCount, 1);

    // ── Platform Health ───────────────────────────────────────────────────────
    setMetric("totalWorkspaces", businessCount);

    if (newWorkspacesRes.status === "fulfilled" && !newWorkspacesRes.value.error) {
      setMetric("newWorkspaces", newWorkspacesRes.value.count ?? 0);
    } else {
      setMetric("newWorkspaces", "—", "Could not load");
    }

    if (totalUsersRes.status === "fulfilled" && !totalUsersRes.value.error) {
      setMetric("totalUsers", totalUsersRes.value.count ?? 0);
    } else {
      setMetric("totalUsers", "—", "Could not load");
    }

    if (gmbProfilesRes.status === "fulfilled" && !gmbProfilesRes.value.error) {
      setMetric("gmbProfilesConnected", gmbProfilesRes.value.count ?? 0);
    } else {
      setMetric("gmbProfilesConnected", "—", "Could not load");
    }

    // ── Jobs ──────────────────────────────────────────────────────────────────
    if (jobsRes.status === "fulfilled" && !jobsRes.value.error) {
      setMetric("jobsCreated", jobsRes.value.count ?? 0);
    } else {
      setMetric("jobsCreated", "—", "Could not load");
    }

    if (activeJobsRes.status === "fulfilled" && !activeJobsRes.value.error) {
      setMetric("activeJobs", activeJobsRes.value.count ?? 0);
    } else {
      setMetric("activeJobs", "—", "Could not load");
    }

    if (completedJobsRes.status === "fulfilled" && !completedJobsRes.value.error) {
      setMetric("completedJobs", completedJobsRes.value.count ?? 0);
    } else {
      setMetric("completedJobs", "—", "Could not load");
    }

    // ── Reviews ───────────────────────────────────────────────────────────────
    let reviews: any[] = [];
    if (reviewsRes.status === "fulfilled" && !reviewsRes.value.error) {
      reviews = reviewsRes.value.data ?? [];
      const total = reviews.length;
      setMetric("totalReviews", total);
      setMetric("avgReviewCountPerWorkspace", total / workspaces);

      const ratingsWithValue = reviews.filter((r) => r.rating != null);
      const avgRating =
        ratingsWithValue.length > 0
          ? ratingsWithValue.reduce((s: number, r: any) => s + Number(r.rating), 0) / ratingsWithValue.length
          : 0;
      setMetric("avgReviewRatingPerWorkspace", avgRating);

      const withResponse = reviews.filter(
        (r) => r.response && (typeof r.response === "object" ? r.response.text : r.response),
      ).length;
      setMetric("reviewResponseRate", total > 0 ? (withResponse / total) * 100 : 0);

      // 5-star rate
      const fiveStar = reviews.filter((r) => Number(r.rating) === 5).length;
      setMetric("fiveStarRate", total > 0 ? (fiveStar / total) * 100 : 0);

      // Negative review rate (1-2 stars)
      const negative = reviews.filter((r) => Number(r.rating) <= 2).length;
      setMetric("negativeReviewRate", total > 0 ? (negative / total) * 100 : 0);
    } else {
      (
        [
          "totalReviews",
          "avgReviewCountPerWorkspace",
          "avgReviewRatingPerWorkspace",
          "reviewResponseRate",
          "fiveStarRate",
          "negativeReviewRate",
        ] as (keyof Metrics)[]
      ).forEach((k) => setMetric(k, "—", "Could not load"));
    }

    if (reviewRequestsRes.status === "fulfilled" && !reviewRequestsRes.value.error) {
      setMetric("totalReviewRequests", reviewRequestsRes.value.count ?? 0);
    } else {
      setMetric("totalReviewRequests", "—", "Could not load");
    }

    // Growth & rating change vs previous period
    let prevReviews: any[] = [];
    if (prevReviewsRes.status === "fulfilled" && !prevReviewsRes.value.error) {
      prevReviews = prevReviewsRes.value.data ?? [];
    }

    if (reviews.length > 0 || prevReviews.length > 0) {
      const growthPct =
        prevReviews.length > 0
          ? ((reviews.length - prevReviews.length) / prevReviews.length) * 100
          : reviews.length > 0
          ? 100
          : 0;
      setMetric("avgReviewGrowthPerWorkspace", growthPct / workspaces);

      const curAvg =
        reviews.length > 0
          ? reviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / reviews.length
          : 0;
      const prevAvg =
        prevReviews.length > 0
          ? prevReviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / prevReviews.length
          : 0;
      setMetric("avgReviewRatingChange", curAvg - prevAvg);
    } else {
      setMetric("avgReviewGrowthPerWorkspace", 0);
      setMetric("avgReviewRatingChange", 0);
    }

    // ── Media ─────────────────────────────────────────────────────────────────
    if (photosRes.status === "fulfilled" && !photosRes.value.error) {
      const totalPhotos = photosRes.value.count ?? 0;
      setMetric("totalPhotos", totalPhotos);
      setMetric("avgPhotosPerWorkspace", totalPhotos / workspaces);
    } else {
      const err =
        photosRes.status === "fulfilled" ? photosRes.value.error?.message : (photosRes as any).reason?.message;
      setMetric("totalPhotos", "—", err ?? "Could not load");
      setMetric("avgPhotosPerWorkspace", "—", err ?? "Could not load");
    }

    if (videosRes.status === "fulfilled" && !videosRes.value.error) {
      const totalVideos = videosRes.value.count ?? 0;
      setMetric("totalVideos", totalVideos);
      setMetric("avgVideosPerWorkspace", totalVideos / workspaces);
    } else {
      const err =
        videosRes.status === "fulfilled" ? videosRes.value.error?.message : (videosRes as any).reason?.message;
      setMetric("totalVideos", "—", err ?? "Could not load");
      setMetric("avgVideosPerWorkspace", "—", err ?? "Could not load");
    }

    // ── Clients ───────────────────────────────────────────────────────────────
    if (clientsRes.status === "fulfilled" && !clientsRes.value.error) {
      const totalClients = clientsRes.value.count ?? 0;
      setMetric("totalClients", totalClients);
      setMetric("avgClientsPerWorkspace", totalClients / workspaces);
    } else {
      setMetric("totalClients", "—", "Could not load");
      setMetric("avgClientsPerWorkspace", "—", "Could not load");
    }

    // ── Automation ────────────────────────────────────────────────────────────
    if (totalWorkflowsRes.status === "fulfilled" && !totalWorkflowsRes.value.error) {
      setMetric("totalWorkflows", totalWorkflowsRes.value.count ?? 0);
    } else {
      setMetric("totalWorkflows", "—", "Could not load");
    }

    if (activeWorkflowsRes.status === "fulfilled" && !activeWorkflowsRes.value.error) {
      setMetric("activeWorkflows", activeWorkflowsRes.value.count ?? 0);
    } else {
      setMetric("activeWorkflows", "—", "Could not load");
    }

    if (workflowExecutionsRes.status === "fulfilled" && !workflowExecutionsRes.value.error) {
      setMetric("workflowExecutions", workflowExecutionsRes.value.count ?? 0);
    } else {
      setMetric("workflowExecutions", "—", "Could not load");
    }

    // ── Support & Engagement ──────────────────────────────────────────────────
    if (totalTicketsRes.status === "fulfilled" && !totalTicketsRes.value.error) {
      setMetric("totalSupportTickets", totalTicketsRes.value.count ?? 0);
    } else {
      setMetric("totalSupportTickets", "—", "Could not load");
    }

    if (openTicketsRes.status === "fulfilled" && !openTicketsRes.value.error) {
      setMetric("openSupportTickets", openTicketsRes.value.count ?? 0);
    } else {
      setMetric("openSupportTickets", "—", "Could not load");
    }

    if (ideasRes.status === "fulfilled" && !ideasRes.value.error) {
      setMetric("ideasSubmitted", ideasRes.value.count ?? 0);
    } else {
      setMetric("ideasSubmitted", "—", "Could not load");
    }

    if (helpArticlesRes.status === "fulfilled" && !helpArticlesRes.value.error) {
      setMetric("helpArticlesPublished", helpArticlesRes.value.count ?? 0);
    } else {
      setMetric("helpArticlesPublished", "—", "Could not load");
    }

    setLastRefreshed(new Date());
    setIsRefreshing(false);
    toast.success("Analytics refreshed");
  }, [dateRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const growthVal =
    typeof metrics.avgReviewGrowthPerWorkspace.value === "number"
      ? metrics.avgReviewGrowthPerWorkspace.value
      : 0;
  const growthTrend: "up" | "down" | "neutral" =
    growthVal > 0 ? "up" : growthVal < 0 ? "down" : "neutral";

  const ratingChangeVal =
    typeof metrics.avgReviewRatingChange.value === "number"
      ? metrics.avgReviewRatingChange.value
      : 0;
  const ratingChangeTrend: "up" | "down" | "neutral" =
    ratingChangeVal > 0 ? "up" : ratingChangeVal < 0 ? "down" : "neutral";

  return (
    <SuperAdminLayout>
      <div className="space-y-6 px-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Platform-wide metrics across all workspaces
              {lastRefreshed && (
                <span className="ml-2 text-xs opacity-60">
                  · Last updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMetrics}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Platform Health ───────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Building2} label="Platform Health" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Workspaces"
              metric={metrics.totalWorkspaces}
              icon={Building2}
              iconColor="bg-slate-500"
              description="All-time active businesses"
            />
            <MetricCard
              title="New Workspaces"
              metric={metrics.newWorkspaces}
              icon={Building2}
              iconColor="bg-slate-400"
              description={`Added in last ${dateRange} days`}
            />
            <MetricCard
              title="Total Users"
              metric={metrics.totalUsers}
              icon={UserCheck}
              iconColor="bg-indigo-600"
              description="All registered users"
            />
            <MetricCard
              title="GMB Profiles Connected"
              metric={metrics.gmbProfilesConnected}
              icon={MapPin}
              iconColor="bg-red-500"
              description="Google Business profiles linked"
            />
          </div>
        </section>

        {/* ── Jobs ─────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Briefcase} label="Jobs" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Jobs Created"
              metric={metrics.jobsCreated}
              icon={Briefcase}
              iconColor="bg-blue-500"
              description={`Past ${dateRange} days`}
            />
            <MetricCard
              title="Active Jobs"
              metric={metrics.activeJobs}
              icon={Clock}
              iconColor="bg-blue-400"
              description="In progress or active right now"
            />
            <MetricCard
              title="Completed Jobs"
              metric={metrics.completedJobs}
              icon={CheckSquare}
              iconColor="bg-green-600"
              description="All-time completed"
            />
          </div>
        </section>

        {/* ── Reviews ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Star} label="Reviews" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Reviews Captured"
              metric={metrics.totalReviews}
              icon={Star}
              iconColor="bg-yellow-500"
              description={`Past ${dateRange} days`}
            />
            <MetricCard
              title="Avg Review Count Per Workspace"
              metric={metrics.avgReviewCountPerWorkspace}
              icon={BarChart3}
              iconColor="bg-amber-500"
              description="Reviews ÷ workspaces"
            />
            <MetricCard
              title="Avg Review Rating Per Workspace"
              metric={metrics.avgReviewRatingPerWorkspace}
              icon={Star}
              iconColor="bg-orange-500"
              suffix=" ★"
              description="Average star rating"
            />
            <MetricCard
              title="Avg Review Growth Per Workspace"
              metric={metrics.avgReviewGrowthPerWorkspace}
              icon={TrendingUp}
              iconColor="bg-green-500"
              suffix="%"
              trend={growthTrend}
              description="vs. previous period"
            />
            <MetricCard
              title="Total Review Requests"
              metric={metrics.totalReviewRequests}
              icon={Send}
              iconColor="bg-indigo-500"
              description={`Past ${dateRange} days`}
            />
            <MetricCard
              title="Reviews Response Rate"
              metric={metrics.reviewResponseRate}
              icon={CheckCircle}
              iconColor="bg-teal-500"
              suffix="%"
              description="Reviews with an owner response"
            />
            <MetricCard
              title="Avg Review Rating Change"
              metric={metrics.avgReviewRatingChange}
              icon={TrendingUp}
              iconColor="bg-purple-500"
              suffix=" ★"
              trend={ratingChangeTrend}
              description="vs. previous period"
            />
            <MetricCard
              title="5-Star Review Rate"
              metric={metrics.fiveStarRate}
              icon={ThumbsUp}
              iconColor="bg-emerald-500"
              suffix="%"
              description="Percentage of 5-star reviews"
            />
            <MetricCard
              title="Negative Review Rate"
              metric={metrics.negativeReviewRate}
              icon={AlertTriangle}
              iconColor="bg-red-400"
              suffix="%"
              description="Reviews rated 1–2 stars"
            />
          </div>
        </section>

        {/* ── Media ────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Image} label="Media" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Photos"
              metric={metrics.totalPhotos}
              icon={Image}
              iconColor="bg-pink-500"
              description="All-time across all jobs"
            />
            <MetricCard
              title="Avg Photos Per Workspace"
              metric={metrics.avgPhotosPerWorkspace}
              icon={Image}
              iconColor="bg-rose-500"
              description="Photos ÷ workspaces"
            />
            <MetricCard
              title="Total Videos"
              metric={metrics.totalVideos}
              icon={Video}
              iconColor="bg-violet-500"
              description="All-time across all jobs"
            />
            <MetricCard
              title="Avg Videos Per Workspace"
              metric={metrics.avgVideosPerWorkspace}
              icon={Video}
              iconColor="bg-purple-500"
              description="Videos ÷ workspaces"
            />
          </div>
        </section>

        {/* ── Clients ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Users} label="Clients" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Total Clients"
              metric={metrics.totalClients}
              icon={Users}
              iconColor="bg-cyan-500"
              description="Admin users across all workspaces"
            />
            <MetricCard
              title="Avg Clients Per Workspace"
              metric={metrics.avgClientsPerWorkspace}
              icon={Users}
              iconColor="bg-sky-500"
              description="Clients ÷ workspaces"
            />
          </div>
        </section>

        {/* ── Automation ───────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Zap} label="Automation" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Total Workflows"
              metric={metrics.totalWorkflows}
              icon={Zap}
              iconColor="bg-yellow-600"
              description="All-time created"
            />
            <MetricCard
              title="Active Workflows"
              metric={metrics.activeWorkflows}
              icon={PlayCircle}
              iconColor="bg-lime-500"
              description="Currently enabled"
            />
            <MetricCard
              title="Workflow Executions"
              metric={metrics.workflowExecutions}
              icon={Activity}
              iconColor="bg-orange-500"
              description={`Runs in last ${dateRange} days`}
            />
          </div>
        </section>

        {/* ── Support & Engagement ─────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={LifeBuoy} label="Support & Engagement" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Support Tickets"
              metric={metrics.totalSupportTickets}
              icon={LifeBuoy}
              iconColor="bg-blue-600"
              description="All-time submitted"
            />
            <MetricCard
              title="Open Support Tickets"
              metric={metrics.openSupportTickets}
              icon={MessageSquare}
              iconColor="bg-amber-600"
              description="Open or in-progress"
            />
            <MetricCard
              title="Ideas Submitted"
              metric={metrics.ideasSubmitted}
              icon={Lightbulb}
              iconColor="bg-yellow-500"
              description="Feature requests & ideas"
            />
            <MetricCard
              title="Help Articles Published"
              metric={metrics.helpArticlesPublished}
              icon={BookOpen}
              iconColor="bg-teal-600"
              description="Live knowledge base articles"
            />
          </div>
        </section>
      </div>
    </SuperAdminLayout>
  );
}
