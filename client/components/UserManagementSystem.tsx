import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Key,
  AlertTriangle,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { UserGroupsManager } from "./UserGroupsManager";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending" | "disabled";
  lastLogin: string;
  createdAt: string;
  avatar?: string;
  phone?: string;
  department?: string;
  permissions?: string[];
  hasCustomPermissions: boolean;
  firstName?: string;
  lastName?: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  userCount: number;
  permissions: string[];
}

const mockGroups: UserGroup[] = [
  {
    id: "admin",
    name: "System Administrators",
    description: "Full system access",
    color: "bg-red-100 text-red-800 border-red-200",
    userCount: 2,
    permissions: ["all"],
  },
  {
    id: "manager",
    name: "Project Managers",
    description: "Project and client management",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    userCount: 5,
    permissions: ["projects", "clients", "media"],
  },
  {
    id: "worker",
    name: "Field Workers",
    description: "Photo uploads and updates",
    color: "bg-green-100 text-green-800 border-green-200",
    userCount: 8,
    permissions: ["projects.view", "media.upload"],
  },
  {
    id: "client",
    name: "Clients",
    description: "View-only access",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    userCount: 12,
    permissions: ["projects.view"],
  },
];

const permissionCategories = {
  projects: [
    "view_projects",
    "create_projects",
    "edit_projects",
    "delete_projects",
    "manage_project_settings",
  ],
  clients: [
    "view_clients",
    "create_clients",
    "edit_clients",
    "delete_clients",
    "manage_client_communications",
  ],
  media: [
    "view_media",
    "upload_media",
    "edit_media",
    "delete_media",
    "manage_media_library",
  ],
  users: [
    "view_users",
    "create_users",
    "edit_users",
    "delete_users",
    "manage_user_permissions",
  ],
  reports: [
    "view_reports",
    "create_reports",
    "export_reports",
    "manage_analytics",
  ],
  system: ["system_settings", "backup_restore", "api_access", "integrations"],
};

const mockUsers: User[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john@smithconstruction.com",
    role: "admin",
    status: "active",
    lastLogin: "2024-01-20",
    createdAt: "2024-01-01",
    phone: "+1 (555) 123-4567",
    department: "Management",
    hasCustomPermissions: false,
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah@smithconstruction.com",
    role: "manager",
    status: "active",
    lastLogin: "2024-01-19",
    createdAt: "2024-01-05",
    phone: "+1 (555) 234-5678",
    department: "Operations",
    hasCustomPermissions: false,
  },
  {
    id: "3",
    name: "Mike Wilson",
    email: "mike@smithconstruction.com",
    role: "worker",
    status: "active",
    lastLogin: "2024-01-20",
    createdAt: "2024-01-10",
    phone: "+1 (555) 345-6789",
    department: "Field Operations",
    hasCustomPermissions: true,
  },
  {
    id: "4",
    name: "David Brown",
    email: "david@client.com",
    role: "client",
    status: "pending",
    lastLogin: "Never",
    createdAt: "2024-01-18",
    phone: "+1 (555) 456-7890",
    department: "External",
    hasCustomPermissions: false,
  },
];

