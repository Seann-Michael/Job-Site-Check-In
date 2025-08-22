import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  UserRole,
  PermissionResource,
  PermissionAction,
  PermissionScope,
  PermissionContext,
  PermissionResult,
  PERMISSIONS,
  ROLE_PERMISSIONS
} from '../../client/types/permissions';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  agency_id?: string;
  business_id?: string;
  permissions?: string[];
}

interface PermissionCheckOptions {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  resource?: PermissionResource;
  action?: PermissionAction;
  scope?: PermissionScope;
  allowSelfAccess?: boolean;
  customCheck?: (user: AuthenticatedUser, event: HandlerEvent) => Promise<boolean>;
}

interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

class PermissionMiddleware {
  private permissionCache = new Map<string, { permissions: Set<string>; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Authenticate user from Bearer token
   */
  async authenticateUser(event: HandlerEvent): Promise<AuthenticatedUser | null> {
    try {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      
      // Handle demo tokens for development
      if (token.startsWith('demo_token_') && process.env.NODE_ENV !== 'production') {
        return this.handleDemoToken(token);
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.warn('Invalid token:', error?.message);
        return null;
      }

      // Get user profile with role and associations
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          role,
          agency_id,
          business_id,
          custom_permissions
        `)
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Failed to fetch user profile:', profileError);
        return null;
      }

      return {
        id: user.id,
        email: user.email!,
        role: profile.role as UserRole,
        agency_id: profile.agency_id,
        business_id: profile.business_id,
        permissions: profile.custom_permissions || []
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  private handleDemoToken(token: string): AuthenticatedUser {
    // Demo token format: demo_token_role_id
    const parts = token.split('_');
    const role = parts[2] as UserRole || 'business_owner';
    const id = parts[3] || 'demo-user-id';

    return {
      id,
      email: `demo@${role}.com`,
      role,
      agency_id: role.includes('agency') ? 'demo-agency-id' : undefined,
      business_id: role.includes('business') ? 'demo-business-id' : undefined,
      permissions: []
    };
  }

  /**
   * Check if user has required permissions
   */
  async hasPermission(
    user: AuthenticatedUser,
    options: PermissionCheckOptions,
    event: HandlerEvent
  ): Promise<PermissionResult> {
    // Super admin has all permissions
    if (user.role === 'super_admin') {
      return { granted: true, reason: 'Super admin access' };
    }

    // Custom check function
    if (options.customCheck) {
      const hasAccess = await options.customCheck(user, event);
      return { granted: hasAccess };
    }

    // Role-based permission check
    const userPermissions = await this.getUserPermissions(user);
    
    if (options.permission) {
      return this.checkSinglePermission(user, options.permission, userPermissions, event, options);
    }

    if (options.permissions) {
      return this.checkMultiplePermissions(user, options.permissions, options.requireAll || false, userPermissions, event, options);
    }

    if (options.resource && options.action) {
      const permission = `${options.resource}:${options.action}`;
      return this.checkSinglePermission(user, permission, userPermissions, event, options);
    }

    return { granted: false, reason: 'No permission criteria specified' };
  }

  private async getUserPermissions(user: AuthenticatedUser): Promise<Set<string>> {
    const cacheKey = `${user.id}:${user.role}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.permissions;
    }

    // Get role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    
    // Get custom user permissions
    const customPermissions = user.permissions || [];
    
    // Get explicit user permissions from database
    const { data: userPerms } = await supabase
      .from('user_permissions')
      .select('permission_id')
      .eq('user_id', user.id)
      .gte('expires_at', new Date().toISOString())
      .or('expires_at.is.null');

    const explicitPermissions = userPerms?.map(p => p.permission_id) || [];
    
    const allPermissions = new Set([
      ...rolePermissions,
      ...customPermissions,
      ...explicitPermissions
    ]);

    // Cache the result
    this.permissionCache.set(cacheKey, {
      permissions: allPermissions,
      expires: Date.now() + this.CACHE_TTL
    });

    return allPermissions;
  }

  private async checkSinglePermission(
    user: AuthenticatedUser,
    permission: string,
    userPermissions: Set<string>,
    event: HandlerEvent,
    options: PermissionCheckOptions
  ): Promise<PermissionResult> {
    if (!userPermissions.has(permission)) {
      return { granted: false, reason: `Missing permission: ${permission}` };
    }

    // Check scope if specified
    if (options.scope) {
      const scopeCheck = await this.checkScope(user, permission, event, options);
      if (!scopeCheck.granted) {
        return scopeCheck;
      }
    }

    // Check self-access for user-specific operations
    if (options.allowSelfAccess) {
      const isSelfAccess = this.checkSelfAccess(user, event);
      if (isSelfAccess) {
        return { granted: true, reason: 'Self access allowed' };
      }
    }

    return { granted: true };
  }

  private async checkMultiplePermissions(
    user: AuthenticatedUser,
    permissions: string[],
    requireAll: boolean,
    userPermissions: Set<string>,
    event: HandlerEvent,
    options: PermissionCheckOptions
  ): Promise<PermissionResult> {
    const checks = await Promise.all(
      permissions.map(permission => 
        this.checkSinglePermission(user, permission, userPermissions, event, options)
      )
    );

    const grantedChecks = checks.filter(check => check.granted);

    if (requireAll) {
      const allGranted = grantedChecks.length === permissions.length;
      return {
        granted: allGranted,
        reason: allGranted ? undefined : 'Not all required permissions granted'
      };
    } else {
      const anyGranted = grantedChecks.length > 0;
      return {
        granted: anyGranted,
        reason: anyGranted ? undefined : 'No required permissions granted'
      };
    }
  }

  private async checkScope(
    user: AuthenticatedUser,
    permission: string,
    event: HandlerEvent,
    options: PermissionCheckOptions
  ): Promise<PermissionResult> {
    const scopeId = this.extractScopeId(event, options.scope!);

    switch (options.scope) {
      case 'global':
        return { 
          granted: user.role === 'super_admin' || user.role === 'admin',
          reason: user.role === 'super_admin' || user.role === 'admin' ? undefined : 'Global scope requires admin role'
        };

      case 'agency':
        if (!user.agency_id) {
          return { granted: false, reason: 'User not associated with any agency' };
        }
        if (scopeId && scopeId !== user.agency_id) {
          return { granted: false, reason: 'Access denied: different agency' };
        }
        return { granted: true };

      case 'business':
        if (!user.business_id) {
          return { granted: false, reason: 'User not associated with any business' };
        }
        if (scopeId && scopeId !== user.business_id) {
          return { granted: false, reason: 'Access denied: different business' };
        }
        return { granted: true };

      case 'project':
        return this.checkProjectScope(user, scopeId);

      case 'self':
        const userId = this.extractUserId(event);
        return { 
          granted: userId === user.id,
          reason: userId === user.id ? undefined : 'Can only access own data'
        };

      default:
        return { granted: true };
    }
  }

  private async checkProjectScope(user: AuthenticatedUser, projectId?: string): Promise<PermissionResult> {
    if (!projectId) {
      return { granted: true }; // No specific project check needed
    }

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('business_id, assigned_users')
        .eq('id', projectId)
        .single();

      if (error) {
        return { granted: false, reason: 'Project not found' };
      }

      // Check if user has access through business association
      if (user.business_id === project.business_id) {
        return { granted: true };
      }

      // Check if user is assigned to the project
      if (project.assigned_users && project.assigned_users.includes(user.id)) {
        return { granted: true };
      }

      return { granted: false, reason: 'No access to this project' };
    } catch (error) {
      console.error('Project scope check failed:', error);
      return { granted: false, reason: 'Project access verification failed' };
    }
  }

