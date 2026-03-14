import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Users,
  Activity,
  Database,
  Eye,
  Camera,
  Video,
  FolderOpen,
  Search,
  Download,
  RefreshCw,
  LogIn,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  businessId: string;
  businessName: string;
  status: "Active" | "Inactive" | "Suspended";
  lastLogin: string;
  joinedDate: string;
  totalLogins: number;
  photosUploaded: number;
  videosUploaded: number;
  projectsCreated: number;
  storageUsed: string;
  accountAge: string;
  activityLevel: "High" | "Medium" | "Low";
  plan: "Free" | "Pro" | "Enterprise";
}

type SortKey = keyof UserDetail;
type SortDirection = "asc" | "desc" | null;

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Mock users data
  const allUsers: UserDetail[] = [
    {
      id: "1",
      name: "John Smith",
      email: "john@smithconstruction.com",
      role: "admin",
      businessId: "1",
      businessName: "Smith Construction LLC",
      status: "Active",
      lastLogin: "2 hours ago",
      joinedDate: "2023-08-15",
      totalLogins: 247,
      photosUploaded: 456,
      videosUploaded: 23,
      projectsCreated: 12,
      storageUsed: "1.2GB",
      accountAge: "5 months",
      activityLevel: "High",
      plan: "Pro",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@smithconstruction.com",
      role: "editor",
      businessId: "1",
      businessName: "Smith Construction LLC",
      status: "Active",
      lastLogin: "1 day ago",
      joinedDate: "2023-09-01",
      totalLogins: 89,
      photosUploaded: 789,
      videosUploaded: 45,
      projectsCreated: 18,
      storageUsed: "890MB",
      accountAge: "4 months",
      activityLevel: "High",
      plan: "Pro",
    },
    {
      id: "3",
      name: "Sarah Johnson",
      email: "sarah@premierrenovations.com",
      role: "admin",
      businessId: "2",
      businessName: "Premier Renovations",
      status: "Active",
      lastLogin: "1 hour ago",
      joinedDate: "2023-06-22",
      totalLogins: 342,
      photosUploaded: 1234,
      videosUploaded: 78,
      projectsCreated: 45,
      storageUsed: "2.1GB",
      accountAge: "7 months",
      activityLevel: "High",
      plan: "Enterprise",
    },
    {
      id: "4",
      name: "Mike Wilson",
      email: "mike@quickfixcontractors.com",
      role: "admin",
      businessId: "3",
      businessName: "Quick Fix Contractors",
      status: "Active",
      lastLogin: "1 day ago",
      joinedDate: "2024-01-10",
      totalLogins: 45,
      photosUploaded: 156,
      videosUploaded: 8,
      projectsCreated: 6,
      storageUsed: "340MB",
      accountAge: "2 weeks",
      activityLevel: "Medium",
      plan: "Free",
    },
    {
      id: "5",
      name: "Lisa Chen",
      email: "lisa@budgetbuilders.com",
      role: "admin",
      businessId: "5",
      businessName: "Budget Builders",
      status: "Suspended",
      lastLogin: "2 weeks ago",
      joinedDate: "2023-11-08",
      totalLogins: 23,
      photosUploaded: 45,
      videosUploaded: 2,
      projectsCreated: 3,
      storageUsed: "120MB",
      accountAge: "2 months",
      activityLevel: "Low",
      plan: "Free",
    },
    {
      id: "6",
      name: "Tom Rodriguez",
      email: "tom@premierrenovations.com",
      role: "editor",
      businessId: "2",
      businessName: "Premier Renovations",
      status: "Active",
      lastLogin: "3 hours ago",
      joinedDate: "2023-07-15",
      totalLogins: 156,
      photosUploaded: 567,
      videosUploaded: 34,
      projectsCreated: 22,
      storageUsed: "1.5GB",
      accountAge: "6 months",
      activityLevel: "High",
      plan: "Enterprise",
    },
    {
      id: "7",
      name: "Amy Davis",
      email: "amy@eliteroofing.com",
      role: "admin",
      businessId: "4",
      businessName: "Elite Roofing Solutions",
      status: "Active",
      lastLogin: "30 minutes ago",
      joinedDate: "2023-03-12",
      totalLogins: 456,
      photosUploaded: 2341,
      videosUploaded: 123,
      projectsCreated: 67,
      storageUsed: "4.2GB",
      accountAge: "10 months",
      activityLevel: "High",
      plan: "Enterprise",
    },
  ];

  const uniqueBusinesses = allUsers.reduce(
    (acc, user) => {
      if (!acc.find((business) => business.id === user.businessId)) {
        acc.push({
          id: user.businessId,
          name: user.businessName,
        });
      }
      return acc;
    },
    [] as { id: string; name: string }[],
  );

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

  const sortedUsers = [...allUsers].sort((a, b) => {
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

  const filteredUsers = sortedUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.businessName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      user.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesBusiness =
      businessFilter === "all" || user.businessId === businessFilter;

    return matchesSearch && matchesStatus && matchesRole && matchesBusiness;
  });

  const impersonateUser = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      toast.success(`Signing in as ${user.name}...`);
      localStorage.setItem(
        "superadmin_session",
        JSON.stringify({ id: "superadmin", role: "superadmin" }),
      );

      const impersonatedUser = {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        isImpersonated: true,
      };

      localStorage.setItem("auth_user", JSON.stringify(impersonatedUser));
      navigate("/admin/jobs", { replace: true });
    }
  };

  const viewUserDetail = (user: UserDetail) => {
    setSelectedUser(user);
    setShowUserDetail(true);
  };

  // Summary statistics
  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter((u) => u.status === "Active").length;
  const totalPhotos = allUsers.reduce((sum, u) => sum + u.photosUploaded, 0);
  const totalProjects = allUsers.reduce((sum, u) => sum + u.projectsCreated, 0);

  return (
    <SuperAdminLayout
      title="User Management"
      breadcrumbs={[{ label: "User Management" }]}
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">{activeUsers}</p>
                  <p className="text-xs text-muted-foreground">
                    {((activeUsers / totalUsers) * 100).toFixed(1)}% active
                  </p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Photos</p>
                  <p className="text-2xl font-bold">
                    {totalPhotos.toLocaleString()}
                  </p>
                </div>
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Projects
                  </p>
                  <p className="text-2xl font-bold">{totalProjects}</p>
                </div>
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Users ({filteredUsers.length})</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-8 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={businessFilter}
                  onValueChange={setBusinessFilter}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Businesses</SelectItem>
                    {uniqueBusinesses.map((business) => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("name")}
                      className="h-auto p-0 font-semibold gap-1"
                    >
                      User
                      {getSortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("businessName")}
                      className="h-auto p-0 font-semibold gap-1"
                    >
                      Business
                      {getSortIcon("businessName")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("role")}
                      className="h-auto p-0 font-semibold gap-1"
                    >
                      Role
                      {getSortIcon("role")}
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
                  <TableHead>Content</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("storageUsed")}
                      className="h-auto p-0 font-semibold gap-1"
                    >
                      Storage
                      {getSortIcon("storageUsed")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("activityLevel")}
                      className="h-auto p-0 font-semibold gap-1"
                    >
                      Activity
                      {getSortIcon("activityLevel")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("lastLogin")}
                      className="h-auto p-0 font-semibold gap-1"
                    >
                      Last Login
                      {getSortIcon("lastLogin")}
                    </Button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => viewUserDetail(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.businessName}</div>
                        <Badge variant="outline" className="text-xs">
                          {user.plan}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === "Active"
                            ? "default"
                            : user.status === "Suspended"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs">
                          <Camera className="h-3 w-3" />
                          {user.photosUploaded}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Video className="h-3 w-3" />
                          {user.videosUploaded}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <FolderOpen className="h-3 w-3" />
                          {user.projectsCreated}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{user.storageUsed}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <Badge
                          variant={
                            user.activityLevel === "High"
                              ? "default"
                              : user.activityLevel === "Medium"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {user.activityLevel}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {user.totalLogins} logins
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{user.lastLogin}</div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => impersonateUser(user.id)}
                          className="gap-1"
                        >
                          <LogIn className="h-3 w-3" />
                          Sign In As
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewUserDetail(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Detail Modal */}
        <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Details: {selectedUser?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">User Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Email:</span>{" "}
                        {selectedUser.email}
                      </div>
                      <div>
                        <span className="font-medium">Role:</span>{" "}
                        {selectedUser.role}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>{" "}
                        {selectedUser.status}
                      </div>
                      <div>
                        <span className="font-medium">Joined:</span>{" "}
                        {new Date(selectedUser.joinedDate).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Account Age:</span>{" "}
                        {selectedUser.accountAge}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Business Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Business:</span>{" "}
                        {selectedUser.businessName}
                      </div>
                      <div>
                        <span className="font-medium">Plan:</span>{" "}
                        {selectedUser.plan}
                      </div>
                      <div>
                        <span className="font-medium">Last Login:</span>{" "}
                        {selectedUser.lastLogin}
                      </div>
                      <div>
                        <span className="font-medium">Total Logins:</span>{" "}
                        {selectedUser.totalLogins}
                      </div>
                      <div>
                        <span className="font-medium">Activity Level:</span>{" "}
                        {selectedUser.activityLevel}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Content Statistics</h4>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-3 border rounded-lg">
                      <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-bold">
                        {selectedUser.photosUploaded}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Photos
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <Video className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-bold">
                        {selectedUser.videosUploaded}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Videos
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <FolderOpen className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-bold">
                        {selectedUser.projectsCreated}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Projects
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <Database className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <div className="font-bold">
                        {selectedUser.storageUsed}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Storage
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => impersonateUser(selectedUser.id)}
                    className="gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In As This User
                  </Button>
                  <Button onClick={() => setShowUserDetail(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
