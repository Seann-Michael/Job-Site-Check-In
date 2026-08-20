import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuthContext } from "@/hooks/useAuthContext";
import { workspaceService } from "@/lib/workspaceService";

function FullscreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** When set, only these roles may enter; others are redirected to /admin/jobs. */
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, loading } = useAuthContext();

  const [wsState, setWsState] = useState(() => workspaceService.getState());
  useEffect(() => workspaceService.subscribe(setWsState), []);

  const roleDenied = !!user && !!roles?.length && !roles.includes(user.role);
  useEffect(() => {
    if (roleDenied) {
      toast.error("You don't have access to that area.");
    }
  }, [roleDenied]);

  if (loading) return <FullscreenSpinner />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roleDenied) {
    return <Navigate to="/admin/jobs" replace />;
  }

  // Wait for workspace scoping to load before deciding onboarding.
  if (!wsState.initialized) return <FullscreenSpinner />;

  const needsOnboarding =
    user.role !== "super_admin" && wsState.businessIds.length === 0;

  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (!needsOnboarding && location.pathname === "/onboarding") {
    return <Navigate to="/admin/jobs" replace />;
  }

  return <>{children}</>;
}

/**
 * Wrapper for public auth pages (/login, /signup). Redirects already
 * authenticated users to the app instead of showing the form again.
 */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  if (loading) return <FullscreenSpinner />;
  if (user) return <Navigate to="/admin/jobs" replace />;
  return <>{children}</>;
}
