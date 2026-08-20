import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  signInWithPassword,
  signOut as authSignOut,
  subscribeAuth,
  type User,
} from "@/lib/auth";

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Supabase-backed auth hook. Preserves the shape its consumers rely on
 * (`user`, `isAuthenticated`, `isLoading`, `login`, `logout`) while delegating
 * all credential handling to `@/lib/auth` (and thus Supabase).
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    return subscribeAuth(() => setUser(getCurrentUser()));
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      await signInWithPassword(credentials.email, credentials.password);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authSignOut();
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };
}
