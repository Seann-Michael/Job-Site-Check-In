import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Building2,
  ArrowLeft,
  RefreshCw,
  Star,
  Briefcase,
  Users,
  Image,
  Send,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  Activity,
  Hash,
  User,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
  Video,
  BarChart3,
  Link2 as LinkIcon,
  CreditCard,
  LifeBuoy,
  StickyNote,
  Plus,
  Trash2,
  Search,
  ChevronUp,
  ChevronDown,
  CheckSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface WorkspaceDetail {
  id: string;
  name: string;
  description: string | null;
  email: string;
  phone: string;
  website: string | null;
  category: string;
  subcategory: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  address: Record<string, any> | null;
  settings: Record<string, any> | null;
  metadata: Record<string, any> | null;
  google_place_id: string | null;
  google_my_business: Record<string, any> | null;
  social_media: Record<string, any> | null;
  owner_id: string | null;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  role: string;
  sub_account_id: string | null;
  last_login: string | null;
  email_verified: boolean;
  is_2fa_enabled: boolean;
  created_at: string;
}

interface Stats {
  jobs: number;
  activeJobs: number;
  completedJobs: number;
  totalReviews: number;
  avgRating: number;
  reviewRequests: number;
  clients: number;
  photos: number;
  videos: number;
  documents: number;
}

