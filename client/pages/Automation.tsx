import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import supabaseClient from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  Square,
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Mail,
  Calendar,
  Save,
  TrendingUp,
  BarChart3,
  Activity,
  Users,
  RefreshCw,
  Filter,
  Search,
  AlertTriangle,
  Volume2,
  VolumeX,
  MessageSquare,
  Smartphone,
  Monitor,
  Star,
  Bell,
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
  status: "success" | "failed" | "running";
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

  useEffect(() => {
    const loadData = async () => {
      setLoadingWorkflows(true);
      try {
        const { data: wfData } = await supabaseClient
          .from("workflows")
          .select("*")
          .order("created_at", { ascending: false });
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

        const { data: exData } = await supabaseClient
          .from("workflow_executions")
          .select("*, workflow:workflow_id(name)")
          .order("started_at", { ascending: false })
          .limit(50);
        const exMapped: ExecutionHistory[] = (exData ?? []).map((e: any) => ({
          id: e.id,
          workflowId: e.workflow_id,
          workflowName: e.workflow?.name ?? "Unknown",
          status: e.status ?? "success",
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
      } catch {
        // leave arrays empty on error
      } finally {
        setLoadingWorkflows(false);
      }
    };
    loadData();
  }, []);
  const [isNewWorkflowOpen, setIsNewWorkflowOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    type: "email",
  });
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
    if (!sortConfig) return workflows;

    return [...workflows].sort((a, b) => {
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
  }, [workflows, sortConfig]);

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

  const handleWorkflowAction = (
    workflowId: string,
    action: "play" | "pause" | "stop" | "edit" | "delete" | "copy",
  ) => {
    setWorkflows((prev) =>
      prev
        .map((workflow) => {
          if (workflow.id === workflowId) {
            switch (action) {
              case "play":
                return { ...workflow, status: "active" as const };
              case "pause":
                return { ...workflow, status: "paused" as const };
              case "stop":
                return { ...workflow, status: "draft" as const };
              case "delete":
                return workflow; // Handle deletion in filter
              default:
                return workflow;
            }
          }
          return workflow;
        })
        .filter(
          (workflow) => !(action === "delete" && workflow.id === workflowId),
        ),
    );

  };

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
      case "success":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "running":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Running
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
            <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
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
                {executionHistory.length > 0
                  ? Math.round((executionHistory.filter((e) => e.status === "success").length / executionHistory.length) * 100)
                  : 0}%
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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              View Analytics
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
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
                      <TableHead>Actions</TableHead>
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
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Activity className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {execution.status === "running" && (
                                <DropdownMenuItem>
                                  <Square className="mr-2 h-4 w-4" />
                                  Stop Execution
                                </DropdownMenuItem>
                              )}
                              {execution.status === "failed" && (
                                <DropdownMenuItem>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Retry
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Export Logs
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Performance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Success Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">97.1%</div>
                  <p className="text-xs text-muted-foreground">
                    +2.3% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg Response Time
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1.2s</div>
                  <p className="text-xs text-muted-foreground">
                    -0.3s from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Daily Executions
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">
                    +12% from yesterday
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Error Rate
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2.9%</div>
                  <p className="text-xs text-muted-foreground">
                    -1.1% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Workflow Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Performance</CardTitle>
                <CardDescription>
                  Individual workflow metrics and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">{workflow.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {workflow.runCount} executions
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">95%</div>
                          <div className="text-muted-foreground">Success</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">2.1s</div>
                          <div className="text-muted-foreground">Avg Time</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">
                            {workflow.lastRun ? "Today" : "Never"}
                          </div>
                          <div className="text-muted-foreground">Last Run</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Usage Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>
                  Execution patterns over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Most Active Triggers</h4>
                    <div className="space-y-2">
                      {[
                        {
                          name: "Project Completed",
                          count: 45,
                          percentage: 38,
                        },
                        { name: "New Lead Added", count: 32, percentage: 27 },
                        { name: "Schedule", count: 28, percentage: 24 },
                        { name: "Manual Trigger", count: 13, percentage: 11 },
                      ].map((trigger) => (
                        <div
                          key={trigger.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-sm">{trigger.name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              {trigger.count}
                            </div>
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
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Error Categories</h4>
                    <div className="space-y-2">
                      {[
                        { name: "Email Delivery", count: 5, percentage: 42 },
                        { name: "API Timeout", count: 3, percentage: 25 },
                        { name: "Invalid Data", count: 2, percentage: 17 },
                        { name: "Network Error", count: 2, percentage: 17 },
                      ].map((error) => (
                        <div
                          key={error.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-sm">{error.name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              {error.count}
                            </div>
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Execution Settings</CardTitle>
                <CardDescription>
                  Configure how workflows are executed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Max Concurrent Executions</Label>
                      <Select defaultValue="5">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Timeout (seconds)</Label>
                      <Input type="number" defaultValue="300" />
                    </div>

                    <div className="space-y-2">
                      <Label>Retry Attempts</Label>
                      <Select defaultValue="3">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No retries</SelectItem>
                          <SelectItem value="1">1 retry</SelectItem>
                          <SelectItem value="3">3 retries</SelectItem>
                          <SelectItem value="5">5 retries</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Retry Delay (seconds)</Label>
                      <Input type="number" defaultValue="60" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Logging</Label>
                        <p className="text-sm text-muted-foreground">
                          Log all workflow executions
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Send email alerts for failures
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-pause on Errors</Label>
                        <p className="text-sm text-muted-foreground">
                          Pause workflows after consecutive failures
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Performance Monitoring</Label>
                        <p className="text-sm text-muted-foreground">
                          Track detailed execution metrics
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                {/* Notification Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    Notification Preferences
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email Recipients</Label>
                        <Textarea
                          placeholder="Enter email addresses (one per line)"
                          defaultValue="admin@example.com&#10;manager@example.com"
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Daily Summary Reports</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive daily execution summaries
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Notification Threshold</Label>
                        <Select defaultValue="any">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any failure</SelectItem>
                            <SelectItem value="consecutive-3">
                              3 consecutive failures
                            </SelectItem>
                            <SelectItem value="consecutive-5">
                              5 consecutive failures
                            </SelectItem>
                            <SelectItem value="rate-10">
                              10% failure rate
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Weekly Performance Reports</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive weekly analytics reports
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Workflow Dialog */}
        <Dialog open={isNewWorkflowOpen} onOpenChange={setIsNewWorkflowOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>
                Choose a workflow template to get started with automation
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Workflow Templates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setNewWorkflow({ ...newWorkflow, type: "email" });
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="font-medium">Email Automation</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send automated emails based on triggers like project
                      completion, new leads, or scheduled times
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setNewWorkflow({ ...newWorkflow, type: "review" });
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                        <Star className="h-5 w-5 text-yellow-600" />
                      </div>
                      <h3 className="font-medium">Review Requests</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automatically request reviews from clients after project
                      completion with customizable timing
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setNewWorkflow({ ...newWorkflow, type: "notification" });
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                        <Bell className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="font-medium">Notifications</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send SMS or push notifications to team members or clients
                      based on project updates
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setNewWorkflow({ ...newWorkflow, type: "custom" });
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                        <Settings className="h-5 w-5 text-purple-600" />
                      </div>
                      <h3 className="font-medium">Custom Workflow</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Build a custom workflow from scratch with multiple
                      triggers, conditions, and actions
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Start Options */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Quick Start Templates</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      const newId = `workflow-${Date.now()}`;
                      const newWorkflowData: Workflow = {
                        id: newId,
                        name: "Lead Nurturing Sequence",
                        description: "7-day email sequence for new leads",
                        status: "draft",
                        nodes: [],
                        connections: [],
                        triggers: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        runCount: 0,
                      };
                      setWorkflows([...workflows, newWorkflowData]);
                      setIsNewWorkflowOpen(false);
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Lead Nurturing Sequence
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      const newId = `workflow-${Date.now()}`;
                      const newWorkflowData: Workflow = {
                        id: newId,
                        name: "Project Completion Follow-up",
                        description: "Send review requests and project surveys",
                        status: "draft",
                        nodes: [],
                        connections: [],
                        triggers: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        runCount: 0,
                      };
                      setWorkflows([...workflows, newWorkflowData]);
                      setIsNewWorkflowOpen(false);
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Project Completion Follow-up
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      const newId = `workflow-${Date.now()}`;
                      const newWorkflowData: Workflow = {
                        id: newId,
                        name: "Client Onboarding",
                        description:
                          "Welcome new clients with automated sequence",
                        status: "draft",
                        nodes: [],
                        connections: [],
                        triggers: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        runCount: 0,
                      };
                      setWorkflows([...workflows, newWorkflowData]);
                      setIsNewWorkflowOpen(false);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Client Onboarding
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsNewWorkflowOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setIsNewWorkflowOpen(false);
                    // Here you would navigate to a workflow builder page
                    // For now, we'll just show a message
                    alert(
                      "Workflow Builder would open here. This would navigate to a visual workflow editor.",
                    );
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Open Workflow Builder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
