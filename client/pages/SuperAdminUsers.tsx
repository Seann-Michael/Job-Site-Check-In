// @ts-nocheck - Temporary suppression of type errors
import React, { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminAgencyManagement from "./SuperAdminAgencyManagement";
import BusinessManagement from "./BusinessManagement";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Building2,
  Shield,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  UserPlus,
  Download,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  Columns,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agency-admin" | "staff" | "viewer";
  status: "active" | "inactive" | "pending" | "suspended" | "cancelled";
  type: "business-owner" | "agency-admin" | "staff-member";
  organization?: string;
  lastLogin: string;
  lastActive: string;
  signupDate: string;
  subscription?: string;
  cancellationDate?: string;
}

export default function SuperAdminUsers() {
  const [activeTab, setActiveTab] = useState("all-users");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    role: true,
    status: true,
    organization: true,
    lastActive: true,
    signupDate: false,
    subscription: false,
    cancellationDate: false,
  });

  // Mock user data
  const users: User[] = [
    {
      id: "1",
      name: "John Smith",
      email: "john@smithconstruction.com",
      role: "admin",
      status: "active",
      type: "business-owner",
      organization: "Smith Construction LLC",
      lastLogin: "2024-01-21T10:30:00Z",
      lastActive: "2024-01-21T15:45:00Z",
      signupDate: "2023-08-15",
      subscription: "Pro",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah@digitalmarketingpro.com",
      role: "agency-admin",
      status: "active",
      type: "agency-admin",
      organization: "Digital Marketing Pro",
      lastLogin: "2024-01-21T09:15:00Z",
      lastActive: "2024-01-21T14:22:00Z",
      signupDate: "2024-01-10",
      subscription: "Professional",
    },
    {
      id: "3",
      name: "Mike Wilson",
      email: "mike@joespizza.com",
      role: "staff",
      status: "active",
      type: "staff-member",
      organization: "Joe's Pizza",
      lastLogin: "2024-01-20T16:45:00Z",
      lastActive: "2024-01-21T08:30:00Z",
      signupDate: "2024-01-15",
    },
    {
      id: "4",
      name: "Lisa Rodriguez",
      email: "lisa@premierrenovations.com",
      role: "admin",
      status: "cancelled",
      type: "business-owner",
      organization: "Premier Renovations",
      lastLogin: "2024-01-19T14:20:00Z",
      lastActive: "2024-01-19T14:20:00Z",
      signupDate: "2024-01-18",
      subscription: "Enterprise",
      cancellationDate: "2024-01-20",
    },
  ];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const toggleColumn = (columnKey: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey as keyof typeof prev],
    }));
  };

  const filteredUsers = users
    .filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (
        searchTerm &&
        !user.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !user.organization?.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const aValue = a[sortField as keyof User];
      const bValue = b[sortField as keyof User];

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active" },
      inactive: { variant: "secondary" as const, label: "Inactive" },
      pending: { variant: "outline" as const, label: "Pending" },
      suspended: { variant: "destructive" as const, label: "Suspended" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "secondary" as const,
      label: status || "Unknown"
    };

    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { variant: "default" as const, label: "Admin" },
      "agency-admin": { variant: "default" as const, label: "Agency Admin" },
      staff: { variant: "secondary" as const, label: "Staff" },
      viewer: { variant: "outline" as const, label: "Viewer" },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || {
      variant: "secondary" as const,
      label: role || "Unknown"
    };

    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "business-owner":
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case "agency-admin":
        return <Shield className="h-4 w-4 text-purple-500" />;
      case "staff-member":
        return <Users className="h-4 w-4 text-green-500" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getTotalStats = () => {
    const activeUsers = users.filter((u) => u.status === "active").length;
    const businessOwners = users.filter(
      (u) => u.type === "business-owner",
    ).length;
    const agencies = users.filter((u) => u.type === "agency-admin").length;
    const totalRevenue = users.reduce(
      (sum, user) => sum + (user.revenue || 0),
      0,
    );

    return { activeUsers, businessOwners, agencies, totalRevenue };
  };

  const stats = getTotalStats();

  return (
    <SuperAdminLayout>
      <div className="w-full max-w-none overflow-x-auto">
        <div className="space-y-6 min-w-0">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-muted-foreground">
                Manage all users, businesses, and agencies across the platform
              </p>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Columns className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {Object.entries(visibleColumns).map(([key, visible]) => (
                    <DropdownMenuItem
                      key={key}
                      className="flex items-center gap-2"
                      onClick={() => toggleColumn(key)}
                    >
                      <Checkbox checked={visible} onChange={() => {}} />
                      <span className="capitalize">
                        {key === "lastActive"
                          ? "Last Active"
                          : key === "signupDate"
                            ? "Signup Date"
                            : key === "cancellationDate"
                              ? "Cancellation Date"
                              : key}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all-users">
                <Users className="h-4 w-4 mr-2" />
                All Users
              </TabsTrigger>
              <TabsTrigger value="business-owners">
                <Building2 className="h-4 w-4 mr-2" />
                Business Owners
              </TabsTrigger>
              <TabsTrigger value="agencies">
                <Shield className="h-4 w-4 mr-2" />
                Agencies
              </TabsTrigger>
            </TabsList>

            {/* All Users Tab */}
            <TabsContent value="all-users" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agency-admin">
                          Agency Admin
                        </SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Users Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Users ({filteredUsers.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <div className="min-w-full w-max">
                      <Table className="table-fixed w-full min-w-[800px]">
                        <TableHeader>
                          <TableRow>
                            {visibleColumns.user && (
                              <TableHead className="w-64 min-w-[200px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("name")}
                                >
                                  User
                                  {getSortIcon("name")}
                                </Button>
                              </TableHead>
                            )}
                            {visibleColumns.role && (
                              <TableHead className="w-32 min-w-[120px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("role")}
                                >
                                  Role
                                  {getSortIcon("role")}
                                </Button>
                              </TableHead>
                            )}
                            {visibleColumns.status && (
                              <TableHead className="w-32 min-w-[120px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("status")}
                                >
                                  Status
                                  {getSortIcon("status")}
                                </Button>
                              </TableHead>
                            )}
                            {visibleColumns.organization && (
                              <TableHead className="w-48 min-w-[180px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("organization")}
                                >
                                  Organization
                                  {getSortIcon("organization")}
                                </Button>
                              </TableHead>
                            )}
                            {visibleColumns.lastActive && (
                              <TableHead className="w-36 min-w-[140px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("lastActive")}
                                >
                                  Last Active
                                  {getSortIcon("lastActive")}
                                </Button>
                              </TableHead>
                            )}

                            {visibleColumns.signupDate && (
                              <TableHead className="w-36 min-w-[140px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("signupDate")}
                                >
                                  Signup Date
                                  {getSortIcon("signupDate")}
                                </Button>
                              </TableHead>
                            )}
                            {visibleColumns.subscription && (
                              <TableHead className="w-36 min-w-[140px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("subscription")}
                                >
                                  Subscription
                                  {getSortIcon("subscription")}
                                </Button>
                              </TableHead>
                            )}
                            {visibleColumns.cancellationDate && (
                              <TableHead className="w-36 min-w-[140px]">
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 font-semibold"
                                  onClick={() => handleSort("cancellationDate")}
                                >
                                  Cancellation Date
                                  {getSortIcon("cancellationDate")}
                                </Button>
                              </TableHead>
                            )}
                            <TableHead className="w-24 min-w-[100px]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              {visibleColumns.user && (
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {getTypeIcon(user.type)}
                                    <div>
                                      <div className="font-medium">
                                        {user.name}
                                      </div>
                                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {user.email}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.role && (
                                <TableCell>{getRoleBadge(user.role)}</TableCell>
                              )}
                              {visibleColumns.status && (
                                <TableCell>
                                  {getStatusBadge(user.status)}
                                </TableCell>
                              )}
                              {visibleColumns.organization && (
                                <TableCell>
                                  <div className="font-medium">
                                    {user.organization}
                                  </div>
                                  {user.subscription && (
                                    <div className="text-sm text-muted-foreground">
                                      {user.subscription} plan
                                    </div>
                                  )}
                                </TableCell>
                              )}
                              {visibleColumns.lastActive && (
                                <TableCell>
                                  <div className="text-sm">
                                    {new Date(
                                      user.lastActive,
                                    ).toLocaleDateString()}
                                  </div>
                                </TableCell>
                              )}

                              {visibleColumns.signupDate && (
                                <TableCell>
                                  <div className="text-sm">
                                    {new Date(
                                      user.signupDate,
                                    ).toLocaleDateString()}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.subscription && (
                                <TableCell>
                                  {user.subscription ? (
                                    <Badge variant="outline">
                                      {user.subscription}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Free
                                    </span>
                                  )}
                                </TableCell>
                              )}
                              {visibleColumns.cancellationDate && (
                                <TableCell>
                                  {user.cancellationDate ? (
                                    <div className="text-sm text-red-600">
                                      {new Date(
                                        user.cancellationDate,
                                      ).toLocaleDateString()}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
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
                                      Send Message
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Business Owners Tab */}
            <TabsContent value="business-owners">
              <BusinessManagement />
            </TabsContent>

            {/* Agencies Tab */}
            <TabsContent value="agencies">
              <SuperAdminAgencyManagement />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
