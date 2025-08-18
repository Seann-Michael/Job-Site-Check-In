import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'agency';
  profile: {
    id: string;
    role: string;
    agency_name?: string;
    agency_id?: string;
    full_name?: string;
    company?: string;
  };
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

export interface AuthorizationOptions {
  requiredRole?: 'super_admin' | 'admin' | 'agency';
  allowedRoles?: ('super_admin' | 'admin' | 'agency')[];
  requiresOwnership?: boolean;
  resourceUserId?: string;
}

/**
 * Authenticate user from Authorization header
 */
export async function authenticateUser(authHeader: string | undefined): Promise<AuthResult> {
  try {
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'No valid authorization header provided',
      };
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Invalid or expired token',
      };
    }

    // Get user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        role: profile.role,
        profile,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Authorize user based on role and resource ownership
 */
export function authorizeUser(
  user: AuthenticatedUser,
  options: AuthorizationOptions = {}
): { authorized: boolean; error?: string } {
  const {
    requiredRole,
    allowedRoles,
    requiresOwnership,
    resourceUserId,
  } = options;

  // Check if user has required role
  if (requiredRole && user.role !== requiredRole) {
    return {
      authorized: false,
      error: `Access denied. Required role: ${requiredRole}`,
    };
  }

  // Check if user has one of the allowed roles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      error: `Access denied. Allowed roles: ${allowedRoles.join(', ')}`,
    };
  }

  // Check resource ownership (unless user is super admin)
  if (requiresOwnership && resourceUserId && user.role !== 'super_admin') {
    if (user.id !== resourceUserId) {
      // For agency users, also check if they can access client resources
      if (user.role === 'agency') {
        // This would require additional logic to check agency-client relationships
        // For now, we'll allow agency users to access resources within their agency
        if (user.profile.agency_id && resourceUserId !== user.profile.agency_id) {
          return {
            authorized: false,
            error: 'Access denied. Resource ownership required',
          };
        }
      } else {
        return {
          authorized: false,
          error: 'Access denied. Resource ownership required',
        };
      }
    }
  }

  return { authorized: true };
}

/**
 * Combined authentication and authorization middleware
 */
export async function authenticateAndAuthorize(
  authHeader: string | undefined,
  options: AuthorizationOptions = {}
): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  // First authenticate
  const authResult = await authenticateUser(authHeader);
  
  if (!authResult.success || !authResult.user) {
    return authResult;
  }

  // Then authorize
  const authzResult = authorizeUser(authResult.user, options);
  
  if (!authzResult.authorized) {
    return {
      success: false,
      error: authzResult.error,
    };
  }

  return {
    success: true,
    user: authResult.user,
  };
}

/**
 * Middleware for API endpoints requiring authentication
 */
export function requireAuth() {
  return async (authHeader: string | undefined): Promise<AuthenticatedUser> => {
    const result = await authenticateUser(authHeader);
    
    if (!result.success || !result.user) {
      throw new Error(result.error || 'Authentication failed');
    }
    
    return result.user;
  };
}

/**
 * Middleware for API endpoints requiring specific roles
 */
export function requireRole(allowedRoles: ('super_admin' | 'admin' | 'agency')[]) {
  return async (authHeader: string | undefined): Promise<AuthenticatedUser> => {
    const result = await authenticateAndAuthorize(authHeader, { allowedRoles });
    
    if (!result.success || !result.user) {
      throw new Error(result.error || 'Authorization failed');
    }
    
    return result.user;
  };
}

/**
 * Middleware for API endpoints requiring super admin role
 */
export function requireSuperAdmin() {
  return requireRole(['super_admin']);
}

/**
 * Middleware for API endpoints requiring admin or super admin role
 */
export function requireAdmin() {
  return requireRole(['super_admin', 'admin']);
}

/**
 * Middleware for API endpoints requiring resource ownership
 */
export function requireOwnership(resourceUserId?: string) {
  return async (authHeader: string | undefined): Promise<AuthenticatedUser> => {
    const result = await authenticateAndAuthorize(authHeader, {
      requiresOwnership: true,
      resourceUserId,
    });
    
    if (!result.success || !result.user) {
      throw new Error(result.error || 'Authorization failed');
    }
    
    return result.user;
  };
}

/**
 * Rate limiting functionality
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (user: AuthenticatedUser) => string;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function createRateLimit(config: RateLimitConfig) {
  return (user: AuthenticatedUser): boolean => {
    const key = config.keyGenerator ? config.keyGenerator(user) : user.id;
    const now = Date.now();
    
    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }
    
    if (current.count >= config.maxRequests) {
      return false; // Rate limit exceeded
    }
    
    current.count++;
    return true;
  };
}

/**
 * Default rate limits by role
 */
export const defaultRateLimits = {
  super_admin: createRateLimit({ windowMs: 60000, maxRequests: 1000 }), // 1000 req/min
  admin: createRateLimit({ windowMs: 60000, maxRequests: 500 }), // 500 req/min
  agency: createRateLimit({ windowMs: 60000, maxRequests: 200 }), // 200 req/min
};

/**
 * Apply rate limiting based on user role
 */
export function applyRateLimit(user: AuthenticatedUser): boolean {
  const rateLimiter = defaultRateLimits[user.role];
  return rateLimiter ? rateLimiter(user) : true;
}

/**
 * Audit log functionality
 */
export interface AuditLogEntry {
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

export async function logUserAction(entry: AuditLogEntry): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        ...entry,
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to log user action:', error);
    // Don't throw error as audit logging shouldn't break the main flow
  }
}

/**
 * Create audit logger middleware
 */
export function createAuditLogger(action: string, resourceType?: string) {
  return async (
    user: AuthenticatedUser,
    resourceId?: string,
    details?: any,
    request?: { headers?: any }
  ): Promise<void> => {
    await logUserAction({
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: request?.headers?.['x-forwarded-for'] || request?.headers?.['x-real-ip'],
      user_agent: request?.headers?.['user-agent'],
    });
  };
}

/**
 * Session management
 */
interface UserSession {
  user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
  last_activity: string;
  ip_address?: string;
  user_agent?: string;
}

export async function createUserSession(
  userId: string,
  sessionToken: string,
  expiresAt: Date,
  metadata?: { ip_address?: string; user_agent?: string }
): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        ip_address: metadata?.ip_address,
        user_agent: metadata?.user_agent,
      });
  } catch (error) {
    console.error('Failed to create user session:', error);
  }
}

export async function updateSessionActivity(sessionToken: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq('session_token', sessionToken);
  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
}

export async function invalidateUserSession(sessionToken: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('session_token', sessionToken);
  } catch (error) {
    console.error('Failed to invalidate user session:', error);
  }
}

/**
 * Security utilities
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Basic XSS prevention
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = Array.isArray(input) ? [] : {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  
  return input;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export commonly used middleware combinations
 */
export const authMiddleware = {
  requireAuth: requireAuth(),
  requireSuperAdmin: requireSuperAdmin(),
  requireAdmin: requireAdmin(),
  requireRole,
  requireOwnership,
  applyRateLimit,
  auditLog: createAuditLogger,
};
