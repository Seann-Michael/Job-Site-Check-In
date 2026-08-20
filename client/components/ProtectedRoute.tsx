import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/hooks/useAuthContext";
import { workspaceService } from "@/lib/workspaceService";

function FullscreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Terminal account states (no redirect loop): explain + offer sign out. */
function AccountBlockedScreen({
  title,
  message,
  onSignOut,
}: {
  title: string;
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <Button onClick={onSignOut}>Sign out</Button>
      </div>
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
  const { user, loading, profileMissing, signOut } = useAuthContext();

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

  // Wait for workspace scoping to load before deciding onboarding. This
  // distinguishes "not loaded yet" from "no businesses" so a fresh login is
  // never bounced through /onboarding on its way to location.state.from.
  if (!wsState.initialized) return <FullscreenSpinner />;

  // Authenticated session but no public.users row: the client cannot create
  // one under RLS, so don't loop through onboarding — explain and stop.
  if (profileMissing || wsState.profileMissing) {
    return (
      <AccountBlockedScreen
        title="Account profile unavailable"
        message="Your account profile could not be loaded. Please contact support so we can restore access."
        onSignOut={() => void signOut()}
      />
    );
  }

  const isSuperAdmin = user.role === "super_admin";

  // Owns businesses, but none are active => suspended. Not onboarding.
  if (
    !isSuperAdmin &&
    wsState.businessIds.length === 0 &&
    wsState.ownedBusinessCount > 0
  ) {
    return (
      <AccountBlockedScreen
        title="Account suspended"
        message="Your account is suspended. Please contact support to restore access."
        onSignOut={() => void signOut()}
      />
    );
  }

  const needsOnboarding =
    !isSuperAdmin && wsState.ownedBusinessCount === 0;

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
