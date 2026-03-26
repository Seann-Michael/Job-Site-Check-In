import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Users,
  Calendar,
  Activity,
  Hash,
  Shield,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Workspace {
  id: string;
  name: string;
  status: "active" | "inactive" | "pending_verification" | "suspended" | "deleted";
  created_at: string;
  updated_at: string;
  owner_email: string | null;
  owner_name: string | null;
  sub_account_id: string | null;
  plan: string;
  metadata: Record<string, any> | null;
}

type SortField = "name" | "sub_account_id" | "created_at" | "updated_at" | "status" | "plan";
type SortDir = "asc" | "desc";

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active:               { label: "Active",           variant: "default" },
  inactive:             { label: "Inactive",         variant: "secondary" },
  pending_verification: { label: "Pending",          variant: "outline" },
  suspended:            { label: "Suspended",        variant: "destructive" },
  deleted:              { label: "Deleted",          variant: "destructive" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 10).toUpperCase();
}

// ── Sort Icon ──────────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
    : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
}

// ── Column header ──────────────────────────────────────────────────────────────
function ColHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className = "",
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  return (
    <button
      className={`flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors select-none ${className}`}
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────
function WorkspaceRow({ ws, onClick }: { ws: Workspace; onClick: () => void }) {
  const status = STATUS_CONFIG[ws.status] ?? { label: ws.status, variant: "outline" as const };
  const accountId = ws.sub_account_id ?? shortId(ws.id);
  return (
    <div
      className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.9fr_1fr] gap-3 items-center px-4 py-3 border-b hover:bg-muted/40 transition-colors text-sm cursor-pointer"
      onClick={onClick}
    >
      {/* Business Name + owner */}
      <div className="min-w-0">
        <p className="font-medium truncate">{ws.name}</p>
        {ws.owner_email && (
          <p className="text-xs text-muted-foreground truncate">{ws.owner_email}</p>
        )}
      </div>
      {/* Account Number */}
      <div className="font-mono text-xs text-muted-foreground truncate">{accountId}</div>
      {/* Date Created */}
      <div className="text-xs text-muted-foreground">{fmtDate(ws.created_at)}</div>
      {/* Last Activity */}
      <div className="text-xs text-muted-foreground">{fmtDateTime(ws.updated_at)}</div>
      {/* Status */}
      <div>
        <Badge variant={status.variant} className="text-xs">
          {status.label}
        </Badge>
      </div>
      {/* Plan */}
      <div className="text-xs text-muted-foreground">{ws.plan}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SuperAdminWorkspaces() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Summary stats
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, pending: 0 });

  const parentRef = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const { data: businesses, error } = await supabaseClient
        .from("businesses")
        .select("id, name, status, created_at, updated_at, owner_id, metadata")
        .order("name", { ascending: true });

      if (error) throw error;

      // Fetch owner info separately
      const ownerIds = [...new Set((businesses ?? []).map((b: any) => b.owner_id).filter(Boolean))];
      let ownerMap: Record<string, { email: string; name: string; sub_account_id: string }> = {};

      if (ownerIds.length > 0) {
        const { data: users } = await supabaseClient
          .from("users")
          .select("id, email, name, sub_account_id")
          .in("id", ownerIds);
        (users ?? []).forEach((u: any) => {
          ownerMap[u.id] = { email: u.email, name: u.name, sub_account_id: u.sub_account_id };
        });
      }

      const rows: Workspace[] = (businesses ?? []).map((b: any) => {
        const owner = b.owner_id ? ownerMap[b.owner_id] : null;
        const plan = b.metadata?.plan ?? b.metadata?.subscription_plan ?? "—";
        return {
          id: b.id,
          name: b.name,
          status: b.status,
          created_at: b.created_at,
          updated_at: b.updated_at,
          owner_email: owner?.email ?? null,
          owner_name: owner?.name ?? null,
          sub_account_id: owner?.sub_account_id ?? null,
          plan,
          metadata: b.metadata,
        };
      });

      setWorkspaces(rows);
      setStats({
        total: rows.length,
        active: rows.filter((r) => r.status === "active").length,
        suspended: rows.filter((r) => r.status === "suspended").length,
        pending: rows.filter((r) => r.status === "pending_verification").length,
      });
      setLastRefreshed(new Date());
    } catch (err: any) {
      toast.error("Failed to load workspaces: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? workspaces.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            (w.owner_email ?? "").toLowerCase().includes(q) ||
            (w.owner_name ?? "").toLowerCase().includes(q) ||
            (w.sub_account_id ?? "").toLowerCase().includes(q) ||
            shortId(w.id).toLowerCase().includes(q) ||
            w.status.toLowerCase().includes(q) ||
            w.plan.toLowerCase().includes(q),
        )
      : workspaces;

    return [...base].sort((a, b) => {
      let aVal: string = "";
      let bVal: string = "";
      if (sortField === "name") { aVal = a.name; bVal = b.name; }
      else if (sortField === "sub_account_id") { aVal = a.sub_account_id ?? shortId(a.id); bVal = b.sub_account_id ?? shortId(b.id); }
      else if (sortField === "created_at") { aVal = a.created_at; bVal = b.created_at; }
      else if (sortField === "updated_at") { aVal = a.updated_at; bVal = b.updated_at; }
      else if (sortField === "status") { aVal = a.status; bVal = b.status; }
      else if (sortField === "plan") { aVal = a.plan; bVal = b.plan; }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [workspaces, search, sortField, sortDir]);

  // ── Virtual scroll ─────────────────────────────────────────────────────────
  const ROW_HEIGHT = 64;
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <SuperAdminLayout>
      <div className="space-y-5 px-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Workspaces
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              All workspace accounts on the platform
              {lastRefreshed && (
                <span className="ml-2 text-xs opacity-60">
                  · Last updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWorkspaces} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Workspaces", value: stats.total, icon: Building2, color: "text-blue-500" },
            { label: "Active",           value: stats.active, icon: Activity, color: "text-green-500" },
            { label: "Suspended",        value: stats.suspended, icon: Shield, color: "text-red-500" },
            { label: "Pending",          value: stats.pending, icon: Calendar, color: "text-amber-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color} flex-shrink-0`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                {loading ? (
                  <div className="h-6 w-8 animate-pulse bg-muted rounded mt-0.5" />
                ) : (
                  <p className="text-xl font-bold leading-tight">{value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, account ID, status, or plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          {search && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.9fr_1fr] gap-3 items-center px-4 py-2.5 bg-muted/30 border-b">
            <ColHeader field="name"           label="Business Name"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader field="sub_account_id" label="Account ID"       sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader field="created_at"     label="Created"          sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader field="updated_at"     label="Last Activity"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader field="status"         label="Status"           sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            <ColHeader field="plan"           label="Plan"             sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>

          {/* Virtual Scroll Body */}
          {loading ? (
            <div className="divide-y">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.9fr_1fr] gap-3 items-center px-4 py-3">
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  ))}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">{search ? "No workspaces match your search" : "No workspaces found"}</p>
              {search && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div
              ref={parentRef}
              style={{ height: Math.min(filtered.length * ROW_HEIGHT, 560), overflowY: "auto" }}
            >
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((vRow) => {
                  const ws = filtered[vRow.index];
                  return (
                    <div
                      key={ws.id}
                      style={{
                        position: "absolute",
                        top: vRow.start,
                        left: 0,
                        right: 0,
                        height: ROW_HEIGHT,
                      }}
                    >
                      <WorkspaceRow ws={ws} onClick={() => navigate(`/super-admin/workspaces/${ws.id}`)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground bg-muted/20">
              Showing {filtered.length.toLocaleString()} workspace{filtered.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </div>
          )}
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
