import React, { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Users,
  MoreVertical,
  Mail,
  Lock,
  UserCheck,
  UserX,
  Download,
  Upload,
  Search,
  Filter,
  Settings,
  Key,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import supabaseClient from "@/lib/supabaseClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending" | "disabled";
  lastLogin: string;
  createdAt: string;
  permissions: {
    [key: string]: boolean;
  };
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: {
    [key: string]: boolean;
  };
}

const defaultPermissions = {
  // Project Permissions
  "projects.create": false,
  "projects.edit": false,
  "projects.delete": false,
  "projects.view": true,
  "projects.assign": false,

  // Media Permissions
  "media.upload": false,
  "media.delete": false,
  "media.view": true,

  // Client Permissions
  "clients.create": false,
  "clients.edit": false,
  "clients.delete": false,
  "clients.view": true,
  "clients.communicate": false,

  // System Permissions
  "system.userManagement": false,
  "system.settings": false,
  "system.billing": false,
  "system.reports": false,
  "system.api": false,
};

const userGroups: UserGroup[] = [
  {
    id: "admin",
    name: "Administrators",
    description: "Full system access and user management",
    userCount: 2,
    permissions: Object.keys(defaultPermissions).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {},
    ),
  },
  {
    id: "manager",
    name: "Project Managers",
    description: "Project creation and client communication",
    userCount: 5,
    permissions: {
      ...defaultPermissions,
      "projects.create": true,
      "projects.edit": true,
      "projects.assign": true,
      "media.upload": true,
      "clients.create": true,
      "clients.edit": true,
      "clients.communicate": true,
      "system.reports": true,
    },
  },
  {
    id: "worker",
    name: "Field Workers",
    description: "Photo uploads and project updates",
    userCount: 8,
    permissions: {
      ...defaultPermissions,
      "projects.edit": true,
      "media.upload": true,
    },
  },
  {
    id: "client",
    name: "Clients",
    description: "View-only access to their projects",
    userCount: 12,
    permissions: defaultPermissions,
  },
];

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabaseClient
          .from("users")
          .select("id, name, email, role, last_login, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const roleToGroup: Record<string, string> = {
          super_admin: "admin",
          agency_admin: "admin",
          business_owner: "admin",
          staff: "worker",
          viewer: "client",
        };
        const mapped: User[] = (data ?? []).map((u: any) => ({
          id: u.id,
          name: u.name ?? u.email,
          email: u.email,
          role: roleToGroup[u.role] ?? "worker",
          status: "active" as const,
          lastLogin: u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never",
          createdAt: u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : "",
          permissions: userGroups.find((g) => g.id === (roleToGroup[u.role] ?? "worker"))?.permissions ?? defaultPermissions,
        }));
        setUsers(mapped);
      } catch {
        // leave empty on error
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, []);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "worker",
    sendInvite: true,
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    const user: User = {
      id: Date.now().toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.sendInvite ? "pending" : "active",
      lastLogin: "Never",
      createdAt: new Date().toISOString().split("T")[0],
      permissions:
        userGroups.find((g) => g.id === newUser.role)?.permissions ||
        defaultPermissions,
    };

    setUsers([...users, user]);
    setNewUser({ name: "", email: "", role: "worker", sendInvite: true });
    setIsAddUserOpen(false);

    if (newUser.sendInvite) {
      toast.success(`Invitation sent to ${newUser.email}`);
    } else {
      toast.success("User added successfully");
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId));
    toast.success("User deleted successfully");
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsers(
      users.map((user) => {
        if (user.id === userId) {
          const newStatus = user.status === "active" ? "disabled" : "active";
          toast.success(
            `User ${newStatus === "active" ? "activated" : "disabled"}`,
          );
          return { ...user, status: newStatus };
        }
        return user;
      }),
    );
  };

  const handleResetPassword = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      // In a real app, this would send a password reset email
      toast.success(`Password reset email sent to ${user.email}`);
    }
  };

  const handleUpdatePermissions = (permissions: { [key: string]: boolean }) => {
    if (selectedUser) {
      setUsers(
        users.map((user) =>
          user.id === selectedUser.id ? { ...user, permissions } : user,
        ),
      );
      toast.success("Permissions updated successfully");
      setIsPermissionsOpen(false);
    }
  };

  const getRoleGroup = (roleId: string) => {
    return userGroups.find((g) => g.id === roleId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage team members, permissions, and access controls
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account and set their role
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="userName">Full Name</Label>
                      <Input
                        id="userName"
                        value={newUser.name}
                        onChange={(e) =>
                          setNewUser({ ...newUser, name: e.target.value })
                        }
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userEmail">Email Address</Label>
                      <Input
                        id="userEmail"
                        type="email"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser({ ...newUser, email: e.target.value })
                        }
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userRole">Role</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value) =>
                          setNewUser({ ...newUser, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {userGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="sendInvite"
                        checked={newUser.sendInvite}
                        onCheckedChange={(checked) =>
                          setNewUser({ ...newUser, sendInvite: checked })
                        }
                      />
                      <Label htmlFor="sendInvite">Send invitation email</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddUserOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddUser}>Add User</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* User Groups Overview */}
      <Card>
        <CardHeader>
          <CardTitle>User Groups</CardTitle>
          <CardDescription>
            Pre-configured roles with permission sets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {userGroups.map((group) => (
              <div key={group.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{group.name}</span>
                  <Badge
                    variant={group.id === "admin" ? "default" : "secondary"}
                  >
                    {group.userCount} users
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {userGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const roleGroup = getRoleGroup(user.role);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">
                          {roleGroup?.name || user.role}
                        </Badge>
                        <Badge
                          variant={
                            user.status === "active"
                              ? "default"
                              : user.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center">
                          Last login: {user.lastLogin}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsPermissionsOpen(true);
                      }}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Permissions
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleResetPassword(user.id)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleUserStatus(user.id)}
                        >
                          {user.status === "active" ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              Disable User
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activate User
                            </>
                          )}
                        </DropdownMenuItem>
                        {user.status === "pending" && (
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend Invitation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Permissions - {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Configure individual permissions for this user
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <UserPermissionsEditor
              user={selectedUser}
              onSave={handleUpdatePermissions}
              onCancel={() => setIsPermissionsOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UserPermissionsEditorProps {
  user: User;
  onSave: (permissions: { [key: string]: boolean }) => void;
  onCancel: () => void;
}

function UserPermissionsEditor({
  user,
  onSave,
  onCancel,
}: UserPermissionsEditorProps) {
  const [permissions, setPermissions] = useState(user.permissions);

  const handlePermissionChange = (key: string, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const permissionGroups = [
    {
      name: "Project Permissions",
      permissions: [
        { key: "projects.create", label: "Create Projects" },
        { key: "projects.edit", label: "Edit Projects" },
        { key: "projects.delete", label: "Delete Projects" },
        { key: "projects.view", label: "View Projects" },
        { key: "projects.assign", label: "Assign Projects" },
      ],
    },
    {
      name: "Media Permissions",
      permissions: [
        { key: "media.upload", label: "Upload Media" },
        { key: "media.delete", label: "Delete Media" },
        { key: "media.view", label: "View Media" },
      ],
    },
    {
      name: "Client Permissions",
      permissions: [
        { key: "clients.create", label: "Create Clients" },
        { key: "clients.edit", label: "Edit Clients" },
        { key: "clients.delete", label: "Delete Clients" },
        { key: "clients.view", label: "View Clients" },
        { key: "clients.communicate", label: "Communicate with Clients" },
      ],
    },
    {
      name: "System Permissions",
      permissions: [
        { key: "system.userManagement", label: "User Management" },
        { key: "system.settings", label: "System Settings" },
        { key: "system.billing", label: "Billing Access" },
        { key: "system.reports", label: "Access Reports" },
        { key: "system.api", label: "API Access" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {permissionGroups.map((group) => (
          <div key={group.name} className="space-y-3">
            <h4 className="font-medium text-sm">{group.name}</h4>
            <div className="space-y-2">
              {group.permissions.map((permission) => (
                <div
                  key={permission.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{permission.label}</span>
                  <Switch
                    checked={permissions[permission.key] || false}
                    onCheckedChange={(checked) =>
                      handlePermissionChange(permission.key, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(permissions)}>Save Permissions</Button>
      </div>
    </div>
  );
}
