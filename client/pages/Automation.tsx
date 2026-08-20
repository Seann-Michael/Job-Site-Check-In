import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import supabaseClient from "@/lib/supabaseClient";
import { workspaceService } from "@/lib/workspaceService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  TrendingUp,
  BarChart3,
  Activity,
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Types and Interfaces
interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition";
  title: string;
  data: any;
  position: { x: number; y: number };
}

interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
}

interface WorkflowTrigger {
  id: string;
  type: string;
  name: string;
  settings: any;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "draft" | "paused";
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: WorkflowTrigger[];
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  runCount: number;
}

interface WorkflowStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  avgExecutionTime: number;
  lastRun: Date;
  averagePerDay: number;
}

interface ExecutionHistory {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "completed" | "failed" | "pending";
  startTime: Date;
  endTime?: Date;
  duration?: number;
  trigger: string;
  errorMessage?: string;
  progress: number;
}

export default function Automation() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState("executions");
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoadingWorkflows(true);
      setLoadError(null);
      try {
        const ws = await workspaceService.whenReady();
        const businessId = ws.currentBusinessId;
        if (!businessId) {
          setWorkflows([]);
          setExecutionHistory([]);
          return;
        }
        const { data: wfData, error: wfError } = await supabaseClient
          .from("workflows")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });
        if (wfError) throw wfError;
        const mapped: Workflow[] = (wfData ?? []).map((w: any) => ({
          id: w.id,
          name: w.name,
          description: w.description ?? "",
          status: w.is_published && w.is_active ? "active" : w.is_published && !w.is_active ? "paused" : "draft",
          nodes: [],
          connections: [],
          triggers: [],
          createdAt: new Date(w.created_at),
          updatedAt: new Date(w.updated_at),
          runCount: 0,
        }));
        setWorkflows(mapped);

        const workflowIds = mapped.map((w) => w.id);
        const { data: exData, error: exError } = workflowIds.length
          ? await supabaseClient
              .from("workflow_executions")
              .select("*, workflow:workflow_id(name)")
              .in("workflow_id", workflowIds)
              .order("started_at", { ascending: false })
              .limit(50)
          : { data: [], error: null };
        if (exError) throw exError;
        const exMapped: ExecutionHistory[] = (exData ?? []).map((e: any) => ({
          id: e.id,
          workflowId: e.workflow_id,
          workflowName: e.workflow?.name ?? "Unknown",
          status: (e.status === "completed" || e.status === "failed" ? e.status : "pending") as ExecutionHistory["status"],
          startTime: new Date(e.started_at),
          endTime: e.completed_at ? new Date(e.completed_at) : undefined,
          duration: e.completed_at && e.started_at
            ? Math.round((new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()) / 1000)
            : undefined,
          trigger: (e.trigger_data as any)?.trigger ?? "manual",
          errorMessage: e.error_message ?? undefined,
          progress: e.status === "completed" ? 100 : e.status === "failed" ? 0 : 50,
        }));
        setExecutionHistory(exMapped);
      } catch (err) {
        console.error("Failed to load automations:", err);
        setLoadError(err instanceof Error ? err.message : "Failed to load automations");
        toast.error("Failed to load automations");
      } finally {
        setLoadingWorkflows(false);
      }
    };
    loadData();
  }, []);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sorting logic
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedWorkflows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visible = q
      ? workflows.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            (w.description || "").toLowerCase().includes(q),
        )
      : workflows;
    if (!sortConfig) return visible;

    return [...visible].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Workflow];
      const bVal = b[sortConfig.key as keyof Workflow];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [workflows, sortConfig, searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(sortedWorkflows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedWorkflows = sortedWorkflows.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const handleWorkflowAction = async (
    workflowId: string,
    action: "play" | "pause" | "edit" | "delete" | "copy",
  ) => {
    if (action === "edit") {
      navigate(`/admin/workflow-builder/${workflowId}`);
      return;
    }
    try {
      if (action === "play" || action === "pause") {
        const isActive = action === "play";
        const { error } = await supabaseClient
          .from("workflows")
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", workflowId);
        if (error) throw error;
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflowId ? { ...w, status: isActive ? "active" : "paused", updatedAt: new Date() } : w,
          ),
        );
        toast.success(isActive ? "Workflow resumed" : "Workflow paused");
      } else if (action === "delete") {
        const { error } = await supabaseClient.from("workflows").delete().eq("id", workflowId);
        if (error) throw error;
        setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
        toast.success("Workflow deleted");
      } else if (action === "copy") {
        const { data: src, error: fetchError } = await supabaseClient
          .from("workflows")
          .select("*")
          .eq("id", workflowId)
          .single();
        if (fetchError || !src) throw fetchError ?? new Error("Workflow not found");
        const { data: created, error: insertError } = await supabaseClient
          .from("workflows")
          .insert({
            business_id: src.business_id,
            name: `${src.name} (copy)`,
            description: src.description,
            steps: src.steps,
            is_active: false,
            is_published: false,
          })
          .select()
          .single();
        if (insertError || !created) throw insertError ?? new Error("Failed to duplicate");
        setWorkflows((prev) => [
          {
            id: created.id,
            name: created.name,
            description: created.description ?? "",
            status: "draft",
            nodes: [],
            connections: [],
            triggers: [],
            createdAt: new Date(created.created_at),
            updatedAt: new Date(created.updated_at),
            runCount: 0,
          },
          ...prev,
        ]);
        toast.success("Workflow duplicated");
      }
    } catch (err) {
      console.error("Workflow action failed:", err);
      toast.error(err instanceof Error ? err.message : "Workflow action failed");
    }
  };

  const analytics = useMemo(() => {
    const finishedRuns = executionHistory.filter((e) => e.status === "completed" || e.status === "failed");
    const failedRuns = executionHistory.filter((e) => e.status === "failed");
    const timed = executionHistory.filter((e) => e.duration != null);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const tally = (values: string[]) => {
      const counts = new Map<string, number>();
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      const total = values.length || 1;
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));
    };
    return {
      finished: finishedRuns.length,
      failed: failedRuns.length,
      successRate: finishedRuns.length ? ((finishedRuns.length - failedRuns.length) / finishedRuns.length) * 100 : 0,
      errorRate: finishedRuns.length ? (failedRuns.length / finishedRuns.length) * 100 : 0,
      avgDuration: timed.length
        ? Math.round(timed.reduce((sum, e) => sum + (e.duration ?? 0), 0) / timed.length)
        : null,
      today: executionHistory.filter((e) => e.startTime >= startOfDay).length,
      triggers: tally(executionHistory.map((e) => e.trigger || "manual")),
      errors: tally(failedRuns.map((e) => e.errorMessage?.trim() || "Unknown error")),
    };
  }, [executionHistory]);

  const getStatusBadge = (status: Workflow["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline">
            <Edit className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      default:
        return null;
    }
  };

  const getExecutionStatusBadge = (status: ExecutionHistory["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Automations</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Create and manage automated workflows for your business
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              onClick={() => navigate("/admin/workflow-builder")}
              className="w-full sm:w-auto min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Workflows
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workflows.length}</div>
              <p className="text-xs text-muted-foreground">
                {workflows.filter((w) => w.status === "active").length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Executions
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{executionHistory.length}</div>
              <p className="text-xs text-muted-foreground">
                {executionHistory.length > 0 ? Math.round(executionHistory.length / 30) : 0} per day avg
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.finished > 0 ? `${Math.round(analytics.successRate)}%` : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {executionHistory.filter((e) => e.status === "failed").length} failures
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Execution Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {executionHistory.filter((e) => e.duration != null).length > 0
                  ? Math.round(executionHistory.filter((e) => e.duration != null).reduce((sum, e) => sum + (e.duration ?? 0), 0) / executionHistory.filter((e) => e.duration != null).length)
                  : 0}s
              </div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Workflows Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Workflows</CardTitle>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search workflows…"
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadError && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {loadError}
              </div>
            )}
            {loadingWorkflows && (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Loading workflows…
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Name</span>
                      {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Status</span>
                      {getSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("runCount")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Executions</span>
                      {getSortIcon("runCount")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("lastRun")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Last Run</span>
                      {getSortIcon("lastRun")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("updatedAt")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Updated</span>
                      {getSortIcon("updatedAt")}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedWorkflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{workflow.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {workflow.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                    <TableCell>{workflow.runCount}</TableCell>
                    <TableCell>
                      {workflow.lastRun
                        ? workflow.lastRun.toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {workflow.updatedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {workflow.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleWorkflowAction(workflow.id, "pause")
                            }
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {workflow.status === "paused" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleWorkflowAction(workflow.id, "play")
                            }
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleWorkflowAction(workflow.id, "edit")
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Workflow
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleWorkflowAction(workflow.id, "copy")
                              }
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                handleWorkflowAction(workflow.id, "delete")
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2 py-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  Rows per page:
                </span>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {startIndex + 1}-
                  {Math.min(startIndex + rowsPerPage, sortedWorkflows.length)}{" "}
                  of {sortedWorkflows.length}
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="executions">Execution History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="executions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Executions</CardTitle>
                <CardDescription>
                  Monitor workflow execution status and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executionHistory.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-medium">
                          {execution.workflowName}
                        </TableCell>
                        <TableCell>
                          {getExecutionStatusBadge(execution.status)}
                        </TableCell>
                        <TableCell>
                          {execution.startTime.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {formatDuration(execution.duration)}
                        </TableCell>
                        <TableCell>{execution.trigger}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={execution.progress}
                              className="w-16"
                            />
                            <span className="text-xs text-muted-foreground">
                              {execution.progress}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Performance Overview (derived from loaded execution history) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.finished > 0 ? `${analytics.successRate.toFixed(1)}%` : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.finished} finished run{analytics.finished === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.avgDuration != null ? formatDuration(analytics.avgDuration) : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">Across runs with a recorded duration</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Executions Today</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.today}</div>
                  <p className="text-xs text-muted-foreground">Started since midnight</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.finished > 0 ? `${analytics.errorRate.toFixed(1)}%` : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">{analytics.failed} failed</p>
                </CardContent>
              </Card>
            </div>

            {/* Workflow Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Performance</CardTitle>
                <CardDescription>Per-workflow metrics from recent executions</CardDescription>
              </CardHeader>
              <CardContent>
                {workflows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No workflows yet.</p>
                ) : (
                  <div className="space-y-4">
                    {workflows.map((workflow) => {
                      const runs = executionHistory.filter((e) => e.workflowId === workflow.id);
                      const finished = runs.filter((e) => e.status === "completed" || e.status === "failed");
                      const completed = finished.filter((e) => e.status === "completed").length;
                      const timed = runs.filter((e) => e.duration != null);
                      const avg = timed.length
                        ? Math.round(timed.reduce((sum, e) => sum + (e.duration ?? 0), 0) / timed.length)
                        : null;
                      const lastRun = runs[0]?.startTime;
                      return (
                        <div
                          key={workflow.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{workflow.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {runs.length} execution{runs.length === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <div className="font-medium">
                                {finished.length ? `${Math.round((completed / finished.length) * 100)}%` : "—"}
                              </div>
                              <div className="text-muted-foreground">Success</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium">{avg != null ? formatDuration(avg) : "—"}</div>
                              <div className="text-muted-foreground">Avg Time</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium">
                                {lastRun ? lastRun.toLocaleDateString() : "Never"}
                              </div>
                              <div className="text-muted-foreground">Last Run</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>Trigger mix and failure reasons from recent executions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Most Active Triggers</h4>
                    {analytics.triggers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No executions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.triggers.map((trigger) => (
                          <div key={trigger.name} className="flex items-center justify-between">
                            <div className="text-sm">{trigger.name}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">{trigger.count}</div>
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${trigger.percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Failure Reasons</h4>
                    {analytics.errors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No failures recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.errors.map((error) => (
                          <div key={error.name} className="flex items-center justify-between gap-4">
                            <div className="text-sm truncate" title={error.name}>{error.name}</div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-sm font-medium">{error.count}</div>
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-destructive h-2 rounded-full"
                                  style={{ width: `${error.percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </div>
    </AppLayout>
  );
}
