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
  ThumbsUp,
  AlertTriangle,
  CheckSquare,
  Clock,
  Eye,
  BookOpen,
  Megaphone,
  Zap,
  MapPin,
  LogIn,
  UserPlus,
  Shield,
  UserCheck,
  ShieldAlert,
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
  // Jobs
  jobsCreated: MetricValue;
  activeJobs: MetricValue;
  completedJobs: MetricValue;
  // Reviews
  totalReviews: MetricValue;
  avgReviewCountPerWorkspace: MetricValue;
  avgReviewRatingPerWorkspace: MetricValue;
  avgReviewGrowthPerWorkspace: MetricValue;
  totalReviewRequests: MetricValue;
  reviewResponseRate: MetricValue;
  avgReviewRatingChange: MetricValue;
  fiveStarRate: MetricValue;
  negativeReviewRate: MetricValue;
  // Media
  totalPhotos: MetricValue;
  avgPhotosPerWorkspace: MetricValue;
  totalVideos: MetricValue;
  avgVideosPerWorkspace: MetricValue;
  // Clients
  totalClients: MetricValue;
  avgClientsPerWorkspace: MetricValue;
  // Engagement
  engReviewViewRate: MetricValue;
  engHelpCenterViews: MetricValue;
  engBroadcastViews: MetricValue;
  engTriggerFires: MetricValue;
  engGmbAudits: MetricValue;
  engIdeaUpvotes: MetricValue;
  // Login / Auth
  loginActive: MetricValue;
  loginNewRegs: MetricValue;
  loginVerified: MetricValue;
  login2fa: MetricValue;
  loginTotal: MetricValue;
  loginAuthErrors: MetricValue;
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
  engReviewViewRate: loading(),
  engHelpCenterViews: loading(),
  engBroadcastViews: loading(),
  engTriggerFires: loading(),
  engGmbAudits: loading(),
  engIdeaUpvotes: loading(),
  loginActive: loading(),
  loginNewRegs: loading(),
  loginVerified: loading(),
  login2fa: loading(),
  loginTotal: loading(),
  loginAuthErrors: loading(),
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
            <span
              className={
                trend === "up"
                  ? "text-green-600"
                  : trend === "down"
                  ? "text-red-600"
                  : "text-muted-foreground"
              }
            >
              {trend === "neutral" ? "No change" : trend === "up" ? "Trending up" : "Trending down"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4" /> {label}
    </h2>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SuperAdminAnalytics({ embedded = false }: { embedded?: boolean }) {
  const [metrics, setMetrics] = useState<Metrics>(blankMetrics());
  const [dateRange, setDateRange] = useState("30");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const setMetric = (key: keyof Metrics, value: number | string, error?: string) =>
    setMetrics((prev) => ({ ...prev, [key]: { value, loading: false, error } }));

  const fetchMetrics = useCallback(async ({ notify = false }: { notify?: boolean } = {}) => {
    setIsRefreshing(true);
    setMetrics(blankMetrics());

    const days = parseInt(dateRange, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const prevCutoffStr = prevCutoff.toISOString();

    const [
      jobsRes,
      activeJobsRes,
      completedJobsRes,
      reviewsRes,
      reviewRequestsRes,
      reviewRequestsViewedRes,
      businessesRes,
      photosRes,
      videosRes,
      clientsRes,
      prevReviewsRes,
      helpArticlesViewsRes,
      broadcastViewsRes,
      triggerFiresRes,
      gmbAuditsRes,
      ideaUpvotesRes,
      loginTotalRes,
      loginActiveRes,
      loginNewRegsRes,
      loginVerifiedRes,
      login2faRes,
      loginAuthErrorsRes,
    ] = await Promise.allSettled([
      // Jobs
      supabaseClient.from("jobs").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
      supabaseClient.from("jobs").select("id", { count: "exact", head: true }).in("status", ["active", "in_progress"]),
      supabaseClient.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      // Reviews (full data for computed metrics)
      supabaseClient.from("reviews").select("id, rating, response", { count: "exact" }).gte("created_at", cutoffStr),
      supabaseClient.from("review_requests").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
      supabaseClient.from("review_requests").select("id", { count: "exact", head: true }).not("viewed_at", "is", null),
      // Workspaces (divisor)
      supabaseClient.from("businesses").select("id", { count: "exact", head: true }),
      // Media (all-time)
      supabaseClient.from("job_media").select("id", { count: "exact", head: true }).eq("media_type", "image"),
      supabaseClient.from("job_media").select("id", { count: "exact", head: true }).eq("media_type", "video"),
      // Clients
      supabaseClient.from("users").select("id", { count: "exact", head: true }).eq("role", "admin"),
      // Previous period reviews
      supabaseClient.from("reviews").select("id, rating").gte("created_at", prevCutoffStr).lt("created_at", cutoffStr),
      // Engagement
      supabaseClient.from("help_articles").select("views"),
      supabaseClient.from("broadcast_messages").select("view_count").eq("status", "sent"),
      supabaseClient.from("event_triggers").select("trigger_count"),
      supabaseClient.from("gmb_audit_results").select("id", { count: "exact", head: true }),
      supabaseClient.from("ideas").select("upvotes"),
      // Login / Auth
      supabaseClient.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "login").gte("created_at", cutoffStr),
      supabaseClient.from("users").select("id", { count: "exact", head: true }).not("last_login", "is", null).gte("last_login", cutoffStr),
      supabaseClient.from("users").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
      supabaseClient.from("users").select("id", { count: "exact", head: true }).eq("email_verified", true),
      supabaseClient.from("users").select("id", { count: "exact", head: true }).eq("is_2fa_enabled", true),
      supabaseClient.from("crash_logs").select("id", { count: "exact", head: true }).gte("created_at", cutoffStr),
    ]);

    // Workspace divisor
    const businessCount =
      businessesRes.status === "fulfilled" && !businessesRes.value.error
        ? (businessesRes.value.count ?? 0)
        : 1;
    const workspaces = Math.max(businessCount, 1);

    // ── Jobs ──────────────────────────────────────────────────────────────────
    if (jobsRes.status === "fulfilled" && !jobsRes.value.error)
      setMetric("jobsCreated", jobsRes.value.count ?? 0);
    else setMetric("jobsCreated", "—", "Could not load");

    if (activeJobsRes.status === "fulfilled" && !activeJobsRes.value.error)
      setMetric("activeJobs", activeJobsRes.value.count ?? 0);
    else setMetric("activeJobs", "—", "Could not load");

    if (completedJobsRes.status === "fulfilled" && !completedJobsRes.value.error)
      setMetric("completedJobs", completedJobsRes.value.count ?? 0);
    else setMetric("completedJobs", "—", "Could not load");

    // ── Reviews ───────────────────────────────────────────────────────────────
    let reviews: any[] = [];
    if (reviewsRes.status === "fulfilled" && !reviewsRes.value.error) {
      reviews = reviewsRes.value.data ?? [];
      const total = reviews.length;
      setMetric("totalReviews", total);
      setMetric("avgReviewCountPerWorkspace", total / workspaces);

      const rated = reviews.filter((r) => r.rating != null);
      const avgRating =
        rated.length > 0 ? rated.reduce((s: number, r: any) => s + Number(r.rating), 0) / rated.length : 0;
      setMetric("avgReviewRatingPerWorkspace", avgRating);

      const withResponse = reviews.filter(
        (r) => r.response && (typeof r.response === "object" ? r.response.text : r.response),
      ).length;
      setMetric("reviewResponseRate", total > 0 ? (withResponse / total) * 100 : 0);
      setMetric("fiveStarRate", total > 0 ? (reviews.filter((r) => Number(r.rating) === 5).length / total) * 100 : 0);
      setMetric("negativeReviewRate", total > 0 ? (reviews.filter((r) => Number(r.rating) <= 2).length / total) * 100 : 0);
    } else {
      (["totalReviews", "avgReviewCountPerWorkspace", "avgReviewRatingPerWorkspace", "reviewResponseRate", "fiveStarRate", "negativeReviewRate"] as (keyof Metrics)[])
        .forEach((k) => setMetric(k, "—", "Could not load"));
    }

    if (reviewRequestsRes.status === "fulfilled" && !reviewRequestsRes.value.error)
      setMetric("totalReviewRequests", reviewRequestsRes.value.count ?? 0);
    else setMetric("totalReviewRequests", "—", "Could not load");

    let prevReviews: any[] = [];
    if (prevReviewsRes.status === "fulfilled" && !prevReviewsRes.value.error)
      prevReviews = prevReviewsRes.value.data ?? [];

    if (reviews.length > 0 || prevReviews.length > 0) {
      const growthPct =
        prevReviews.length > 0
          ? ((reviews.length - prevReviews.length) / prevReviews.length) * 100
          : reviews.length > 0 ? 100 : 0;
      setMetric("avgReviewGrowthPerWorkspace", growthPct / workspaces);
      const curAvg = reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / reviews.length : 0;
      const prevAvg = prevReviews.length > 0 ? prevReviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / prevReviews.length : 0;
      setMetric("avgReviewRatingChange", curAvg - prevAvg);
    } else {
      setMetric("avgReviewGrowthPerWorkspace", 0);
      setMetric("avgReviewRatingChange", 0);
    }

    // ── Media ─────────────────────────────────────────────────────────────────
    if (photosRes.status === "fulfilled" && !photosRes.value.error) {
      const n = photosRes.value.count ?? 0;
      setMetric("totalPhotos", n);
      setMetric("avgPhotosPerWorkspace", n / workspaces);
    } else {
      setMetric("totalPhotos", "—", "Could not load");
      setMetric("avgPhotosPerWorkspace", "—", "Could not load");
    }

    if (videosRes.status === "fulfilled" && !videosRes.value.error) {
      const n = videosRes.value.count ?? 0;
      setMetric("totalVideos", n);
      setMetric("avgVideosPerWorkspace", n / workspaces);
    } else {
      setMetric("totalVideos", "—", "Could not load");
      setMetric("avgVideosPerWorkspace", "—", "Could not load");
    }

    // ── Clients ───────────────────────────────────────────────────────────────
    if (clientsRes.status === "fulfilled" && !clientsRes.value.error) {
      const n = clientsRes.value.count ?? 0;
      setMetric("totalClients", n);
      setMetric("avgClientsPerWorkspace", n / workspaces);
    } else {
      setMetric("totalClients", "—", "Could not load");
      setMetric("avgClientsPerWorkspace", "—", "Could not load");
    }

    // ── Engagement ────────────────────────────────────────────────────────────
    // Review request view rate
    const rrTotal =
      reviewRequestsRes.status === "fulfilled" && !reviewRequestsRes.value.error
        ? (reviewRequestsRes.value.count ?? 0)
        : null;
    const rrViewed =
      reviewRequestsViewedRes.status === "fulfilled" && !reviewRequestsViewedRes.value.error
        ? (reviewRequestsViewedRes.value.count ?? 0)
        : null;
    if (rrTotal !== null && rrViewed !== null) {
      setMetric("engReviewViewRate", rrTotal > 0 ? (rrViewed / rrTotal) * 100 : 0);
    } else {
      setMetric("engReviewViewRate", "—", "Could not load");
    }

    // Help center views
    if (helpArticlesViewsRes.status === "fulfilled" && !helpArticlesViewsRes.value.error) {
      const totalViews = (helpArticlesViewsRes.value.data ?? []).reduce(
        (s: number, r: any) => s + (Number(r.views) || 0), 0,
      );
      setMetric("engHelpCenterViews", totalViews);
    } else {
      setMetric("engHelpCenterViews", "—", "Could not load");
    }

    // Broadcast message views
    if (broadcastViewsRes.status === "fulfilled" && !broadcastViewsRes.value.error) {
      const totalViews = (broadcastViewsRes.value.data ?? []).reduce(
        (s: number, r: any) => s + (Number(r.view_count) || 0), 0,
      );
      setMetric("engBroadcastViews", totalViews);
    } else {
      setMetric("engBroadcastViews", "—", "Could not load");
    }

    // Event trigger fires
    if (triggerFiresRes.status === "fulfilled" && !triggerFiresRes.value.error) {
      const totalFires = (triggerFiresRes.value.data ?? []).reduce(
        (s: number, r: any) => s + (Number(r.trigger_count) || 0), 0,
      );
      setMetric("engTriggerFires", totalFires);
    } else {
      setMetric("engTriggerFires", "—", "Could not load");
    }

    // GMB audits
    if (gmbAuditsRes.status === "fulfilled" && !gmbAuditsRes.value.error)
      setMetric("engGmbAudits", gmbAuditsRes.value.count ?? 0);
    else setMetric("engGmbAudits", "—", "Could not load");

    // Idea upvotes
    if (ideaUpvotesRes.status === "fulfilled" && !ideaUpvotesRes.value.error) {
      const totalVotes = (ideaUpvotesRes.value.data ?? []).reduce(
        (s: number, r: any) => s + (Number(r.upvotes) || 0), 0,
      );
      setMetric("engIdeaUpvotes", totalVotes);
    } else {
      setMetric("engIdeaUpvotes", "—", "Could not load");
    }

    // ── Login / Auth ──────────────────────────────────────────────────────────
    if (loginTotalRes.status === "fulfilled" && !loginTotalRes.value.error)
      setMetric("loginTotal", loginTotalRes.value.count ?? 0);
    else setMetric("loginTotal", "—", "Could not load");

    if (loginActiveRes.status === "fulfilled" && !loginActiveRes.value.error)
      setMetric("loginActive", loginActiveRes.value.count ?? 0);
    else setMetric("loginActive", "—", "Could not load");

    if (loginNewRegsRes.status === "fulfilled" && !loginNewRegsRes.value.error)
      setMetric("loginNewRegs", loginNewRegsRes.value.count ?? 0);
    else setMetric("loginNewRegs", "—", "Could not load");

    if (loginVerifiedRes.status === "fulfilled" && !loginVerifiedRes.value.error)
      setMetric("loginVerified", loginVerifiedRes.value.count ?? 0);
    else setMetric("loginVerified", "—", "Could not load");

    if (login2faRes.status === "fulfilled" && !login2faRes.value.error)
      setMetric("login2fa", login2faRes.value.count ?? 0);
    else setMetric("login2fa", "—", "Could not load");

    if (loginAuthErrorsRes.status === "fulfilled" && !loginAuthErrorsRes.value.error)
      setMetric("loginAuthErrors", loginAuthErrorsRes.value.count ?? 0);
    else setMetric("loginAuthErrors", "—", "Could not load");

    setLastRefreshed(new Date());
    setIsRefreshing(false);
    if (notify) toast.success("Analytics refreshed");
  }, [dateRange]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const growthVal = typeof metrics.avgReviewGrowthPerWorkspace.value === "number" ? metrics.avgReviewGrowthPerWorkspace.value : 0;
  const growthTrend: "up" | "down" | "neutral" = growthVal > 0 ? "up" : growthVal < 0 ? "down" : "neutral";

  const ratingChangeVal = typeof metrics.avgReviewRatingChange.value === "number" ? metrics.avgReviewRatingChange.value : 0;
  const ratingChangeTrend: "up" | "down" | "neutral" = ratingChangeVal > 0 ? "up" : ratingChangeVal < 0 ? "down" : "neutral";

  const content = (
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
              onClick={() => fetchMetrics({ notify: true })}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Jobs ─────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Briefcase} label="Jobs" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard title="Jobs Created" metric={metrics.jobsCreated} icon={Briefcase} iconColor="bg-blue-500" description={`Past ${dateRange} days`} />
            <MetricCard title="Active Jobs" metric={metrics.activeJobs} icon={Clock} iconColor="bg-blue-400" description="In progress or active right now" />
            <MetricCard title="Completed Jobs" metric={metrics.completedJobs} icon={CheckSquare} iconColor="bg-green-600" description="All-time completed" />
          </div>
        </section>

        {/* ── Reviews ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Star} label="Reviews" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard title="Total Reviews Captured" metric={metrics.totalReviews} icon={Star} iconColor="bg-yellow-500" description={`Past ${dateRange} days`} />
            <MetricCard title="Avg Review Count Per Workspace" metric={metrics.avgReviewCountPerWorkspace} icon={BarChart3} iconColor="bg-amber-500" description="Reviews ÷ workspaces" />
            <MetricCard title="Avg Review Rating Per Workspace" metric={metrics.avgReviewRatingPerWorkspace} icon={Star} iconColor="bg-orange-500" suffix=" ★" description="Average star rating" />
            <MetricCard title="Avg Review Growth Per Workspace" metric={metrics.avgReviewGrowthPerWorkspace} icon={TrendingUp} iconColor="bg-green-500" suffix="%" trend={growthTrend} description="vs. previous period" />
            <MetricCard title="Total Review Requests" metric={metrics.totalReviewRequests} icon={Send} iconColor="bg-indigo-500" description={`Past ${dateRange} days`} />
            <MetricCard title="Reviews Response Rate" metric={metrics.reviewResponseRate} icon={CheckCircle} iconColor="bg-teal-500" suffix="%" description="Reviews with an owner response" />
            <MetricCard title="Avg Review Rating Change" metric={metrics.avgReviewRatingChange} icon={TrendingUp} iconColor="bg-purple-500" suffix=" ★" trend={ratingChangeTrend} description="vs. previous period" />
            <MetricCard title="5-Star Review Rate" metric={metrics.fiveStarRate} icon={ThumbsUp} iconColor="bg-emerald-500" suffix="%" description="Percentage of 5-star reviews" />
            <MetricCard title="Negative Review Rate" metric={metrics.negativeReviewRate} icon={AlertTriangle} iconColor="bg-red-400" suffix="%" description="Reviews rated 1–2 stars" />
          </div>
        </section>

        {/* ── Media ────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Image} label="Media" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Total Photos" metric={metrics.totalPhotos} icon={Image} iconColor="bg-pink-500" description="All-time across all jobs" />
            <MetricCard title="Avg Photos Per Workspace" metric={metrics.avgPhotosPerWorkspace} icon={Image} iconColor="bg-rose-500" description="Photos ÷ workspaces" />
            <MetricCard title="Total Videos" metric={metrics.totalVideos} icon={Video} iconColor="bg-violet-500" description="All-time across all jobs" />
            <MetricCard title="Avg Videos Per Workspace" metric={metrics.avgVideosPerWorkspace} icon={Video} iconColor="bg-purple-500" description="Videos ÷ workspaces" />
          </div>
        </section>

        {/* ── Clients ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Users} label="Clients" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard title="Total Clients" metric={metrics.totalClients} icon={Users} iconColor="bg-cyan-500" description="Admin users across all workspaces" />
            <MetricCard title="Avg Clients Per Workspace" metric={metrics.avgClientsPerWorkspace} icon={Users} iconColor="bg-sky-500" description="Clients ÷ workspaces" />
          </div>
        </section>

        {/* ── Engagement Analytics ─────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={BarChart3} label="Engagement Analytics" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Review Request View Rate"
              metric={metrics.engReviewViewRate}
              icon={Eye}
              iconColor="bg-indigo-500"
              suffix="%"
              description="Requests opened by customers (all-time)"
            />
            <MetricCard
              title="Help Center Total Views"
              metric={metrics.engHelpCenterViews}
              icon={BookOpen}
              iconColor="bg-teal-500"
              description="Cumulative article page views"
            />
            <MetricCard
              title="Broadcast Message Views"
              metric={metrics.engBroadcastViews}
              icon={Megaphone}
              iconColor="bg-orange-500"
              description="Total views on sent broadcasts"
            />
            <MetricCard
              title="Automation Trigger Fires"
              metric={metrics.engTriggerFires}
              icon={Zap}
              iconColor="bg-yellow-600"
              description="Total times event triggers have fired"
            />
            <MetricCard
              title="GMB Audits Performed"
              metric={metrics.engGmbAudits}
              icon={MapPin}
              iconColor="bg-red-500"
              description="Google Business audit checks run"
            />
            <MetricCard
              title="Total Idea Upvotes"
              metric={metrics.engIdeaUpvotes}
              icon={ThumbsUp}
              iconColor="bg-emerald-500"
              description="Community votes on feature ideas"
            />
          </div>
        </section>

        {/* ── Login & Auth Analytics ───────────────────────────────────────── */}
        <section>
          <SectionHeader icon={LogIn} label="Login & Auth Analytics" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Sign-ins"
              metric={metrics.loginTotal}
              icon={LogIn}
              iconColor="bg-blue-600"
              description={`Audit log logins past ${dateRange} days`}
            />
            <MetricCard
              title="Active Users"
              metric={metrics.loginActive}
              icon={UserCheck}
              iconColor="bg-green-500"
              description={`Users who logged in past ${dateRange} days`}
            />
            <MetricCard
              title="New Registrations"
              metric={metrics.loginNewRegs}
              icon={UserPlus}
              iconColor="bg-indigo-500"
              description={`New user accounts past ${dateRange} days`}
            />
            <MetricCard
              title="Email Verified Accounts"
              metric={metrics.loginVerified}
              icon={CheckCircle}
              iconColor="bg-teal-500"
              description="All-time verified users"
            />
            <MetricCard
              title="2FA Enabled Users"
              metric={metrics.login2fa}
              icon={Shield}
              iconColor="bg-purple-600"
              description="Accounts with 2-factor auth on"
            />
            <MetricCard
              title="Application Errors"
              metric={metrics.loginAuthErrors}
              icon={ShieldAlert}
              iconColor="bg-red-500"
              description={`Crash log entries past ${dateRange} days`}
            />
          </div>
        </section>
    </div>
  );

  return embedded ? content : <SuperAdminLayout>{content}</SuperAdminLayout>;
}
