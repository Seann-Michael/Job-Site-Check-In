import { useEffect, useState } from "react";
import {
  workspaceService,
  type BusinessRole,
  type WorkspaceState,
} from "@/lib/workspaceService";

export interface MyRoleInfo {
  /** Role on the current (or given) business. */
  role: BusinessRole;
  /** Owner or staff (or super admin): may create/edit/delete. */
  canWrite: boolean;
  /** Business owner or super admin: may manage team membership. */
  canManageTeam: boolean;
  /** Viewer: read-only. */
  isViewer: boolean;
  isSuperAdmin: boolean;
  /** False until the workspace has loaded; treat controls as read-only until then. */
  ready: boolean;
}

function compute(state: WorkspaceState, businessId?: string | null): MyRoleInfo {
  const isSuperAdmin = workspaceService.isSuperAdmin();
  const role = workspaceService.getMyRole(businessId);
  return {
    role,
    canWrite: role !== "viewer",
    canManageTeam: isSuperAdmin || role === "owner",
    isViewer: role === "viewer",
    isSuperAdmin,
    ready: state.initialized,
  };
}

/**
 * Reactive access to the signed-in user's role on the current business.
 * Re-renders when the workspace (business switch / reload) changes.
 */
export function useMyRole(businessId?: string | null): MyRoleInfo {
  const [info, setInfo] = useState<MyRoleInfo>(() =>
    compute(workspaceService.getState(), businessId),
  );

  useEffect(() => {
    setInfo(compute(workspaceService.getState(), businessId));
    return workspaceService.subscribe((s) => setInfo(compute(s, businessId)));
  }, [businessId]);

  return info;
}
