import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentUser,
  isAuthReady,
  signOut as authSignOut,
  subscribeAuth,
  type User,
} from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  /** True until the initial Supabase session check has resolved. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

/**
 * Provides the current Supabase-backed user to the tree and re-renders it on
 * every auth-state change (login / logout / token refresh). initAuth() is
 * awaited in main.tsx before render, so `loading` is usually already false.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [loading, setLoading] = useState<boolean>(() => !isAuthReady());

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(!isAuthReady());
    const unsubscribe = subscribeAuth(() => {
      setUser(getCurrentUser());
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut: authSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
