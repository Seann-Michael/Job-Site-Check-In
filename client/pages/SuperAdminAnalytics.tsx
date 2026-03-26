import { useState, useEffect, useCallback } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
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
  jobsCreated: MetricValue;
  totalReviews: MetricValue;
  avgReviewCountPerWorkspace: MetricValue;
  avgReviewRatingPerWorkspace: MetricValue;
  avgReviewGrowthPerWorkspace: MetricValue;
  totalReviewRequests: MetricValue;
  reviewResponseRate: MetricValue;
  totalPhotos: MetricValue;
  avgPhotosPerWorkspace: MetricValue;
  totalVideos: MetricValue;
  avgVideosPerWorkspace: MetricValue;
  totalClients: MetricValue;
  avgClientsPerWorkspace: MetricValue;
  avgReviewRatingChange: MetricValue;
}

const loading = (): MetricValue => ({ value: 0, loading: true });
const blankMetrics = (): Metrics => ({
  jobsCreated: loading(),
  totalReviews: loading(),
  avgReviewCountPerWorkspace: loading(),
  avgReviewRatingPerWorkspace: loading(),
  avgReviewGrowthPerWorkspace: loading(),
  totalReviewRequests: loading(),
  reviewResponseRate: loading(),
  totalPhotos: loading(),
  avgPhotosPerWorkspace: loading(),
  totalVideos: loading(),
  avgVideosPerWorkspace: loading(),
  totalClients: loading(),
  avgClientsPerWorkspace: loading(),
  avgReviewRatingChange: loading(),
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

    // ── Run all queries in parallel ──────────────────────────────────────────

    // 1. Jobs Created (projects table — filtered by date range)
    const jobsQuery = supabaseClient
      .from("projects")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoffStr);

    // 2. Total Reviews Captured (filtered by date range)
    const reviewsQuery = supabaseClient
      .from("reviews")
      .select("id, rating, created_at, response", { count: "exact" })
      .gte("created_at", cutoffStr);

    // 3. Total Review Requests (filtered by date range)
    const reviewRequestsQuery = supabaseClient
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoffStr);

    // 4. Total Businesses (workspaces — all time)
    const businessesQuery = supabaseClient
      .from("businesses")
      .select("id", { count: "exact", head: true });

    // 5. Photos — all-time total (project_media uses project_id, not business_id)
    const photosQuery = supabaseClient
      .from("project_media")
      .select("id", { count: "exact", head: true })
      .eq("media_type", "image");

    // 6. Videos — all-time total
    const videosQuery = supabaseClient
      .from("project_media")
      .select("id", { count: "exact", head: true })
      .eq("media_type", "video");

    // 7. Clients (users with admin role — all time)
    const clientsQuery = supabaseClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    // 8. Older reviews for growth/rating-change comparison (previous period)
    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const prevCutoffStr = prevCutoff.toISOString();

    const prevReviewsQuery = supabaseClient
      .from("reviews")
      .select("id, rating, created_at")
      .gte("created_at", prevCutoffStr)
      .lt("created_at", cutoffStr);

    const [
      jobsRes,
      reviewsRes,
      reviewRequestsRes,
      businessesRes,
      photosRes,
      videosRes,
      clientsRes,
      prevReviewsRes,
    ] = await Promise.allSettled([
      jobsQuery,
      reviewsQuery,
      reviewRequestsQuery,
      businessesQuery,
      photosQuery,
      videosQuery,
      clientsQuery,
      prevReviewsQuery,
    ]);

    const businessCount = businessesRes.status === "fulfilled" && !businessesRes.value.error
      ? (businessesRes.value.count ?? 0)
      : 1;
    const workspaces = Math.max(businessCount, 1);

    // ── Jobs Created ──────────────────────────────────────────────────────────
    if (jobsRes.status === "fulfilled" && !jobsRes.value.error) {
      setMetric("jobsCreated", jobsRes.value.count ?? 0);
    } else {
      setMetric("jobsCreated", "—", "Could not load");
    }

    // ── Reviews ──────────────────────────────────────────────────────────────
    let reviews: any[] = [];
    if (reviewsRes.status === "fulfilled" && !reviewsRes.value.error) {
      reviews = reviewsRes.value.data ?? [];
      const total = reviews.length;
      setMetric("totalReviews", total);

      // Avg review count per workspace
      setMetric("avgReviewCountPerWorkspace", total / workspaces);

      // Avg review rating per workspace
      const ratingsWithValue = reviews.filter((r) => r.rating != null);
      const avgRating = ratingsWithValue.length > 0
        ? ratingsWithValue.reduce((s: number, r: any) => s + Number(r.rating), 0) / ratingsWithValue.length
        : 0;
      setMetric("avgReviewRatingPerWorkspace", avgRating);

      // Response rate
      const withResponse = reviews.filter((r) => r.response && (typeof r.response === "object" ? r.response.text : r.response)).length;
      const responseRate = total > 0 ? (withResponse / total) * 100 : 0;
      setMetric("reviewResponseRate", responseRate);
    } else {
      ["totalReviews", "avgReviewCountPerWorkspace", "avgReviewRatingPerWorkspace", "reviewResponseRate"].forEach((k) =>
        setMetric(k as keyof Metrics, "—", "Could not load"),
      );
    }

    // ── Review Requests ───────────────────────────────────────────────────────
    if (reviewRequestsRes.status === "fulfilled" && !reviewRequestsRes.value.error) {
      setMetric("totalReviewRequests", reviewRequestsRes.value.count ?? 0);
    } else {
      setMetric("totalReviewRequests", "—", "Could not load");
    }

    // ── Growth & Rating Change (compare vs previous period) ───────────────────
    let prevReviews: any[] = [];
    if (prevReviewsRes.status === "fulfilled" && !prevReviewsRes.value.error) {
      prevReviews = prevReviewsRes.value.data ?? [];
    }

    if (reviews.length > 0 || prevReviews.length > 0) {
      // Growth per workspace (percentage change in review count)
      const growthPct = prevReviews.length > 0
        ? ((reviews.length - prevReviews.length) / prevReviews.length) * 100
        : reviews.length > 0 ? 100 : 0;
      setMetric("avgReviewGrowthPerWorkspace", growthPct / workspaces);

      // Rating change
      const curAvg = reviews.length > 0
        ? reviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / reviews.length
        : 0;
      const prevAvg = prevReviews.length > 0
        ? prevReviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / prevReviews.length
        : 0;
      setMetric("avgReviewRatingChange", curAvg - prevAvg);
    } else {
      setMetric("avgReviewGrowthPerWorkspace", 0);
      setMetric("avgReviewRatingChange", 0);
    }

    // ── Photos ────────────────────────────────────────────────────────────────
    if (photosRes.status === "fulfilled" && !photosRes.value.error) {
      const totalPhotos = photosRes.value.count ?? 0;
      setMetric("totalPhotos", totalPhotos);
      setMetric("avgPhotosPerWorkspace", totalPhotos / workspaces);
    } else {
      const photoErr = photosRes.status === "fulfilled" ? photosRes.value.error?.message : photosRes.reason?.message;
      console.error("[Analytics] Photos query failed:", photoErr);
      setMetric("totalPhotos", "—", photoErr ?? "Could not load");
      setMetric("avgPhotosPerWorkspace", "—", photoErr ?? "Could not load");
    }

    // ── Videos ────────────────────────────────────────────────────────────────
    if (videosRes.status === "fulfilled" && !videosRes.value.error) {
      const totalVideos = videosRes.value.count ?? 0;
      setMetric("totalVideos", totalVideos);
      setMetric("avgVideosPerWorkspace", totalVideos / workspaces);
    } else {
      const videoErr = videosRes.status === "fulfilled" ? videosRes.value.error?.message : videosRes.reason?.message;
      console.error("[Analytics] Videos query failed:", videoErr);
      setMetric("totalVideos", "—", videoErr ?? "Could not load");
      setMetric("avgVideosPerWorkspace", "—", videoErr ?? "Could not load");
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

    setLastRefreshed(new Date());
    setIsRefreshing(false);
    toast.success("Analytics refreshed");
  }, [dateRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Determine trend for review growth
  const growthVal = typeof metrics.avgReviewGrowthPerWorkspace.value === "number"
    ? metrics.avgReviewGrowthPerWorkspace.value : 0;
  const growthTrend: "up" | "down" | "neutral" =
    growthVal > 0 ? "up" : growthVal < 0 ? "down" : "neutral";

  const ratingChangeVal = typeof metrics.avgReviewRatingChange.value === "number"
    ? metrics.avgReviewRatingChange.value : 0;
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

        {/* ── Jobs ─────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Jobs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Jobs Created"
              metric={metrics.jobsCreated}
              icon={Briefcase}
              iconColor="bg-blue-500"
              description={`Past ${dateRange} days`}
            />
          </div>
        </section>

        {/* ── Reviews ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" /> Reviews
          </h2>
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
          </div>
        </section>

        {/* ── Media ────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Image className="h-4 w-4" /> Media
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Photos"
              metric={metrics.totalPhotos}
              icon={Image}
              iconColor="bg-pink-500"
              description="All-time across all projects"
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
              description="All-time across all projects"
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Clients
          </h2>
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

      </div>
    </SuperAdminLayout>
  );
}
