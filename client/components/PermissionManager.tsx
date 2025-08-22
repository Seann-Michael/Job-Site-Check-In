import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Settings,
  UserPlus,
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
    <SuperAdminGuard 
      fallback={
        <AdminGuard 
          fallback={
            <div className="text-center p-8">
              <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">You need admin permissions to access this page.</p>
            </div>
          }
        >
          <PermissionManagerContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            users={filteredUsers}
            roles={roles}
            permissions={filteredPermissions}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            handleUpdateUserRole={handleUpdateUserRole}
            handleCreateRole={handleCreateRole}
            getRoleIcon={getRoleIcon}
            getPermissionBadgeVariant={getPermissionBadgeVariant}
            loadData={loadData}
          />
        </AdminGuard>
      }
    >
      <PermissionManagerContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        users={filteredUsers}
        roles={roles}
        permissions={filteredPermissions}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        handleUpdateUserRole={handleUpdateUserRole}
        handleCreateRole={handleCreateRole}
        getRoleIcon={getRoleIcon}
        getPermissionBadgeVariant={getPermissionBadgeVariant}
        loadData={loadData}
      />
    </SuperAdminGuard>
  );
}

// Content component to avoid duplication
function PermissionManagerContent({
  activeTab,
  setActiveTab,
  users,
  roles,
  permissions,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  handleUpdateUserRole,
  handleCreateRole,
  getRoleIcon,
  getPermissionBadgeVariant,
  loadData
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  users: User[];
  roles: Role[];
  permissions: Permission[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: PermissionCategory | 'all';
  setSelectedCategory: (category: PermissionCategory | 'all') => void;
  handleUpdateUserRole: (userId: string, role: UserRole) => void;
  handleCreateRole: (data: RoleFormData) => void;
  getRoleIcon: (role: UserRole) => React.ReactNode;
  getPermissionBadgeVariant: (resource: PermissionResource) => 'default' | 'secondary' | 'destructive' | 'outline';
  loadData: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permission Management</h1>
          <p className="text-muted-foreground">Manage users, roles, and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData}>
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
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Grant Permission
                </Button>
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
                    {users.map((user) => (
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
                  const categoryPermissions = permissions.filter(p => p.category === category);
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
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </div>

              <div className="space-y-4">
                {roles.map((role) => (
                  <Card key={role.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {role.name}
                          </CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
  );
}

export default PermissionManager;
