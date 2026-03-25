import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Camera,
  Video,
  FolderOpen,
  Eye,
  LogIn,
  Search,
  Download,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns,
  Ban,
  Trash2,
  MoreVertical,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";

interface Business {
  id: string;
  name: string;
  admin: string;
  email: string;
  users: number;
  photos: number;
  videos: number;
  projects: number;
  storage: string;
  plan: "Free" | "Pro" | "Enterprise";
  status: "Active" | "Trial" | "Suspended" | "Canceled";
  lastActivity: string;
  signupDate: string;
  canceledDate?: string;
  revenue: number;
}

type SortKey = keyof Business;
type SortDirection = "asc" | "desc" | null;

function mapDbStatus(dbStatus: string): Business["status"] {
  if (dbStatus === "suspended") return "Suspended";
  if (dbStatus === "pending_verification") return "Trial";
  if (dbStatus === "inactive" || dbStatus === "deleted") return "Canceled";
  return "Active";
}

export default function BusinessManagement() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    business: true,
    status: true,
    plan: true,
    users: true,
    content: true,
    storage: true,
    lastActivity: true,
  });

  useEffect(() => {
    const fetchBusinesses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseClient
          .from("businesses")
          .select(`id, name, email, phone, status, created_at, updated_at, metadata, owner:owner_id(name, email)`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped: Business[] = (data ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          admin: b.owner?.name ?? b.owner?.email ?? "—",
          email: b.owner?.email ?? b.email ?? "—",
          users: 0,
          photos: 0,
          videos: 0,
          projects: 0,
          storage: "—",
          plan: (b.metadata?.plan as Business["plan"]) ?? "Free",
          status: mapDbStatus(b.status),
          lastActivity: b.updated_at ? new Date(b.updated_at).toLocaleDateString() : "—",
          signupDate: b.created_at ? new Date(b.created_at).toISOString().slice(0, 10) : "—",
          revenue: 0,
        }));
        setBusinesses(mapped);
      } catch (err: any) {
        toast.error("Failed to load businesses: " + (err?.message ?? "Unknown error"));
      } finally {
        setLoading(false);
      }
    };
    fetchBusinesses();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(
        sortDirection === "asc"
          ? "desc"
          : sortDirection === "desc"
            ? null
            : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4" />;
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortDirection === "desc") return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  const sortedBusinesses = [...businesses].sort((a, b) => {
    if (!sortKey || !sortDirection) return 0;

    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  const filteredBusinesses = sortedBusinesses.filter((business) => {
    const matchesSearch =
      business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.admin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || business.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const [suspendTarget, setSuspendTarget] = useState<Business | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null);

  const handleSuspend = async (business: Business) => {
    try {
      const newStatus = business.status === "Suspended" ? "active" : "suspended";
      const { error } = await supabaseClient
        .from("businesses")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", business.id);
      if (error) throw error;
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === business.id ? { ...b, status: mapDbStatus(newStatus) } : b,
        ),
      );
      setSuspendTarget(null);
      toast.success(
        newStatus === "suspended"
          ? `${business.name} has been suspended`
          : `${business.name} has been reactivated`,
      );
    } catch (err: any) {
      toast.error("Failed: " + (err?.message ?? "Unknown error"));
    }
  };

  const handleDelete = async (business: Business) => {
    try {
      const { error } = await supabaseClient
        .from("businesses")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", business.id);
      if (error) throw error;
      setBusinesses((prev) => prev.filter((b) => b.id !== business.id));
      setDeleteTarget(null);
      toast.success(`${business.name} has been deleted`);
    } catch (err: any) {
      toast.error("Failed: " + (err?.message ?? "Unknown error"));
    }
  };

  const impersonateUser = (businessId: string) => {
    const targetBusiness = businesses.find((b) => b.id === businessId);
    if (targetBusiness) {
      toast.success(`Signing in as ${targetBusiness.admin}...`);
      localStorage.setItem(
        "superadmin_session",
        JSON.stringify({ id: "superadmin", role: "superadmin" }),
      );

      const impersonatedUser = {
        id: businessId,
        name: targetBusiness.admin,
        email: targetBusiness.email,
        role: "admin",
        isImpersonated: true,
      };

      localStorage.setItem("auth_user", JSON.stringify(impersonatedUser));
      navigate("/admin/jobs", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading businesses…
      </div>
    );
  }

  return (
    <div className="w-full max-w-none overflow-x-auto min-w-0">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Businesses ({filteredBusinesses.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search businesses..."
                  className="pl-8 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-full w-max">
              <Table className="table-fixed w-full min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("name")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Business
                        {getSortIcon("name")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("status")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Status
                        {getSortIcon("status")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("plan")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Plan
                        {getSortIcon("plan")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("users")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Users
                        {getSortIcon("users")}
                      </Button>
                    </TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("storage")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Storage
                        {getSortIcon("storage")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("revenue")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Revenue
                        {getSortIcon("revenue")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("signupDate")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Signup Date
                        {getSortIcon("signupDate")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("canceledDate")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Cancel Date
                        {getSortIcon("canceledDate")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("lastActivity")}
                        className="h-auto p-0 font-semibold gap-1"
                      >
                        Last Activity
                        {getSortIcon("lastActivity")}
                      </Button>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.map((business) => (
                    <TableRow
                      key={business.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        navigate(`/super-admin/business/${business.id}`)
                      }
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{business.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {business.admin}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {business.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            business.status === "Active"
                              ? "default"
                              : business.status === "Trial"
                                ? "secondary"
                                : business.status === "Suspended"
                                  ? "destructive"
                                  : "outline"
                          }
                        >
                          {business.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            business.plan === "Enterprise"
                              ? "default"
                              : business.plan === "Pro"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {business.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{business.users}</div>
                          <div className="text-xs text-muted-foreground">
                            users
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs">
                            <Camera className="h-3 w-3" />
                            {business.photos}
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <Video className="h-3 w-3" />
                            {business.videos}
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <FolderOpen className="h-3 w-3" />
                            {business.projects}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{business.storage}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">${business.revenue}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(business.signupDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {business.canceledDate ? (
                          <div className="text-sm text-red-600">
                            {new Date(
                              business.canceledDate,
                            ).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">-</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{business.lastActivity}</div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => impersonateUser(business.id)}
                            className="gap-1"
                          >
                            <LogIn className="h-3 w-3" />
                            Sign In As
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              navigate(`/super-admin/business/${business.id}`)
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSuspendTarget(business)}>
                                {business.status === "Suspended" ? (
                                  <><CheckCircle className="mr-2 h-4 w-4" />Reactivate</>
                                ) : (
                                  <><Ban className="mr-2 h-4 w-4" />Suspend</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(business)}
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suspend Confirm */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.status === "Suspended" ? "Reactivate Business" : "Suspend Business"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.status === "Suspended"
                ? `Reactivate ${suspendTarget?.name}? They will regain full access.`
                : `Suspend ${suspendTarget?.name}? Users will lose access immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={suspendTarget?.status === "Suspended" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              onClick={() => suspendTarget && handleSuspend(suspendTarget)}
            >
              {suspendTarget?.status === "Suspended" ? "Reactivate" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Business</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              This marks the business as deleted and cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
