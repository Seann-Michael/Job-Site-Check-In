import {
  Permission,
  PermissionContext,
  PermissionResult,
  UserRole,
  UserPermission,
  Role,
  PermissionScope,
  PermissionResource,
  PermissionAction,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PermissionCondition,
} from "@/types/permissions";

interface UserData {
  id: string;
  role: UserRole;
  agency_id?: string;
  business_id?: string;
  permissions?: UserPermission[];
  custom_permissions?: string[];
}

interface CachedPermissions {
  permissions: Set<string>;
  timestamp: number;
  expires_at: number;
}

class PermissionService {
  private cache = new Map<string, CachedPermissions>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.initializeDefaultPermissions();
    this.loadPermissionsFromServer();
  }

  private initializeDefaultPermissions() {
    // Initialize with basic permission structure
    Object.entries(PERMISSIONS).forEach(([key, value]) => {
      const [resource, action] = value.split(":") as [
        PermissionResource,
        PermissionAction,
      ];
      this.permissions.set(value, {
        id: value,
        resource,
        action,
        scope: "business", // Default scope
        description: `${action} ${resource}`,
        category: this.getCategoryForResource(resource),
      });
    });
  }

  private getCategoryForResource(resource: PermissionResource): string {
    const categoryMap: Record<PermissionResource, string> = {
      projects: "Project Management",
      businesses: "Business Management",
      users: "User & Team Management",
      analytics: "Analytics & Reporting",
      reports: "Analytics & Reporting",
      settings: "System Administration",
      chat: "Communication & Chat",
      media: "Media & Content",
      tasks: "Project Management",
      reviews: "SEO Tools",
      keywords: "SEO Tools",
      citations: "SEO Tools",
      competitors: "SEO Tools",
      backlinks: "SEO Tools",
      audits: "SEO Tools",
      billing: "Billing & Finance",
      integrations: "Integrations & API",
      webhooks: "Integrations & API",
      api_keys: "Integrations & API",
      team: "User & Team Management",
      clients: "Business Management",
      agencies: "Business Management",
    };
    return categoryMap[resource] || "General";
  }

  private async loadPermissionsFromServer() {
    try {
      // Load custom permissions and roles from server
      const [permissionsResponse, rolesResponse] = await Promise.all([
        this.fetchWithAuth("/api/permissions"),
        this.fetchWithAuth("/api/roles"),
      ]);

      if (permissionsResponse.ok) {
        const serverPermissions = await permissionsResponse.json();
        serverPermissions.forEach((perm: Permission) => {
          this.permissions.set(perm.id, perm);
        });
      }

      if (rolesResponse.ok) {
        const serverRoles = await rolesResponse.json();
        serverRoles.forEach((role: Role) => {
          this.roles.set(role.id, role);
        });
      }
    } catch (error) {
      console.warn("Failed to load permissions from server:", error);
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = this.getAuthToken();
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  private getAuthToken(): string {
    return localStorage.getItem("auth_token") || "";
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    // Check cache first
    const cacheKey = `${user.id}:${permission}:${JSON.stringify(context)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expires_at > Date.now()) {
      return { granted: cached.permissions.has(permission) };
    }

    // Perform permission check
    const result = await this.checkPermission(user, permission, context);

    // Cache result
    this.cachePermissionResult(cacheKey, permission, result.granted);

    return result;
  }

  private async checkPermission(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    // Super admin has all permissions
    if (user.role === "super_admin") {
      return { granted: true, reason: "Super admin access" };
    }

    // Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    if (rolePermissions.includes(permission)) {
      // Check scope and conditions
      const scopeCheck = await this.checkScope(user, permission, context);
      if (!scopeCheck.granted) {
        return scopeCheck;
      }

      const conditionCheck = await this.checkConditions(
        user,
        permission,
        context,
      );
      return conditionCheck;
    }

    // Check custom user permissions
    if (user.custom_permissions?.includes(permission)) {
      return this.checkUserSpecificPermission(user, permission, context);
    }

    // Check explicit user permissions
    if (user.permissions) {
      const userPerm = user.permissions.find(
        (p) => p.permission_id === permission,
      );
      if (userPerm) {
        return this.evaluateUserPermission(userPerm, context);
      }
    }

    return {
      granted: false,
      reason: "Permission not found in user role or custom permissions",
    };
  }

  private async checkScope(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    const permissionDef = this.permissions.get(permission);
    if (!permissionDef) {
      return { granted: true }; // If permission not defined, allow role-based access
    }

    switch (permissionDef.scope) {
      case "global":
        return {
          granted: user.role === "super_admin" || user.role === "admin",
        };

      case "agency":
        if (!user.agency_id && context?.scope_id) {
          return {
            granted: false,
            reason: "User not associated with any agency",
          };
        }
        if (context?.scope_id && context.scope_id !== user.agency_id) {
          return { granted: false, reason: "Access denied: different agency" };
        }
        return { granted: true };

      case "business":
        if (!user.business_id && context?.scope_id) {
          return {
            granted: false,
            reason: "User not associated with any business",
          };
        }
        if (context?.scope_id && context.scope_id !== user.business_id) {
          return {
            granted: false,
            reason: "Access denied: different business",
          };
        }
        return { granted: true };

      case "project":
        return this.checkProjectAccess(user, context);

      case "self":
        if (
          context?.resource_data?.user_id &&
          context.resource_data.user_id !== user.id
        ) {
          return { granted: false, reason: "Can only access own data" };
        }
        return { granted: true };

      default:
        return { granted: true };
    }
  }

  private async checkProjectAccess(
    user: UserData,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    if (!context?.scope_id) {
      return { granted: true }; // No specific project check needed
    }

    try {
      const response = await this.fetchWithAuth(
        `/api/projects/${context.scope_id}/access-check`,
      );
      if (response.ok) {
        const accessData = await response.json();
        return { granted: accessData.has_access };
      }
    } catch (error) {
      console.error("Project access check failed:", error);
    }

    return { granted: false, reason: "Project access verification failed" };
  }

  private async checkConditions(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    const permissionDef = this.permissions.get(permission);
    if (!permissionDef?.conditions || permissionDef.conditions.length === 0) {
      return { granted: true };
    }

    for (const condition of permissionDef.conditions) {
      const conditionMet = this.evaluateCondition(condition, user, context);
      if (!conditionMet) {
        return {
          granted: false,
          reason: `Condition not met: ${condition.description}`,
          conditions_met: false,
        };
      }
    }

    return { granted: true, conditions_met: true };
  }

  private evaluateCondition(
    condition: PermissionCondition,
    user: UserData,
    context?: Partial<PermissionContext>,
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, user, context);

    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue)
        );
      case "not_in":
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(fieldValue)
        );
      case "greater_than":
        return Number(fieldValue) > Number(condition.value);
      case "less_than":
        return Number(fieldValue) < Number(condition.value);
      case "contains":
        return String(fieldValue)
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());
      default:
        return false;
    }
  }

  private getFieldValue(
    field: string,
    user: UserData,
    context?: Partial<PermissionContext>,
  ): any {
    // Support nested field access like "user.role" or "context.resource_data.status"
    const parts = field.split(".");
    let value: any;

    if (parts[0] === "user") {
      value = user;
      for (let i = 1; i < parts.length; i++) {
        value = value?.[parts[i]];
      }
    } else if (parts[0] === "context") {
      value = context;
      for (let i = 1; i < parts.length; i++) {
        value = value?.[parts[i]];
      }
    } else {
      value = user[field as keyof UserData];
    }

    return value;
  }

  private async checkUserSpecificPermission(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    // Implementation for custom user permissions
    return { granted: true, reason: "Custom user permission" };
  }

  private evaluateUserPermission(
    userPermission: UserPermission,
    context?: Partial<PermissionContext>,
  ): PermissionResult {
    // Check if permission has expired
    if (
      userPermission.expires_at &&
      new Date(userPermission.expires_at) < new Date()
    ) {
      return { granted: false, reason: "Permission expired" };
    }

    // Check scope
    if (
      userPermission.scope_id &&
      context?.scope_id !== userPermission.scope_id
    ) {
      return { granted: false, reason: "Scope mismatch" };
    }

    // Check custom conditions
    if (userPermission.conditions) {
      for (const [key, value] of Object.entries(userPermission.conditions)) {
        if (context?.additional_context?.[key] !== value) {
          return { granted: false, reason: `Condition not met: ${key}` };
        }
      }
    }

    return { granted: true };
  }

  private cachePermissionResult(
    cacheKey: string,
    permission: string,
    granted: boolean,
  ) {
    const existing = this.cache.get(cacheKey);
    const permissions = existing?.permissions || new Set<string>();

    if (granted) {
      permissions.add(permission);
    }

    this.cache.set(cacheKey, {
      permissions,
      timestamp: Date.now(),
      expires_at: Date.now() + this.CACHE_TTL,
    });
  }

  /**
   * Check multiple permissions at once
   */
  async hasAnyPermission(
    user: UserData,
    permissions: string[],
    context?: Partial<PermissionContext>,
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map((perm) => this.hasPermission(user, perm, context)),
    );
    return results.some((result) => result.granted);
  }

  /**
   * Check if user has all permissions
   */
  async hasAllPermissions(
    user: UserData,
    permissions: string[],
    context?: Partial<PermissionContext>,
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map((perm) => this.hasPermission(user, perm, context)),
    );
    return results.every((result) => result.granted);
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(user: UserData): Promise<string[]> {
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    const customPermissions = user.custom_permissions || [];
    const explicitPermissions =
      user.permissions?.map((p) => p.permission_id) || [];

    return [
      ...new Set([
        ...rolePermissions,
        ...customPermissions,
        ...explicitPermissions,
      ]),
    ];
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    userId: string,
    permission: string,
    scope: PermissionScope,
    scopeId?: string,
    expiresAt?: Date,
  ): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth("/api/permissions/grant", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          permission_id: permission,
          scope_type: scope,
          scope_id: scopeId,
          expires_at: expiresAt?.toISOString(),
        }),
      });

      if (response.ok) {
        this.clearUserCache(userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to grant permission:", error);
      return false;
    }
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(
    userId: string,
    permission: string,
    scopeId?: string,
  ): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth("/api/permissions/revoke", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          permission_id: permission,
          scope_id: scopeId,
        }),
      });

      if (response.ok) {
        this.clearUserCache(userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to revoke permission:", error);
      return false;
    }
  }

  /**
   * Create custom role
   */
  async createRole(
    role: Omit<Role, "id" | "created_at" | "updated_at">,
  ): Promise<Role | null> {
    try {
      const response = await this.fetchWithAuth("/api/roles", {
        method: "POST",
        body: JSON.stringify(role),
      });

      if (response.ok) {
        const newRole = await response.json();
        this.roles.set(newRole.id, newRole);
        return newRole;
      }
      return null;
    } catch (error) {
      console.error("Failed to create role:", error);
      return null;
    }
  }

  /**
   * Clear cache for specific user
   */
  clearUserCache(userId: string) {
    for (const [key] of this.cache) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get permission definition
   */
  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  /**
   * Get role definition
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Get all available permissions
   */
  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Get permissions by category
   */
  getPermissionsByCategory(category: string): Permission[] {
    return Array.from(this.permissions.values()).filter(
      (p) => p.category === category,
    );
  }

  /**
   * Check if user can access admin features
   */
  async canAccessAdmin(user: UserData): Promise<boolean> {
    const result = await this.hasPermission(user, PERMISSIONS.ADMIN_ACCESS);
    return result.granted;
  }

  /**
   * Check if user can manage a specific resource
   */
  async canManage(
    user: UserData,
    resource: PermissionResource,
    resourceId?: string,
  ): Promise<boolean> {
    const permission = `${resource}:manage`;
    const context = resourceId ? { scope_id: resourceId } : undefined;
    const result = await this.hasPermission(user, permission, context);
    return result.granted;
  }
}

// Export singleton instance
export const permissionService = new PermissionService();

// Helper functions for common permission checks
export const PermissionHelpers = {
  canCreateProject: (user: UserData) =>
    permissionService.hasPermission(user, PERMISSIONS.PROJECTS_CREATE),

  canEditProject: (user: UserData, projectId: string) =>
    permissionService.hasPermission(user, PERMISSIONS.PROJECTS_UPDATE, {
      scope_id: projectId,
    }),

  canDeleteProject: (user: UserData, projectId: string) =>
    permissionService.hasPermission(user, PERMISSIONS.PROJECTS_DELETE, {
      scope_id: projectId,
    }),

  canViewAnalytics: (user: UserData) =>
    permissionService.hasPermission(user, PERMISSIONS.ANALYTICS_READ),

  canManageUsers: (user: UserData) =>
    permissionService.hasPermission(user, PERMISSIONS.USERS_MANAGE),

  canManageBilling: (user: UserData) =>
    permissionService.hasPermission(user, PERMISSIONS.BILLING_MANAGE),

  canConfigureSystem: (user: UserData) =>
    permissionService.hasPermission(user, PERMISSIONS.SETTINGS_CONFIGURE),
};

export default permissionService;
