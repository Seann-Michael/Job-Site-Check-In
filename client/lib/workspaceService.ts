/**
 * workspaceService.ts
 *
 * Single source of truth linking:
 *   Supabase user UUID  ←→  sub_account_id (XXX-XXX-XXX)  ←→  businesses  ←→  projects
 *
 * Every data query in the app is scoped through this chain so each workspace
 * only ever sees its own data.
 */

import { supabase } from "./dataService";
import { getCurrentUser as getLocalUser } from "./auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceUser {
  /** Supabase UUID (primary key of `users` table) */
  id: string;
  email: string;
  name: string;
  role: string;
  /** Display-friendly unique ID, format XXX-XXX-XXX */
  subAccountId: string;
}

export interface WorkspaceState {
  user: WorkspaceUser | null;
  /** UUID of the business currently selected */
  currentBusinessId: string | null;
  /** All business UUIDs that belong to this user */
  businessIds: string[];
  initialized: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9).padEnd(9, "0");
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

function generateAccountId(): string {
  const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

// ---------------------------------------------------------------------------
// WorkspaceService
// ---------------------------------------------------------------------------

class WorkspaceService {
  private state: WorkspaceState = {
    user: null,
    currentBusinessId: null,
    businessIds: [],
    initialized: false,
  };

  private listeners: Array<(state: WorkspaceState) => void> = [];

  /** Subscribe to workspace state changes */
  subscribe(fn: (state: WorkspaceState) => void): () => void {
    this.listeners.push(fn);
    // Immediately emit current state if already initialized
    if (this.state.initialized) fn(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit() {
    this.listeners.forEach((fn) => fn({ ...this.state }));
  }

  // -------------------------------------------------------------------------
  // Initialization — call once on app mount
  // -------------------------------------------------------------------------

  async initialize(): Promise<WorkspaceState> {
    try {
      const workspaceUser = await this.resolveWorkspaceUser();
      if (!workspaceUser) {
        this.state = { user: null, currentBusinessId: null, businessIds: [], initialized: true };
        this.emit();
        return this.state;
      }

      // Load business IDs owned by this user
      const businessIds = await this.fetchBusinessIds(workspaceUser.id);

      // Restore or pick the first business
      const stored = localStorage.getItem("workspace_business_id");
      const currentBusinessId =
        stored && businessIds.includes(stored)
          ? stored
          : businessIds[0] ?? null;

      if (currentBusinessId) {
        localStorage.setItem("workspace_business_id", currentBusinessId);
      }

      this.state = {
        user: workspaceUser,
        currentBusinessId,
        businessIds,
        initialized: true,
      };

      this.emit();
      return this.state;
    } catch (err) {
      console.error("[workspace] initialization error:", err);
      this.state = { ...this.state, initialized: true };
      this.emit();
      return this.state;
    }
  }

  // -------------------------------------------------------------------------
  // Resolve / sync the workspace user
  // -------------------------------------------------------------------------

  private async resolveWorkspaceUser(): Promise<WorkspaceUser | null> {
    // 1. Try Supabase session first (real auth)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        return await this.syncUserRecord(authUser.id, authUser.email ?? "");
      }
    } catch {
      // Supabase not connected — fall through to local
    }

    // 2. Fallback: local demo user synced by a stable deterministic UUID
    const localUser = getLocalUser();
    if (!localUser) return null;

    // Use the local user's id as a stable identifier
    const userId = localUser.id;
    return await this.syncUserRecord(userId, localUser.email ?? "", localUser.name);
  }

  /**
   * Upsert the user row in Supabase and ensure sub_account_id is set.
   * Returns the canonical WorkspaceUser.
   */
  private async syncUserRecord(
    userId: string,
    email: string,
    name?: string,
  ): Promise<WorkspaceUser | null> {
    try {
      // Fetch existing record
      const { data: existing, error: fetchErr } = await supabase
        .from("users")
        .select("id, email, name, role, sub_account_id")
        .eq("id", userId)
        .single();

      if (fetchErr && fetchErr.code !== "PGRST116") {
        console.error("[workspace] fetch user error:", fetchErr);
        return this.buildFallbackUser(userId, email, name);
      }

      if (existing) {
        // Ensure sub_account_id is formatted
        let subAccountId = existing.sub_account_id as string | null;
        if (!subAccountId) {
          subAccountId = generateAccountId();
          await supabase.from("users").update({ sub_account_id: subAccountId }).eq("id", userId);
        } else if (!subAccountId.includes("-")) {
          subAccountId = formatAccountId(subAccountId);
          await supabase.from("users").update({ sub_account_id: subAccountId }).eq("id", userId);
        }
        return {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          role: existing.role,
          subAccountId: subAccountId!,
        };
      }

      // Row doesn't exist — insert it (trigger will set sub_account_id)
      const subAccountId = generateAccountId();
      const { data: inserted, error: insertErr } = await supabase
        .from("users")
        .insert({
          id: userId,
          email,
          name: name ?? email,
          role: "business_owner",
          sub_account_id: subAccountId,
          email_verified: false,
          phone_verified: false,
          is_2fa_enabled: false,
        })
        .select("id, email, name, role, sub_account_id")
        .single();

      if (insertErr) {
        console.error("[workspace] insert user error:", insertErr);
        return this.buildFallbackUser(userId, email, name, subAccountId);
      }

      return {
        id: inserted.id,
        email: inserted.email,
        name: inserted.name,
        role: inserted.role,
        subAccountId: inserted.sub_account_id ?? subAccountId,
      };
    } catch (err) {
      console.error("[workspace] syncUserRecord error:", err);
      return this.buildFallbackUser(userId, email, name);
    }
  }

  /** Build a fallback workspace user using localStorage settings for offline/demo mode */
  private buildFallbackUser(
    userId: string,
    email: string,
    name?: string,
    subAccountId?: string,
  ): WorkspaceUser {
    // Try to read sub_account_id from stored settings
    let storedId = subAccountId;
    if (!storedId) {
      try {
        const settings = JSON.parse(localStorage.getItem("business_settings") ?? "{}");
        storedId = settings.subAccountId;
      } catch {}
    }
    if (!storedId) {
      storedId = generateAccountId();
    }
    if (!storedId.includes("-")) {
      storedId = formatAccountId(storedId);
    }
    return { id: userId, email, name: name ?? email, role: "business_owner", subAccountId: storedId };
  }

  // -------------------------------------------------------------------------
  // Business scoping
  // -------------------------------------------------------------------------

  private async fetchBusinessIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .eq("status", "active");

      if (error) {
        console.warn("[workspace] fetchBusinessIds error:", error);
        return [];
      }
      return (data ?? []).map((b: { id: string }) => b.id);
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Public accessors
  // -------------------------------------------------------------------------

  getState(): WorkspaceState {
    return { ...this.state };
  }

  getUserId(): string | null {
    return this.state.user?.id ?? null;
  }

  getSubAccountId(): string | null {
    return this.state.user?.subAccountId ?? null;
  }

  getCurrentBusinessId(): string | null {
    return this.state.currentBusinessId;
  }

  getBusinessIds(): string[] {
    return this.state.businessIds;
  }

  async switchBusiness(businessId: string): Promise<void> {
    if (!this.state.businessIds.includes(businessId)) return;
    this.state = { ...this.state, currentBusinessId: businessId };
    localStorage.setItem("workspace_business_id", businessId);
    this.emit();
  }

  /**
   * Update the sub_account_id in Supabase and sync locally.
   * Called from Settings if ever the ID needs to be regenerated.
   */
  async refreshSubAccountId(): Promise<string | null> {
    const userId = this.getUserId();
    if (!userId) return null;
    const newId = generateAccountId();
    try {
      await supabase.from("users").update({ sub_account_id: newId }).eq("id", userId);
      this.state = {
        ...this.state,
        user: this.state.user ? { ...this.state.user, subAccountId: newId } : null,
      };
      this.emit();
      return newId;
    } catch (err) {
      console.error("[workspace] refreshSubAccountId error:", err);
      return null;
    }
  }

  /**
   * Reload businesses after a new one is created.
   */
  async reloadBusinesses(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;
    const businessIds = await this.fetchBusinessIds(userId);
    const currentBusinessId =
      this.state.currentBusinessId && businessIds.includes(this.state.currentBusinessId)
        ? this.state.currentBusinessId
        : businessIds[0] ?? null;

    this.state = { ...this.state, businessIds, currentBusinessId };
    if (currentBusinessId) localStorage.setItem("workspace_business_id", currentBusinessId);
    this.emit();
  }
}

export const workspaceService = new WorkspaceService();
