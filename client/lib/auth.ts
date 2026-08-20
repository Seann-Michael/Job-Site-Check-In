/**
 * auth.ts
 *
 * Thin, mostly-synchronous facade over Supabase Auth.
 *
 * A module-level cache `{ session, profile }` is populated once by `initAuth()`
 * (called from main.tsx before first paint) and kept fresh by
 * `supabaseClient.auth.onAuthStateChange`. Synchronous getters read from that
 * cache so the ~20 legacy call sites keep working unchanged.
 */

import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "./supabaseClient";
import { workspaceService } from "./workspaceService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole =
  | "super_admin"
  | "agency_admin"
  | "business_owner"
  | "staff"
  | "viewer";

export interface BusinessProfile {
  id: string;
  accountId: string; // Format: XXX-XXX-XXX
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  logo?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isImpersonated?: boolean;
  agencyId?: string;
  agencyName?: string;
  firstName?: string;
  lastName?: string;
  currentBusinessId?: string;
  businesses?: BusinessProfile[];
}

interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface AuthCache {
  session: Session | null;
  profile: ProfileRow | null;
}

const cache: AuthCache = { session: null, profile: null };
let initialized = false;
let initPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Change notification (drives AuthProvider / useAuth re-renders)
// ---------------------------------------------------------------------------

type AuthListener = () => void;
const listeners = new Set<AuthListener>();

export function subscribeAuth(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error("[auth] listener error:", err);
    }
  });
}

// ---------------------------------------------------------------------------
// Session / profile plumbing
// ---------------------------------------------------------------------------

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, email, name, role, avatar_url, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[auth] fetchProfile error:", error.message);
      return null;
    }
    return (data as ProfileRow | null) ?? null;
  } catch (err) {
    console.warn("[auth] fetchProfile failed:", err);
    return null;
  }
}

/**
 * Apply a Supabase session to the cache, refreshing the profile row and keeping
 * workspace state in sync with the session identity.
 */
async function applySession(session: Session | null): Promise<void> {
  const prevUserId = cache.session?.user?.id ?? null;
  const nextUserId = session?.user?.id ?? null;

  cache.session = session;
  cache.profile = session?.user ? await fetchProfile(session.user.id) : null;

  // Re-scope the workspace whenever the signed-in identity changes.
  if (nextUserId !== prevUserId) {
    workspaceService.reset();
    if (nextUserId) {
      try {
        await workspaceService.initialize();
      } catch (err) {
        console.warn("[auth] workspace re-init failed:", err);
      }
    }
  }

  emit();
}

/**
 * Populate the auth cache from the current Supabase session and subscribe to
 * future auth-state changes. Idempotent — safe to await from multiple places.
 */
export async function initAuth(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { data } = await supabaseClient.auth.getSession();
      await applySession(data.session ?? null);
    } catch (err) {
      console.warn("[auth] initAuth failed:", err);
      cache.session = null;
      cache.profile = null;
    }

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      void applySession(session ?? null);
    });

    initialized = true;
  })();

  return initPromise;
}

/** True once initAuth() has completed at least one pass. */
export function isAuthReady(): boolean {
  return initialized;
}

// ---------------------------------------------------------------------------
// Synchronous getters (read from cache)
// ---------------------------------------------------------------------------

export function getCurrentUser(): User | null {
  const { session, profile } = cache;
  if (!session?.user) return null;

  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const role =
    (profile?.role as UserRole | undefined) ??
    (typeof meta.role === "string" ? (meta.role as UserRole) : undefined) ??
    "business_owner";

  const firstName =
    profile?.first_name ??
    (typeof meta.first_name === "string" ? meta.first_name : undefined) ??
    undefined;
  const lastName =
    profile?.last_name ??
    (typeof meta.last_name === "string" ? meta.last_name : undefined) ??
    undefined;

  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const name =
    profile?.name ??
    (typeof meta.name === "string" ? meta.name : undefined) ??
    (composedName || undefined) ??
    session.user.email ??
    "";

  return {
    id: profile?.id ?? session.user.id,
    email: profile?.email ?? session.user.email ?? "",
    name: name || session.user.email || "",
    role,
    avatar: profile?.avatar_url ?? undefined,
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
    currentBusinessId: workspaceService.getCurrentBusinessId() ?? undefined,
  };
}

export function getAuthToken(): string | null {
  return cache.session?.access_token ?? null;
}

export function isAuthenticated(): boolean {
  return !!cache.session?.user;
}

export function isSuperAdmin(): boolean {
  return getCurrentUser()?.role === "super_admin";
}

export function isAgencyAdmin(): boolean {
  return getCurrentUser()?.role === "agency_admin";
}

export function requireAuth(): boolean {
  return isAuthenticated();
}

// ---------------------------------------------------------------------------
// Business helpers — delegate to workspaceService (the source of truth)
// ---------------------------------------------------------------------------

export function getCurrentBusiness(): BusinessProfile | null {
  const id = workspaceService.getCurrentBusinessId();
  if (!id) return null;
  return {
    id,
    accountId: workspaceService.getSubAccountId() ?? "",
    name: "",
  };
}

export function getUserBusinesses(): BusinessProfile[] {
  return workspaceService.getBusinessIds().map((id) => ({
    id,
    accountId: workspaceService.getSubAccountId() ?? "",
    name: "",
  }));
}

export function switchToBusiness(businessId: string): boolean {
  if (!workspaceService.getBusinessIds().includes(businessId)) return false;
  void workspaceService.switchBusiness(businessId);
  return true;
}

export function canSwitchBusinesses(): boolean {
  return workspaceService.getBusinessIds().length > 1;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error("[auth] signOut error:", err);
  }
  cache.session = null;
  cache.profile = null;
  workspaceService.reset();
  try {
    localStorage.removeItem("workspace_business_id");
  } catch {
    /* ignore */
  }
  emit();
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  await applySession(data.session ?? null);
  return data;
}

export async function signUpWithPassword(params: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const { email, password, firstName, lastName } = params;
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      // The DB trigger reads name / first_name / last_name from user metadata
      // to populate the public.users row on signup.
      data: {
        name: name || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      },
      emailRedirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined,
    },
  });
  if (error) throw error;

  // If email confirmation is disabled Supabase returns a session immediately.
  if (data.session) {
    await applySession(data.session);
  }
  return data;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo:
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}