interface RecentJob {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface RecentReview {
  id: string;
  rating: number;
  text: string;
  author: Record<string, any> | null;
  platform: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:               { label: "Active",           variant: "default" },
  inactive:             { label: "Inactive",         variant: "secondary" },
  pending_verification: { label: "Pending",          variant: "outline" },
  suspended:            { label: "Suspended",        variant: "destructive" },
  deleted:              { label: "Deleted",          variant: "destructive" },
};

const JOB_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:      { label: "Active",      variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed:   { label: "Completed",   variant: "secondary" },
  paused:      { label: "Paused",      variant: "outline" },
  draft:       { label: "Draft",       variant: "outline" },
  cancelled:   { label: "Cancelled",   variant: "destructive" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-36 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium flex-1 min-w-0 break-words">{value ?? "—"}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconColor, sub }: {
  label: string; value: number | string; icon: React.ElementType; iconColor: string; sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium leading-snug">{label}</p>
          <p className="text-2xl font-bold mt-0.5 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${iconColor}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SuperAdminWorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<Owner[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [billingRecords, setBillingRecords] = useState<any[]>([]);
  const [planData, setPlanData] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSortKey, setUserSortKey] = useState<"name" | "email" | "role" | "last_login">("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Core workspace
      const { data: biz, error: bizErr } = await supabaseClient
        .from("businesses")
        .select("*")
        .eq("id", id)
        .single();
      if (bizErr) throw bizErr;
      setWorkspace(biz as WorkspaceDetail);

      // 2. Owner
      if (biz.owner_id) {
        const { data: ownerData } = await supabaseClient
          .from("users")
          .select("id, name, email, role, sub_account_id, last_login, email_verified, is_2fa_enabled, created_at")
          .eq("id", biz.owner_id)
          .single();
        setOwner(ownerData as Owner);
      }

      // 3. Stats — parallel
      const [
        jobsRes,
        activeJobsRes,
        completedJobsRes,
        reviewsRes,
        reviewRequestsRes,
        clientsRes,
        photosRes,
        videosRes,
        docsRes,
        recentJobsRes,
        recentReviewsRes,
      ] = await Promise.allSettled([
        supabaseClient.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", id),
        supabaseClient.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", id).in("status", ["active", "in_progress"]),
        supabaseClient.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", id).eq("status", "completed"),
        supabaseClient.from("reviews").select("id, rating").eq("business_id", id),
        supabaseClient.from("review_requests").select("id", { count: "exact", head: true }).eq("business_id", id),
        supabaseClient.from("clients").select("id", { count: "exact", head: true }).eq("business_id", id),
        supabaseClient.from("job_media").select("id", { count: "exact", head: true }).eq("media_type", "image"),
        supabaseClient.from("job_media").select("id", { count: "exact", head: true }).eq("media_type", "video"),
        supabaseClient.from("job_documents").select("id", { count: "exact", head: true }),
        supabaseClient.from("jobs").select("id, name, status, created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(5),
        supabaseClient.from("reviews").select("id, rating, text, author, platform, created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(5),
      ]);

      const reviews = reviewsRes.status === "fulfilled" && !reviewsRes.value.error ? reviewsRes.value.data ?? [] : [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / reviews.length
        : 0;

      setStats({
        jobs: jobsRes.status === "fulfilled" && !jobsRes.value.error ? (jobsRes.value.count ?? 0) : 0,
        activeJobs: activeJobsRes.status === "fulfilled" && !activeJobsRes.value.error ? (activeJobsRes.value.count ?? 0) : 0,
        completedJobs: completedJobsRes.status === "fulfilled" && !completedJobsRes.value.error ? (completedJobsRes.value.count ?? 0) : 0,
        totalReviews: reviews.length,
        avgRating,
        reviewRequests: reviewRequestsRes.status === "fulfilled" && !reviewRequestsRes.value.error ? (reviewRequestsRes.value.count ?? 0) : 0,
        clients: clientsRes.status === "fulfilled" && !clientsRes.value.error ? (clientsRes.value.count ?? 0) : 0,
        photos: photosRes.status === "fulfilled" && !photosRes.value.error ? (photosRes.value.count ?? 0) : 0,
        videos: videosRes.status === "fulfilled" && !videosRes.value.error ? (videosRes.value.count ?? 0) : 0,
        documents: docsRes.status === "fulfilled" && !docsRes.value.error ? (docsRes.value.count ?? 0) : 0,
      });

      if (recentJobsRes.status === "fulfilled" && !recentJobsRes.value.error)
        setRecentJobs(recentJobsRes.value.data ?? []);
      if (recentReviewsRes.status === "fulfilled" && !recentReviewsRes.value.error)
        setRecentReviews(recentReviewsRes.value.data ?? []);

      // 4. Support tickets matched by owner email or business name
      if (biz.email || biz.name) {
        const { data: ticketData } = await supabaseClient
          .from("support_tickets")
          .select("id, ticket_number, title, status, priority, submitted_by, created_at, updated_at")
          .or(`submitted_by.ilike.%${biz.email ?? ""}%,organization.ilike.%${biz.name ?? ""}%`)
          .order("created_at", { ascending: false })
          .limit(10);
        setTickets(ticketData ?? []);
      }

      // 4b. Tasks
      const { data: tasksData } = await supabaseClient
        .from("tasks")
        .select("id, title, status, priority, due_date, assigned_to, created_at")
        .eq("business_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTasks(tasksData ?? []);

      // 4c. Billing records
      const { data: billingData } = await supabaseClient
        .from("billing_records")
        .select("*")
        .eq("business_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      setBillingRecords(billingData ?? []);

      // 4d. Plan data
      const planName = biz.metadata?.plan ?? biz.metadata?.subscription_plan;
      if (planName) {
        const { data: planRow } = await supabaseClient
          .from("plans")
          .select("*")
          .ilike("name", planName)
          .limit(1)
          .single();
        setPlanData(planRow ?? null);
      }

      // 5. Internal notes
      const { data: notesData } = await supabaseClient
        .from("business_notes")
        .select("id, note, admin_user, created_at")
        .eq("business_id", id)
        .order("created_at", { ascending: false });
      setNotes(notesData ?? []);

      // 6. Workspace users — owner + anyone assigned to jobs in this workspace
      const { data: jobAssignees } = await supabaseClient
        .from("jobs")
        .select("assigned_to")
        .eq("business_id", id)
        .not("assigned_to", "is", null);
      const assigneeIds = [...new Set((jobAssignees ?? []).map((j: any) => j.assigned_to).filter(Boolean))];
      const allUserIds = [...new Set([biz.owner_id, ...assigneeIds].filter(Boolean))];
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabaseClient
          .from("users")
          .select("id, name, email, role, sub_account_id, last_login, email_verified, is_2fa_enabled, created_at")
          .in("id", allUserIds);
        setWorkspaceUsers((usersData ?? []) as Owner[]);
      }
    } catch (err: any) {
      toast.error("Failed to load workspace: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleStatusChange = async (newStatus: string) => {
    if (!workspace) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabaseClient
        .from("businesses")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", workspace.id);
      if (error) throw error;
      setWorkspace((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success(`Workspace status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error("Failed to update status: " + (err?.message ?? "Unknown"));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="space-y-5 px-1">
          <div className="h-8 w-48 animate-pulse bg-muted rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-muted rounded-lg" />)}
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 animate-pulse bg-muted rounded-lg" />)}
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  if (!workspace) {
    return (
      <SuperAdminLayout>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium text-lg">Workspace not found</p>
          <Button variant="ghost" className="mt-3 gap-2" onClick={() => navigate("/super-admin/workspaces")}>
            <ArrowLeft className="h-4 w-4" /> Back to Workspaces
          </Button>
        </div>
      </SuperAdminLayout>
    );
  }

  const status = STATUS_CONFIG[workspace.status] ?? { label: workspace.status, variant: "outline" as const };
  const plan = workspace.metadata?.plan ?? workspace.metadata?.subscription_plan ?? "—";
  const accountId = owner?.sub_account_id ?? workspace.id.replace(/-/g, "").slice(0, 10).toUpperCase();
  const addressStr = workspace.address
    ? [workspace.address.street, workspace.address.city, workspace.address.state, workspace.address.zip].filter(Boolean).join(", ")
    : null;

  return (
    <SuperAdminLayout>
      <div className="space-y-5 px-1">

        {/* Back + Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 flex-shrink-0"
              onClick={() => navigate("/super-admin/workspaces")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{workspace.name}</h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                <span className="font-mono text-xs">{accountId}</span>
                <span className="opacity-40">·</span>
                <span>Created {fmtDate(workspace.created_at)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={workspace.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending_verification">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="support">Support Tickets</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-5 mt-0">

            {/* Info cards */}
            <div className="grid lg:grid-cols-3 gap-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" /> Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="Account ID"   value={<span className="font-mono text-xs">{accountId}</span>} />
                  <InfoRow label="Status"       value={<Badge variant={status.variant} className="text-xs">{status.label}</Badge>} />
                  <InfoRow label="Plan"         value={plan} />
                  <InfoRow label="Created"      value={fmtDate(workspace.created_at)} />
                  <InfoRow label="Last Updated" value={fmtDateTime(workspace.updated_at)} />
                  {workspace.verified_at && <InfoRow label="Verified On" value={fmtDate(workspace.verified_at)} />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> Business
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="Business Name" value={workspace.name} />
                  <InfoRow label="Category"      value={workspace.category ? workspace.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null} />
                  {workspace.subcategory && <InfoRow label="Subcategory" value={workspace.subcategory} />}
                  <InfoRow label="Email"   value={workspace.email} />
                  <InfoRow label="Phone"   value={workspace.phone} />
                  {workspace.website && <InfoRow label="Website" value={<a href={workspace.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{workspace.website}</a>} />}
                  {addressStr && <InfoRow label="Address" value={addressStr} />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Account Owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  {owner ? (
                    <>
                      <InfoRow label="Name"           value={owner.name} />
                      <InfoRow label="Email"          value={owner.email} />
                      <InfoRow label="Last Login"     value={owner.last_login ? fmtDateTime(owner.last_login) : "Never"} />
                      <InfoRow label="Email Verified" value={owner.email_verified
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Verified</span>
                        : <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Not verified</span>} />
                      <InfoRow label="2FA Enabled" value={owner.is_2fa_enabled
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Enabled</span>
                        : <span className="text-muted-foreground">Disabled</span>} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No owner assigned</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Statistics + Users + Connections */}
            <div className="grid lg:grid-cols-3 gap-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" /> Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 gap-px bg-border">
                    {[
                      { label: "Total Jobs",      value: stats?.jobs ?? 0,           sub: `${stats?.activeJobs ?? 0} active` },
                      { label: "Completed Jobs",  value: stats?.completedJobs ?? 0,  sub: undefined },
                      { label: "Total Reviews",   value: stats?.totalReviews ?? 0,   sub: stats && stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} ★ avg` : undefined },
                      { label: "Review Requests", value: stats?.reviewRequests ?? 0, sub: undefined },
                      { label: "Clients",         value: stats?.clients ?? 0,        sub: undefined },
                      { label: "Photos",          value: stats?.photos ?? 0,         sub: "All-time" },
                      { label: "Videos",          value: stats?.videos ?? 0,         sub: "All-time" },
                      { label: "Documents",       value: stats?.documents ?? 0,      sub: "All-time" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="bg-card px-4 py-3">
                        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                        <p className="text-lg font-bold leading-tight">{value}</p>
                        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" /> Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </CardContent>
                <CardContent className="p-0">
                  {workspaceUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                  ) : (() => {
                    const q = userSearch.toLowerCase();
                    const filtered = workspaceUsers.filter(
                      (u) =>
                        !q ||
                        (u.name ?? "").toLowerCase().includes(q) ||
                        (u.email ?? "").toLowerCase().includes(q)
                    );
                    const sorted = [...filtered].sort((a, b) => {
                      let av: string = "";
                      let bv: string = "";
                      if (userSortKey === "name") { av = a.name ?? ""; bv = b.name ?? ""; }
                      else if (userSortKey === "email") { av = a.email ?? ""; bv = b.email ?? ""; }
                      else if (userSortKey === "role") { av = a.role ?? ""; bv = b.role ?? ""; }
                      else if (userSortKey === "last_login") { av = a.last_login ?? ""; bv = b.last_login ?? ""; }
                      const cmp = av.localeCompare(bv);
                      return userSortDir === "asc" ? cmp : -cmp;
                    });
                    const toggleSort = (key: typeof userSortKey) => {
                      if (userSortKey === key) setUserSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else { setUserSortKey(key); setUserSortDir("asc"); }
                    };
                    const SortIcon = ({ k }: { k: typeof userSortKey }) =>
                      userSortKey === k ? (
                        userSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : null;
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              {([
                                { key: "name", label: "Name" },
                                { key: "email", label: "Email" },
                                { key: "role", label: "Role" },
                                { key: "last_login", label: "Last Login" },
                              ] as { key: typeof userSortKey; label: string }[]).map((col) => (
                                <th
                                  key={col.key}
                                  className="text-left px-4 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                                  onClick={() => toggleSort(col.key)}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {col.label}<SortIcon k={col.key} />
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {sorted.length === 0 ? (
                              <tr><td colSpan={4} className="text-center text-muted-foreground py-6 text-xs">No users match your search</td></tr>
                            ) : sorted.map((u) => {
                              const isOwner = u.id === owner?.id;
                              return (
                                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0 text-xs font-semibold">
                                        {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-medium truncate max-w-[120px]">{u.name ?? "—"}</span>
                                      {isOwner && <Badge variant="default" className="text-[10px] px-1.5 py-0">Owner</Badge>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[140px]">{u.email}</td>
                                  <td className="px-4 py-3">
                                    <Badge variant="outline" className="text-xs capitalize">{(u.role ?? "—").replace(/_/g, " ")}</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.last_login ? fmtDateTime(u.last_login) : "Never"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" /> Connections
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {(() => {
                      const sm = workspace.social_media ?? {};
                      const gmb = workspace.google_my_business ?? {};
                      const meta = workspace.metadata ?? {};
                      return [
                        { name: "Google My Business", identifier: workspace.google_place_id ?? gmb?.placeId ?? gmb?.place_id ?? null, identifierLabel: "Place ID", connected: !!(workspace.google_place_id || gmb?.placeId || gmb?.place_id), color: "bg-red-500", letter: "G" },
                        { name: "Facebook", identifier: sm?.facebook ?? sm?.facebook_page_id ?? meta?.facebook_page_id ?? null, identifierLabel: "Page", connected: !!(sm?.facebook || sm?.facebook_page_id || meta?.facebook_page_id), color: "bg-blue-600", letter: "f" },
                        { name: "Instagram", identifier: sm?.instagram ?? sm?.instagram_handle ?? meta?.instagram_handle ?? null, identifierLabel: "Handle", connected: !!(sm?.instagram || sm?.instagram_handle || meta?.instagram_handle), color: "bg-gradient-to-br from-purple-500 to-pink-500", letter: "In" },
                        { name: "GoHighLevel", identifier: meta?.ghl_location_id ?? meta?.gohighlevel_id ?? owner?.sub_account_id ?? null, identifierLabel: "Location ID", connected: !!(meta?.ghl_location_id || meta?.gohighlevel_id || owner?.sub_account_id), color: "bg-orange-500", letter: "GH" },
                        { name: "WordPress", identifier: meta?.wordpress_url ?? meta?.wp_url ?? sm?.wordpress ?? null, identifierLabel: "Site URL", connected: !!(meta?.wordpress_url || meta?.wp_url || sm?.wordpress), color: "bg-sky-600", letter: "W" },
                      ].map((conn) => (
                        <div key={conn.name} className="flex items-center gap-3 px-5 py-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 text-white text-xs font-bold ${conn.color}`}>{conn.letter}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{conn.name}</p>
                            {conn.connected && conn.identifier
                              ? <p className="text-xs text-muted-foreground truncate">{conn.identifierLabel}: <span className="font-mono">{conn.identifier}</span></p>
                              : <p className="text-xs text-muted-foreground">Not connected</p>}
                          </div>
                          <Badge variant={conn.connected ? "default" : "secondary"} className="text-xs flex-shrink-0">
                            {conn.connected ? "Connected" : "Not connected"}
                          </Badge>
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent activity */}
            <div className="grid lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" /> Recent Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {recentJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No jobs yet</p>
                  ) : (
                    <div className="divide-y">
                      {recentJobs.map((job) => {
                        const jStatus = JOB_STATUS_CONFIG[job.status] ?? { label: job.status, variant: "outline" as const };
                        return (
                          <div key={job.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{job.name}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(job.created_at)}</p>
                            </div>
                            <Badge variant={jStatus.variant} className="text-xs ml-3 flex-shrink-0">{jStatus.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" /> Recent Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {recentReviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No reviews yet</p>
                  ) : (
                    <div className="divide-y">
                      {recentReviews.map((review) => {
                        const authorName = review.author?.name ?? review.author?.displayName ?? "Anonymous";
                        return (
                          <div key={review.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{authorName}</span>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className="text-xs text-amber-500 font-semibold">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                                <span className="text-xs text-muted-foreground capitalize">{review.platform}</span>
                              </div>
                            </div>
                            {review.text && <p className="text-xs text-muted-foreground line-clamp-2">{review.text}</p>}
                            <p className="text-xs text-muted-foreground mt-1">{fmtDate(review.created_at)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing" className="space-y-5 mt-0">
            {(() => {
              const meta = workspace.metadata ?? {};
              const plan = meta.plan ?? meta.subscription_plan ?? null;
              const billingCycle = meta.billing_cycle ?? meta.billing_period ?? null;
              const amount = meta.amount ?? meta.monthly_amount ?? null;
              const currency = (meta.currency ?? "usd").toUpperCase();
              const nextRenewal = meta.next_renewal ?? meta.renewal_date ?? null;
              const trialEnds = meta.trial_ends ?? meta.trial_end_date ?? null;
              const billingEmail = meta.billing_email ?? workspace.email ?? null;
              const billingStatus = meta.billing_status ?? meta.subscription_status ?? workspace.status ?? null;
              const stripeCustomerId = meta.stripe_customer_id ?? meta.stripe_id ?? null;
              const stripeSubId = meta.stripe_subscription_id ?? meta.stripe_sub_id ?? null;
              const paypalCustomerId = meta.paypal_customer_id ?? meta.paypal_payer_id ?? null;
              const paypalSubId = meta.paypal_subscription_id ?? meta.paypal_agreement_id ?? null;
              const primaryProvider = meta.primary_payment_provider ?? meta.payment_provider ?? (stripeCustomerId ? "stripe" : paypalCustomerId ? "paypal" : null);
              const promoCode = meta.promo_code ?? meta.discount_code ?? null;
              const discountAmount = meta.discount ?? meta.discount_amount ?? null;
              const outstandingBalance = meta.outstanding_balance ?? meta.balance_due ?? null;

              // summary stats
              const billingStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
                active: "default", trialing: "default", past_due: "destructive",
                cancelled: "secondary", paused: "outline", unpaid: "destructive", none: "secondary",
              };

              const txTypeColors: Record<string, string> = {
                charge: "text-red-600", refund: "text-green-600", credit: "text-green-600",
                dispute: "text-orange-600", subscription_start: "text-blue-600",
                subscription_renewal: "text-blue-600", subscription_cancel: "text-muted-foreground",
                plan_upgrade: "text-purple-600", plan_downgrade: "text-muted-foreground",
                trial_start: "text-blue-600", trial_end: "text-muted-foreground",
                subscription_pause: "text-orange-600", manual: "text-muted-foreground",
              };
              const txStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
                succeeded: "default", failed: "destructive", pending: "outline",
                refunded: "secondary", disputed: "destructive", cancelled: "secondary",
              };

              const totalSpend = billingRecords
                .filter((r) => r.type === "charge" && r.status === "succeeded")
                .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
              const totalRefunds = billingRecords
                .filter((r) => r.type === "refund")
                .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
              const failedPayments = billingRecords.filter((r) => r.status === "failed").length;

              return (
                <>
                  {/* Summary strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Billing Status</p>
                      <div className="mt-1">
                        <Badge variant={billingStatusVariant[billingStatus ?? ""] ?? "outline"} className="text-sm capitalize">
                          {billingStatus?.replace(/_/g, " ") ?? "Unknown"}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Current Plan</p>
                      <p className="text-lg font-bold mt-0.5 capitalize">{plan ?? "—"}</p>
                      {billingCycle && <p className="text-xs text-muted-foreground capitalize">{billingCycle}</p>}
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Total Spend</p>
                      <p className="text-lg font-bold mt-0.5">
                        {totalSpend > 0 ? `${currency} ${totalSpend.toFixed(2)}` : "—"}
                      </p>
                      {totalRefunds > 0 && <p className="text-xs text-green-600">-{currency} {totalRefunds.toFixed(2)} refunded</p>}
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Failed Payments</p>
                      <p className={`text-lg font-bold mt-0.5 ${failedPayments > 0 ? "text-destructive" : ""}`}>{failedPayments}</p>
                      {outstandingBalance && <p className="text-xs text-destructive">{currency} {outstandingBalance} outstanding</p>}
                    </div>
                  </div>

                  {/* Subscription + Payment Providers side by side */}
                  <div className="grid lg:grid-cols-2 gap-5">
                    {/* Subscription Details */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" /> Subscription Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-0">
                        <InfoRow label="Plan" value={plan ? <span className="capitalize font-semibold">{plan}</span> : "—"} />
                        <InfoRow label="Status" value={
                          billingStatus
                            ? <Badge variant={billingStatusVariant[billingStatus] ?? "outline"} className="text-xs capitalize">{billingStatus.replace(/_/g, " ")}</Badge>
                            : "—"
                        } />
                        <InfoRow label="Billing Cycle" value={billingCycle ? <span className="capitalize">{billingCycle}</span> : "—"} />
                        <InfoRow label="Amount" value={amount ? `${currency} ${Number(amount).toFixed(2)} / ${billingCycle ?? "period"}` : "—"} />
                        <InfoRow label="Next Renewal" value={nextRenewal ? fmtDate(nextRenewal) : "—"} />
                        {trialEnds && <InfoRow label="Trial Ends" value={fmtDate(trialEnds)} />}
                        <InfoRow label="Billing Email" value={billingEmail ?? "—"} />
                        {promoCode && <InfoRow label="Promo Code" value={
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{promoCode}{discountAmount ? ` — ${discountAmount} off` : ""}</span>
                        } />}
                      </CardContent>
                    </Card>

                    {/* Payment Providers */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-muted-foreground" /> Payment Providers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {/* Stripe */}
                        <div className="px-5 py-4 border-b">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#635bff] text-white text-xs font-bold">S</div>
                              <span className="text-sm font-medium">Stripe</span>
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">Primary</Badge>
                            </div>
                            <Badge variant={stripeCustomerId ? "default" : "secondary"} className="text-xs">
                              {stripeCustomerId ? "Connected" : "Not connected"}
                            </Badge>
                          </div>
                          {stripeCustomerId && (
                            <div className="space-y-1 ml-9">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-28">Customer ID</span>
                                <span className="text-xs font-mono">{stripeCustomerId}</span>
                              </div>
                              {stripeSubId && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-28">Subscription</span>
                                  <span className="text-xs font-mono">{stripeSubId}</span>
                                </div>
                              )}
                              {meta.stripe_payment_method && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-28">Payment Method</span>
                                  <span className="text-xs capitalize">{meta.stripe_payment_method}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {!stripeCustomerId && (
                            <p className="text-xs text-muted-foreground ml-9">No Stripe account linked to this workspace</p>
                          )}
                        </div>
                        {/* PayPal */}
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#003087] text-white text-[10px] font-bold">PP</div>
                              <span className="text-sm font-medium">PayPal</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Backup</Badge>
                            </div>
                            <Badge variant={paypalCustomerId ? "default" : "secondary"} className="text-xs">
                              {paypalCustomerId ? "Connected" : "Not connected"}
                            </Badge>
                          </div>
                          {paypalCustomerId && (
                            <div className="space-y-1 ml-9">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-28">Payer ID</span>
                                <span className="text-xs font-mono">{paypalCustomerId}</span>
                              </div>
                              {paypalSubId && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-28">Agreement</span>
                                  <span className="text-xs font-mono">{paypalSubId}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {!paypalCustomerId && (
                            <p className="text-xs text-muted-foreground ml-9">No PayPal account linked to this workspace</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Plan Limitations */}
                  {(planData || plan) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" /> Plan Limitations &amp; Features
                          <span className="text-xs font-normal text-muted-foreground capitalize ml-1">({plan ?? planData?.name ?? "—"})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid lg:grid-cols-2 gap-6">
                          <div className="space-y-0">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Limits</p>
                            <InfoRow label="Max Users" value={planData?.max_users != null ? String(planData.max_users) : (meta.max_users ?? "—")} />
                            <InfoRow label="Max Businesses" value={planData?.max_businesses != null ? String(planData.max_businesses) : (meta.max_businesses ?? "—")} />
                            <InfoRow label="Storage Limit" value={meta.storage_limit ?? planData?.storage_limit ?? "—"} />
                            <InfoRow label="API Rate Limit" value={meta.api_rate_limit ?? planData?.api_rate_limit ?? "—"} />
                            <InfoRow label="Plan Price" value={planData?.price != null ? planData.price : (amount ? `${currency} ${Number(amount).toFixed(2)}` : "—")} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Features</p>
                            {planData?.features && planData.features.length > 0 ? (
                              <ul className="space-y-1.5">
                                {planData.features.map((f: string, i: number) => (
                                  <li key={i} className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            ) : meta.features ? (
                              <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{JSON.stringify(meta.features, null, 2)}</pre>
                            ) : (
                              <p className="text-sm text-muted-foreground">No feature list recorded for this plan</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Payment / Billing History */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" /> Payment &amp; Billing History
                        {billingRecords.length > 0 && (
                          <span className="ml-auto text-xs font-normal text-muted-foreground">{billingRecords.length} records</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {billingRecords.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No payment history recorded</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Provider</th>
                                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                                <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {billingRecords.map((rec) => {
                                const isCredit = ["refund", "credit"].includes(rec.type);
                                const fmtAmt = rec.amount != null
                                  ? `${isCredit ? "+" : ""}${(rec.currency ?? "usd").toUpperCase()} ${Math.abs(Number(rec.amount)).toFixed(2)}`
                                  : "—";
                                return (
                                  <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(rec.created_at)}</td>
                                    <td className="px-5 py-3">
                                      <p className="text-sm truncate max-w-[220px]">{rec.description ?? rec.plan_name ?? rec.type?.replace(/_/g, " ") ?? "—"}</p>
                                      {rec.invoice_id && <p className="text-xs text-muted-foreground font-mono">#{rec.invoice_id}</p>}
                                    </td>
                                    <td className="px-5 py-3">
                                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize`}>
                                        <span className={`h-2 w-2 rounded-full ${
                                          rec.payment_provider === "stripe" ? "bg-[#635bff]" :
                                          rec.payment_provider === "paypal" ? "bg-[#003087]" : "bg-muted-foreground"
                                        }`} />
                                        {rec.payment_provider ?? "—"}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      <span className={`text-xs font-medium capitalize ${txTypeColors[rec.type] ?? "text-muted-foreground"}`}>
                                        {rec.type?.replace(/_/g, " ") ?? "—"}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      <Badge variant={txStatusVariant[rec.status] ?? "outline"} className="text-xs capitalize">{rec.status ?? "—"}</Badge>
                                    </td>
                                    <td className={`px-5 py-3 text-right text-sm font-semibold whitespace-nowrap ${isCredit ? "text-green-600" : ""}`}>
                                      {fmtAmt}
                                      {rec.provider_receipt_url && (
                                        <a href={rec.provider_receipt_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-primary hover:underline">View</a>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* Support Tickets */}
          <TabsContent value="support" className="space-y-5 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-muted-foreground" /> Support Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No support tickets found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Ticket</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Submitted By</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Priority</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tickets.map((t) => {
                          const tStatus: Record<string, "default" | "secondary" | "destructive" | "outline"> = { open: "outline", "in-progress": "default", resolved: "secondary", closed: "secondary" };
                          const tPriority: Record<string, "default" | "secondary" | "destructive" | "outline"> = { urgent: "destructive", high: "default", medium: "outline", low: "secondary" };
                          return (
                            <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium truncate max-w-[240px]">{t.title}</p>
                                <p className="text-xs text-muted-foreground">#{t.ticket_number}</p>
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{t.submitted_by ?? "—"}</td>
                              <td className="px-5 py-3">
                                <Badge variant={tPriority[t.priority] ?? "outline"} className="text-xs capitalize">{t.priority ?? "—"}</Badge>
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant={tStatus[t.status] ?? "outline"} className="text-xs capitalize">{(t.status ?? "—").replace("-", " ")}</Badge>
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDate(t.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks */}
          <TabsContent value="tasks" className="space-y-5 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" /> Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tasks found for this workspace</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Task</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Priority</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Due Date</th>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tasks.map((task) => {
                          const tPriority: Record<string, "default" | "secondary" | "destructive" | "outline"> = { urgent: "destructive", high: "default", medium: "outline", normal: "outline", low: "secondary" };
                          const tStatus: Record<string, "default" | "secondary" | "destructive" | "outline"> = { completed: "secondary", done: "secondary", "in-progress": "default", in_progress: "default", open: "outline", pending: "outline", cancelled: "destructive" };
                          return (
                            <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium truncate max-w-[280px]">{task.title ?? "Untitled"}</p>
                              </td>
                              <td className="px-5 py-3">
                                {task.priority ? <Badge variant={tPriority[task.priority] ?? "outline"} className="text-xs capitalize">{task.priority}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-5 py-3">
                                {task.status ? <Badge variant={tStatus[task.status] ?? "outline"} className="text-xs capitalize">{task.status.replace(/_/g, " ")}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{task.due_date ? fmtDate(task.due_date) : "—"}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{fmtDate(task.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-5 mt-0">
            {workspace.settings && Object.keys(workspace.settings).length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Workspace Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto">
                    {JSON.stringify(workspace.settings, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No settings configured</p>
            )}
          </TabsContent>

        </Tabs>

        {/* Internal Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" /> Internal Notes
              <span className="text-xs font-normal text-muted-foreground ml-1">(visible to super admins only)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add note */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Add an internal note about this workspace…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[80px] text-sm resize-none flex-1"
              />
              <Button
                size="sm"
                disabled={!newNote.trim() || savingNote}
                className="self-end"
                onClick={async () => {
                  if (!newNote.trim() || !id) return;
                  setSavingNote(true);
                  try {
                    const { data, error } = await supabaseClient
                      .from("business_notes")
                      .insert({ business_id: id, note: newNote.trim(), admin_user: "Super Admin" })
                      .select("id, note, admin_user, created_at")
                      .single();
                    if (error) throw error;
                    setNotes((prev) => [data, ...prev]);
                    setNewNote("");
                    toast.success("Note saved");
                  } catch (err: any) {
                    toast.error("Failed to save note: " + (err?.message ?? "Unknown"));
                  } finally {
                    setSavingNote(false);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing notes */}
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-muted/40 border px-4 py-3 group relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-muted-foreground">{note.admin_user}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{fmtDateTime(note.created_at)}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            try {
                              const { error } = await supabaseClient.from("business_notes").delete().eq("id", note.id);
                              if (error) throw error;
                              setNotes((prev) => prev.filter((n) => n.id !== note.id));
                              toast.success("Note deleted");
                            } catch (err: any) {
                              toast.error("Failed to delete note");
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </SuperAdminLayout>
  );
}
