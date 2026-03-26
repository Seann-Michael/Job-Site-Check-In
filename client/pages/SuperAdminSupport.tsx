import React, { useState, useEffect, useCallback, useRef } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  Eye,
  Users,
  RefreshCw,
  Send,
  XCircle,
  ArrowUpDown,
  Trash2,
  Lightbulb,
  BookOpen,
  ThumbsUp,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SupportTicket {
  id: string;
  ticket_number: number;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  submitted_by: string;
  organization: string | null;
  user_type: string;
  assigned_to: string | null;
  tags: string[];
  estimated_resolution: string | null;
  actual_resolution: string | null;
  satisfaction_rating: number | null;
  time_spent: number;
  created_at: string;
  updated_at: string;
}

interface TicketResponse {
  id: string;
  ticket_id: string;
  message: string;
  author: string;
  is_staff: boolean;
  is_internal: boolean;
  created_at: string;
}

const CATEGORIES = [
  "Technical Issue",
  "Billing Question",
  "Feature Request",
  "Account Access",
  "Integration Help",
  "Data Export",
  "Performance Issue",
  "Security Concern",
  "Training Request",
  "Bug Report",
  "API Support",
  "Other",
];

const EMPTY_FORM = {
  title: "",
  category: "Technical Issue",
  priority: "medium" as SupportTicket["priority"],
  description: "",
  submitted_by: "",
  organization: "",
  user_type: "admin",
  assigned_to: "",
  tags: "",
  estimated_resolution: "",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // detail dialog
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [newResponse, setNewResponse] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);

  // delete dialog
  const [deleteTarget, setDeleteTarget] = useState<SupportTicket | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Fetch tickets ─────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets((data ?? []) as SupportTicket[]);
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error("Failed to load tickets: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // ── Fetch responses for a ticket ──────────────────────────────────────────
  const fetchResponses = useCallback(async (ticketId: string) => {
    setResponsesLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("ticket_responses")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setResponses((data ?? []) as TicketResponse[]);
    } catch (err: any) {
      toast.error("Failed to load responses: " + (err?.message ?? "Unknown"));
    } finally {
      setResponsesLoading(false);
    }
  }, []);

  const openDetail = (ticket: SupportTicket) => {
    setDetailTicket(ticket);
    setDetailOpen(true);
    setNewResponse("");
    setIsInternal(false);
    fetchResponses(ticket.id);
  };

  // ── CRUD: Create ticket ───────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSaving(true);
    try {
      const tagsArr = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error } = await supabaseClient.from("support_tickets").insert({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        submitted_by: form.submitted_by.trim() || "Super Admin",
        organization: form.organization.trim() || null,
        user_type: form.user_type,
        assigned_to: form.assigned_to.trim() || null,
        tags: tagsArr,
        estimated_resolution: form.estimated_resolution || null,
        status: "open",
      });
      if (error) throw error;
      toast.success("Ticket created");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      fetchTickets();
    } catch (err: any) {
      toast.error("Create failed: " + (err?.message ?? "Unknown"));
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD: Update status ───────────────────────────────────────────────────
  const updateStatus = async (ticket: SupportTicket, status: SupportTicket["status"]) => {
    try {
      const extra: Record<string, any> = { status, updated_at: new Date().toISOString() };
      if (status === "resolved" || status === "closed") {
        extra.actual_resolution = new Date().toISOString();
      }
      const { error } = await supabaseClient
        .from("support_tickets")
        .update(extra)
        .eq("id", ticket.id);
      if (error) throw error;
      toast.success(`Ticket marked as ${status}`);
      fetchTickets();
      if (detailTicket?.id === ticket.id) {
        setDetailTicket({ ...detailTicket, status, ...extra });
      }
    } catch (err: any) {
      toast.error("Update failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── CRUD: Update assigned_to ─────────────────────────────────────────────
  const updateAssignee = async (ticket: SupportTicket, assignedTo: string) => {
    try {
      const { error } = await supabaseClient
        .from("support_tickets")
        .update({
          assigned_to: assignedTo || null,
          status: assignedTo ? "in-progress" : "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);
      if (error) throw error;
      toast.success("Ticket assigned");
      fetchTickets();
    } catch (err: any) {
      toast.error("Update failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── CRUD: Add response ────────────────────────────────────────────────────
  const handleAddResponse = async () => {
    if (!detailTicket || !newResponse.trim()) return;
    setSendingResponse(true);
    try {
      const { error } = await supabaseClient.from("ticket_responses").insert({
        ticket_id: detailTicket.id,
        message: newResponse.trim(),
        author: "Super Admin",
        is_staff: true,
        is_internal: isInternal,
      });
      if (error) throw error;

      // also update ticket updated_at
      await supabaseClient
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", detailTicket.id);

      toast.success(isInternal ? "Internal note added" : "Response sent");
      setNewResponse("");
      setIsInternal(false);
      fetchResponses(detailTicket.id);
      fetchTickets();
    } catch (err: any) {
      toast.error("Failed to send response: " + (err?.message ?? "Unknown"));
    } finally {
      setSendingResponse(false);
    }
  };

  // ── CRUD: Delete ticket ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabaseClient
        .from("support_tickets")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Ticket deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchTickets();
    } catch (err: any) {
      toast.error("Delete failed: " + (err?.message ?? "Unknown"));
    }
  };

  // ── Sort helper ───────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredTickets = tickets
    .filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      const q = searchTerm.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) &&
          !t.description.toLowerCase().includes(q) &&
          !(t.submitted_by ?? "").toLowerCase().includes(q) &&
          !(t.organization ?? "").toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const av = (a as any)[sortField] ?? "";
      const bv = (b as any)[sortField] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // ── Engagement stats ─────────────────────────────────────────────────────
  const [engLoading, setEngLoading] = useState(true);
  const [engStats, setEngStats] = useState({
    totalIdeas: 0,
    ideasOnRoadmap: 0,
    totalUpvotes: 0,
    helpPublished: 0,
    helpViews: 0,
  });
  const engFetched = useRef(false);

  useEffect(() => {
    if (engFetched.current) return;
    engFetched.current = true;
    (async () => {
      setEngLoading(true);
      const [ideasRes, ideasRoadmapRes, helpRes] = await Promise.allSettled([
        supabaseClient.from("ideas").select("upvotes"),
        supabaseClient.from("ideas").select("id", { count: "exact", head: true }).eq("status", "roadmap"),
        supabaseClient.from("help_articles").select("views, status"),
      ]);
      const ideas = ideasRes.status === "fulfilled" && !ideasRes.value.error ? ideasRes.value.data ?? [] : [];
      const roadmapCount = ideasRoadmapRes.status === "fulfilled" && !ideasRoadmapRes.value.error ? ideasRoadmapRes.value.count ?? 0 : 0;
      const articles = helpRes.status === "fulfilled" && !helpRes.value.error ? helpRes.value.data ?? [] : [];
      setEngStats({
        totalIdeas: ideas.length,
        ideasOnRoadmap: roadmapCount,
        totalUpvotes: ideas.reduce((s: number, r: any) => s + (Number(r.upvotes) || 0), 0),
        helpPublished: articles.filter((a: any) => a.status === "published").length,
        helpViews: articles.reduce((s: number, a: any) => s + (Number(a.views) || 0), 0),
      });
      setEngLoading(false);
    })();
  }, []);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in-progress").length;
  const urgentCount = tickets.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length;
  const resolvedTickets = tickets.filter((t) => t.actual_resolution);
  const avgResolutionHrs = resolvedTickets.length > 0
    ? resolvedTickets.reduce((sum, t) => {
        const diff = new Date(t.actual_resolution!).getTime() - new Date(t.created_at).getTime();
        return sum + diff / 3_600_000;
      }, 0) / resolvedTickets.length
    : 0;

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const priorityBadge = (priority: string) => {
    const map: Record<string, "destructive" | "default" | "outline" | "secondary"> = {
      urgent: "destructive", high: "default", medium: "outline", low: "secondary",
    };
    return <Badge variant={map[priority] ?? "outline"} className="capitalize">{priority}</Badge>;
  };

  const statusBadge = (status: string) => {
    const cfg: Record<string, { variant: "destructive" | "default" | "outline" | "secondary"; icon: React.ElementType }> = {
      "open":        { variant: "outline",     icon: MessageSquare },
      "in-progress": { variant: "default",     icon: Clock },
      "resolved":    { variant: "secondary",   icon: CheckCircle },
      "closed":      { variant: "secondary",   icon: XCircle },
    };
    const { variant, icon: Icon } = cfg[status] ?? { variant: "outline", icon: MessageSquare };
    return (
      <Badge variant={variant} className="gap-1 capitalize">
        <Icon className="h-3 w-3" />{status.replace("-", " ")}
      </Badge>
    );
  };

  const SkeletonRow = ({ cols }: { cols: number }) => (
    <TableRow>
      {[...Array(cols)].map((_, i) => (
        <TableCell key={i}><div className="h-4 w-full animate-pulse bg-muted rounded" /></TableCell>
      ))}
    </TableRow>
  );

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Support Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live data · Last refreshed {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" /> Create Ticket
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : openCount}
              </div>
              <p className="text-xs text-muted-foreground">{inProgressCount} in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent Tickets</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : urgentCount}
              </div>
              <p className="text-xs text-muted-foreground">Require immediate attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-16 animate-pulse bg-muted rounded" /> : `${avgResolutionHrs.toFixed(1)}h`}
              </div>
              <p className="text-xs text-muted-foreground">From {resolvedTickets.length} resolved tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : tickets.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {tickets.filter((t) => t.status === "resolved" || t.status === "closed").length} resolved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Engagement Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" /> Community & Engagement
          </h2>
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Ideas</CardTitle>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engLoading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : engStats.totalIdeas}</div>
                <p className="text-xs text-muted-foreground">{engStats.ideasOnRoadmap} on roadmap</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Idea Upvotes</CardTitle>
                <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engLoading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : engStats.totalUpvotes}</div>
                <p className="text-xs text-muted-foreground">Community votes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Help Articles</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engLoading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : engStats.helpPublished}</div>
                <p className="text-xs text-muted-foreground">Published articles</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Help Center Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engLoading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : engStats.helpViews}</div>
                <p className="text-xs text-muted-foreground">Total article views</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ideas on Roadmap</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{engLoading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : engStats.ideasOnRoadmap}</div>
                <p className="text-xs text-muted-foreground">Planned or in-progress</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets by title, requester, or organization…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-44">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Support Tickets ({filteredTickets.length})</CardTitle>
            <CardDescription>Click a row to view details and respond</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-medium gap-1" onClick={() => handleSort("ticket_number")}>
                        # <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-medium gap-1" onClick={() => handleSort("title")}>
                        Subject <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-medium gap-1" onClick={() => handleSort("submitted_by")}>
                        Requester <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-medium gap-1" onClick={() => handleSort("priority")}>
                        Priority <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-medium gap-1" onClick={() => handleSort("status")}>
                        Status <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>
                      <Button variant="ghost" className="h-8 p-0 font-medium gap-1" onClick={() => handleSort("created_at")}>
                        Created <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={8} />)
                  ) : filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No tickets found</p>
                        <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setCreateOpen(true)}>
                          <Plus className="h-4 w-4" /> Create First Ticket
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openDetail(ticket)}
                      >
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          #{ticket.ticket_number}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium leading-tight">{ticket.title}</div>
                          <div className="text-xs text-muted-foreground">{ticket.category}</div>
                          <div className="flex gap-1 mt-1">
                            {ticket.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                            {ticket.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{ticket.tags.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{ticket.submitted_by || "—"}</div>
                          {ticket.organization && (
                            <div className="text-xs text-muted-foreground">{ticket.organization}</div>
                          )}
                        </TableCell>
                        <TableCell>{priorityBadge(ticket.priority)}</TableCell>
                        <TableCell>{statusBadge(ticket.status)}</TableCell>
                        <TableCell>
                          {ticket.assigned_to ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                                {initials(ticket.assigned_to)}
                              </div>
                              <span className="text-sm">{ticket.assigned_to}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(ticket)}>
                                <Eye className="h-4 w-4 mr-2" /> View & Respond
                              </DropdownMenuItem>
                              {ticket.status !== "in-progress" && (
                                <DropdownMenuItem onClick={() => updateStatus(ticket, "in-progress")}>
                                  <Clock className="h-4 w-4 mr-2" /> Mark In Progress
                                </DropdownMenuItem>
                              )}
                              {ticket.status !== "resolved" && (
                                <DropdownMenuItem onClick={() => updateStatus(ticket, "resolved")}>
                                  <CheckCircle className="h-4 w-4 mr-2" /> Mark Resolved
                                </DropdownMenuItem>
                              )}
                              {ticket.status !== "closed" && (
                                <DropdownMenuItem onClick={() => updateStatus(ticket, "closed")}>
                                  <XCircle className="h-4 w-4 mr-2" /> Close Ticket
                                </DropdownMenuItem>
                              )}
                              {ticket.status !== "open" && (
                                <DropdownMenuItem onClick={() => updateStatus(ticket, "open")}>
                                  <MessageSquare className="h-4 w-4 mr-2" /> Reopen
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => { setDeleteTarget(ticket); setDeleteOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Create Ticket Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the issue"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as SupportTicket["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Submitted By</Label>
                <Input
                  value={form.submitted_by}
                  onChange={(e) => setForm((f) => ({ ...f, submitted_by: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Organization</Label>
                <Input
                  value={form.organization}
                  onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                  placeholder="Company name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="Staff member name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="billing, urgent, api"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Resolution</Label>
              <Input
                type="datetime-local"
                value={form.estimated_resolution}
                onChange={(e) => setForm((f) => ({ ...f, estimated_resolution: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Detailed description of the issue…"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ticket Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base">#{detailTicket?.ticket_number}</span>
              {detailTicket && priorityBadge(detailTicket.priority)}
              {detailTicket && statusBadge(detailTicket.status)}
            </DialogTitle>
            <p className="text-sm font-medium mt-1">{detailTicket?.title}</p>
          </DialogHeader>

          {detailTicket && (
            <div className="space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border rounded-lg p-4 bg-muted/30">
                <div><span className="text-muted-foreground">Submitted by: </span><span className="font-medium">{detailTicket.submitted_by || "—"}</span></div>
                <div><span className="text-muted-foreground">Organization: </span><span className="font-medium">{detailTicket.organization || "—"}</span></div>
                <div><span className="text-muted-foreground">Category: </span><span className="font-medium">{detailTicket.category}</span></div>
                <div><span className="text-muted-foreground">Assigned to: </span><span className="font-medium">{detailTicket.assigned_to || "Unassigned"}</span></div>
                <div><span className="text-muted-foreground">Created: </span><span className="font-medium">{new Date(detailTicket.created_at).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Updated: </span><span className="font-medium">{new Date(detailTicket.updated_at).toLocaleString()}</span></div>
              </div>

              {/* Quick status change */}
              <div className="flex gap-2 flex-wrap">
                {(["open", "in-progress", "resolved", "closed"] as SupportTicket["status"][]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={detailTicket.status === s ? "default" : "outline"}
                    className="capitalize"
                    onClick={() => updateStatus(detailTicket, s)}
                  >
                    {s.replace("-", " ")}
                  </Button>
                ))}
              </div>

              {/* Assign */}
              <div className="flex items-center gap-3">
                <Label className="shrink-0">Assign to:</Label>
                <Input
                  className="max-w-xs"
                  placeholder="Staff member name"
                  defaultValue={detailTicket.assigned_to ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (detailTicket.assigned_to ?? "")) {
                      updateAssignee(detailTicket, e.target.value);
                    }
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-semibold mb-2">Description</p>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">{detailTicket.description}</div>
              </div>

              {/* Tags */}
              {detailTicket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detailTicket.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}

              {/* Responses */}
              <div>
                <p className="text-sm font-semibold mb-2">
                  Responses ({responses.length})
                </p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {responsesLoading ? (
                    <div className="h-16 animate-pulse bg-muted rounded-lg" />
                  ) : responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No responses yet</p>
                  ) : (
                    responses.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg text-sm ${
                          r.is_internal
                            ? "bg-yellow-50 border border-yellow-200"
                            : r.is_staff
                            ? "bg-blue-50 border-l-4 border-blue-500"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium flex items-center gap-1">
                            {r.author}
                            {r.is_staff && <Badge variant="outline" className="text-xs ml-1">Staff</Badge>}
                            {r.is_internal && <Badge variant="secondary" className="text-xs ml-1">Internal</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{r.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Response */}
              <div className="border-t pt-4 space-y-3">
                <Textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Type your response…"
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    Internal note (not visible to user)
                  </label>
                  <Button
                    onClick={handleAddResponse}
                    disabled={!newResponse.trim() || sendingResponse}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendingResponse ? "Sending…" : isInternal ? "Add Note" : "Send Response"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Ticket</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete ticket <strong>#{deleteTarget?.ticket_number} — {deleteTarget?.title}</strong>? All responses will also be deleted. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
