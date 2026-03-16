import React, { useState, useEffect, useCallback } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Lightbulb,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Rocket,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "approved" | "rejected" | "roadmap";
  author_name: string;
  author_email: string | null;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  priority: "low" | "medium" | "high";
  admin_notes: string | null;
  roadmap_status: "planned" | "in-progress" | "completed" | null;
  estimated_completion: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

const blankEdit = (idea: Idea) => ({
  title: idea.title,
  description: idea.description,
  category: idea.category,
  priority: idea.priority as "low" | "medium" | "high",
  admin_notes: idea.admin_notes ?? "",
  status: idea.status,
});

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [editForm, setEditForm] = useState<ReturnType<typeof blankEdit> | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const [roadmapIdea, setRoadmapIdea] = useState<Idea | null>(null);
  const [roadmapForm, setRoadmapForm] = useState({
    roadmap_status: "planned" as "planned" | "in-progress" | "completed",
    estimated_completion: "",
    assigned_to: "",
  });
  const [showRoadmapDialog, setShowRoadmapDialog] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabaseClient
        .from("ideas")
        .select("*")
        .order(sortField, { ascending: sortDirection === "asc" });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (searchTerm.trim()) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,author_name.ilike.%${searchTerm}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setIdeas((data as Idea[]) ?? []);
    } catch (err: any) {
      toast.error("Failed to load ideas: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, sortField, sortDirection]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDirection("asc"); }
  };

  const SortIcon = ({ field }: { field: string }) =>
    sortField !== field ? (
      <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
    ) : sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
    );

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabaseClient
        .from("ideas")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Idea ${status}`);
      fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setEditForm(blankEdit(idea));
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingIdea || !editForm) return;
    setSaving(true);
    try {
      const { error } = await supabaseClient
        .from("ideas")
        .update({ ...editForm, updated_at: new Date().toISOString() })
        .eq("id", editingIdea.id);
      if (error) throw error;
      toast.success("Idea updated");
      setShowEditDialog(false);
      fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Roadmap ────────────────────────────────────────────────────────────────
  const openRoadmap = (idea: Idea) => {
    setRoadmapIdea(idea);
    setRoadmapForm({
      roadmap_status: idea.roadmap_status ?? "planned",
      estimated_completion: idea.estimated_completion ?? "",
      assigned_to: idea.assigned_to ?? "",
    });
    setShowRoadmapDialog(true);
  };

  const handleSaveRoadmap = async () => {
    if (!roadmapIdea) return;
    setSaving(true);
    try {
      const { error } = await supabaseClient
        .from("ideas")
        .update({
          status: "roadmap",
          roadmap_status: roadmapForm.roadmap_status,
          estimated_completion: roadmapForm.estimated_completion || null,
          assigned_to: roadmapForm.assigned_to || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", roadmapIdea.id);
      if (error) throw error;
      toast.success("Idea assigned to roadmap");
      setShowRoadmapDialog(false);
      fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { error } = await supabaseClient.from("ideas").delete().eq("id", deleteTargetId);
      if (error) throw error;
      toast.success("Idea deleted");
      setDeleteTargetId(null);
      fetchIdeas();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  // ── Badges ─────────────────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      pending: { label: "Pending", icon: <Clock className="h-3 w-3 mr-1" />, className: "" },
      approved: { label: "Approved", icon: <CheckCircle className="h-3 w-3 mr-1" />, className: "bg-green-500 text-white border-green-500" },
      rejected: { label: "Rejected", icon: <XCircle className="h-3 w-3 mr-1" />, className: "" },
      roadmap: { label: "On Roadmap", icon: <Rocket className="h-3 w-3 mr-1" />, className: "bg-purple-500 text-white border-purple-500" },
    };
    const cfg = map[status] ?? { label: status, icon: null, className: "" };
    return (
      <Badge
        variant={status === "rejected" ? "destructive" : status === "pending" ? "secondary" : "default"}
        className={`flex items-center w-fit ${cfg.className}`}
      >
        {cfg.icon}{cfg.label}
      </Badge>
    );
  };

  const PriorityBadge = ({ priority }: { priority: string }) => (
    <Badge variant={priority === "high" ? "destructive" : priority === "medium" ? "secondary" : "outline"} className="capitalize">
      {priority}
    </Badge>
  );

  // ── Counts ─────────────────────────────────────────────────────────────────
  const countByStatus = (s: string) => ideas.filter((i) => i.status === s).length;

  const SkeletonRow = () => (
    <TableRow>
      {[...Array(7)].map((_, i) => (
        <TableCell key={i}><div className="h-4 w-full animate-pulse bg-muted rounded" /></TableCell>
      ))}
    </TableRow>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="space-y-6 px-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Ideas Management</h1>
            <p className="text-muted-foreground">Review and manage user-submitted feature ideas</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchIdeas} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pending Review", status: "pending", icon: <Clock className="h-8 w-8 text-orange-500" /> },
            { label: "Approved", status: "approved", icon: <CheckCircle className="h-8 w-8 text-green-500" /> },
            { label: "On Roadmap", status: "roadmap", icon: <Rocket className="h-8 w-8 text-purple-500" /> },
            { label: "Total Ideas", status: "all", icon: <Lightbulb className="h-8 w-8 text-blue-500" /> },
          ].map(({ label, status, icon }) => (
            <Card key={label} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter(status)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">
                      {loading
                        ? <span className="inline-block h-7 w-8 animate-pulse bg-muted rounded" />
                        : status === "all" ? ideas.length : countByStatus(status)}
                    </p>
                  </div>
                  {icon}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, description or author…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="roadmap">On Roadmap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {loading ? "Loading ideas…" : `${ideas.length} idea${ideas.length !== 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">
                      <button onClick={() => handleSort("title")} className="flex items-center font-semibold hover:text-foreground transition-colors">
                        Idea <SortIcon field="title" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      <button onClick={() => handleSort("author_name")} className="flex items-center font-semibold hover:text-foreground transition-colors">
                        Author <SortIcon field="author_name" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      <button onClick={() => handleSort("status")} className="flex items-center font-semibold hover:text-foreground transition-colors">
                        Status <SortIcon field="status" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[90px]">
                      <button onClick={() => handleSort("priority")} className="flex items-center font-semibold hover:text-foreground transition-colors">
                        Priority <SortIcon field="priority" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      <button onClick={() => handleSort("upvotes")} className="flex items-center font-semibold hover:text-foreground transition-colors">
                        Engagement <SortIcon field="upvotes" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[110px]">
                      <button onClick={() => handleSort("created_at")} className="flex items-center font-semibold hover:text-foreground transition-colors">
                        Submitted <SortIcon field="created_at" />
                      </button>
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  ) : ideas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                        <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No ideas found</p>
                        <p className="text-sm mt-1">Ideas submitted by users will appear here</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    ideas.map((idea) => (
                      <TableRow key={idea.id} className="group">
                        <TableCell>
                          <p className="font-medium line-clamp-1">{idea.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{idea.description}</p>
                          {idea.admin_notes && (
                            <p className="text-xs text-blue-600 mt-1 italic line-clamp-1">Note: {idea.admin_notes}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{idea.author_name}</p>
                          <Badge variant="outline" className="text-xs mt-0.5">{idea.category}</Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={idea.status} /></TableCell>
                        <TableCell><PriorityBadge priority={idea.priority} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <ThumbsUp className="h-3 w-3 text-green-500" />{idea.upvotes}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ThumbsDown className="h-3 w-3 text-red-500" />{idea.downvotes}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" />{idea.comments_count}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(idea.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(idea)}>
                                <Edit className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              {idea.status === "pending" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "approved")}>
                                    <CheckCircle className="h-4 w-4 mr-2" />Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "rejected")}>
                                    <XCircle className="h-4 w-4 mr-2" />Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(idea.status === "approved" || idea.status === "pending") && (
                                <DropdownMenuItem onClick={() => openRoadmap(idea)}>
                                  <Rocket className="h-4 w-4 mr-2" />Assign to Roadmap
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTargetId(idea.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Delete
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(o) => { setShowEditDialog(o); if (!o) setEditingIdea(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Idea</DialogTitle>
            <DialogDescription>Update idea details and admin notes in Supabase.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm((p) => p && { ...p, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm((p) => p && { ...p, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={editForm.priority} onValueChange={(v) => setEditForm((p) => p && { ...p, priority: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => p && { ...p, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="roadmap">On Roadmap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Admin Notes</Label>
                <Textarea value={editForm.admin_notes} onChange={(e) => setEditForm((p) => p && { ...p, admin_notes: e.target.value })} placeholder="Internal notes…" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
              {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roadmap Dialog */}
      <Dialog open={showRoadmapDialog} onOpenChange={(o) => { setShowRoadmapDialog(o); if (!o) setRoadmapIdea(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Roadmap</DialogTitle>
            <DialogDescription>Set the roadmap status and timeline for this idea.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Roadmap Status</Label>
              <Select value={roadmapForm.roadmap_status} onValueChange={(v) => setRoadmapForm((p) => ({ ...p, roadmap_status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Completion (optional)</Label>
              <Input type="date" value={roadmapForm.estimated_completion} onChange={(e) => setRoadmapForm((p) => ({ ...p, estimated_completion: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To (optional)</Label>
              <Input placeholder="Team or person responsible" value={roadmapForm.assigned_to} onChange={(e) => setRoadmapForm((p) => ({ ...p, assigned_to: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoadmapDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveRoadmap} disabled={saving} className="gap-2">
              {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Assign to Roadmap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the idea from Supabase. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
