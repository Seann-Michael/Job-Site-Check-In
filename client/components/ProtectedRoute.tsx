import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!isAuthenticated()) {
    // Redirect to sign in page with return url
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
