import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Plus,
  Shield,
  User,
  Mail,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import { Input as SearchInput } from "@/components/ui/input";
import { inviteInternalUser } from "@/lib/adminUserService";
import { AlertTriangle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type StaffRole = "super_admin" | "agency_admin" | "staff" | "viewer";

interface StaffMember {
  id: string;
  name: string | null;
  email: string;
  role: StaffRole;
  created_at: string;
  last_login: string | null;
  email_verified: boolean;
  phone: string | null;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  agency_admin: "Agency Admin",
  staff: "Staff",
  viewer: "Viewer",
};

const ROLE_VARIANTS: Record<StaffRole, "default" | "secondary" | "outline" | "destructive"> = {
  super_admin: "destructive",
  agency_admin: "default",
  staff: "secondary",
  viewer: "outline",
};

// ── Blank form ─────────────────────────────────────────────────────────────────
const blankForm = () => ({
  name: "",
  email: "",
  role: "staff" as StaffRole,
  phone: "",
});

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminStaff() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState(blankForm());

  // Invite internal (super admin) user dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });
  const [inviting, setInviting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      // Show super_admin + staff + agency_admin — i.e. everyone except regular business_owner/viewer
      let query = supabaseClient
        .from("users")
        .select("id, name, email, role, created_at, last_login, email_verified, phone")
        .in("role", ["super_admin", "agency_admin", "staff", "viewer"])
        .order("created_at", { ascending: false });

      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMembers((data as StaffMember[]) ?? []);
    } catch (err: any) {
      toast.error("Failed to load staff: " + (err?.message ?? "Unknown"));
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = members.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.name?.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term)
    );
  });

  // ── Invite internal user (creates a login-capable super admin) ─────────────
  const openInvite = () => {
    setInviteForm({ name: "", email: "" });
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    const email = inviteForm.email.trim();
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setInviting(true);
    try {
      await inviteInternalUser({ email, name: inviteForm.name });
      toast.success(`Invitation sent to ${email}`);
      setInviteOpen(false);
      setInviteForm({ name: "", email: "" });
      fetchMembers();
    } catch (err: any) {
      toast.error("Failed to send invite: " + (err?.message ?? "Unknown error"));
    } finally {
      setInviting(false);
    }
  };

  const openEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setFormData({ name: m.name ?? "", email: m.email, role: m.role, phone: m.phone ?? "" });
    setDialogOpen(true);
  };

  // ── Save (update existing only) ────────────────────────────────────────────
  // New staff are created via the invite endpoint (openInvite) so they get a
  // real auth account and can log in. This path only edits existing records.
  const handleSave = async () => {
    if (!editingId) return;
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabaseClient
        .from("users")
        .update({
          name: formData.name || null,
          email: formData.email,
          role: formData.role,
          phone: formData.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (error) throw error;
      toast.success("Staff member updated");
      setDialogOpen(false);
      fetchMembers();
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
      const { error } = await supabaseClient
        .from("users")
        .delete()
        .eq("id", deleteTargetId);
      if (error) throw error;
      toast.success("Staff member removed");
      setDeleteTargetId(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  // ── Toggle role between active super_admin and staff ────────────────────────
  const toggleActive = async (m: StaffMember) => {
    const newRole: StaffRole = m.role === "super_admin" ? "staff" : "super_admin";
    try {
      const { error } = await supabaseClient
        .from("users")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", m.id);
      if (error) throw error;
      toast.success(`${m.name ?? m.email} role updated to ${ROLE_LABELS[newRole]}`);
      fetchMembers();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const superAdminCount = members.filter((m) => m.role === "super_admin").length;
  const recentlyActive = members.filter(
    (m) => m.last_login && new Date(m.last_login) > new Date(Date.now() - 7 * 86400000),
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Staff</h1>
            <p className="text-muted-foreground">
              Manage staff members and their access roles
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button className="gap-2" onClick={openInvite}>
              <Plus className="h-4 w-4" />
              Invite internal user
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : members.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : superAdminCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active (7d)</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="h-7 w-10 animate-pulse bg-muted rounded" /> : recentlyActive}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading
                  ? <div className="h-7 w-10 animate-pulse bg-muted rounded" />
                  : members.filter((m) => m.email_verified).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <SearchInput
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="agency_admin">Agency Admin</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Staff Members</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} member${filtered.length !== 1 ? "s" : ""} shown`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Member</TableHead>
                    <TableHead className="min-w-[130px]">Role</TableHead>
                    <TableHead className="min-w-[100px]">Verified</TableHead>
                    <TableHead className="min-w-[120px]">Joined</TableHead>
                    <TableHead className="min-w-[120px]">Last Login</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(6)].map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 w-full animate-pulse bg-muted rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No staff members found</p>
                        <p className="text-sm mt-1">Invite an internal user to get started</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((m) => (
                      <TableRow key={m.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                                {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {m.name ?? <span className="italic text-muted-foreground">No name</span>}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3 shrink-0" />
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={ROLE_VARIANTS[m.role]}>
                            {ROLE_LABELS[m.role] ?? m.role}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant={m.email_verified ? "default" : "secondary"} className="text-xs">
                            {m.email_verified ? "Verified" : "Unverified"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {m.last_login
                            ? new Date(m.last_login).toLocaleDateString()
                            : <span className="italic">Never</span>}
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(m)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(m)}>
                                {m.role === "super_admin" ? (
                                  <>
                                    <UserX className="mr-2 h-4 w-4" />
                                    Demote to Staff
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Promote to Super Admin
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTargetId(m.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this staff member's details in Supabase."
                : "Add a new staff member. They'll need to sign up at /signup to gain login access."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full Name</Label>
              <Input
                id="staff-name"
                placeholder="Jane Smith"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email Address <span className="text-destructive">*</span></Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="jane@company.com"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                disabled={!!editingId}
              />
              {editingId && (
                <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-phone">Phone (optional)</Label>
              <Input
                id="staff-phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData((p) => ({ ...p, role: v as StaffRole }))}
              >
                <SelectTrigger id="staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="agency_admin">Agency Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {editingId ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Internal User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !inviting && setInviteOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite internal user</DialogTitle>
            <DialogDescription>
              Sends an email invite. The user sets a password and joins as a Super Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>Super Admin grants full access to every account</strong> on this
                platform, including billing, settings and all customer data. Only invite
                trusted internal staff.
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input
                id="invite-name"
                placeholder="Jane Smith"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Super Admin</Badge>
                <span className="text-xs text-muted-foreground">Fixed for internal invites</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteForm.email.trim()} className="gap-2">
              {inviting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the user record from Supabase. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
