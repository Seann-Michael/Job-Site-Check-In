import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Bug,
  Shield,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
  RefreshCw,
  Eye,
  Download,
  Activity,
  Gauge,
  Heart,
  Star,
  Building2,
  Briefcase,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface GmbAuditResult {
  id: string;
  business_id: string;
  category: string;
  title: string;
  description: string | null;
  status: "critical" | "warning" | "good";
  impact: "high" | "medium" | "low";
  action_required: string | null;
  scanned_at: string | null;
}

interface ReviewRow {
  id: string;
  business_id: string;
  platform: string;
  rating: number;
  text: string;
  created_at: string;
  response: any;
}

interface HealthResult {
  name: string;
  table: string;
  status: "healthy" | "warning" | "error";
  responseMs: number;
  rowCount: number;
  checkedAt: string;
}

interface DataSummary {
  totalUsers: number;
  totalBusinesses: number;
  totalJobs: number;
  activeJobs: number;
  totalReviews: number;
  avgRating: number;
  verifiedUsers: number;
  gmbAuditTotal: number;
  gmbAuditGood: number;
  gmbAuditWarning: number;
  gmbAuditCritical: number;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminQuality() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);

  const [summary, setSummary] = useState<DataSummary>({
    totalUsers: 0, totalBusinesses: 0, totalJobs: 0, activeJobs: 0,
    totalReviews: 0, avgRating: 0, verifiedUsers: 0,
    gmbAuditTotal: 0, gmbAuditGood: 0, gmbAuditWarning: 0, gmbAuditCritical: 0,
  });
  const [auditResults, setAuditResults] = useState<GmbAuditResult[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthResult[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // ── Fetch all real data ───────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        usersRes,
        verifiedRes,
        bizRes,
        jobsRes,
        activeJobsRes,
        reviewsRes,
        ratingsRes,
        auditRes,
      ] = await Promise.all([
        supabaseClient.from("users").select("id", { count: "exact", head: true }),
        supabaseClient.from("users").select("id", { count: "exact", head: true }).eq("email_verified", true),
        supabaseClient.from("businesses").select("id", { count: "exact", head: true }),
        supabaseClient.from("jobs").select("id", { count: "exact", head: true }),
        supabaseClient.from("jobs").select("id", { count: "exact", head: true }).in("status", ["active", "in_progress"]),
        supabaseClient.from("reviews").select("id, business_id, platform, rating, text, created_at, response").order("created_at", { ascending: false }).limit(50),
        supabaseClient.from("reviews").select("rating"),
        supabaseClient.from("gmb_audit_results").select("*").order("scanned_at", { ascending: false }),
      ]);

      const ratings: number[] = (ratingsRes.data ?? []).map((r: any) => Number(r.rating));
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const audits: GmbAuditResult[] = (auditRes.data ?? []) as GmbAuditResult[];

      setSummary({
        totalUsers: usersRes.count ?? 0,
        verifiedUsers: verifiedRes.count ?? 0,
        totalBusinesses: bizRes.count ?? 0,
        totalJobs: jobsRes.count ?? 0,
        activeJobs: activeJobsRes.count ?? 0,
        totalReviews: reviewsRes.count ?? ratings.length,
        avgRating: Math.round(avgRating * 10) / 10,
        gmbAuditTotal: audits.length,
        gmbAuditGood: audits.filter((a) => a.status === "good").length,
        gmbAuditWarning: audits.filter((a) => a.status === "warning").length,
        gmbAuditCritical: audits.filter((a) => a.status === "critical").length,
      });

      setAuditResults(audits);
      setReviews((reviewsRes.data ?? []) as ReviewRow[]);
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error("Failed to load data: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Real health checks: measure actual Supabase query response times ───────
  const runHealthChecks = useCallback(async () => {
    setHealthLoading(true);
    const tables = [
      { name: "Users", table: "users" },
      { name: "Businesses", table: "businesses" },
      { name: "Jobs", table: "jobs" },
      { name: "Reviews", table: "reviews" },
      { name: "GMB Audit Results", table: "gmb_audit_results" },
      { name: "Clients", table: "clients" },
    ];

    const results: HealthResult[] = await Promise.all(
      tables.map(async ({ name, table }) => {
        const start = performance.now();
        try {
          const { count, error } = await supabaseClient
            .from(table)
            .select("id", { count: "exact", head: true });
          const ms = Math.round(performance.now() - start);
          if (error) throw error;
          return {
            name,
            table,
            status: ms < 300 ? "healthy" : ms < 800 ? "warning" : "error",
            responseMs: ms,
            rowCount: count ?? 0,
            checkedAt: new Date().toISOString(),
          } as HealthResult;
        } catch {
          return {
            name,
            table,
            status: "error",
            responseMs: Math.round(performance.now() - start),
            rowCount: 0,
            checkedAt: new Date().toISOString(),
          } as HealthResult;
        }
      }),
    );

    setHealthChecks(results);
    setHealthLoading(false);
    toast.success("Health checks complete");
  }, []);

  useEffect(() => {
    fetchData();
    runHealthChecks();
  }, [fetchData, runHealthChecks]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const gmbHealthPct =
    summary.gmbAuditTotal > 0
      ? Math.round((summary.gmbAuditGood / summary.gmbAuditTotal) * 100)
      : 0;

  const emailVerifiedPct =
    summary.totalUsers > 0
      ? Math.round((summary.verifiedUsers / summary.totalUsers) * 100)
      : 0;

  const avgRatingPct = Math.round((summary.avgRating / 5) * 100);

  const reviewResponseRate =
    reviews.length > 0
      ? Math.round((reviews.filter((r) => r.response).length / reviews.length) * 100)
      : 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "good" || status === "healthy")
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "critical" || status === "error")
      return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === "warning")
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const impactVariant = (impact: string) =>
    impact === "high" ? "destructive" : impact === "medium" ? "default" : "secondary";

  const statusVariant = (status: string) =>
    status === "critical" || status === "error"
      ? "destructive"
      : status === "warning"
      ? "default"
      : "secondary";

  const ratingStars = (rating: number) =>
    "★".repeat(rating) + "☆".repeat(5 - rating);

  const SkeletonRow = ({ cols }: { cols: number }) => (
    <TableRow>
      {[...Array(cols)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-full animate-pulse bg-muted rounded" />
        </TableCell>
      ))}
    </TableRow>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quality Assurance</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live data · Last refreshed {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchData(); runHealthChecks(); }}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Review Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : `${summary.avgRating}★`}
              </div>
              <Progress value={avgRatingPct} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{summary.totalReviews} reviews total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">GMB Health Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : `${gmbHealthPct}%`}
              </div>
              <Progress value={gmbHealthPct} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.gmbAuditCritical > 0 ? `${summary.gmbAuditCritical} critical` : "No critical issues"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Verified</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : `${emailVerifiedPct}%`}
              </div>
              <Progress value={emailVerifiedPct} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.verifiedUsers} of {summary.totalUsers} users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Review Response Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : `${reviewResponseRate}%`}
              </div>
              <Progress value={reviewResponseRate} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {reviews.filter((r) => r.response).length} of {reviews.length} responded
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gmb-audit">GMB Audit</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Platform stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Platform Data Summary</CardTitle>
                  <CardDescription>Live record counts from Supabase</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Total Users", value: summary.totalUsers, icon: Users },
                      { label: "Total Businesses", value: summary.totalBusinesses, icon: Building2 },
                      { label: "Total Jobs", value: summary.totalJobs, icon: Briefcase },
                      { label: "Active Jobs", value: summary.activeJobs, icon: Activity },
                      { label: "Total Reviews", value: summary.totalReviews, icon: Star },
                      { label: "GMB Audit Items", value: summary.gmbAuditTotal, icon: Shield },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{label}</span>
                        </div>
                        {loading ? (
                          <div className="h-5 w-10 animate-pulse bg-background rounded" />
                        ) : (
                          <span className="font-bold text-lg">{value.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* GMB audit summary */}
              <Card>
                <CardHeader>
                  <CardTitle>GMB Audit Breakdown</CardTitle>
                  <CardDescription>Issue counts by severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Good / Passing</span>
                      </div>
                      <Badge variant="secondary" className="text-green-700 bg-green-100">{summary.gmbAuditGood}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">Warnings</span>
                      </div>
                      <Badge variant="default">{summary.gmbAuditWarning}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="font-medium">Critical Issues</span>
                      </div>
                      <Badge variant="destructive">{summary.gmbAuditCritical}</Badge>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Overall Health</span>
                        <span className="font-semibold">{gmbHealthPct}%</span>
                      </div>
                      <Progress value={gmbHealthPct} className="h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── GMB Audit ── */}
          <TabsContent value="gmb-audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GMB Audit Results</CardTitle>
                <CardDescription>Real audit data from your Google Business Profile scans</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Impact</TableHead>
                        <TableHead>Action Required</TableHead>
                        <TableHead>Scanned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                      ) : auditResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No audit results yet</p>
                            <p className="text-sm mt-1">Run a GMB audit to see results here</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditResults.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <StatusIcon status={item.status} />
                                {item.title}
                              </div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(item.status)} className="capitalize">
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={impactVariant(item.impact)} className="capitalize">
                                {item.impact}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs">
                              {item.action_required ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {item.scanned_at ? new Date(item.scanned_at).toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reviews ── */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
                <CardDescription>Latest {reviews.length} reviews across all platforms</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="min-w-[300px]">Review</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(6)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : reviews.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No reviews yet</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        reviews.map((r) => (
                          <TableRow key={r.id} className="group">
                            <TableCell>
                              <Badge variant="outline" className="capitalize">{r.platform}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-amber-500 text-sm font-medium">{ratingStars(r.rating)}</span>
                              <span className="text-xs text-muted-foreground ml-1">({r.rating}/5)</span>
                            </TableCell>
                            <TableCell className="text-sm max-w-xs">
                              <p className="line-clamp-2">{r.text}</p>
                            </TableCell>
                            <TableCell>
                              {r.response ? (
                                <Badge variant="secondary">Responded</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">No response</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(r.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Monitoring ── */}
          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Database Health Checks</CardTitle>
                  <CardDescription>
                    Live response times measured against Supabase tables
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runHealthChecks}
                  disabled={healthLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${healthLoading ? "animate-spin" : ""}`} />
                  Run Checks
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service / Table</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Row Count</TableHead>
                        <TableHead>Checked At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthLoading ? (
                        [...Array(6)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : healthChecks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                            <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No health checks run yet</p>
                            <Button variant="outline" size="sm" className="mt-3" onClick={runHealthChecks}>
                              Run Health Checks
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        healthChecks.map((check) => (
                          <TableRow key={check.table}>
                            <TableCell>
                              <div className="font-medium">{check.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{check.table}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StatusIcon status={check.status} />
                                <span className="capitalize">{check.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  check.responseMs < 300
                                    ? "text-green-600 font-medium"
                                    : check.responseMs < 800
                                    ? "text-yellow-600 font-medium"
                                    : "text-red-600 font-medium"
                                }
                              >
                                {check.responseMs}ms
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">{check.rowCount.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(check.checkedAt).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
