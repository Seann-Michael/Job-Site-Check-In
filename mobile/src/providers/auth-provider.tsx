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
  /**
   * Derived display string — always `firstName lastName`. Roughly a dozen
   * screens key avatars, greetings and comment attribution off this, so it
   * stays populated even when only one half of the name is known.
   */
  name: string;
  firstName: string;
  lastName: string;
  isDemo: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInDemo: () => void;
  signOut: () => Promise<void>;
  updateName: (firstName: string, lastName: string) => Promise<{ error?: string }>;
  changePassword: (password: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILE_KEY = 'lsr-demo-profile-v1';

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'demo@localseoranker.com',
  name: 'Alex Morgan',
  firstName: 'Alex',
  lastName: 'Morgan',
  isDemo: true,
};

/** The one place `name` is composed, so first/last stay the source of truth. */
function composeName(firstName: string, lastName: string, fallback: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || fallback;
}

/**
 * Accounts and demo profiles created before the name was split only carry a
 * single string, so split it rather than showing the user two empty fields.
 */
function splitName(name: string): { firstName: string; lastName: string } {
  const [first = '', ...rest] = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(' ') };
}

function userFromSession(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session.user.email ?? '';
  const metaString = (key: string) =>
    typeof meta[key] === 'string' ? (meta[key] as string).trim() : '';
  // `name` is what every pre-split account has; the email prefix is the same
  // last resort this used before, kept so a nameless account still renders.
  const base = metaString('name') || email.split('@')[0];
  const fromName = splitName(base);
  const firstName = metaString('first_name') || fromName.firstName;
  const lastName = metaString('last_name') || fromName.lastName;
  return {
    id: session.user.id,
    email,
    name: composeName(firstName, lastName, base),
    firstName,
    lastName,
    isDemo: false,
  };
}

interface StoredDemoProfile {
  /** Written by every version, including current ones, so older builds keep working. */
  name?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Reads the demo profile blob, tolerating the pre-split `{ name }` shape that
 * existing installs still have on disk.
 */
function demoUserFromStored(raw: string | null): AuthUser {
  if (!raw) return DEMO_USER;
  let stored: StoredDemoProfile;
  try {
    stored = JSON.parse(raw) as StoredDemoProfile;
  } catch {
    return DEMO_USER;
  }
  const legacy = splitName(stored.name ?? '');
  const firstName = stored.firstName?.trim() || legacy.firstName;
  const lastName = stored.lastName?.trim() || legacy.lastName;
  if (!firstName && !lastName) return DEMO_USER;
  return {
    ...DEMO_USER,
    name: composeName(firstName, lastName, DEMO_USER.name),
    firstName,
    lastName,
  };
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
          setUser(demoUserFromStored(raw));
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

  const updateName = useCallback(async (firstName: string, lastName: string) => {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first && !last) return { error: 'Enter a first or last name.' };
    const name = composeName(first, last, '');
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.updateUser({
        data: { name, first_name: first, last_name: last },
      });
      if (error) return { error: error.message };
      // Auth metadata above is what this app reads back on the next session.
      // `public.users` is mirrored because the web app and the team screen read
      // the name from that table instead. The mirror is best-effort: a row the
      // user cannot update must not fail the save they just made.
      const id = data.user?.id;
      if (id) {
        await supabase
          .from('users')
          .update({ name, first_name: first, last_name: last })
          .eq('id', id);
      }
    } else {
      // `name` stays in the blob so an older build reading this profile still
      // finds the field it expects.
      await AsyncStorage.setItem(
        DEMO_PROFILE_KEY,
        JSON.stringify({ name, firstName: first, lastName: last }),
      ).catch(() => undefined);
    }
    setUser((prev) => (prev ? { ...prev, name, firstName: first, lastName: last } : prev));
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
