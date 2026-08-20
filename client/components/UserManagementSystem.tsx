import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Users,
  Download,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Crown,
  UserPlus,
  Trash2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { workspaceService } from "@/lib/workspaceService";
import { useMyRole } from "@/hooks/useMyRole";
import {
  MEMBER_ROLES,
  TEAM_ROLES,
  type BusinessTeam,
  type MemberRole,
  type TeamMember,
  fetchBusinessTeam,
  inviteTeamMember,
  removeTeamMember,
  roleLabel,
  updateTeamMemberRole,
} from "@/lib/settingsTeamService";
import { downloadCsv } from "@/lib/dataExport";

interface UserManagementSystemProps {
  /** Business to manage. Defaults to the current workspace business. */
  businessId?: string;
  /**
   * Force management controls on (super admin contexts). When omitted the
   * component enables them for the business owner and super admins only.
   */
  canManage?: boolean;
  /** Hide the page-level heading (when embedded inside another card). */
  embedded?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Team for a business: the owner (from `businesses.owner_id`) plus every
 * `business_members` row, loaded from `/api/team/:businessId`.
 */
export function UserManagementSystem({
  businessId: businessIdProp,
  canManage: canManageProp,
  embedded = false,
}: UserManagementSystemProps) {
  const [businessId, setBusinessId] = useState<string | null>(
    businessIdProp ?? workspaceService.getCurrentBusinessId(),
  );
  const [team, setTeam] = useState<BusinessTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    name: string;
    role: MemberRole;
  }>({ email: "", name: "", role: "staff" });
  const [inviting, setInviting] = useState(false);

  // Remove confirm
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const myRole = useMyRole(businessId);
  const canManage = canManageProp ?? myRole.canManageTeam;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let id = businessIdProp ?? null;
      if (!id) {
        let ws = workspaceService.getState();
        if (!ws.initialized) ws = await workspaceService.initialize();
        id = ws.currentBusinessId;
      }
      if (!id) {
        throw new Error("No business is associated with this account.");
      }
      setBusinessId(id);
      setTeam(await fetchBusinessTeam(id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load team";
      setError(msg);
      toast.error(`Couldn't load team members: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [businessIdProp]);

  useEffect(() => {
    load();
  }, [load]);

  const members = team?.members ?? [];
  const owner = team?.owner ?? null;

  const q = searchQuery.trim().toLowerCase();
  const matches = (name: string | null, email: string) =>
    !q ||
    (name ?? "").toLowerCase().includes(q) ||
    email.toLowerCase().includes(q);

  const showOwner =
    !!owner &&
    matches(owner.name, owner.email) &&
    (filterRole === "all" || filterRole === "owner");
  const filtered = members.filter(
    (m) =>
      matches(m.name, m.email) &&
      (filterRole === "all" || m.role === filterRole),
  );
  const visibleCount = filtered.length + (showOwner ? 1 : 0);

  const handleRoleChange = async (member: TeamMember, role: MemberRole) => {
    if (!businessId || member.role === role) return;
    setSavingId(member.id);
    const previous = member.role;
    setTeam((t) =>
      t
        ? {
            ...t,
            members: t.members.map((m) =>
              m.id === member.id ? { ...m, role } : m,
            ),
          }
        : t,
    );
    try {
      await updateTeamMemberRole(businessId, member.id, role);
      toast.success(`${member.name || member.email} is now ${roleLabel(role)}`);
    } catch (err) {
      setTeam((t) =>
        t
          ? {
              ...t,
              members: t.members.map((m) =>
                m.id === member.id ? { ...m, role: previous } : m,
              ),
            }
          : t,
      );
      toast.error(
        `Couldn't update role: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleInvite = async () => {
    if (!businessId) return;
    const email = inviteForm.email.trim();
    if (!EMAIL_RE.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setInviting(true);
    try {
      const created = await inviteTeamMember(businessId, {
        email,
        name: inviteForm.name,
        role: inviteForm.role,
      });
      setTeam((t) =>
        t
          ? {
              ...t,
              members: [
                ...t.members.filter((m) => m.id !== created.id),
                created,
              ],
            }
          : t,
      );
      setInviteOpen(false);
      setInviteForm({ email: "", name: "", role: "staff" });
      toast.success(`Invitation sent to ${email}`);
    } catch (err) {
      toast.error(
        `Couldn't send invite: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async () => {
    if (!businessId || !removeTarget) return;
    setRemoving(true);
    const target = removeTarget;
    try {
      await removeTeamMember(businessId, target.id);
      setTeam((t) =>
        t ? { ...t, members: t.members.filter((m) => m.id !== target.id) } : t,
      );
      toast.success(`${target.name || target.email} removed from the team`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(
        `Couldn't remove member: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setRemoving(false);
    }
  };

  const exportMembers = () => {
    if (!owner && members.length === 0) {
      toast.error("There are no team members to export.");
      return;
    }
    const rows = [
      ...(owner
        ? [
            {
              name: owner.name ?? "",
              email: owner.email,
              role: "Owner",
              status: "Active",
              created_at: "",
            },
          ]
        : []),
      ...members.map((m) => ({
        name: m.name ?? "",
        email: m.email,
        role: roleLabel(m.role),
        status: m.status === "invited" ? "Invited" : "Active",
        created_at: m.createdAt ?? "",
      })),
    ];
    downloadCsv("team", rows, [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Added" },
    ]);
  };

  const initials = (name: string | null, email: string) =>
    (name || email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {!embedded ? (
          <div>
            <h2 className="text-2xl font-bold">Team</h2>
            <p className="text-muted-foreground mt-1">
              People with access to this business and their roles
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="flex gap-2 flex-wrap">
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
          {canManage && (
            <Button
              onClick={() => setInviteOpen(true)}
              disabled={loading || !businessId}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite user
            </Button>
          )}
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
                placeholder="Search by name or email…"
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
          <CardTitle>Members ({visibleCount})</CardTitle>
          <CardDescription>
            {canManage
              ? "The business owner and everyone you've invited. Invited users receive an email to set their password."
              : "The business owner and everyone invited to this business."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
            </div>
          ) : visibleCount === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {!owner && members.length === 0
                  ? "No team members found for this business."
                  : "No members match your filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {showOwner && owner && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                      {initials(owner.name, owner.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {owner.name || owner.email}
                        </p>
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="h-3 w-3" /> Owner
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {owner.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              )}

              {filtered.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                      {initials(m.name, m.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {m.name || m.email}
                        </p>
                        {!canManage && (
                          <Badge variant="outline">{roleLabel(m.role)}</Badge>
                        )}
                        {m.status === "invited" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-300 bg-amber-50 text-amber-900"
                          >
                            <Mail className="h-3 w-3" /> Invited
                          </Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {m.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added{" "}
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      {savingId === m.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <Select
                        value={m.role}
                        disabled={savingId === m.id}
                        onValueChange={(v) =>
                          handleRoleChange(m, v as MemberRole)
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBER_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${m.name || m.email}`}
                        disabled={savingId === m.id}
                        onClick={() => setRemoveTarget(m)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They'll receive an email with a link to set their password and
              join this business.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                placeholder="Full name (optional)"
                value={inviteForm.name}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) =>
                  setInviteForm((f) => ({ ...f, role: v as MemberRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ul className="text-xs text-muted-foreground space-y-1 pt-1">
                {MEMBER_ROLES.map((r) => (
                  <li key={r.value}>
                    <span className="font-medium text-foreground">
                      {r.label}:
                    </span>{" "}
                    {r.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteForm.email.trim()}
            >
              {inviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name || removeTarget?.email} will immediately lose
              access to this business. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
