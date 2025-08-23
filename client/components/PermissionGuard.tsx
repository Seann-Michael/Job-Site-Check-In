import React, { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { permissionService, PermissionHelpers } from '@/lib/permissions';
import { 
  PermissionResource, 
  PermissionAction, 
  PermissionScope,
  UserRole,
  PERMISSIONS 
} from '@/types/permissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, ShieldX, AlertTriangle } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean; // For multiple permissions: true = AND, false = OR
  resource?: PermissionResource;
  action?: PermissionAction;
  scope?: PermissionScope;
  scopeId?: string;
  role?: UserRole | UserRole[];
  fallback?: ReactNode;
  showLoading?: boolean;
  showError?: boolean;
  resourceData?: any;
  additionalContext?: Record<string, any>;
}

export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  resource,
  action,
  scope,
  scopeId,
  role,
  fallback,
  showLoading = true,
  showError = true,
  resourceData,
  additionalContext
}: PermissionGuardProps) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, [user, permission, permissions, resource, action, scope, scopeId, role]);

  const checkAccess = async () => {
    if (!user) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Role-based check
      if (role) {
        const allowedRoles = Array.isArray(role) ? role : [role];
        if (!allowedRoles.includes(user.role as UserRole)) {
          setHasAccess(false);
          setIsLoading(false);
          return;
        }
      }

      // Permission-based check
      if (permission || permissions || (resource && action)) {
        const context = {
          user_id: user.id,
          resource: resource!,
          action: action!,
          scope_type: scope,
          scope_id: scopeId,
          resource_data: resourceData,
          additional_context: additionalContext
        };

        let hasPermission = false;

        if (permission) {
          const result = await permissionService.hasPermission(user as any, permission, context);
          hasPermission = result.granted;
          if (!result.granted && result.reason) {
            setError(result.reason);
          }
        } else if (permissions) {
          if (requireAll) {
            hasPermission = await permissionService.hasAllPermissions(user as any, permissions, context);
          } else {
            hasPermission = await permissionService.hasAnyPermission(user as any, permissions, context);
          }
        } else if (resource && action) {
          const permissionString = `${resource}:${action}`;
          const result = await permissionService.hasPermission(user as any, permissionString, context);
          hasPermission = result.granted;
          if (!result.granted && result.reason) {
            setError(result.reason);
          }
        }

        setHasAccess(hasPermission);
      } else {
        // No specific permission check, just check if user exists
        setHasAccess(true);
      }
    } catch (err) {
      console.error('Permission check failed:', err);
      setError('Permission check failed');
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && showLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Alert variant="destructive" className="my-4">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            {error || 'You don\'t have permission to access this content.'}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}

// Specific permission guards for common use cases
export function AdminGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission={PERMISSIONS.ADMIN_ACCESS} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function SuperAdminGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <PermissionGuard permission={PERMISSIONS.SUPER_ADMIN_ACCESS} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function ProjectGuard({ 
  children, 
  projectId, 
  action = 'read',
  fallback 
}: { 
  children: ReactNode; 
  projectId: string;
  action?: PermissionAction;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard 
      resource="projects" 
      action={action} 
      scopeId={projectId}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}

export function BusinessGuard({ 
  children, 
  businessId, 
  action = 'read',
  fallback 
}: { 
  children: ReactNode; 
  businessId: string;
  action?: PermissionAction;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard 
      resource="businesses" 
      action={action} 
      scopeId={businessId}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}

export function RoleGuard({ 
  children, 
  roles, 
  fallback 
}: { 
  children: ReactNode; 
  roles: UserRole | UserRole[];
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard role={roles} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// Hook for permission checking in components
export function usePermission(permission: string, context?: any) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    permissionService.hasPermission(user, permission, context)
      .then(result => {
        setHasAccess(result.granted);
        setIsLoading(false);
      })
      .catch(() => {
        setHasAccess(false);
        setIsLoading(false);
      });
  }, [user, permission, context]);

  return { hasAccess, isLoading };
}

// Hook for multiple permission checking
export function usePermissions(permissions: string[], requireAll = false, context?: any) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    const checkPermissions = requireAll 
      ? permissionService.hasAllPermissions(user, permissions, context)
      : permissionService.hasAnyPermission(user, permissions, context);

    checkPermissions
      .then(result => {
        setHasAccess(result);
        setIsLoading(false);
      })
      .catch(() => {
        setHasAccess(false);
        setIsLoading(false);
      });
  }, [user, permissions, requireAll, context]);

  return { hasAccess, isLoading };
}

// Hook for role checking
export function useRole(allowedRoles: UserRole | UserRole[]) {
  const { user } = useAuth();
  
  const hasRole = React.useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(user.role);
  }, [user, allowedRoles]);

  return hasRole;
}

// Higher-order component for permission-based component rendering
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permission: string,
  fallback?: ReactNode
) {
  const WithPermissionComponent = (props: P) => {
    return (
      <PermissionGuard permission={permission} fallback={fallback}>
        <WrappedComponent {...props} />
      </PermissionGuard>
    );
  };

  WithPermissionComponent.displayName = `withPermission(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithPermissionComponent;
}

// Higher-order component for role-based component rendering
export function withRole<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles: UserRole | UserRole[],
  fallback?: ReactNode
) {
  const WithRoleComponent = (props: P) => {
    return (
      <RoleGuard roles={allowedRoles} fallback={fallback}>
        <WrappedComponent {...props} />
      </RoleGuard>
    );
  };

  WithRoleComponent.displayName = `withRole(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithRoleComponent;
}

// Permission display component
export function PermissionDisplay({ 
  permission,
  showIcon = true,
  className = "text-sm text-muted-foreground"
}: { 
  permission: string;
  showIcon?: boolean;
  className?: string;
}) {
  const permissionDef = permissionService.getPermission(permission);
  
  if (!permissionDef) {
    return (
      <span className={className}>
        {showIcon && <AlertTriangle className="h-3 w-3 inline mr-1" />}
        Unknown permission: {permission}
      </span>
    );
  }

  return (
    <span className={className}>
      {showIcon && <Lock className="h-3 w-3 inline mr-1" />}
      {permissionDef.description}
    </span>
  );
}

export default PermissionGuard;
