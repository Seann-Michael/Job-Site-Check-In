import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Users,
  MoreVertical,
  Settings,
  Copy,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Permission {
  id: string;
  category: string;
  name: string;
  description: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  userCount: number;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const availablePermissions: Permission[] = [
  // Project Management
  {
    id: "projects.create",
    category: "Projects",
    name: "Create Projects",
    description: "Create new projects",
  },
  {
    id: "projects.edit",
    category: "Projects",
    name: "Edit Projects",
    description: "Modify existing projects",
  },
  {
    id: "projects.delete",
    category: "Projects",
    name: "Delete Projects",
    description: "Remove projects permanently",
  },
  {
    id: "projects.view",
    category: "Projects",
    name: "View Projects",
    description: "Access project information",
  },
  {
    id: "projects.assign",
    category: "Projects",
    name: "Assign Projects",
    description: "Assign projects to team members",
  },
  {
    id: "projects.archive",
    category: "Projects",
    name: "Archive Projects",
    description: "Archive completed projects",
  },

  // Media Management
  {
    id: "media.upload",
    category: "Media",
    name: "Upload Media",
    description: "Upload photos and videos",
  },
  {
    id: "media.edit",
    category: "Media",
    name: "Edit Media",
    description: "Edit photos and metadata",
  },
  {
    id: "media.delete",
    category: "Media",
    name: "Delete Media",
    description: "Remove media files",
  },
  {
    id: "media.download",
    category: "Media",
    name: "Download Media",
    description: "Download media files",
  },
  {
    id: "media.organize",
    category: "Media",
    name: "Organize Media",
    description: "Tag and categorize media",
  },

  // Client Management
  {
    id: "clients.create",
    category: "Clients",
    name: "Create Clients",
    description: "Add new clients",
  },
  {
    id: "clients.edit",
    category: "Clients",
    name: "Edit Clients",
    description: "Modify client information",
  },
  {
    id: "clients.delete",
    category: "Clients",
    name: "Delete Clients",
    description: "Remove clients",
  },
  {
    id: "clients.view",
    category: "Clients",
    name: "View Clients",
    description: "Access client information",
  },
  {
    id: "clients.communicate",
    category: "Clients",
    name: "Communicate",
    description: "Send messages to clients",
  },

  // User Management
  {
    id: "users.create",
    category: "Users",
    name: "Create Users",
    description: "Add new team members",
  },
  {
    id: "users.edit",
    category: "Users",
    name: "Edit Users",
    description: "Modify user accounts",
  },
  {
    id: "users.delete",
    category: "Users",
    name: "Delete Users",
    description: "Remove user accounts",
  },
  {
    id: "users.permissions",
    category: "Users",
    name: "Manage Permissions",
    description: "Set user permissions",
  },
  {
    id: "users.groups",
    category: "Users",
    name: "Manage Groups",
    description: "Create and edit user groups",
  },

  // System Administration
  {
    id: "system.settings",
    category: "System",
    name: "System Settings",
    description: "Configure system settings",
  },
  {
    id: "system.billing",
    category: "System",
    name: "Billing Access",
    description: "Access billing information",
  },
  {
    id: "system.reports",
    category: "System",
    name: "System Reports",
    description: "Generate system reports",
  },
  {
    id: "system.api",
    category: "System",
    name: "API Access",
    description: "Use API endpoints",
  },
  {
    id: "system.integrations",
    category: "System",
    name: "Integrations",
    description: "Manage third-party integrations",
  },

  // Analytics & Reporting
  {
    id: "analytics.view",
    category: "Analytics",
    name: "View Analytics",
    description: "Access analytics dashboard",
  },
  {
    id: "analytics.export",
    category: "Analytics",
    name: "Export Data",
    description: "Export analytics data",
  },
  {
    id: "reports.create",
    category: "Analytics",
    name: "Create Reports",
    description: "Generate custom reports",
  },
  {
    id: "reports.schedule",
    category: "Analytics",
    name: "Schedule Reports",
    description: "Set up automated reports",
  },
];

const defaultGroups: UserGroup[] = [
  {
    id: "admin",
    name: "System Administrators",
    description: "Full system access with all permissions",
    color: "bg-red-100 text-red-800 border-red-200",
    userCount: 2,
    permissions: availablePermissions.map((p) => p.id),
    isSystem: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
  {
    id: "manager",
    name: "Project Managers",
    description: "Can manage projects and communicate with clients",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    userCount: 5,
    permissions: [
      "projects.create",
      "projects.edit",
      "projects.view",
      "projects.assign",
      "projects.archive",
      "media.upload",
      "media.edit",
      "media.organize",
      "media.download",
      "clients.create",
      "clients.edit",
      "clients.view",
      "clients.communicate",
      "users.view",
      "analytics.view",
      "reports.create",
    ],
    isSystem: false,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-15",
  },
  {
    id: "worker",
    name: "Field Workers",
    description: "Can upload media and update project status",
    color: "bg-green-100 text-green-800 border-green-200",
    userCount: 8,
    permissions: [
      "projects.view",
      "projects.edit",
      "media.upload",
      "media.organize",
      "clients.view",
    ],
    isSystem: false,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-10",
  },
  {
    id: "client",
    name: "Clients",
    description: "View-only access to their projects",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    userCount: 12,
    permissions: ["projects.view", "media.download"],
    isSystem: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
];

export function UserGroupsManager() {
  const [groups, setGroups] = useState<UserGroup[]>(defaultGroups);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    permissions: [] as string[],
  });

  const groupColors = [
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-orange-100 text-orange-800 border-orange-200",
    "bg-teal-100 text-teal-800 border-teal-200",
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
    "bg-yellow-100 text-yellow-800 border-yellow-200",
  ];

  const permissionCategories = availablePermissions.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  const handleCreateGroup = () => {
    if (!newGroup.name.trim()) {
      toast.error("Group name is required");
      return;
    }

    const group: UserGroup = {
      id: Date.now().toString(),
      name: newGroup.name,
      description: newGroup.description,
      color: newGroup.color,
      userCount: 0,
      permissions: newGroup.permissions,
      isSystem: false,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    };

    setGroups([...groups, group]);
    setNewGroup({
      name: "",
      description: "",
      color: groupColors[0],
      permissions: [],
    });
    setIsCreateGroupOpen(false);
    toast.success("User group created successfully");
  };

  const handleEditGroup = () => {
    if (!selectedGroup) return;

    const updatedGroups = groups.map((group) =>
      group.id === selectedGroup.id
        ? {
            ...selectedGroup,
            updatedAt: new Date().toISOString().split("T")[0],
          }
        : group,
    );

    setGroups(updatedGroups);
    setIsEditGroupOpen(false);
    setSelectedGroup(null);
    toast.success("User group updated successfully");
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup || selectedGroup.isSystem) return;

    if (selectedGroup.userCount > 0) {
      toast.error(
        "Cannot delete group with active users. Please reassign users first.",
      );
      return;
    }

    setGroups(groups.filter((group) => group.id !== selectedGroup.id));
    setIsDeleteConfirmOpen(false);
    setSelectedGroup(null);
    toast.success("User group deleted successfully");
  };

  const handleDuplicateGroup = (group: UserGroup) => {
    const duplicatedGroup: UserGroup = {
      ...group,
      id: Date.now().toString(),
      name: `${group.name} (Copy)`,
      userCount: 0,
      isSystem: false,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    };

    setGroups([...groups, duplicatedGroup]);
    toast.success("User group duplicated successfully");
  };

  const togglePermission = (permissionId: string, isForNewGroup = false) => {
    if (isForNewGroup) {
      setNewGroup((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(permissionId)
          ? prev.permissions.filter((p) => p !== permissionId)
          : [...prev.permissions, permissionId],
      }));
    } else if (selectedGroup) {
      setSelectedGroup({
        ...selectedGroup,
        permissions: selectedGroup.permissions.includes(permissionId)
          ? selectedGroup.permissions.filter((p) => p !== permissionId)
          : [...selectedGroup.permissions, permissionId],
      });
    }
  };

  const getPermissionsByCategory = (permissions: string[]) => {
    return Object.entries(permissionCategories).map(
      ([category, categoryPermissions]) => ({
        category,
        permissions: categoryPermissions,
        enabledCount: categoryPermissions.filter((p) =>
          permissions.includes(p.id),
        ).length,
        totalCount: categoryPermissions.length,
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Groups</h2>
          <p className="text-muted-foreground">
            Manage user groups and permissions to control access across your
            organization
          </p>
        </div>
        <Button onClick={() => setIsCreateGroupOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Groups Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${group.color} font-medium`}>
                      {group.name}
                    </Badge>
                    {group.isSystem && (
                      <Badge variant="outline" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {group.description}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedGroup(group);
                        setIsEditGroupOpen(true);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Group
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDuplicateGroup(group)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!group.isSystem && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedGroup(group);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Group
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {group.userCount} users
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    {group.permissions.length} permissions
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Permission Categories
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getPermissionsByCategory(group.permissions).map(
                      ({ category, enabledCount, totalCount }) =>
                        enabledCount > 0 && (
                          <Badge
                            key={category}
                            variant="outline"
                            className="text-xs"
                          >
                            {category} {enabledCount}/{totalCount}
                          </Badge>
                        ),
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Updated {new Date(group.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User Group</DialogTitle>
            <DialogDescription>
              Define a new user group with specific permissions and access
              levels
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  value={newGroup.name}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, name: e.target.value })
                  }
                  placeholder="Enter group name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupColor">Color Theme</Label>
                <div className="flex gap-2 flex-wrap">
                  {groupColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewGroup({ ...newGroup, color })}
                      className={`w-8 h-8 rounded border-2 ${color} ${
                        newGroup.color === color ? "ring-2 ring-primary" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description</Label>
              <Textarea
                id="groupDescription"
                value={newGroup.description}
                onChange={(e) =>
                  setNewGroup({ ...newGroup, description: e.target.value })
                }
                placeholder="Describe the purpose and scope of this group"
                rows={3}
              />
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Permissions</Label>
                <div className="text-sm text-muted-foreground">
                  {newGroup.permissions.length} of {availablePermissions.length}{" "}
                  selected
                </div>
              </div>

              <div className="grid gap-4">
                {Object.entries(permissionCategories).map(
                  ([category, permissions]) => (
                    <Card key={category}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {category}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {
                                permissions.filter((p) =>
                                  newGroup.permissions.includes(p.id),
                                ).length
                              }
                              /{permissions.length}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const allSelected = permissions.every((p) =>
                                  newGroup.permissions.includes(p.id),
                                );
                                if (allSelected) {
                                  setNewGroup({
                                    ...newGroup,
                                    permissions: newGroup.permissions.filter(
                                      (p) =>
                                        !permissions
                                          .map((perm) => perm.id)
                                          .includes(p),
                                    ),
                                  });
                                } else {
                                  setNewGroup({
                                    ...newGroup,
                                    permissions: [
                                      ...new Set([
                                        ...newGroup.permissions,
                                        ...permissions.map((p) => p.id),
                                      ]),
                                    ],
                                  });
                                }
                              }}
                            >
                              {permissions.every((p) =>
                                newGroup.permissions.includes(p.id),
                              )
                                ? "Deselect All"
                                : "Select All"}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {permissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="flex items-start space-x-3"
                            >
                              <Switch
                                id={permission.id}
                                checked={newGroup.permissions.includes(
                                  permission.id,
                                )}
                                onCheckedChange={() =>
                                  togglePermission(permission.id, true)
                                }
                              />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor={permission.id}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {permission.name}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateGroupOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateGroup}>
                <Save className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Group</DialogTitle>
            <DialogDescription>
              Modify group settings and permissions
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editGroupName">Group Name</Label>
                  <Input
                    id="editGroupName"
                    value={selectedGroup.name}
                    onChange={(e) =>
                      setSelectedGroup({
                        ...selectedGroup,
                        name: e.target.value,
                      })
                    }
                    placeholder="Enter group name"
                    disabled={selectedGroup.isSystem}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editGroupColor">Color Theme</Label>
                  <div className="flex gap-2 flex-wrap">
                    {groupColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setSelectedGroup({ ...selectedGroup, color })
                        }
                        className={`w-8 h-8 rounded border-2 ${color} ${
                          selectedGroup.color === color
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        disabled={selectedGroup.isSystem}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editGroupDescription">Description</Label>
                <Textarea
                  id="editGroupDescription"
                  value={selectedGroup.description}
                  onChange={(e) =>
                    setSelectedGroup({
                      ...selectedGroup,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe the purpose and scope of this group"
                  rows={3}
                  disabled={selectedGroup.isSystem}
                />
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Permissions</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedGroup.permissions.length} of{" "}
                    {availablePermissions.length} selected
                  </div>
                </div>

                <div className="grid gap-4">
                  {Object.entries(permissionCategories).map(
                    ([category, permissions]) => (
                      <Card key={category}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">
                              {category}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {
                                  permissions.filter((p) =>
                                    selectedGroup.permissions.includes(p.id),
                                  ).length
                                }
                                /{permissions.length}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const allSelected = permissions.every((p) =>
                                    selectedGroup.permissions.includes(p.id),
                                  );
                                  if (allSelected) {
                                    setSelectedGroup({
                                      ...selectedGroup,
                                      permissions:
                                        selectedGroup.permissions.filter(
                                          (p) =>
                                            !permissions
                                              .map((perm) => perm.id)
                                              .includes(p),
                                        ),
                                    });
                                  } else {
                                    setSelectedGroup({
                                      ...selectedGroup,
                                      permissions: [
                                        ...new Set([
                                          ...selectedGroup.permissions,
                                          ...permissions.map((p) => p.id),
                                        ]),
                                      ],
                                    });
                                  }
                                }}
                              >
                                {permissions.every((p) =>
                                  selectedGroup.permissions.includes(p.id),
                                )
                                  ? "Deselect All"
                                  : "Select All"}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {permissions.map((permission) => (
                              <div
                                key={permission.id}
                                className="flex items-start space-x-3"
                              >
                                <Switch
                                  id={`edit-${permission.id}`}
                                  checked={selectedGroup.permissions.includes(
                                    permission.id,
                                  )}
                                  onCheckedChange={() =>
                                    togglePermission(permission.id, false)
                                  }
                                />
                                <div className="grid gap-1.5 leading-none">
                                  <label
                                    htmlFor={`edit-${permission.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {permission.name}
                                  </label>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditGroupOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditGroup}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User Group
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedGroup?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && selectedGroup.userCount > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                This group has {selectedGroup.userCount} active users. Please
                reassign them to another group before deleting.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={(selectedGroup?.userCount ?? 0) > 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
