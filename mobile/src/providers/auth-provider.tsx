import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { configurePurchases, logOutPurchases } from '@/lib/purchases';
import { clearSignedMediaUrlCache } from '@/lib/media-urls';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Backend roles as they appear on the Supabase user / membership row. The web
 * app uses these exact strings; the mobile UI collapses them into three modes
 * in hooks/use-role.ts.
 */
export type UserRole = 'super_admin' | 'business_owner' | 'staff' | 'viewer';

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
  /**
   * Access role. TODO(backend): populate from the membership/user row once the
   * auth milestone wires roles through. Until then it reads from
   * `user_metadata.role` when present and otherwise defaults to 'business_owner'
   * (see userFromSession / DEMO_USER), so the role-aware UI has something real
   * to branch on today.
   */
  role: UserRole;
}

/** The safe default while roles aren't wired through the backend yet. */
const DEFAULT_ROLE: UserRole = 'business_owner';

const KNOWN_ROLES: UserRole[] = ['super_admin', 'business_owner', 'staff', 'viewer'];

function coerceRole(value: unknown): UserRole {
  return KNOWN_ROLES.includes(value as UserRole) ? (value as UserRole) : DEFAULT_ROLE;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
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
  role: DEFAULT_ROLE,
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
    // TODO(backend): the auth milestone should source this from the membership
    // row, not user_metadata. Read it opportunistically until then.
    role: coerceRole(meta['role']),
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

  // Bind RevenueCat (in-app purchases) to the signed-in user so App Store /
  // Play Store purchases are attributed to this account. All calls no-op in
  // Expo Go / web / when no RevenueCat key is set (see lib/purchases.ts).
  useEffect(() => {
    if (user && !user.isDemo) {
      void configurePurchases(user.id);
    } else if (!user) {
      void logOutPurchases();
    }
  }, [user?.id, user?.isDemo]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      setUser(DEMO_USER);
      return {};
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured) {
      setUser(DEMO_USER);
      return {};
    }
    const trimmedName = name.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // `handle_new_auth_user` reads name from raw_user_meta_data on insert to
      // seed the public.users profile — same shape the web signup sends.
      options: trimmedName ? { data: { name: trimmedName } } : undefined,
    });
    if (error) return { error: error.message };
    // With email confirmation on, signUp creates the user but no session — the
    // caller shows a "check your email" message instead of navigating in.
    if (!data.session) return { needsConfirmation: true };
    return {};
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUser(DEMO_USER);
      return {};
    }
    // Native OAuth: Supabase builds the Google consent URL, we open it in an
    // in-app browser, and Google → Supabase redirects back to this app's deep
    // link with an authorization code we exchange for a session. `redirectTo`
    // must be on Supabase Auth's redirect allow-list.
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: 'cancelled' };
    }
    if (result.type !== 'success' || !result.url) {
      return { error: 'Google sign-in did not complete.' };
    }
    const { queryParams } = Linking.parse(result.url);
    const code = typeof queryParams?.code === 'string' ? queryParams.code : undefined;
    const oauthError =
      typeof queryParams?.error_description === 'string'
        ? queryParams.error_description
        : typeof queryParams?.error === 'string'
          ? queryParams.error
          : undefined;
    if (oauthError) return { error: oauthError };
    if (!code) return { error: 'Google sign-in did not return an authorization code.' };
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { error: exchangeError.message };
    // onAuthStateChange picks up the new session and populates the user.
    return {};
  }, []);

  const signInDemo = useCallback(() => {
    setUser(DEMO_USER);
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    // Drop any signed media URLs cached for the account that is leaving.
    clearSignedMediaUrlCache();
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
      signUp,
      signInWithGoogle,
      signInDemo,
      signOut,
      updateName,
      changePassword,
    }),
    [
      user,
      initializing,
      signIn,
      signUp,
      signInWithGoogle,
      signInDemo,
      signOut,
      updateName,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
