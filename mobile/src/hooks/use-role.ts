import { useMemo } from 'react';

import { useAuth, type UserRole } from '@/providers/auth-provider';

/** The three UI modes the app branches on, mapped from the backend role. */
export type RoleMode = 'owner' | 'staff' | 'viewer';

export interface RoleAccess {
  /** Backend role as stored (may be more granular than `mode`). */
  role: UserRole;
  /** Collapsed UI mode: owner | staff | viewer. */
  mode: RoleMode;
  /** Can create/edit content (jobs, captures, review actions, GMB posts). */
  canWrite: boolean;
  /** Can manage the business (team, billing, workspace-level settings). */
  canManage: boolean;
  /** Read-only account — every create/edit/delete control is hidden. */
  isViewer: boolean;
}

function toMode(role: UserRole): RoleMode {
  switch (role) {
    case 'super_admin':
    case 'business_owner':
      return 'owner';
    case 'viewer':
      return 'viewer';
    default:
      return 'staff';
  }
}

/**
 * Role-awareness for the shell. Reads the signed-in user's role and derives the
 * capability flags every screen gates its create/edit controls on.
 *
 *   owner  → canManage + canWrite
 *   staff  → canWrite
 *   viewer → read-only
 */
export function useRole(): RoleAccess {
  const { user } = useAuth();
  return useMemo(() => {
    // TODO(backend): role defaults to 'business_owner' in the auth provider
    // until memberships are wired through; this hook branches on it now.
    const role: UserRole = user?.role ?? 'business_owner';
    const mode = toMode(role);
    return {
      role,
      mode,
      canManage: mode === 'owner',
      canWrite: mode === 'owner' || mode === 'staff',
      isViewer: mode === 'viewer',
    };
  }, [user?.role]);
}
