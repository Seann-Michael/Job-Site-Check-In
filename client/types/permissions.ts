// Permission resource types
export type PermissionResource =
  | "projects"
  | "businesses"
  | "users"
  | "analytics"
  | "reports"
  | "settings"
  | "media"
  | "tasks"
  | "reviews"
  | "keywords"
  | "citations"
  | "competitors"
  | "backlinks"
  | "audits"
  | "billing"
  | "integrations"
  | "webhooks"
  | "api_keys"
  | "team"
  | "clients"
  | "agencies";

// Permission action types
export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "manage"
  | "assign"
  | "archive"
  | "export"
  | "import"
  | "approve"
  | "publish"
  | "schedule"
  | "moderate"
  | "configure"
  | "view_sensitive"
  | "bulk_edit"
  | "admin_access";

// Permission scopes for multi-tenancy
export type PermissionScope =
  | "global" // System-wide access
  | "agency" // Agency-level access
  | "business" // Business-level access
  | "project" // Project-level access
  | "self"; // Own data only

// User roles in hierarchy
export type UserRole =
  | "super_admin" // Platform administrator
  | "admin" // Organization administrator
  | "agency_admin" // Agency administrator
  | "agency_user" // Agency team member
  | "business_owner" // Business owner
  | "business_admin" // Business administrator
  | "business_user" // Business team member
  | "client" // Client with limited access
  | "viewer" // Read-only access
  | "guest"; // Temporary/limited access

// Permission definition
export interface Permission {
  id: string;
  resource: PermissionResource;
  action: PermissionAction;
  scope: PermissionScope;
  conditions?: PermissionCondition[];
  description: string;
  category: string;
}

// Permission condition for dynamic access control
export interface PermissionCondition {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "in"
    | "not_in"
    | "greater_than"
    | "less_than"
    | "contains";
  value: any;
  description: string;
}

