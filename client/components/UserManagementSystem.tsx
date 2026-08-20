import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Users,
  Download,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { workspaceService } from "@/lib/workspaceService";
import { isSuperAdmin } from "@/lib/auth";
import {
  TEAM_ROLES,
  type TeamMember,
  type TeamRole,
  fetchBusinessTeam,
  roleLabel,
  updateTeamMemberRole,
} from "@/lib/settingsTeamService";
import { downloadCsv } from "@/lib/dataExport";

/**
 * Team members for the current business: the owner plus everyone assigned to
 * one of its jobs. Roles are the real `users.role` values. Inviting new
 * members requires account creation and lives with the auth work.
 */
export function UserManagementSystem() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let ws = workspaceService.getState();
      if (!ws.initialized) ws = await workspaceService.initialize();
      if (!ws.currentBusinessId) {
        throw new Error("No business is associated with this account.");
      }
      const team = await fetchBusinessTeam(ws.currentBusinessId);
      // Defense in depth: super admins are never shown as team members.
      setMembers(team.filter((m) => m.role !== "super_admin"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load team";
      setError(msg);
      toast.error(`Couldn't load team members: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (m.name ?? "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.phone ?? "").toLowerCase().includes(q);
    const matchesRole = filterRole === "all" || m.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Role changes are restricted to super admins at the database level.
  const canEditRoles = isSuperAdmin();

  const handleRoleChange = async (member: TeamMember, role: TeamRole) => {
    if (member.role === role) return;
    setSavingId(member.id);
    const previous = member.role;
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, role } : m)),
    );
    try {
      await updateTeamMemberRole(member.id, role);
      toast.success(`${member.name || member.email} is now ${roleLabel(role)}`);
    } catch (err) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: previous } : m)),
      );
      toast.error(
        `Couldn't update role: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setSavingId(null);
    }
  };

  const exportMembers = () => {
    if (members.length === 0) {
      toast.error("There are no team members to export.");
      return;
    }
    downloadCsv(
      "team",
      members.map((m) => ({
        name: m.name ?? "",
        email: m.email,
        role: roleLabel(m.role),
        phone: m.phone ?? "",
        last_login: m.last_login ?? "",
        created_at: m.created_at ?? "",
      })),
      [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role" },
        { key: "phone", label: "Phone" },
        { key: "last_login", label: "Last Login" },
        { key: "created_at", label: "Created" },
      ],
    );
  };

  const knownRole = (role: string): role is TeamRole =>
    TEAM_ROLES.some((r) => r.value === role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <p className="text-muted-foreground mt-1">
            People with access to this business and their roles
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportMembers}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {TEAM_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({filtered.length})</CardTitle>
          <CardDescription>
            The business owner and everyone assigned to one of its jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {members.length === 0
                  ? "No team members found for this business."
                  : "No members match your filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                      {(m.name || m.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {m.name || m.email}
                        </p>
                        {m.isOwner && (
                          <Badge variant="secondary" className="gap-1">
                            <Crown className="h-3 w-3" /> Owner
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {m.email}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last login:{" "}
                        {m.last_login
                          ? new Date(m.last_login).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingId === m.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {knownRole(m.role) && canEditRoles ? (
                      <Select
                        value={m.role}
                        disabled={savingId === m.id || m.isOwner}
                        onValueChange={(v) =>
                          handleRoleChange(m, v as TeamRole)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEAM_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {roleLabel(m.role)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
