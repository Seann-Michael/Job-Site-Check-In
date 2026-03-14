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
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

export default function BusinessManagement() {
  const navigate = useNavigate();
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

  const mockBusinesses: Business[] = [
    {
      id: "1",
      name: "Smith Construction LLC",
      admin: "John Smith",
      email: "john@smithconstruction.com",
      users: 8,
      photos: 1247,
      videos: 89,
      projects: 34,
      storage: "2.4GB",
      plan: "Pro",
      status: "Active",
      lastActivity: "2 hours ago",
      signupDate: "2023-08-15",
      revenue: 348,
    },
    {
      id: "2",
      name: "Premier Renovations",
      admin: "Sarah Johnson",
      email: "sarah@premierrenovations.com",
      users: 12,
      photos: 2156,
      videos: 156,
      projects: 67,
      storage: "4.1GB",
      plan: "Enterprise",
      status: "Active",
      lastActivity: "1 hour ago",
      signupDate: "2023-06-22",
      revenue: 1197,
    },
    {
      id: "3",
      name: "Quick Fix Contractors",
      admin: "Mike Wilson",
      email: "mike@quickfixcontractors.com",
      users: 3,
      photos: 423,
      videos: 12,
      projects: 18,
      storage: "890MB",
      plan: "Free",
      status: "Trial",
      lastActivity: "1 day ago",
      signupDate: "2024-01-10",
      revenue: 0,
    },
    {
      id: "4",
      name: "Elite Roofing Solutions",
      admin: "David Rodriguez",
      email: "david@eliteroofing.com",
      users: 15,
      photos: 3892,
      videos: 234,
      projects: 89,
      storage: "7.2GB",
      plan: "Enterprise",
      status: "Active",
      lastActivity: "30 minutes ago",
      signupDate: "2023-03-12",
      revenue: 1595,
    },
    {
      id: "5",
      name: "Budget Builders",
      admin: "Lisa Chen",
      email: "lisa@budgetbuilders.com",
      users: 4,
      photos: 156,
      videos: 8,
      projects: 12,
      storage: "340MB",
      plan: "Free",
      status: "Canceled",
      lastActivity: "2 weeks ago",
      signupDate: "2023-11-08",
      canceledDate: "2024-01-15",
      revenue: 87,
    },
  ];

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

  const sortedBusinesses = [...mockBusinesses].sort((a, b) => {
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

  const impersonateUser = (businessId: string) => {
    const targetBusiness = mockBusinesses.find((b) => b.id === businessId);
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
    </div>
  );
}
