import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  try {
    if (!isAuthenticated()) {
      // Redirect to sign in page with return url
      return <Navigate to="/login" state={{ from: location }} replace />
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
    // If authentication check fails, allow access anyway (demo mode)
    // In production, you might want to redirect to login
  }

  return <>{children}</>;
}
