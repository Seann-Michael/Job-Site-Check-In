import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
} from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

      // 4. Workspace users — owner + anyone assigned to jobs in this workspace
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

        {/* Main content grid */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Account */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" /> Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <InfoRow label="Account ID"   value={<span className="font-mono text-xs">{accountId}</span>} icon={Hash} />
              <InfoRow label="Status"       value={<Badge variant={status.variant} className="text-xs">{status.label}</Badge>} />
              <InfoRow label="Plan"         value={plan} icon={TrendingUp} />
              <InfoRow label="Created"      value={fmtDate(workspace.created_at)} icon={Calendar} />
              <InfoRow label="Last Updated" value={fmtDateTime(workspace.updated_at)} icon={Activity} />
              {workspace.verified_at && <InfoRow label="Verified On" value={fmtDate(workspace.verified_at)} icon={CheckCircle} />}
            </CardContent>
          </Card>

          {/* Business Info */}
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
              <InfoRow label="Email"   value={workspace.email}   icon={Mail} />
              <InfoRow label="Phone"   value={workspace.phone}   icon={Phone} />
              {workspace.website && <InfoRow label="Website" value={<a href={workspace.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{workspace.website}</a>} icon={Globe} />}
              {addressStr && <InfoRow label="Address" value={addressStr} icon={MapPin} />}
            </CardContent>
          </Card>

          {/* Owner Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Account Owner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {owner ? (
                <>
                  <InfoRow label="Name"          value={owner.name} icon={User} />
                  <InfoRow label="Email"         value={owner.email} icon={Mail} />
                  <InfoRow label="Last Login"    value={owner.last_login ? fmtDateTime(owner.last_login) : "Never"} icon={Clock} />
                  <InfoRow label="Email Verified" value={
                    owner.email_verified
                      ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Verified</span>
                      : <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Not verified</span>
                  } />
                  <InfoRow label="2FA Enabled" value={
                    owner.is_2fa_enabled
                      ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Enabled</span>
                      : <span className="text-muted-foreground">Disabled</span>
                  } />
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No owner assigned</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Statistics + Users + Connections — 3-col grid */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" /> Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-px bg-border">
                {[
                  { label: "Total Jobs",      value: stats?.jobs ?? 0,          sub: `${stats?.activeJobs ?? 0} active` },
                  { label: "Completed Jobs",  value: stats?.completedJobs ?? 0, sub: undefined },
                  { label: "Total Reviews",   value: stats?.totalReviews ?? 0,  sub: stats && stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} ★ avg` : undefined },
                  { label: "Review Requests", value: stats?.reviewRequests ?? 0, sub: undefined },
                  { label: "Clients",         value: stats?.clients ?? 0,       sub: undefined },
                  { label: "Photos",          value: stats?.photos ?? 0,        sub: "All-time" },
                  { label: "Videos",          value: stats?.videos ?? 0,        sub: "All-time" },
                  { label: "Documents",       value: stats?.documents ?? 0,     sub: "All-time" },
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

          {/* Users */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" /> Users
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {workspaceUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
              ) : (
                <div className="divide-y">
                  {workspaceUsers.map((u) => {
                    const isOwner = u.id === owner?.id;
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 text-sm font-semibold">
                          {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {isOwner && <Badge variant="default" className="text-xs">Owner</Badge>}
                          <Badge variant="outline" className="text-xs capitalize">{u.role?.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connections */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" /> Connections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {(() => {
                  const sm = workspace.social_media as Record<string, any> | null ?? {};
                  const gmb = workspace.google_my_business as Record<string, any> | null ?? {};
                  const meta = workspace.metadata as Record<string, any> | null ?? {};

                  const connections = [
                    {
                      name: "Google My Business",
                      identifier: workspace.google_place_id ?? gmb?.placeId ?? gmb?.place_id ?? null,
                      identifierLabel: "Place ID",
                      connected: !!(workspace.google_place_id || gmb?.placeId || gmb?.place_id),
                      color: "bg-red-500",
                      letter: "G",
                    },
                    {
                      name: "Facebook",
                      identifier: sm?.facebook ?? sm?.facebook_page_id ?? meta?.facebook_page_id ?? null,
                      identifierLabel: "Page",
                      connected: !!(sm?.facebook || sm?.facebook_page_id || meta?.facebook_page_id),
                      color: "bg-blue-600",
                      letter: "f",
                    },
                    {
                      name: "Instagram",
                      identifier: sm?.instagram ?? sm?.instagram_handle ?? meta?.instagram_handle ?? null,
                      identifierLabel: "Handle",
                      connected: !!(sm?.instagram || sm?.instagram_handle || meta?.instagram_handle),
                      color: "bg-gradient-to-br from-purple-500 to-pink-500",
                      letter: "In",
                    },
                    {
                      name: "GoHighLevel",
                      identifier: meta?.ghl_location_id ?? meta?.gohighlevel_id ?? owner?.sub_account_id ?? null,
                      identifierLabel: "Location ID",
                      connected: !!(meta?.ghl_location_id || meta?.gohighlevel_id || owner?.sub_account_id),
                      color: "bg-orange-500",
                      letter: "GH",
                    },
                    {
                      name: "WordPress",
                      identifier: meta?.wordpress_url ?? meta?.wp_url ?? sm?.wordpress ?? null,
                      identifierLabel: "Site URL",
                      connected: !!(meta?.wordpress_url || meta?.wp_url || sm?.wordpress),
                      color: "bg-sky-600",
                      letter: "W",
                    },
                  ];

                  return connections.map((conn) => (
                    <div key={conn.name} className="flex items-center gap-3 px-5 py-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 text-white text-xs font-bold ${conn.color}`}>
                        {conn.letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{conn.name}</p>
                        {conn.connected && conn.identifier ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {conn.identifierLabel}: <span className="font-mono">{conn.identifier}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not connected</p>
                        )}
                      </div>
                      <Badge
                        variant={conn.connected ? "default" : "secondary"}
                        className="text-xs flex-shrink-0"
                      >
                        {conn.connected ? "Connected" : "Not connected"}
                      </Badge>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Recent activity — 2-col grid */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Recent Jobs */}
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
                        <Badge variant={jStatus.variant} className="text-xs ml-3 flex-shrink-0">
                          {jStatus.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Reviews */}
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
                        {review.text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{review.text}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{fmtDate(review.created_at)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Settings / Config (if present) */}
        {workspace.settings && Object.keys(workspace.settings).length > 0 && (
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
        )}

      </div>
    </SuperAdminLayout>
  );
}
