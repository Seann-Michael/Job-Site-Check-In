// @ts-nocheck - Temporary suppression of type errors
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
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Plus,
  Shield,
  User,
  Mail,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Settings,
  Eye,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: "super-admin" | "admin" | "support";
  status: "active" | "inactive" | "pending";
  lastLogin: string;
  createdDate: string;
  permissions: string[];
  avatar?: string;
}

export default function SuperAdminStaff() {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "admin" as const,
    permissions: [] as string[],
  });

  const availablePermissions = [
    "User Management",
    "Business Management",
    "Agency Management",
    "Financial Dashboard",
    "System Settings",
    "Support Management",
    "Database Access",
    "Analytics & Reports",
  ];

  useEffect(() => {
    // Load existing super admin users
    const existingUsers = JSON.parse(
      localStorage.getItem("super_admin_users") || "[]",
    );

    if (existingUsers.length === 0) {
      const sampleUsers: SuperAdminUser[] = [
        {
          id: "1",
          name: "John Doe",
          email: "john@localgmbbooster.com",
          role: "super-admin",
          status: "active",
          lastLogin: "2024-03-15T10:30:00Z",
          createdDate: "2024-01-15",
          permissions: availablePermissions,
        },
        {
          id: "2",
          name: "Sarah Wilson",
          email: "sarah@localgmbbooster.com",
          role: "admin",
          status: "active",
          lastLogin: "2024-03-14T15:20:00Z",
          createdDate: "2024-02-01",
          permissions: [
            "User Management",
            "Business Management",
            "Support Management",
          ],
        },
        {
          id: "3",
          name: "Mike Johnson",
          email: "mike@localgmbbooster.com",
          role: "support",
          status: "active",
          lastLogin: "2024-03-15T09:15:00Z",
          createdDate: "2024-02-15",
          permissions: ["Support Management", "User Management"],
        },
      ];

      localStorage.setItem("super_admin_users", JSON.stringify(sampleUsers));
      setUsers(sampleUsers);
    } else {
      setUsers(existingUsers);
    }
  }, []);

  const handleAddUser = () => {
    if (!formData.name || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    const newUser: SuperAdminUser = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: "pending",
      lastLogin: "",
      createdDate: new Date().toISOString().split("T")[0],
      permissions: formData.permissions,
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem("super_admin_users", JSON.stringify(updatedUsers));

    setFormData({
      name: "",
      email: "",
      role: "admin",
      permissions: [],
    });
    setShowAddDialog(false);

    toast.success(
      `Super admin user ${newUser.name} has been added successfully`,
    );
  };

  const handleEditUser = (user: SuperAdminUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    });
    setShowAddDialog(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser || !formData.name || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    const updatedUser = {
      ...editingUser,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      permissions: formData.permissions,
    };

    const updatedUsers = users.map((user) =>
      user.id === editingUser.id ? updatedUser : user,
    );

    setUsers(updatedUsers);
    localStorage.setItem("super_admin_users", JSON.stringify(updatedUsers));

    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      role: "admin",
      permissions: [],
    });
    setShowAddDialog(false);

    toast.success(
      `Super admin user ${updatedUser.name} has been updated successfully`,
    );
  };

  const handleDeleteUser = (userId: string) => {
    const updatedUsers = users.filter((user) => user.id !== userId);
    setUsers(updatedUsers);
    localStorage.setItem("super_admin_users", JSON.stringify(updatedUsers));
    toast.success("Super admin user has been deleted");
  };

  const toggleUserStatus = (userId: string) => {
    const updatedUsers = users.map((user) =>
      user.id === userId
        ? {
            ...user,
            status: user.status === "active" ? "inactive" : ("active" as const),
          }
        : user,
    );

    setUsers(updatedUsers);
    localStorage.setItem("super_admin_users", JSON.stringify(updatedUsers));

    const user = updatedUsers.find((u) => u.id === userId);
    toast.success(
      `User ${user?.name} has been ${user?.status === "active" ? "activated" : "deactivated"}`,
    );
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      "super-admin": { variant: "destructive" as const, label: "Super Admin" },
      admin: { variant: "default" as const, label: "Admin" },
      support: { variant: "secondary" as const, label: "Support" },
    };

    const config = roleConfig[role as keyof typeof roleConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active" },
      inactive: { variant: "secondary" as const, label: "Inactive" },
      pending: { variant: "outline" as const, label: "Pending" },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "admin",
      permissions: [],
    });
    setEditingUser(null);
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Staff</h1>
            <p className="text-muted-foreground">
              Manage super administrator users and their permissions
            </p>
          </div>
          <Dialog
            open={showAddDialog}
            onOpenChange={(open) => {
              setShowAddDialog(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Edit Staff Member" : "Add Staff Member"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Update staff member details and permissions"
                    : "Add a new super admin staff member to the system"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, role: value as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super-admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                    {availablePermissions.map((permission) => (
                      <label
                        key={permission}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData((prev) => ({
                                ...prev,
                                permissions: [...prev.permissions, permission],
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                permissions: prev.permissions.filter(
                                  (p) => p !== permission,
                                ),
                              }));
                            }
                          }}
                          className="rounded"
                        />
                        <span>{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingUser ? handleUpdateUser : handleAddUser}
                >
                  {editingUser ? "Update" : "Add"} Staff Member
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter((u) => u.status === "active").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Super Admins
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter((u) => u.role === "super-admin").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter((u) => u.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff Table */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
            <CardDescription>
              Manage super admin staff members and their access levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
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
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.permissions.length} permissions
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? (
                          <div className="text-sm">
                            {new Date(user.lastLogin).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleUserStatus(user.id)}
                            >
                              {user.status === "active" ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
