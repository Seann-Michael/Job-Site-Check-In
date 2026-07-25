import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DEMO_BUSINESS } from '@/lib/demo-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  businessName: string;
  initializing: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'demo@localseoranker.com',
  name: 'Alex Morgan',
  isDemo: true,
};

function userFromSession(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session.user.email ?? '';
  const name = typeof meta.name === 'string' && meta.name ? meta.name : email.split('@')[0];
  return { id: session.user.id, email, name, isDemo: false };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend configured: start signed in with demo data so the app is
      // explorable out of the box (same spirit as the web app's mock fallback).
      setUser(DEMO_USER);
      setInitializing(false);
      return;
    }

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(userFromSession(data.session));
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(userFromSession(session));
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      setUser(DEMO_USER);
      return {};
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signInDemo = useCallback(() => {
    setUser(DEMO_USER);
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      businessName: DEMO_BUSINESS.name,
      initializing,
      isSupabaseConfigured,
      signIn,
      signInDemo,
      signOut,
    }),
    [user, initializing, signIn, signInDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