  private extractScopeId(event: HandlerEvent, scope: PermissionScope): string | undefined {
    const path = event.path;
    const queryParams = event.queryStringParameters || {};

    // Extract from URL path parameters
    const pathMatch = path.match(/\/([^\/]+)\/([a-f0-9-]{36})/);
    if (pathMatch) {
      return pathMatch[2];
    }

    // Extract from query parameters
    return queryParams.agency_id || queryParams.business_id || queryParams.project_id || queryParams.id;
  }

  private extractUserId(event: HandlerEvent): string | undefined {
    const path = event.path;
    const queryParams = event.queryStringParameters || {};

    // Extract from URL path
    const userIdMatch = path.match(/\/users\/([a-f0-9-]{36})/);
    if (userIdMatch) {
      return userIdMatch[1];
    }

    return queryParams.user_id;
  }

  private checkSelfAccess(user: AuthenticatedUser, event: HandlerEvent): boolean {
    const targetUserId = this.extractUserId(event);
    return targetUserId === user.id;
  }

  /**
   * Create error response
   */
  createErrorResponse(statusCode: number, message: string, details?: any): APIResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        error: message,
        details,
        timestamp: new Date().toISOString()
      })
    };
  }

  /**
   * Create success response
   */
  createSuccessResponse(data: any, statusCode = 200): APIResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify(data)
    };
  }
}

// Export singleton instance
export const permissionMiddleware = new PermissionMiddleware();

/**
 * Higher-order function to wrap handlers with permission checking
 */
export function requirePermissions(options: PermissionCheckOptions) {
  return function(handler: (event: HandlerEvent, context: HandlerContext, user: AuthenticatedUser) => Promise<APIResponse>) {
    return async (event: HandlerEvent, context: HandlerContext): Promise<APIResponse> => {
      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return permissionMiddleware.createSuccessResponse({}, 200);
      }

      try {
        // Authenticate user
        const user = await permissionMiddleware.authenticateUser(event);
        if (!user) {
          return permissionMiddleware.createErrorResponse(401, 'Authentication required');
        }

        // Check permissions
        const permissionResult = await permissionMiddleware.hasPermission(user, options, event);
        if (!permissionResult.granted) {
          return permissionMiddleware.createErrorResponse(
            403, 
            'Access denied', 
            { reason: permissionResult.reason }
          );
        }

        // Call the actual handler
        return await handler(event, context, user);
      } catch (error) {
        console.error('Permission middleware error:', error);
        return permissionMiddleware.createErrorResponse(500, 'Internal server error');
      }
    };
  };
}

/**
 * Convenience functions for common permission patterns
 */
export const requireAuth = () => requirePermissions({});

export const requireAdmin = () => requirePermissions({ 
  permission: PERMISSIONS.ADMIN_ACCESS 
});

export const requireSuperAdmin = () => requirePermissions({ 
  permission: PERMISSIONS.SUPER_ADMIN_ACCESS 
});

export const requireProjectAccess = (action: PermissionAction = 'read') => requirePermissions({
  resource: 'projects',
  action,
  scope: 'project'
});

export const requireBusinessAccess = (action: PermissionAction = 'read') => requirePermissions({
  resource: 'businesses',
  action,
  scope: 'business'
});

export const requireAgencyAccess = (action: PermissionAction = 'read') => requirePermissions({
  resource: 'agencies',
  action,
  scope: 'agency'
});

export const requireSelfOrAdmin = () => requirePermissions({
  permission: PERMISSIONS.USERS_MANAGE,
  allowSelfAccess: true
});

export default permissionMiddleware;
