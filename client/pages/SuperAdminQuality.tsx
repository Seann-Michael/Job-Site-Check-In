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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Bug,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Activity,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Star,
  Building2,
  Briefcase,
  Database,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface QaCheck {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "pass" | "fail" | "pending" | "in_progress";
  priority: "low" | "medium" | "high" | "critical";
  assigned_to: string | null;
  notes: string | null;
  last_run_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

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
  date: string;
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

const EMPTY_CHECK: Omit<QaCheck, "id" | "created_at" | "updated_at"> = {
  title: "",
  description: "",
  category: "general",
  status: "pending",
  priority: "medium",
  assigned_to: "",
  notes: "",
  last_run_at: null,
  created_by: "Super Admin",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminQuality() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [checksLoading, setChecksLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState<DataSummary>({
    totalUsers: 0, totalBusinesses: 0, totalJobs: 0, activeJobs: 0,
    totalReviews: 0, avgRating: 0, verifiedUsers: 0,
    gmbAuditTotal: 0, gmbAuditGood: 0, gmbAuditWarning: 0, gmbAuditCritical: 0,
  });
  const [auditResults, setAuditResults] = useState<GmbAuditResult[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthResult[]>([]);
  const [qaChecks, setQaChecks] = useState<QaCheck[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<QaCheck | null>(null);
  const [form, setForm] = useState(EMPTY_CHECK);
  const [deleteTarget, setDeleteTarget] = useState<QaCheck | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Fetch platform summary data ───────────────────────────────────────────
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
        supabaseClient.from("reviews").select("id, business_id, platform, rating, text, date, created_at, response").order("date", { ascending: false }).limit(50),
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
        totalReviews: ratings.length,
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

  // ── Fetch QA checks ───────────────────────────────────────────────────────
  const fetchQaChecks = useCallback(async () => {
    setChecksLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("qa_checks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQaChecks((data ?? []) as QaCheck[]);
    } catch (err: any) {
      toast.error("Failed to load QA checks: " + (err?.message ?? "Unknown"));
    } finally {
      setChecksLoading(false);
    }
  }, []);

  // ── Real health checks ────────────────────────────────────────────────────
  const runHealthChecks = useCallback(async () => {
    setHealthLoading(true);
    const tables = [
      { name: "Users", table: "users" },
      { name: "Businesses", table: "businesses" },
      { name: "Jobs", table: "jobs" },
      { name: "Reviews", table: "reviews" },
      { name: "GMB Audit Results", table: "gmb_audit_results" },
      { name: "QA Checks", table: "qa_checks" },
      { name: "Broadcast Messages", table: "broadcast_messages" },
      { name: "Event Triggers", table: "event_triggers" },
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
            name, table,
            status: ms < 300 ? "healthy" : ms < 800 ? "warning" : "error",
            responseMs: ms,
            rowCount: count ?? 0,
            checkedAt: new Date().toISOString(),
          } as HealthResult;
        } catch {
          return {
            name, table,
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
    fetchQaChecks();
    runHealthChecks();
  }, [fetchData, fetchQaChecks, runHealthChecks]);

  // ── CRUD: Save (create / update) ──────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        category: form.category,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to?.trim() || null,
        notes: form.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingCheck) {
        const { error } = await supabaseClient
          .from("qa_checks")
          .update(payload)
          .eq("id", editingCheck.id);
        if (error) throw error;
        toast.success("QA check updated");
      } else {
        const { error } = await supabaseClient
          .from("qa_checks")
          .insert({ ...payload, created_by: "Super Admin" });
        if (error) throw error;
        toast.success("QA check created");
      }

      setDialogOpen(false);
      setEditingCheck(null);
      setForm(EMPTY_CHECK);
      fetchQaChecks();
    } catch (err: any) {
      toast.error("Save failed: " + (err?.message ?? "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD: Mark as run ─────────────────────────────────────────────────────
  const markAsRun = async (check: QaCheck, newStatus: QaCheck["status"]) => {
    try {
      const { error } = await supabaseClient
        .from("qa_checks")
        .update({ status: newStatus, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", check.id);
      if (error) throw error;
      toast.success(`Marked as ${newStatus}`);
      fetchQaChecks();
    } catch (err: any) {
      toast.error("Update failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── CRUD: Delete ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabaseClient
        .from("qa_checks")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("QA check deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchQaChecks();
    } catch (err: any) {
      toast.error("Delete failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingCheck(null);
    setForm(EMPTY_CHECK);
    setDialogOpen(true);
  };

  const openEdit = (check: QaCheck) => {
    setEditingCheck(check);
    setForm({
      title: check.title,
      description: check.description ?? "",
      category: check.category,
      status: check.status,
      priority: check.priority,
      assigned_to: check.assigned_to ?? "",
      notes: check.notes ?? "",
      last_run_at: check.last_run_at,
      created_by: check.created_by,
    });
    setDialogOpen(true);
  };

  // ── Derived metrics ────────────────────────────────────────────────────────
  const gmbHealthPct = summary.gmbAuditTotal > 0
    ? Math.round((summary.gmbAuditGood / summary.gmbAuditTotal) * 100)
    : 0;

  const emailVerifiedPct = summary.totalUsers > 0
    ? Math.round((summary.verifiedUsers / summary.totalUsers) * 100)
    : 0;

  const avgRatingPct = Math.round((summary.avgRating / 5) * 100);

  const reviewResponseRate = reviews.length > 0
    ? Math.round((reviews.filter((r) => r.response).length / reviews.length) * 100)
    : 0;

  const qaPassRate = qaChecks.length > 0
    ? Math.round((qaChecks.filter((c) => c.status === "pass").length / qaChecks.length) * 100)
    : 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "good" || status === "healthy" || status === "pass")
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "critical" || status === "error" || status === "fail")
      return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === "warning")
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (status === "in_progress")
      return <Activity className="h-4 w-4 text-blue-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const impactVariant = (impact: string) =>
    impact === "high" ? "destructive" : impact === "medium" ? "default" : "secondary";

  const statusVariant = (status: string): "destructive" | "default" | "secondary" | "outline" =>
    status === "critical" || status === "error" || status === "fail"
      ? "destructive"
      : status === "warning"
      ? "default"
      : "secondary";

  const priorityVariant = (priority: string): "destructive" | "default" | "secondary" | "outline" =>
    priority === "critical" ? "destructive"
      : priority === "high" ? "default"
      : priority === "medium" ? "secondary"
      : "outline";

  const ratingStars = (rating: number) =>
    "★".repeat(Math.max(0, Math.min(5, rating))) + "☆".repeat(Math.max(0, 5 - Math.min(5, rating)));

  const SkeletonRow = ({ cols }: { cols: number }) => (
    <TableRow>
      {[...Array(cols)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-full animate-pulse bg-muted rounded" />
        </TableCell>
      ))}
    </TableRow>
  );

  const formatDate = (val: string | null) =>
    val ? new Date(val).toLocaleDateString() : "—";

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchData(); fetchQaChecks(); runHealthChecks(); }}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh All
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QA Pass Rate</CardTitle>
              <Bug className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {checksLoading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : `${qaPassRate}%`}
              </div>
              <Progress value={qaPassRate} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {qaChecks.filter((c) => c.status === "pass").length} of {qaChecks.length} checks passing
              </p>
            </CardContent>
          </Card>

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="qa-checks">QA Checks</TabsTrigger>
            <TabsTrigger value="gmb-audit">GMB Audit</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
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

              <Card>
                <CardHeader>
                  <CardTitle>QA Check Status Breakdown</CardTitle>
                  <CardDescription>Status distribution of all tracked QA checks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: "Passing", status: "pass", icon: CheckCircle, iconCls: "text-green-500", badgeCls: "text-green-700 bg-green-100" },
                      { label: "Failing", status: "fail", icon: XCircle, iconCls: "text-red-500", badgeCls: "text-red-700 bg-red-100" },
                      { label: "In Progress", status: "in_progress", icon: Activity, iconCls: "text-blue-500", badgeCls: "text-blue-700 bg-blue-100" },
                      { label: "Pending", status: "pending", icon: Clock, iconCls: "text-gray-400", badgeCls: "" },
                    ].map(({ label, status, icon: Icon, iconCls, badgeCls }) => (
                      <div key={status} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${iconCls}`} />
                          <span className="font-medium">{label}</span>
                        </div>
                        <Badge variant="secondary" className={badgeCls}>
                          {qaChecks.filter((c) => c.status === status).length}
                        </Badge>
                      </div>
                    ))}
                    <div className="pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Overall Pass Rate</span>
                        <span className="font-semibold">{qaPassRate}%</span>
                      </div>
                      <Progress value={qaPassRate} className="h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GMB audit summary */}
            <Card>
              <CardHeader>
                <CardTitle>GMB Audit Breakdown</CardTitle>
                <CardDescription>Issue counts by severity from Google Business Profile scans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Good / Passing</span>
                    </div>
                    <Badge variant="secondary" className="text-green-700 bg-green-100">{summary.gmbAuditGood}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium">Warnings</span>
                    </div>
                    <Badge variant="default">{summary.gmbAuditWarning}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Critical Issues</span>
                    </div>
                    <Badge variant="destructive">{summary.gmbAuditCritical}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── QA Checks ── */}
          <TabsContent value="qa-checks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">QA Checks</h2>
                <p className="text-sm text-muted-foreground">{qaChecks.length} checks tracked</p>
              </div>
              <Button size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add Check
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checksLoading ? (
                        [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={7} />)
                      ) : qaChecks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                            <Bug className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No QA checks yet</p>
                            <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={openCreate}>
                              <Plus className="h-4 w-4" /> Add First Check
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        qaChecks.map((check) => (
                          <TableRow key={check.id}>
                            <TableCell>
                              <div className="font-medium flex items-center gap-2">
                                <StatusIcon status={check.status} />
                                {check.title}
                              </div>
                              {check.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                                  {check.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">{check.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={priorityVariant(check.priority)} className="capitalize">
                                {check.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(check.status)} className="capitalize">
                                {check.status.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {check.assigned_to || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(check.last_run_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark Pass"
                                  onClick={() => markAsRun(check, "pass")}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark Fail"
                                  onClick={() => markAsRun(check, "fail")}
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark In Progress"
                                  onClick={() => markAsRun(check, "in_progress")}
                                >
                                  <PlayCircle className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(check)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setDeleteTarget(check); setDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
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
                        auditResults.map((item) => (
                          <TableRow key={item.id}>
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
                              {formatDate(item.scanned_at)}
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
                          <TableRow key={r.id}>
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
                              {formatDate(r.date || r.created_at)}
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
                  <CardDescription>Live response times measured against Supabase tables</CardDescription>
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
                        [...Array(8)].map((_, i) => <SkeletonRow key={i} cols={5} />)
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCheck ? "Edit QA Check" : "New QA Check"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Verify login flow works correctly"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this check verify?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["ui", "api", "data", "security", "performance", "general"].map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as QaCheck["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as QaCheck["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending", "in_progress", "pass", "fail"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Input
                  value={form.assigned_to ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="Team or person name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes or context"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingCheck ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete QA Check</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
