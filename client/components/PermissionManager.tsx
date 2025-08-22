import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Search,
  Filter,
  UserPlus,
  Settings,
  Lock,
  Unlock,
  Crown,
  Star,
  AlertTriangle
} from 'lucide-react';
import {
  Permission,
  Role,
  UserRole,
  UserPermission,
  PermissionResource,
  PermissionAction,
  PermissionScope,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
  PermissionCategory
} from '@/types/permissions';
import { permissionService } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { SuperAdminGuard, AdminGuard } from './PermissionGuard';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  agency_id?: string;
  business_id?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

interface RoleFormData {
  name: string;
  description: string;
  level: number;
  permissions: string[];
  inherits_from?: string;
}

interface UserPermissionFormData {
  user_id: string;
  permission_id: string;
  scope_type: PermissionScope;
  scope_id?: string;
  expires_at?: string;
}

export function PermissionManager() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PermissionCategory | 'all'>('all');
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isUserPermissionDialogOpen, setIsUserPermissionDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingUserPermission, setEditingUserPermission] = useState<UserPermission | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData, permissionsData, userPermsData] = await Promise.all([
        fetchUsers(),
        fetchRoles(),
        fetchPermissions(),
        fetchUserPermissions()
      ]);

      setUsers(usersData);
      setRoles(rolesData);
      setPermissions(permissionsData);
      setUserPermissions(userPermsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load permission data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (): Promise<User[]> => {
    const response = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (response.ok) {
      return response.json();
    }
    return [];
  };

  const fetchRoles = async (): Promise<Role[]> => {
    const response = await fetch('/api/roles', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (response.ok) {
      return response.json();
    }
    return [];
  };

  const fetchPermissions = async (): Promise<Permission[]> => {
    return permissionService.getAllPermissions();
  };

  const fetchUserPermissions = async (): Promise<UserPermission[]> => {
    const response = await fetch('/api/permissions/users', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (response.ok) {
      return response.json();
    }
    return [];
  };

  const getAuthToken = () => localStorage.getItem('auth_token') || '';

  const handleCreateRole = async (roleData: RoleFormData) => {
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(roleData)
      });

      if (response.ok) {
        const newRole = await response.json();
        setRoles(prev => [...prev, newRole]);
        setIsRoleDialogOpen(false);
        toast.success('Role created successfully');
      } else {
        toast.error('Failed to create role');
      }
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async (roleId: string, roleData: Partial<RoleFormData>) => {
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(roleData)
      });

      if (response.ok) {
        const updatedRole = await response.json();
        setRoles(prev => prev.map(role => role.id === roleId ? updatedRole : role));
        setEditingRole(null);
        toast.success('Role updated successfully');
      } else {
        toast.error('Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });

      if (response.ok) {
        setRoles(prev => prev.filter(role => role.id !== roleId));
        toast.success('Role deleted successfully');
      } else {
        toast.error('Failed to delete role');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    }
  };

  const handleGrantPermission = async (formData: UserPermissionFormData) => {
    try {
      const success = await permissionService.grantPermission(
        formData.user_id,
        formData.permission_id,
        formData.scope_type,
        formData.scope_id,
        formData.expires_at ? new Date(formData.expires_at) : undefined
      );

      if (success) {
        await loadData(); // Reload to get updated permissions
        setIsUserPermissionDialogOpen(false);
        toast.success('Permission granted successfully');
      } else {
        toast.error('Failed to grant permission');
      }
    } catch (error) {
      console.error('Error granting permission:', error);
      toast.error('Failed to grant permission');
    }
  };

  const handleRevokePermission = async (userId: string, permissionId: string, scopeId?: string) => {
    try {
      const success = await permissionService.revokePermission(userId, permissionId, scopeId);

      if (success) {
        setUserPermissions(prev => 
          prev.filter(perm => 
            !(perm.user_id === userId && 
              perm.permission_id === permissionId && 
              perm.scope_id === scopeId)
          )
        );
        toast.success('Permission revoked successfully');
      } else {
        toast.error('Failed to revoke permission');
      }
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast.error('Failed to revoke permission');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ));
        toast.success('User role updated successfully');
      } else {
        toast.error('Failed to update user role');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || permission.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'super_admin': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <Shield className="h-4 w-4 text-red-500" />;
      case 'agency_admin': return <Star className="h-4 w-4 text-blue-500" />;
      case 'business_owner': return <Users className="h-4 w-4 text-green-500" />;
      default: return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPermissionBadgeVariant = (resource: PermissionResource) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      projects: 'default',
      businesses: 'secondary',
      users: 'destructive',
      analytics: 'outline',
      settings: 'destructive'
    };
    return variants[resource] || 'default';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SuperAdminGuard fallback={
      <AdminGuard fallback={
        <div className="text-center p-8">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need admin permissions to access this page.</p>
        </div>
      }>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Permission Management</h1>
              <p className="text-muted-foreground">Manage users, roles, and permissions</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => loadData()}>
                <Settings className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">Users & Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="roles">Custom Roles</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage user roles and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Dialog open={isUserPermissionDialogOpen} onOpenChange={setIsUserPermissionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Grant Permission
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Grant User Permission</DialogTitle>
                          <DialogDescription>
                            Grant specific permission to a user
                          </DialogDescription>
                        </DialogHeader>
                        <UserPermissionForm
                          users={users}
                          permissions={permissions}
                          onSubmit={handleGrantPermission}
                          onCancel={() => setIsUserPermissionDialogOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Permissions</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(user.role)}
                                <span className="capitalize">{user.role.replace('_', ' ')}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(ROLE_PERMISSIONS[user.role] || []).slice(0, 3).map((perm) => (
                                  <Badge key={perm} variant="outline" className="text-xs">
                                    {perm.split(':')[1]}
                                  </Badge>
                                ))}
                                {(ROLE_PERMISSIONS[user.role] || []).length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{(ROLE_PERMISSIONS[user.role] || []).length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Select
                                  value={user.role}
                                  onValueChange={(value: UserRole) => handleUpdateUserRole(user.id, value)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="agency_admin">Agency Admin</SelectItem>
                                    <SelectItem value="agency_user">Agency User</SelectItem>
                                    <SelectItem value="business_owner">Business Owner</SelectItem>
                                    <SelectItem value="business_admin">Business Admin</SelectItem>
                                    <SelectItem value="business_user">Business User</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Permission Registry</CardTitle>
                  <CardDescription>
                    View and manage all system permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search permissions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={(value: PermissionCategory | 'all') => setSelectedCategory(value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Object.values(PERMISSION_CATEGORIES).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4">
                    {Object.values(PERMISSION_CATEGORIES).map((category) => {
                      const categoryPermissions = filteredPermissions.filter(p => p.category === category);
                      if (categoryPermissions.length === 0 && selectedCategory !== 'all') return null;

                      return (
                        <Card key={category}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{category}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-2">
                              {categoryPermissions.map((permission) => (
                                <div key={permission.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <div className="font-medium">{permission.id}</div>
                                    <div className="text-sm text-muted-foreground">{permission.description}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={getPermissionBadgeVariant(permission.resource)}>
                                      {permission.resource}
                                    </Badge>
                                    <Badge variant="outline">
                                      {permission.action}
                                    </Badge>
                                    <Badge variant="secondary">
                                      {permission.scope}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Roles</CardTitle>
                  <CardDescription>
                    Create and manage custom roles with specific permission sets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-4">
                    <Input
                      placeholder="Search roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                    <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Role
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create Custom Role</DialogTitle>
                          <DialogDescription>
                            Define a new role with specific permissions
                          </DialogDescription>
                        </DialogHeader>
                        <RoleForm
                          permissions={permissions}
                          existingRoles={roles}
                          onSubmit={handleCreateRole}
                          onCancel={() => setIsRoleDialogOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-4">
                    {roles.map((role) => (
                      <Card key={role.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {role.is_system_role ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Unlock className="h-4 w-4" />
                                )}
                                {role.name}
                              </CardTitle>
                              <CardDescription>{role.description}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              {!role.is_system_role && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingRole(role)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this role? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteRole(role.id)}>
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {role.permissions.slice(0, 10).map((permissionId) => (
                              <Badge key={permissionId} variant="outline">
                                {permissionId.split(':')[1] || permissionId}
                              </Badge>
                            ))}
                            {role.permissions.length > 10 && (
                              <Badge variant="outline">
                                +{role.permissions.length - 10} more
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Permission Audit Log</CardTitle>
                  <CardDescription>
                    Track permission changes and access attempts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-16 w-16 mx-auto mb-4" />
                    <p>Audit log functionality coming soon...</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AdminGuard>
    </SuperAdminGuard>
  );
}

// Role creation/editing form component
function RoleForm({
  permissions,
  existingRoles,
  onSubmit,
  onCancel,
  initialData
}: {
  permissions: Permission[];
  existingRoles: Role[];
  onSubmit: (data: RoleFormData) => void;
  onCancel: () => void;
  initialData?: Role;
}) {
  const [formData, setFormData] = useState<RoleFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    level: initialData?.level || 5,
    permissions: initialData?.permissions || [],
    inherits_from: initialData?.inherits_from
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Role Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="level">Priority Level</Label>
          <Input
            id="level"
            type="number"
            min="1"
            max="10"
            value={formData.level}
            onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) }))}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label>Permissions</Label>
        <ScrollArea className="h-64 border rounded-md p-4">
          {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
            <div key={category} className="mb-4">
              <h4 className="font-medium mb-2">{category}</h4>
              <div className="space-y-2">
                {categoryPermissions.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission.id}
                      checked={formData.permissions.includes(permission.id)}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <Label htmlFor={permission.id} className="text-sm">
                      {permission.description}
                    </Label>
                  </div>
                ))}
              </div>
              <Separator className="mt-2" />
            </div>
          ))}
        </ScrollArea>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </form>
  );
}

// User permission form component
function UserPermissionForm({
  users,
  permissions,
  onSubmit,
  onCancel
}: {
  users: User[];
  permissions: Permission[];
  onSubmit: (data: UserPermissionFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<UserPermissionFormData>({
    user_id: '',
    permission_id: '',
    scope_type: 'business'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="user">User</Label>
        <Select value={formData.user_id} onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select user" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="permission">Permission</Label>
        <Select value={formData.permission_id} onValueChange={(value) => setFormData(prev => ({ ...prev, permission_id: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select permission" />
          </SelectTrigger>
          <SelectContent>
            {permissions.map((permission) => (
              <SelectItem key={permission.id} value={permission.id}>
                {permission.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="scope">Scope</Label>
        <Select value={formData.scope_type} onValueChange={(value: PermissionScope) => setFormData(prev => ({ ...prev, scope_type: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global</SelectItem>
            <SelectItem value="agency">Agency</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="self">Self</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="expires">Expires At (Optional)</Label>
        <Input
          id="expires"
          type="datetime-local"
          value={formData.expires_at || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Grant Permission
        </Button>
      </div>
    </form>
  );
}

export default PermissionManager;