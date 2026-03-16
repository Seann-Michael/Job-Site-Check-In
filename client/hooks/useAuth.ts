import { useState, useEffect, useCallback } from "react";
import {
  SecureSession,
  SecureInput,
  AuditLogger,
  SecurityMonitor,
} from "@/lib/security";
import { safeStorage } from "@/lib/reliability";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  lastLogin?: string;
  mfaEnabled?: boolean;
  token?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionWarning: boolean;
  timeUntilExpiry: number;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    sessionWarning: false,
    timeUntilExpiry: 0,
  });

  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  // Check session validity on mount and set up monitoring
  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 60000); // Check every minute

    // Track user activity
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    const handleActivity = () => SecureSession.updateActivity();

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      clearInterval(interval);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  const checkSession = useCallback(() => {
    const sessionResult = SecureSession.validateSession();

    setAuthState((prev) => {
      const newState = {
        ...prev,
        user: sessionResult.user || null,
        isAuthenticated: sessionResult.valid,
        isLoading: false,
        sessionWarning: !!sessionResult.warningTime,
        timeUntilExpiry: sessionResult.warningTime || 0,
      };

      // Check for session expiration using previous state to avoid stale closure
      if (!sessionResult.valid && prev.isAuthenticated) {
        toast.error("Your session has expired. Please sign in again.");
        AuditLogger.log("SESSION_EXPIRED", "auth", {}, prev.user?.id);
      }

      return newState;
    });
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      // Check if account is locked
      const lockoutData = safeStorage.get("account_lockout");
      if (lockoutData && Date.now() < lockoutData.unlockTime) {
        const remainingTime = Math.ceil(
          (lockoutData.unlockTime - Date.now()) / 60000,
        );
        throw new Error(
          `Account locked. Try again in ${remainingTime} minutes.`,
        );
      }

      // Validate input
      const emailValidation = SecureInput.validateEmail(credentials.email);
      if (!emailValidation.valid) {
        SecurityMonitor.logSecurityEvent("INVALID_EMAIL_LOGIN", {
          email: credentials.email,
          error: emailValidation.error,
        });
        throw new Error(emailValidation.error);
      }

      const passwordValidation = SecureInput.validatePassword(
        credentials.password,
      );
      if (!passwordValidation.valid) {
        SecurityMonitor.logSecurityEvent("WEAK_PASSWORD_LOGIN", {
          email: credentials.email,
        });
        // Don't expose password validation errors during login
      }

      try {
        setAuthState((prev) => ({ ...prev, isLoading: true }));

        // Simulate API call - replace with actual authentication
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            mfaCode: credentials.mfaCode,
          }),
        });

        if (!response.ok) {
          const currentAttempts = loginAttempts + 1;
          setLoginAttempts(currentAttempts);

          SecurityMonitor.logSecurityEvent("FAILED_LOGIN_ATTEMPT", {
            email: credentials.email,
            attempt: currentAttempts,
            timestamp: Date.now(),
          });

          if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
            const unlockTime = Date.now() + LOCKOUT_DURATION;
            safeStorage.set("account_lockout", { unlockTime });
            setIsLocked(true);

            SecurityMonitor.logSecurityEvent("ACCOUNT_LOCKED", {
              email: credentials.email,
              unlockTime,
            });

            throw new Error(
              "Too many failed attempts. Account locked for 15 minutes.",
            );
          }

          throw new Error("Invalid credentials");
        }

        const userData = await response.json();

        // Create secure session
        const sessionId = SecureSession.createSession(
          userData,
          credentials.rememberMe,
        );

        // Reset login attempts on successful login
        setLoginAttempts(0);
        setIsLocked(false);
        safeStorage.remove("account_lockout");

        // Log successful authentication
        AuditLogger.log(
          "LOGIN_SUCCESS",
          "auth",
          {
            sessionId,
            rememberMe: credentials.rememberMe,
            mfaUsed: !!credentials.mfaCode,
          },
          userData.id,
        );

        setAuthState({
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          sessionWarning: false,
          timeUntilExpiry: 0,
        });

        toast.success("Login successful!");
      } catch (error) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [loginAttempts],
  );

  const logout = useCallback(
    async (reason?: string) => {
      try {
        const currentUser = authState.user;

        // Notify server of logout
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Destroy local session
        SecureSession.destroySession();

        // Log logout
        AuditLogger.log("LOGOUT", "auth", { reason }, currentUser?.id);

        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionWarning: false,
          timeUntilExpiry: 0,
        });

        toast.info(reason || "Logged out successfully");
      } catch (error) {
        console.error("Logout error:", error);
        // Force logout even if server call fails
        SecureSession.destroySession();
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionWarning: false,
          timeUntilExpiry: 0,
        });
      }
    },
    [authState.user],
  );

  const extendSession = useCallback(() => {
    SecureSession.extendSession();
    setAuthState((prev) => ({
      ...prev,
      sessionWarning: false,
      timeUntilExpiry: 0,
    }));

    AuditLogger.log("SESSION_EXTENDED", "auth", {}, authState.user?.id);
    toast.success("Session extended");
  }, [authState.user]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const validation = SecureInput.validatePassword(newPassword);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }

      try {
        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to change password");
        }

        AuditLogger.log("PASSWORD_CHANGED", "auth", {}, authState.user?.id);
        toast.success("Password changed successfully");
      } catch (error) {
        SecurityMonitor.logSecurityEvent("PASSWORD_CHANGE_FAILED", {
          userId: authState.user?.id,
          error: error.message,
        });
        throw error;
      }
    },
    [authState.user],
  );

  const enableMFA = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/enable-mfa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to enable MFA");
      }

      const result = await response.json();

      AuditLogger.log("MFA_ENABLED", "auth", {}, authState.user?.id);

      return result; // Contains QR code and backup codes
    } catch (error) {
      SecurityMonitor.logSecurityEvent("MFA_ENABLE_FAILED", {
        userId: authState.user?.id,
        error: error.message,
      });
      throw error;
    }
  }, [authState.user]);

  const verifyMFA = useCallback(
    async (code: string) => {
      try {
        const response = await fetch("/api/auth/verify-mfa", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          SecurityMonitor.logSecurityEvent("MFA_VERIFICATION_FAILED", {
            userId: authState.user?.id,
          });
          throw new Error("Invalid MFA code");
        }

        AuditLogger.log("MFA_VERIFIED", "auth", {}, authState.user?.id);
        return true;
      } catch (error) {
        throw error;
      }
    },
    [authState.user],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      return authState.user?.permissions?.includes(permission) || false;
    },
    [authState.user],
  );

  const hasRole = useCallback(
    (role: string) => {
      return authState.user?.role === role;
    },
    [authState.user],
  );

  const getSecurityInfo = useCallback(() => {
    return {
      loginAttempts,
      isLocked,
      sessionValid: authState.isAuthenticated,
      sessionWarning: authState.sessionWarning,
      timeUntilExpiry: authState.timeUntilExpiry,
      mfaEnabled: authState.user?.mfaEnabled || false,
      lastLogin: authState.user?.lastLogin,
    };
  }, [authState, loginAttempts, isLocked]);

  return {
    // Auth state
    ...authState,

    // Auth actions
    login,
    logout,
    extendSession,
    changePassword,
    enableMFA,
    verifyMFA,

    // Permission checks
    hasPermission,
    hasRole,

    // Security info
    getSecurityInfo,
    loginAttempts,
    isLocked,
  };
}

// Hook for protecting routes
export function useProtectedRoute(
  requiredPermission?: string,
  requiredRole?: string,
) {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      AuditLogger.log("UNAUTHORIZED_ACCESS_ATTEMPT", "route", {
        requiredPermission,
        requiredRole,
        path: window.location.pathname,
      });

      window.location.href = "/login";
      return;
    }

    if (requiredPermission && !auth.hasPermission(requiredPermission)) {
      SecurityMonitor.logSecurityEvent("INSUFFICIENT_PERMISSIONS", {
        userId: auth.user?.id,
        requiredPermission,
        userPermissions: auth.user?.permissions,
        path: window.location.pathname,
      });

      toast.error("You don't have permission to access this page");
      window.location.href = "/admin/jobs";
      return;
    }

    if (requiredRole && !auth.hasRole(requiredRole)) {
      SecurityMonitor.logSecurityEvent("INSUFFICIENT_ROLE", {
        userId: auth.user?.id,
        requiredRole,
        userRole: auth.user?.role,
        path: window.location.pathname,
      });

      toast.error("You don't have the required role to access this page");
      window.location.href = "/admin/jobs";
      return;
    }
  }, [auth.isAuthenticated, auth.isLoading, requiredPermission, requiredRole]);

  return auth;
}
