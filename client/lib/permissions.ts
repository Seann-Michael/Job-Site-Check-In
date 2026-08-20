import {
  Permission,
  PermissionContext,
  PermissionResult,
  UserRole,
  UserPermission,
  Role,
  PermissionResource,
  PermissionAction,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "@/types/permissions";

/**
 * Client-side permission checks.
 *
 * Decisions are made purely from the user's role (users.role) plus any
 * explicit per-user permissions passed in. There is no permissions backend;
 * nothing here makes a network call. Server-side enforcement is still the
 * source of truth (RLS / route guards) — this only drives UI gating.
 */

export interface UserData {
  id: string;
  /** Either a canonical UserRole or one of the legacy role strings. */
  role: UserRole | string;
  business_id?: string;
  permissions?: UserPermission[];
  custom_permissions?: string[];
}

/**
 * Role strings seen in the codebase / database, mapped onto the canonical
 * UserRole set that ROLE_PERMISSIONS is keyed by.
 *  - client/lib/auth.ts:   admin | editor | viewer | superadmin | agency
 *  - public.users.role:    super_admin | agency_admin | business_owner | staff | viewer
 */
const ROLE_ALIASES: Record<string, UserRole> = {
  superadmin: "super_admin",
  super_admin: "super_admin",
  admin: "admin",
  agency: "agency_admin",
  agency_admin: "agency_admin",
  agency_user: "agency_user",
  business_owner: "business_owner",
  business_admin: "business_admin",
  business_user: "business_user",
  editor: "business_user",
  staff: "business_user",
  client: "client",
  viewer: "viewer",
  guest: "guest",
};

export function normalizeRole(role: string | undefined | null): UserRole {
  if (!role) return "guest";
  return ROLE_ALIASES[role] ?? "guest";
}

class PermissionService {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.initializeDefaultPermissions();
    this.initializeRoles();
  }

  private initializeDefaultPermissions() {
    Object.values(PERMISSIONS).forEach((value) => {
      const [resource, action] = value.split(":") as [
        PermissionResource,
        PermissionAction,
      ];
      this.permissions.set(value, {
        id: value,
        resource,
        action,
        scope: "business",
        description: `${action} ${resource}`,
        category: this.getCategoryForResource(resource),
      });
    });
  }

  private initializeRoles() {
    const now = new Date(0).toISOString();
    (Object.keys(ROLE_PERMISSIONS) as UserRole[]).forEach((roleId, index) => {
      this.roles.set(roleId, {
        id: roleId,
        name: roleId.replace(/_/g, " "),
        description: `Built-in ${roleId.replace(/_/g, " ")} role`,
        level: index,
        permissions: ROLE_PERMISSIONS[roleId],
        is_system_role: true,
        created_at: now,
        updated_at: now,
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

  /**
   * Check whether a user holds a permission. Synchronous internally; the
   * async signature is kept so existing callers (PermissionGuard) keep working.
   */
  async hasPermission(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): Promise<PermissionResult> {
    return this.checkPermission(user, permission, context);
  }

  checkPermission(
    user: UserData,
    permission: string,
    context?: Partial<PermissionContext>,
  ): PermissionResult {
    const role = normalizeRole(user.role);

    if (role === "super_admin") {
      return { granted: true, reason: "Super admin access" };
    }

    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    const granted =
      rolePermissions.includes(permission) ||
      !!user.custom_permissions?.includes(permission) ||
      !!user.permissions?.some((p) => p.permission_id === permission && !this.isExpired(p));

    if (!granted) {
      return { granted: false, reason: "Permission not granted to this role" };
    }

    // Business scoping: a business-scoped check against a different business
    // than the user's is denied. Unknown scope ids are allowed (role decides).
    if (
      context?.scope_type === "business" &&
      context.scope_id &&
      user.business_id &&
      context.scope_id !== user.business_id
    ) {
      return { granted: false, reason: "Access denied: different business" };
    }

    // Self scoping: only the owner of a record may act on it.
    if (
      context?.scope_type === "self" &&
      context.resource_data?.user_id &&
      context.resource_data.user_id !== user.id
    ) {
      return { granted: false, reason: "Can only access own data" };
    }

    return { granted: true };
  }

  private isExpired(p: UserPermission): boolean {
    const expires = (p as { expires_at?: string }).expires_at;
    return !!expires && new Date(expires).getTime() < Date.now();
  }

  async hasAnyPermission(
    user: UserData,
    permissions: string[],
    context?: Partial<PermissionContext>,
  ): Promise<boolean> {
    return permissions.some((p) => this.checkPermission(user, p, context).granted);
  }

  async hasAllPermissions(
    user: UserData,
    permissions: string[],
    context?: Partial<PermissionContext>,
  ): Promise<boolean> {
    return permissions.every((p) => this.checkPermission(user, p, context).granted);
  }

  async getUserPermissions(user: UserData): Promise<string[]> {
    const role = normalizeRole(user.role);
    const set = new Set<string>(ROLE_PERMISSIONS[role] || []);
    user.custom_permissions?.forEach((p) => set.add(p));
    user.permissions?.forEach((p) => {
      if (!this.isExpired(p)) set.add(p.permission_id);
    });
    return Array.from(set);
  }

  /** Kept for API compatibility; there is no cache any more. */
  clearUserCache(_userId: string) {}
  clearCache() {}

  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(normalizeRole(roleId));
  }

  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  getPermissionsByCategory(category: string): Permission[] {
    return this.getAllPermissions().filter((p) => p.category === category);
  }

  async canAccessAdmin(user: UserData): Promise<boolean> {
    return this.checkPermission(user, PERMISSIONS.ADMIN_ACCESS).granted;
  }

  async canManage(
    user: UserData,
    resource: PermissionResource,
    resourceId?: string,
  ): Promise<boolean> {
    const permission = `${resource}:manage`;
    const context = resourceId ? { scope_id: resourceId } : undefined;
    return this.checkPermission(user, permission, context).granted;
  }
}

export const permissionService = new PermissionService();

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
