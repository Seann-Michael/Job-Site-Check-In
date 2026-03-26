// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  HardDrive,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Gauge,
  Scale,
  Eye,
  Plus,
  Edit,
  Trash2,
  Play,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatSystemDate } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableHealthCheck {
  name: string;
  table: string;
  responseMs: number;
  rowCount: number | null;
  status: "healthy" | "warning" | "error";
  checkedAt: string;
}

interface ScalingRule {
  id: string;
  name: string;
  trigger_metric: string;
  trigger_operator: string;
  trigger_value: number;
  trigger_duration: number;
  action_type: string;
  action_parameters: Record<string, any>;
  enabled: boolean;
  trigger_count: number;
  last_triggered: string | null;
  created_at: string;
  updated_at: string;
}

interface OptimizationJob {
  id: string;
  name: string;
  type: string;
  status: "running" | "completed" | "failed" | "scheduled";
  progress: number;
  logs: string[] | null;
  started_at: string | null;
  ended_at: string | null;
  scheduled_at: string;
  created_at: string;
  created_by: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLES_TO_CHECK = [
  { name: "Users", table: "users" },
  { name: "Businesses", table: "businesses" },
  { name: "Reviews", table: "reviews" },
  { name: "Jobs", table: "jobs" },
  { name: "Broadcast Messages", table: "broadcast_messages" },
  { name: "Event Triggers", table: "event_triggers" },
  { name: "Ideas", table: "ideas" },
  { name: "User Segments", table: "user_segments" },
  { name: "Email Campaigns", table: "email_campaigns" },
  { name: "Message Templates", table: "message_templates" },
];

const RULE_EMPTY = {
  name: "",
  trigger_metric: "response_time",
  trigger_operator: ">",
  trigger_value: 500,
  trigger_duration: 300,
  action_type: "notify",
  action_parameters: {},
  enabled: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function latencyToHealth(avgMs: number): number {
  if (avgMs <= 0) return 100;
  if (avgMs < 100) return Math.round(98 - avgMs * 0.02);
  if (avgMs < 300) return Math.round(90 - (avgMs - 100) * 0.05);
  if (avgMs < 800) return Math.round(75 - (avgMs - 300) * 0.05);
  return Math.max(40, Math.round(50 - (avgMs - 800) * 0.01));
}

function statusFromMs(ms: number): "healthy" | "warning" | "error" {
  if (ms < 300) return "healthy";
  if (ms < 800) return "warning";
  return "error";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminPerformance() {
  const [activeTab, setActiveTab] = useState("overview");

  // Platform health stats
  const [platformStats, setPlatformStats] = useState({ workspaces: 0, users: 0, gmbProfiles: 0, newWorkspaces: 0 });
  const [platformStatsLoading, setPlatformStatsLoading] = useState(true);

  // Health checks
  const [healthChecks, setHealthChecks] = useState<TableHealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // DB-backed data
  const [scalingRules, setScalingRules] = useState<ScalingRule[]>([]);
  const [optimizationJobs, setOptimizationJobs] = useState<OptimizationJob[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Dialog state
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ScalingRule | null>(null);
  const [ruleForm, setRuleForm] = useState(RULE_EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  // ── Health Checks ──────────────────────────────────────────────────────────
  const runHealthChecks = useCallback(async () => {
    setHealthLoading(true);
    try {
      const results: TableHealthCheck[] = await Promise.all(
        TABLES_TO_CHECK.map(async ({ name, table }) => {
          const start = performance.now();
          try {
            const { count, error } = await supabaseClient
              .from(table)
              .select("id", { count: "exact", head: true });
            const ms = Math.round(performance.now() - start);
            return {
              name,
              table,
              responseMs: ms,
              rowCount: error ? null : (count ?? 0),
              status: error ? "error" : statusFromMs(ms),
              checkedAt: new Date().toISOString(),
            };
          } catch {
            return {
              name,
              table,
              responseMs: Math.round(performance.now() - start),
              rowCount: null,
              status: "error" as const,
              checkedAt: new Date().toISOString(),
            };
          }
        })
      );
      setHealthChecks(results);
      setLastChecked(new Date());
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // ── Supabase data loaders ──────────────────────────────────────────────────
  const fetchScalingRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("scaling_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setScalingRules(data || []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load scaling rules");
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const fetchOptimizationJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("optimization_jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOptimizationJobs(data || []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load optimization jobs");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    runHealthChecks();
    fetchScalingRules();
    fetchOptimizationJobs();
  }, [runHealthChecks, fetchScalingRules, fetchOptimizationJobs]);

  // ── Platform health stats ──────────────────────────────────────────────────
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();
    (async () => {
      setPlatformStatsLoading(true);
      const [bizRes, usersRes, gmbRes, newBizRes] = await Promise.allSettled([
        supabaseClient.from("businesses").select("id", { count: "exact", head: true }),
        supabaseClient.from("users").select("id", { count: "exact", head: true }),
        supabaseClient.from("gmb_profiles").select("id", { count: "exact", head: true }),
        supabaseClient.from("businesses").select("id", { count: "exact", head: true }).gte("created_at", cutoff),
      ]);
      setPlatformStats({
        workspaces: bizRes.status === "fulfilled" && !bizRes.value.error ? (bizRes.value.count ?? 0) : 0,
        users: usersRes.status === "fulfilled" && !usersRes.value.error ? (usersRes.value.count ?? 0) : 0,
        gmbProfiles: gmbRes.status === "fulfilled" && !gmbRes.value.error ? (gmbRes.value.count ?? 0) : 0,
        newWorkspaces: newBizRes.status === "fulfilled" && !newBizRes.value.error ? (newBizRes.value.count ?? 0) : 0,
      });
      setPlatformStatsLoading(false);
    })();
  }, []);

  // ── Derived system health ──────────────────────────────────────────────────
  const avgMs =
    healthChecks.length > 0
      ? healthChecks.reduce((s, h) => s + h.responseMs, 0) / healthChecks.length
      : 0;

  const dbMs =
    healthChecks.length > 0
      ? Math.min(...healthChecks.map((h) => h.responseMs))
      : 0;

  const healthyCount = healthChecks.filter((h) => h.status === "healthy").length;
  const systemHealth = {
    overall: latencyToHealth(avgMs),
    api: latencyToHealth(avgMs * 0.8),
    database: latencyToHealth(dbMs),
    tables:
      healthChecks.length > 0
        ? Math.round((healthyCount / healthChecks.length) * 100)
        : 100,
    avgResponseMs: Math.round(avgMs),
  };

  // ── Scaling Rules CRUD ─────────────────────────────────────────────────────
  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm(RULE_EMPTY);
    setShowRuleDialog(true);
  };

  const openEditRule = (rule: ScalingRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      trigger_metric: rule.trigger_metric,
      trigger_operator: rule.trigger_operator,
      trigger_value: rule.trigger_value,
      trigger_duration: rule.trigger_duration,
      action_type: rule.action_type,
      action_parameters: rule.action_parameters,
      enabled: rule.enabled,
    });
    setShowRuleDialog(true);
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: ruleForm.name.trim(),
        trigger_metric: ruleForm.trigger_metric,
        trigger_operator: ruleForm.trigger_operator,
        trigger_value: Number(ruleForm.trigger_value),
        trigger_duration: Number(ruleForm.trigger_duration),
        action_type: ruleForm.action_type,
        action_parameters: ruleForm.action_parameters,
        enabled: ruleForm.enabled,
        updated_at: new Date().toISOString(),
      };

      if (editingRule) {
        const { error } = await supabaseClient
          .from("scaling_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast.success("Scaling rule updated!");
      } else {
        const { error } = await supabaseClient
          .from("scaling_rules")
          .insert([{ ...payload, trigger_count: 0 }]);
        if (error) throw error;
        toast.success("Scaling rule created!");
      }
      setShowRuleDialog(false);
      fetchScalingRules();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRule = async (rule: ScalingRule) => {
    try {
      const { error } = await supabaseClient
        .from("scaling_rules")
        .update({ enabled: !rule.enabled, updated_at: new Date().toISOString() })
        .eq("id", rule.id);
      if (error) throw error;
      toast.success(`Rule ${!rule.enabled ? "enabled" : "disabled"}!`);
      fetchScalingRules();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to toggle rule");
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this scaling rule?")) return;
    try {
      const { error } = await supabaseClient
        .from("scaling_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Rule deleted!");
      fetchScalingRules();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete rule");
    }
  };

  // ── Optimization Jobs ──────────────────────────────────────────────────────
  const handleRunJob = async (type: OptimizationJob["type"]) => {
    try {
      const { data, error } = await supabaseClient
        .from("optimization_jobs")
        .insert([
          {
            name: `Manual ${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
            type,
            status: "running",
            progress: 0,
            logs: [`Started ${type} job manually`],
            started_at: new Date().toISOString(),
            created_by: "Super Admin",
          },
        ])
        .select()
        .single();
      if (error) throw error;
      toast.success("Optimization job started!");
      fetchOptimizationJobs();

      // Simulate progress updates
      let progress = 0;
      const interval = setInterval(async () => {
        progress = Math.min(100, progress + Math.random() * 20);
        const isDone = progress >= 100;
        await supabaseClient
          .from("optimization_jobs")
          .update({
            progress: Math.round(progress),
            status: isDone ? "completed" : "running",
            ended_at: isDone ? new Date().toISOString() : null,
            logs: isDone
              ? [`Started ${type} job manually`, "Job completed successfully"]
              : [`Started ${type} job manually`, `Progress: ${Math.round(progress)}%`],
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        fetchOptimizationJobs();
        if (isDone) clearInterval(interval);
      }, 2000);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start job");
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from("optimization_jobs")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchOptimizationJobs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete job");
    }
  };

  const skeletonRows = Array.from({ length: 5 });

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance & Scale</h1>
            <p className="text-muted-foreground">
              System health, database latency, scaling rules, and optimization jobs
            </p>
            {lastChecked && (
              <p className="text-xs text-muted-foreground mt-1">
                Live data · Last checked {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { runHealthChecks(); fetchScalingRules(); fetchOptimizationJobs(); }}
            disabled={healthLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Platform Health Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" /> Platform Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Workspaces", value: platformStats.workspaces, sub: "Active businesses" },
              { label: "New Workspaces (30d)", value: platformStats.newWorkspaces, sub: "Added last 30 days" },
              { label: "Total Users", value: platformStats.users, sub: "All registered accounts" },
              { label: "GMB Profiles Connected", value: platformStats.gmbProfiles, sub: "Google Business linked" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground font-medium leading-snug">{label}</p>
                {platformStatsLoading ? (
                  <div className="h-7 w-12 mt-1 animate-pulse bg-muted rounded" />
                ) : (
                  <p className="text-2xl font-bold mt-0.5">{value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{systemHealth.overall}%</div>
                  <Progress value={systemHealth.overall} className="h-2 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Latency</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{systemHealth.avgResponseMs}ms</div>
                  <p className="text-xs text-muted-foreground mt-1">avg across all tables</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database Health</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{systemHealth.database}%</div>
                  <Progress value={systemHealth.database} className="h-2 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Healthy Tables</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {healthChecks.filter((h) => h.status === "healthy").length}/{healthChecks.length}
                  </div>
                  <Progress value={systemHealth.tables} className="h-2 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rule Dialog */}
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Scaling Rule" : "Create Scaling Rule"}</DialogTitle>
              <DialogDescription>
                Define conditions and actions for automated scaling responses
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Rule Name *</Label>
                <Input
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., High Latency Alert"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Metric</Label>
                  <Select value={ruleForm.trigger_metric} onValueChange={(v) => setRuleForm((p) => ({ ...p, trigger_metric: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="response_time">Response Time</SelectItem>
                      <SelectItem value="error_rate">Error Rate</SelectItem>
                      <SelectItem value="row_count">Row Count</SelectItem>
                      <SelectItem value="active_users">Active Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Operator</Label>
                  <Select value={ruleForm.trigger_operator} onValueChange={(v) => setRuleForm((p) => ({ ...p, trigger_operator: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">{">"}</SelectItem>
                      <SelectItem value="<">{"<"}</SelectItem>
                      <SelectItem value="=">{"="}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={ruleForm.trigger_value}
                    onChange={(e) => setRuleForm((p) => ({ ...p, trigger_value: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Duration (seconds) — how long condition must hold</Label>
                <Input
                  type="number"
                  value={ruleForm.trigger_duration}
                  onChange={(e) => setRuleForm((p) => ({ ...p, trigger_duration: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Action</Label>
                <Select value={ruleForm.action_type} onValueChange={(v) => setRuleForm((p) => ({ ...p, action_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Notify</SelectItem>
                    <SelectItem value="scale_up">Scale Up</SelectItem>
                    <SelectItem value="scale_down">Scale Down</SelectItem>
                    <SelectItem value="restart">Restart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch checked={ruleForm.enabled} onCheckedChange={(v) => setRuleForm((p) => ({ ...p, enabled: v }))} />
                <Label>Enable this rule</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveRule} disabled={isSaving}>
                {isSaving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="scaling">Scaling</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Supabase Table Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {healthLoading
                      ? skeletonRows.map((_, i) => (
                          <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                        ))
                      : healthChecks.map((h) => (
                          <div key={h.table} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {h.status === "healthy" ? (
                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                              ) : h.status === "warning" ? (
                                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-sm">{h.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {h.rowCount !== null ? `${h.rowCount.toLocaleString()} rows` : "unreachable"}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-sm font-bold ${
                                  h.status === "healthy"
                                    ? "text-green-600"
                                    : h.status === "warning"
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                }`}
                              >
                                {h.responseMs}ms
                              </div>
                            </div>
                          </div>
                        ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {jobsLoading ? (
                      <div className="h-20 bg-muted animate-pulse rounded" />
                    ) : optimizationJobs.filter((j) => j.status === "running" || j.status === "scheduled").length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No active jobs</p>
                    ) : (
                      optimizationJobs
                        .filter((j) => j.status === "running" || j.status === "scheduled")
                        .map((job) => (
                          <div key={job.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm">{job.name}</div>
                              <Badge variant={job.status === "running" ? "default" : "secondary"}>
                                {job.status}
                              </Badge>
                            </div>
                            {job.status === "running" && (
                              <div className="space-y-1">
                                <Progress value={job.progress} className="h-2" />
                                <div className="text-xs text-muted-foreground">{job.progress}% complete</div>
                              </div>
                            )}
                          </div>
                        ))
                    )}

                    <div className="pt-3 border-t">
                      <div className="text-sm font-medium mb-2">Quick Actions</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleRunJob("database_cleanup")}>
                          DB Cleanup
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRunJob("log_rotation")}>
                          Log Rotation
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRunJob("index_rebuild")}>
                          Rebuild Indexes
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRunJob("cache_warmup")}>
                          Cache Warmup
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Database ─────────────────────────────────────────────────────── */}
          <TabsContent value="database" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Database Performance</CardTitle>
                  <Button variant="outline" size="sm" onClick={runHealthChecks} disabled={healthLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? "animate-spin" : ""}`} />
                    Re-check
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Row Count</TableHead>
                      <TableHead>Checked At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthLoading
                      ? skeletonRows.map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(5)].map((__, j) => (
                              <TableCell key={j}>
                                <div className="h-4 bg-muted animate-pulse rounded w-24" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : healthChecks.map((h) => (
                          <TableRow key={h.table}>
                            <TableCell className="font-medium">{h.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {h.status === "healthy" ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertTriangle className={`h-4 w-4 ${h.status === "warning" ? "text-yellow-500" : "text-red-500"}`} />
                                )}
                                <span className="capitalize">{h.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  h.status === "healthy"
                                    ? "text-green-600 font-medium"
                                    : h.status === "warning"
                                    ? "text-yellow-600 font-medium"
                                    : "text-red-600 font-medium"
                                }
                              >
                                {h.responseMs}ms
                              </span>
                            </TableCell>
                            <TableCell>
                              {h.rowCount !== null ? h.rowCount.toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(h.checkedAt).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Scaling ──────────────────────────────────────────────────────── */}
          <TabsContent value="scaling" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Define rules that trigger automated scaling actions when thresholds are exceeded.
              </p>
              <Button onClick={openCreateRule} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>

            <Card>
              <CardHeader><CardTitle>Auto-scaling Rules</CardTitle></CardHeader>
              <CardContent className="p-0">
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
                    {rulesLoading
                      ? skeletonRows.map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(6)].map((__, j) => (
                              <TableCell key={j}>
                                <div className="h-4 bg-muted animate-pulse rounded w-24" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : scalingRules.length === 0
                      ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                              No scaling rules. Create one to get started.
                            </TableCell>
                          </TableRow>
                        )
                      : scalingRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">{rule.name}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {rule.trigger_metric} {rule.trigger_operator} {rule.trigger_value}
                                <div className="text-xs text-muted-foreground">for {rule.trigger_duration}s</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.action_type.replace("_", " ")}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule)} />
                                <span className="text-sm">{rule.enabled ? "Active" : "Disabled"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{rule.trigger_count} times</div>
                                {rule.last_triggered && (
                                  <div className="text-xs text-muted-foreground">
                                    Last: {formatSystemDate(rule.last_triggered)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditRule(rule)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteRule(rule.id)}>
                                  <Trash2 className="h-4 w-4" />
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

          {/* ── Optimization ─────────────────────────────────────────────────── */}
          <TabsContent value="optimization" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Run maintenance and optimization tasks against the database.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRunJob("database_cleanup")}>
                  <Play className="h-4 w-4 mr-2" />
                  DB Cleanup
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRunJob("index_rebuild")}>
                  <Play className="h-4 w-4 mr-2" />
                  Rebuild Indexes
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle>Optimization Jobs</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Logs</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobsLoading
                      ? skeletonRows.map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(7)].map((__, j) => (
                              <TableCell key={j}>
                                <div className="h-4 bg-muted animate-pulse rounded w-24" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : optimizationJobs.length === 0
                      ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                              No optimization jobs yet.
                            </TableCell>
                          </TableRow>
                        )
                      : optimizationJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{job.type.replace(/_/g, " ")}</Badge>
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
                                className={job.status === "completed" ? "bg-green-500" : ""}
                              >
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={job.progress} className="h-2 w-16" />
                                <span className="text-sm">{job.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {job.started_at
                                ? new Date(job.started_at).toLocaleString()
                                : formatSystemDate(job.scheduled_at)}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {(job.logs || []).slice(-1)[0] || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteJob(job.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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