export function UserManagementSystem() {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: "worker",
    permissionType: "group", // "group" or "custom"
    customPermissions: [] as string[],
    password: "",
    confirmPassword: "",
    sendInvite: true,
    generatePassword: true,
  });
  const [passwordReset, setPasswordReset] = useState({
    userId: "",
    newPassword: "",
    confirmPassword: "",
    sendEmail: true,
    requireChange: true,
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus =
      filterStatus === "all" || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (
      !newUser.generatePassword &&
      newUser.password !== newUser.confirmPassword
    ) {
      toast.error("Passwords do not match");
      return;
    }

    const password = newUser.generatePassword
      ? generatePassword()
      : newUser.password;

    const user: User = {
      id: Date.now().toString(),
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      department: newUser.department,
      role: newUser.role,
      status: newUser.sendInvite ? "pending" : "active",
      lastLogin: "Never",
      createdAt: new Date().toISOString().split("T")[0],
      hasCustomPermissions: newUser.permissionType === "custom",
      permissions:
        newUser.permissionType === "custom"
          ? newUser.customPermissions
          : undefined,
    };

    setUsers([...users, user]);
    setNewUser({
      name: "",
      email: "",
      phone: "",
      department: "",
      role: "worker",
      permissionType: "group",
      customPermissions: [],
      password: "",
      confirmPassword: "",
      sendInvite: true,
      generatePassword: true,
    });
    setIsAddUserOpen(false);

    if (newUser.sendInvite) {
      toast.success(
        `Invitation sent to ${newUser.email} with temporary password: ${password}`,
      );
    } else {
      toast.success(`User added successfully with password: ${password}`);
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

  const handlePasswordReset = () => {
    if (
      !passwordReset.newPassword ||
      passwordReset.newPassword !== passwordReset.confirmPassword
    ) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordReset.sendEmail) {
      toast.success("Password reset email sent successfully");
    } else {
      toast.success("Password updated successfully");
    }

    setPasswordReset({
      userId: "",
      newPassword: "",
      confirmPassword: "",
      sendEmail: true,
      requireChange: true,
    });
    setIsPasswordResetOpen(false);
  };

  const getGroupInfo = (roleId: string) => {
    return mockGroups.find((g) => g.id === roleId);
  };

  const exportUsers = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Name,Email,Role,Status,Phone,Department,Last Login,Created\n" +
      users
        .map(
          (user) =>
            `"${user.name}","${user.email}","${user.role}","${user.status}","${user.phone || ""}","${user.department || ""}","${user.lastLogin}","${user.createdAt}"`,
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users.csv");
    link.click();
    toast.success("Users exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, groups, and permissions across your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportUsers}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsAddUserOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
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
                    {mockGroups.map((group) => (
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Users ({filteredUsers.length})</CardTitle>
                  <CardDescription>
                    Manage user accounts and permissions
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Bulk Actions
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredUsers.map((user) => {
                  const groupInfo = getGroupInfo(user.role);
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.name
                              .split(" ")
                              .filter(n => n && n.length > 0)
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge
                              className={
                                groupInfo?.color || "bg-gray-100 text-gray-800"
                              }
                            >
                              {groupInfo?.name || user.role}
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
                            {user.hasCustomPermissions && (
                              <Badge variant="outline">
                                <Settings className="w-3 h-3 mr-1" />
                                Custom Perms
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span>Last login: {user.lastLogin}</span>
                            {user.phone && (
                              <span className="ml-3">Phone: {user.phone}</span>
                            )}
                            {user.department && (
                              <span className="ml-3">
                                Dept: {user.department}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditUserOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setPasswordReset({
                                  ...passwordReset,
                                  userId: user.id,
                                });
                                setIsPasswordResetOpen(true);
                              }}
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

                {filteredUsers.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      No users found
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery
                        ? "Try adjusting your search terms"
                        : "Add your first user to get started"}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setIsAddUserOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups">
          <UserGroupsManager />
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account and configure their access
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userName">Full Name *</Label>
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
                <Label htmlFor="userEmail">Email Address *</Label>
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
                <Label htmlFor="userPhone">Phone Number</Label>
                <PhoneInput
                  id="userPhone"
                  value={newUser.phone}
                  onChange={(value) => setNewUser({ ...newUser, phone: value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userDepartment">Department</Label>
                <Input
                  id="userDepartment"
                  value={newUser.department}
                  onChange={(e) =>
                    setNewUser({ ...newUser, department: e.target.value })
                  }
                  placeholder="Enter department"
                />
              </div>
            </div>

            {/* Permission Assignment */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                Permission Assignment
              </Label>
              <RadioGroup
                value={newUser.permissionType}
                onValueChange={(value) =>
                  setNewUser({ ...newUser, permissionType: value })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="group" id="group" />
                  <Label htmlFor="group">Assign to User Group</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom">Custom Permissions</Label>
                </div>
              </RadioGroup>

              {newUser.permissionType === "group" && (
                <div className="space-y-2">
                  <Label htmlFor="userRole">Select User Group</Label>
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
                      {mockGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${group.color.split(" ")[0]}`}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newUser.role && (
                    <div className="text-sm text-muted-foreground">
                      {
                        mockGroups.find((g) => g.id === newUser.role)
                          ?.description
                      }
                    </div>
                  )}
                </div>
              )}

              {newUser.permissionType === "custom" && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Custom permissions will be configured after user creation
                  </p>
                  <Badge variant="outline">
                    Custom permissions available post-creation
                  </Badge>
                </div>
              )}
            </div>

            {/* Password Configuration */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                Password Configuration
              </Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="generatePassword"
                  checked={newUser.generatePassword}
                  onCheckedChange={(checked) =>
                    setNewUser({ ...newUser, generatePassword: checked })
                  }
                />
                <Label htmlFor="generatePassword">
                  Generate secure password automatically
                </Label>
              </div>

              {!newUser.generatePassword && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="userPassword">Password</Label>
                    <div className="relative">
                      <Input
                        id="userPassword"
                        type={showPassword ? "text" : "password"}
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={newUser.confirmPassword}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notification Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                Notification Settings
              </Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendInvite"
                  checked={newUser.sendInvite}
                  onCheckedChange={(checked) =>
                    setNewUser({ ...newUser, sendInvite: checked })
                  }
                />
                <Label htmlFor="sendInvite">
                  Send invitation email with login credentials
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>
                <Save className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for the selected user
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={passwordReset.newPassword}
                  onChange={(e) =>
                    setPasswordReset({
                      ...passwordReset,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type={showPassword ? "text" : "password"}
                value={passwordReset.confirmPassword}
                onChange={(e) =>
                  setPasswordReset({
                    ...passwordReset,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm new password"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendResetEmail"
                  checked={passwordReset.sendEmail}
                  onCheckedChange={(checked) =>
                    setPasswordReset({ ...passwordReset, sendEmail: checked })
                  }
                />
                <Label htmlFor="sendResetEmail">
                  Send password reset email to user
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="requireChange"
                  checked={passwordReset.requireChange}
                  onCheckedChange={(checked) =>
                    setPasswordReset({
                      ...passwordReset,
                      requireChange: checked,
                    })
                  }
                />
                <Label htmlFor="requireChange">
                  Require password change on next login
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsPasswordResetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const password = generatePassword();
                  setPasswordReset({
                    ...passwordReset,
                    newPassword: password,
                    confirmPassword: password,
                  });
                }}
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate
              </Button>
              <Button onClick={handlePasswordReset}>
                <Key className="mr-2 h-4 w-4" />
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* User Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={selectedUser?.firstName || ""}
                  onChange={(e) =>
                    setSelectedUser(
                      selectedUser
                        ? { ...selectedUser, firstName: e.target.value }
                        : null,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={selectedUser?.lastName || ""}
                  onChange={(e) =>
                    setSelectedUser(
                      selectedUser
                        ? { ...selectedUser, lastName: e.target.value }
                        : null,
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email Address</Label>
              <Input
                id="editEmail"
                type="email"
                value={selectedUser?.email || ""}
                onChange={(e) =>
                  setSelectedUser(
                    selectedUser
                      ? { ...selectedUser, email: e.target.value }
                      : null,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone Number</Label>
              <PhoneInput
                value={selectedUser?.phone || ""}
                onChange={(value) =>
                  setSelectedUser(
                    selectedUser ? { ...selectedUser, phone: value } : null,
                  )
                }
              />
            </div>

            {/* User Role and Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={selectedUser?.role || ""}
                  onValueChange={(value) =>
                    setSelectedUser(
                      selectedUser ? { ...selectedUser, role: value } : null,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStatus">Status</Label>
                <Select
                  value={selectedUser?.status || ""}
                  onValueChange={(value) =>
                    setSelectedUser(
                      selectedUser
                        ? {
                            ...selectedUser,
                            status: value as "active" | "pending" | "disabled",
                          }
                        : null,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* User Permissions */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Permissions</Label>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(permissionCategories).map(
                  ([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <Label className="text-sm font-medium capitalize">
                        {category.replace("_", " ")}
                      </Label>
                      <div className="space-y-1">
                        {perms.map((permission) => (
                          <div
                            key={permission}
                            className="flex items-center space-x-2"
                          >
                            <Switch
                              id={`edit-${permission}`}
                              checked={
                                selectedUser?.permissions?.includes(
                                  permission,
                                ) || false
                              }
                              onCheckedChange={(checked) => {
                                if (!selectedUser) return;
                                const currentPermissions =
                                  selectedUser.permissions || [];
                                const updatedPermissions = checked
                                  ? [...currentPermissions, permission]
                                  : currentPermissions.filter(
                                      (p) => p !== permission,
                                    );
                                setSelectedUser({
                                  ...selectedUser,
                                  permissions: updatedPermissions,
                                });
                              }}
                            />
                            <Label
                              htmlFor={`edit-${permission}`}
                              className="text-xs cursor-pointer"
                            >
                              {permission
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditUserOpen(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUser) {
                    const updatedUsers = users.map((user) =>
                      user.id === selectedUser.id ? selectedUser : user,
                    );
                    setUsers(updatedUsers);
                    setIsEditUserOpen(false);
                    setSelectedUser(null);
                  }
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Update User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
