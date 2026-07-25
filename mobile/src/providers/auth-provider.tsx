import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInDemo: () => void;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<{ error?: string }>;
  changePassword: (password: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILE_KEY = 'lsr-demo-profile-v1';

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
    let cancelled = false;

    if (!isSupabaseConfigured) {
      // No backend configured: start signed in with demo data so the app is
      // explorable out of the box (same spirit as the web app's mock fallback).
      AsyncStorage.getItem(DEMO_PROFILE_KEY)
        .then((raw) => {
          if (cancelled) return;
          const stored = raw ? (JSON.parse(raw) as { name?: string }) : {};
          setUser({ ...DEMO_USER, name: stored.name || DEMO_USER.name });
        })
        .catch(() => {
          if (!cancelled) setUser(DEMO_USER);
        })
        .finally(() => {
          if (!cancelled) setInitializing(false);
        });
      return () => {
        cancelled = true;
      };
    }

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

  const updateName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Name cannot be empty.' };
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ data: { name: trimmed } });
      if (error) return { error: error.message };
    } else {
      await AsyncStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ name: trimmed })).catch(
        () => undefined,
      );
    }
    setUser((prev) => (prev ? { ...prev, name: trimmed } : prev));
    return {};
  }, []);

  const changePassword = useCallback(async (password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Password changes need a connected Supabase account.' };
    }
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isSupabaseConfigured,
      signIn,
      signInDemo,
      signOut,
      updateName,
      changePassword,
    }),
    [user, initializing, signIn, signInDemo, signOut, updateName, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
