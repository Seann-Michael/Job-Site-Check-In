/**
 * workspaceService.ts
 *
 * Single source of truth linking:
 *   Supabase user UUID  ←→  sub_account_id (XXX-XXX-XXX)  ←→  businesses  ←→  projects
 *
 * Data scoping is enforced at the application layer — every data query is
 * restricted to the current workspace's owner_id / business_ids.
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
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

function serializeError(err: unknown): string {
  if (!err) return "unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function formatAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9).padEnd(9, "0");
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

function generateAccountId(): string {
  const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

function ensureFormattedId(id: string | null | undefined): string {
  if (!id) return generateAccountId();
  if (id.includes("-") && id.length === 11) return id; // already XXX-XXX-XXX
  if (id.includes("-")) return id; // some other dashed format — leave it
  return formatAccountId(id);
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
    if (this.state.initialized) fn({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit() {
    this.listeners.forEach((fn) => fn({ ...this.state }));
  }

  private initPromise: Promise<WorkspaceState> | null = null;

  // -------------------------------------------------------------------------
  // Initialization — kicked off once in main.tsx. Idempotent: concurrent
  // callers share the same in-flight promise instead of re-running the flow.
  // -------------------------------------------------------------------------

  initialize(): Promise<WorkspaceState> {
    if (!this.initPromise) this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  /**
   * Await this before reading getCurrentBusinessId()/getBusinessIds().
   * Resolves once initialization has completed (starting it if it hasn't),
   * so cold-load callers never observe the pre-init null business id and
   * accidentally run unscoped queries or stamp rows with a null tenant.
   */
  whenReady(): Promise<WorkspaceState> {
    if (this.state.initialized) return Promise.resolve(this.getState());
    return this.initialize();
  }

  private async doInitialize(): Promise<WorkspaceState> {
    try {
      const workspaceUser = await this.resolveWorkspaceUser();

      if (!workspaceUser) {
        this.state = {
          user: null,
          currentBusinessId: null,
          businessIds: [],
          initialized: true,
        };
        this.emit();
        return this.state;
      }

      // Fetch business IDs — for real UUID users scope to owner_id,
      // for local dev users (non-UUID id like "1") return all active businesses
      const businessIds = isValidUUID(workspaceUser.id)
        ? await this.fetchBusinessIds(workspaceUser.id)
        : await this.fetchAllBusinessIds();

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
      console.error("[workspace] initialization error:", serializeError(err));
      this.state = { ...this.state, initialized: true };
      this.emit();
      return this.state;
    }
  }

  // -------------------------------------------------------------------------
  // Resolve the workspace user
  // -------------------------------------------------------------------------

  private async resolveWorkspaceUser(): Promise<WorkspaceUser | null> {
    // 1. Real Supabase auth session
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        return await this.syncUserRecord(authUser.id, authUser.email ?? "");
      }
    } catch {
      // Supabase auth not available — fall through
    }

    // 2. Local demo/localStorage user
    const localUser = getLocalUser();
    if (!localUser) return null;

    // If the local user ID is a valid UUID, try syncing with Supabase
    if (isValidUUID(localUser.id)) {
      return await this.syncUserRecord(
        localUser.id,
        localUser.email ?? "",
        localUser.name,
      );
    }

    // Non-UUID local ID (e.g. "1") — skip Supabase, use localStorage only
    return this.buildFallbackUser(localUser.id, localUser.email ?? "", localUser.name);
  }

  /**
   * Upsert the user row in Supabase and ensure sub_account_id is set.
   * Only called when userId is a valid UUID.
   */
  private async syncUserRecord(
    userId: string,
    email: string,
    name?: string,
  ): Promise<WorkspaceUser | null> {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from("users")
        .select("id, email, name, role, sub_account_id")
        .eq("id", userId)
        .maybeSingle();

      if (fetchErr) {
        console.warn(
          "[workspace] could not fetch user from Supabase:",
          serializeError(fetchErr),
          "— using local fallback",
        );
        return this.buildFallbackUser(userId, email, name);
      }

      if (existing) {
        let subAccountId = ensureFormattedId(existing.sub_account_id as string);
        if (subAccountId !== existing.sub_account_id) {
          // Update the stored ID to the formatted version
          await supabase
            .from("users")
            .update({ sub_account_id: subAccountId })
            .eq("id", userId);
        }
        return {
          id: existing.id as string,
          email: existing.email as string,
          name: existing.name as string,
          role: existing.role as string,
          subAccountId,
        };
      }

      // Row doesn't exist — insert
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
        console.warn(
          "[workspace] could not insert user into Supabase:",
          serializeError(insertErr),
          "— using local fallback",
        );
        return this.buildFallbackUser(userId, email, name, subAccountId);
      }

      return {
        id: inserted.id as string,
        email: inserted.email as string,
        name: inserted.name as string,
        role: inserted.role as string,
        subAccountId: ensureFormattedId(inserted.sub_account_id as string) ?? subAccountId,
      };
    } catch (err) {
      console.warn(
        "[workspace] syncUserRecord failed:",
        serializeError(err),
        "— using local fallback",
      );
      return this.buildFallbackUser(userId, email, name);
    }
  }

  /** Build a workspace user entirely from localStorage — used when Supabase is unavailable */
  private buildFallbackUser(
    userId: string,
    email: string,
    name?: string,
    subAccountId?: string,
  ): WorkspaceUser {
    let id = subAccountId;
    if (!id) {
      try {
        const settings = JSON.parse(
          localStorage.getItem("business_settings") ?? "{}",
        );
        id = settings.subAccountId;
      } catch {}
    }
    id = ensureFormattedId(id ?? null);
    return {
      id: userId,
      email,
      name: name ?? email,
      role: "business_owner",
      subAccountId: id,
    };
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
        console.warn(
          "[workspace] fetchBusinessIds error:",
          serializeError(error),
        );
        return [];
      }
      return (data ?? []).map((b: { id: string }) => b.id);
    } catch {
      return [];
    }
  }

  /** Dev/demo fallback — returns all active businesses when user has no UUID */
  private async fetchAllBusinessIds(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("id")
        .eq("status", "active");

      if (error) {
        console.warn("[workspace] fetchAllBusinessIds error:", serializeError(error));
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

  async refreshSubAccountId(): Promise<string | null> {
    const userId = this.getUserId();
    if (!userId) return null;
    const newId = generateAccountId();
    try {
      if (isValidUUID(userId)) {
        await supabase
          .from("users")
          .update({ sub_account_id: newId })
          .eq("id", userId);
      }
      this.state = {
        ...this.state,
        user: this.state.user ? { ...this.state.user, subAccountId: newId } : null,
      };
      this.emit();
      return newId;
    } catch (err) {
      console.warn("[workspace] refreshSubAccountId error:", serializeError(err));
      return null;
    }
  }

  async reloadBusinesses(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;
    const businessIds = isValidUUID(userId)
      ? await this.fetchBusinessIds(userId)
      : await this.fetchAllBusinessIds();
    const currentBusinessId =
      this.state.currentBusinessId &&
      businessIds.includes(this.state.currentBusinessId)
        ? this.state.currentBusinessId
        : businessIds[0] ?? null;

    this.state = { ...this.state, businessIds, currentBusinessId };
    if (currentBusinessId)
      localStorage.setItem("workspace_business_id", currentBusinessId);
    this.emit();
  }
}

export const workspaceService = new WorkspaceService();
