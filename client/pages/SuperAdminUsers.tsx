import React, { useState, useEffect, useCallback } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Building2,
  Shield,
  Search,
  MoreVertical,
  Eye,
  Edit,
  UserPlus,
  Download,
  RefreshCw,
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Ban,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
type DbRole = "super_admin" | "agency_admin" | "business_owner" | "staff" | "viewer";

interface DbUser {
  id: string;
  email: string;
  name: string | null;
  role: DbRole;
  created_at: string;
  last_login: string | null;
  email_verified: boolean;
  phone: string | null;
  avatar_url: string | null;
  // joined from businesses
  business_name?: string | null;
}

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<DbRole, string> = {
  super_admin: "Super Admin",
  agency_admin: "Agency Admin",
  business_owner: "Business Owner",
  staff: "Staff",
  viewer: "Viewer",
};

const ROLE_VARIANTS: Record<DbRole, "default" | "secondary" | "outline" | "destructive"> = {
  super_admin: "destructive",
  agency_admin: "default",
  business_owner: "default",
  staff: "secondary",
  viewer: "outline",
};

const ROLE_ICONS: Record<DbRole, React.ReactNode> = {
  super_admin: <Shield className="h-4 w-4 text-red-500" />,
  agency_admin: <Shield className="h-4 w-4 text-purple-500" />,
  business_owner: <Building2 className="h-4 w-4 text-blue-500" />,
  staff: <Users className="h-4 w-4 text-green-500" />,
  viewer: <Eye className="h-4 w-4 text-gray-400" />,
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function SuperAdminUsers() {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabaseClient
        .from("users")
        .select(
          `id, email, name, role, created_at, last_login, email_verified, phone, avatar_url,
           businesses(name)`,
          { count: "exact" },
        )
        .order(sortField, { ascending: sortDirection === "asc" })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }

      if (searchTerm.trim()) {
        query = query.or(
          `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`,
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const mapped: DbUser[] = (data ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        created_at: u.created_at,
        last_login: u.last_login,
        email_verified: u.email_verified,
        phone: u.phone,
        avatar_url: u.avatar_url,
        business_name: u.businesses?.[0]?.name ?? null,
      }));

      setUsers(mapped);
      setTotal(count ?? 0);
    } catch (err: any) {
      toast.error("Failed to load users: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, searchTerm, sortField, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, searchTerm, sortField, sortDirection]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Email", "Role", "Business", "Joined", "Last Login", "Email Verified"].join(","),
      ...users.map((u) =>
        [
          u.name ?? "",
          u.email,
          ROLE_LABELS[u.role] ?? u.role,
          u.business_name ?? "",
          u.created_at ? new Date(u.created_at).toLocaleDateString() : "",
          u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never",
          u.email_verified ? "Yes" : "No",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Users exported");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              {loading ? "Loading…" : `${total.toLocaleString()} users in the system`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || users.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
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
                  <SelectItem value="business_owner">Business Owner</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {loading
                ? "Loading users…"
                : total === 0
                ? "No users found"
                : `Showing ${from}–${to} of ${total.toLocaleString()} users`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex items-center font-semibold hover:text-foreground transition-colors"
                      >
                        User <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[130px]">
                      <button
                        onClick={() => handleSort("role")}
                        className="flex items-center font-semibold hover:text-foreground transition-colors"
                      >
                        Role <SortIcon field="role" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[160px]">Business</TableHead>
                    <TableHead className="min-w-[120px]">
                      <button
                        onClick={() => handleSort("created_at")}
                        className="flex items-center font-semibold hover:text-foreground transition-colors"
                      >
                        Joined <SortIcon field="created_at" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      <button
                        onClick={() => handleSort("last_login")}
                        className="flex items-center font-semibold hover:text-foreground transition-colors"
                      >
                        Last Login <SortIcon field="last_login" />
                      </button>
                    </TableHead>
                    <TableHead className="min-w-[90px]">Verified</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(7)].map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 w-full animate-pulse bg-muted rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No users found</p>
                        <p className="text-sm mt-1">Try adjusting your search or filters</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id} className="group">
                        {/* User */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                              {(user.name ?? user.email)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {user.name ?? <span className="text-muted-foreground italic">No name</span>}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 shrink-0" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {ROLE_ICONS[user.role]}
                            <Badge variant={ROLE_VARIANTS[user.role]} className="text-xs">
                              {ROLE_LABELS[user.role] ?? user.role}
                            </Badge>
                          </div>
                        </TableCell>

                        {/* Business */}
                        <TableCell className="text-sm text-muted-foreground">
                          {user.business_name ?? "—"}
                        </TableCell>

                        {/* Joined */}
                        <TableCell className="text-sm text-muted-foreground">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString()
                            : "—"}
                        </TableCell>

                        {/* Last Login */}
                        <TableCell className="text-sm text-muted-foreground">
                          {user.last_login
                            ? new Date(user.last_login).toLocaleDateString()
                            : <span className="italic">Never</span>}
                        </TableCell>

                        {/* Email Verified */}
                        <TableCell>
                          <Badge variant={user.email_verified ? "default" : "secondary"} className="text-xs">
                            {user.email_verified ? "Verified" : "Unverified"}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
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
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