// Role definition with permissions
export interface Role {
  id: string;
  name: string;
  description: string;
  level: number; // Hierarchy level (lower = more permissions)
  permissions: string[]; // Permission IDs
  inherits_from?: string; // Parent role ID
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

// User permission assignment
export interface UserPermission {
  user_id: string;
  permission_id: string;
  scope_type: PermissionScope;
  scope_id?: string; // ID of the scoped resource (agency_id, business_id, etc.)
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  conditions?: Record<string, any>;
}

// Permission check context
export interface PermissionContext {
  user_id: string;
  resource: PermissionResource;
  action: PermissionAction;
  scope_type?: PermissionScope;
  scope_id?: string;
  resource_data?: any;
  additional_context?: Record<string, any>;
}

// Permission check result
export interface PermissionResult {
  granted: boolean;
  reason?: string;
  conditions_met?: boolean;
  scope_limited?: boolean;
  alternative_permissions?: string[];
}

// Predefined permission constants
export const PERMISSIONS = {
  // Project Management
  PROJECTS_CREATE: "projects:create",
  PROJECTS_READ: "projects:read",
  PROJECTS_UPDATE: "projects:update",
  PROJECTS_DELETE: "projects:delete",
  PROJECTS_MANAGE: "projects:manage",
  PROJECTS_ASSIGN: "projects:assign",
  PROJECTS_ARCHIVE: "projects:archive",
  PROJECTS_EXPORT: "projects:export",

  // Business Management
  BUSINESSES_CREATE: "businesses:create",
  BUSINESSES_READ: "businesses:read",
  BUSINESSES_UPDATE: "businesses:update",
  BUSINESSES_DELETE: "businesses:delete",
  BUSINESSES_MANAGE: "businesses:manage",

  // User Management
  USERS_CREATE: "users:create",
  USERS_READ: "users:read",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",
  USERS_MANAGE: "users:manage",
  USERS_VIEW_SENSITIVE: "users:view_sensitive",

  // Analytics & Reports
  ANALYTICS_READ: "analytics:read",
  ANALYTICS_EXPORT: "analytics:export",
  REPORTS_CREATE: "reports:create",
  REPORTS_READ: "reports:read",
  REPORTS_EXPORT: "reports:export",

  // Media Management
  MEDIA_CREATE: "media:create",
  MEDIA_READ: "media:read",
  MEDIA_UPDATE: "media:update",
  MEDIA_DELETE: "media:delete",

  // System Administration
  SETTINGS_READ: "settings:read",
  SETTINGS_UPDATE: "settings:update",
  SETTINGS_CONFIGURE: "settings:configure",
  INTEGRATIONS_MANAGE: "integrations:manage",
  API_KEYS_MANAGE: "api_keys:manage",

  // Agency Management
  AGENCIES_CREATE: "agencies:create",
  AGENCIES_READ: "agencies:read",
  AGENCIES_UPDATE: "agencies:update",
  AGENCIES_DELETE: "agencies:delete",
  AGENCIES_MANAGE: "agencies:manage",

  // Team Management
  TEAM_CREATE: "team:create",
  TEAM_READ: "team:read",
  TEAM_UPDATE: "team:update",
  TEAM_DELETE: "team:delete",
  TEAM_ASSIGN: "team:assign",
  TEAM_MANAGE: "team:manage",

  // Billing & Finance
  BILLING_READ: "billing:read",
  BILLING_UPDATE: "billing:update",
  BILLING_MANAGE: "billing:manage",

  // SEO Tools
  KEYWORDS_CREATE: "keywords:create",
  KEYWORDS_READ: "keywords:read",
  KEYWORDS_UPDATE: "keywords:update",
  KEYWORDS_DELETE: "keywords:delete",
  KEYWORDS_MANAGE: "keywords:manage",

  CITATIONS_CREATE: "citations:create",
  CITATIONS_READ: "citations:read",
  CITATIONS_UPDATE: "citations:update",
  CITATIONS_DELETE: "citations:delete",
  CITATIONS_MANAGE: "citations:manage",

  REVIEWS_READ: "reviews:read",
  REVIEWS_UPDATE: "reviews:update",
  REVIEWS_MODERATE: "reviews:moderate",

  AUDITS_CREATE: "audits:create",
  AUDITS_READ: "audits:read",
  AUDITS_EXPORT: "audits:export",

  // Admin Access
  ADMIN_ACCESS: "admin:access",
  SUPER_ADMIN_ACCESS: "super_admin:access",
} as const;

// Role hierarchy and default permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    PERMISSIONS.SUPER_ADMIN_ACCESS,
    PERMISSIONS.ADMIN_ACCESS,
    // All permissions - super admin has access to everything
    ...Object.values(PERMISSIONS),
  ],

  admin: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.BUSINESSES_MANAGE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.MEDIA_CREATE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPDATE,
    PERMISSIONS.MEDIA_DELETE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.KEYWORDS_MANAGE,
    PERMISSIONS.CITATIONS_MANAGE,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.AUDITS_CREATE,
    PERMISSIONS.AUDITS_READ,
    PERMISSIONS.AUDITS_EXPORT,
  ],

  agency_admin: [
    PERMISSIONS.AGENCIES_READ,
    PERMISSIONS.AGENCIES_UPDATE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.BUSINESSES_READ,
    PERMISSIONS.BUSINESSES_UPDATE,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.MEDIA_CREATE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPDATE,
    PERMISSIONS.TEAM_CREATE,
    PERMISSIONS.TEAM_READ,
    PERMISSIONS.TEAM_UPDATE,
    PERMISSIONS.TEAM_ASSIGN,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.KEYWORDS_CREATE,
    PERMISSIONS.KEYWORDS_READ,
    PERMISSIONS.KEYWORDS_UPDATE,
    PERMISSIONS.CITATIONS_CREATE,
    PERMISSIONS.CITATIONS_READ,
    PERMISSIONS.CITATIONS_UPDATE,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.REVIEWS_UPDATE,
    PERMISSIONS.AUDITS_CREATE,
    PERMISSIONS.AUDITS_READ,
  ],

  agency_user: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.BUSINESSES_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.MEDIA_CREATE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPDATE,
    PERMISSIONS.KEYWORDS_READ,
    PERMISSIONS.KEYWORDS_UPDATE,
    PERMISSIONS.CITATIONS_READ,
    PERMISSIONS.CITATIONS_UPDATE,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.AUDITS_READ,
  ],

  business_owner: [
    PERMISSIONS.BUSINESSES_READ,
    PERMISSIONS.BUSINESSES_UPDATE,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_ASSIGN,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.MEDIA_CREATE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPDATE,
    PERMISSIONS.TEAM_READ,
    PERMISSIONS.TEAM_UPDATE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.KEYWORDS_CREATE,
    PERMISSIONS.KEYWORDS_READ,
    PERMISSIONS.KEYWORDS_UPDATE,
    PERMISSIONS.CITATIONS_CREATE,
    PERMISSIONS.CITATIONS_READ,
    PERMISSIONS.CITATIONS_UPDATE,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.REVIEWS_UPDATE,
    PERMISSIONS.AUDITS_READ,
  ],

  business_admin: [
    PERMISSIONS.BUSINESSES_READ,
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_ASSIGN,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.MEDIA_CREATE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPDATE,
    PERMISSIONS.TEAM_READ,
    PERMISSIONS.KEYWORDS_READ,
    PERMISSIONS.KEYWORDS_UPDATE,
    PERMISSIONS.CITATIONS_READ,
    PERMISSIONS.CITATIONS_UPDATE,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.AUDITS_READ,
  ],

  business_user: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.CHAT_READ,
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.KEYWORDS_READ,
    PERMISSIONS.CITATIONS_READ,
    PERMISSIONS.REVIEWS_READ,
  ],

  client: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.MEDIA_READ,
  ],

  viewer: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_READ,
  ],

  guest: [
    // Very limited access
  ],
};

// Permission categories for UI organization
export const PERMISSION_CATEGORIES = {
  PROJECT_MANAGEMENT: "Project Management",
  BUSINESS_MANAGEMENT: "Business Management",
  USER_MANAGEMENT: "User & Team Management",
  ANALYTICS_REPORTING: "Analytics & Reporting",
  COMMUNICATION: "Communication & Chat",
  MEDIA_CONTENT: "Media & Content",
  SEO_TOOLS: "SEO Tools",
  SYSTEM_ADMIN: "System Administration",
  BILLING_FINANCE: "Billing & Finance",
  INTEGRATIONS: "Integrations & API",
} as const;

export type PermissionCategory =
  (typeof PERMISSION_CATEGORIES)[keyof typeof PERMISSION_CATEGORIES];
