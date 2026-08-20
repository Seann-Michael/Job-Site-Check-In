import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentUser,
  isAuthReady,
  isProfileMissing,
  signOut as authSignOut,
  subscribeAuth,
  type User,
} from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  /** True until the initial Supabase session check has resolved. */
  loading: boolean;
  /** Session exists but no public.users row could be loaded. */
  profileMissing: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profileMissing: false,
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
  const [profileMissing, setProfileMissing] = useState<boolean>(() =>
    isProfileMissing(),
  );

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(!isAuthReady());
    setProfileMissing(isProfileMissing());
    const unsubscribe = subscribeAuth(() => {
      setUser(getCurrentUser());
      setProfileMissing(isProfileMissing());
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, profileMissing, signOut: authSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
