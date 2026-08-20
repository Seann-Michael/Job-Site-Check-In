/**
 * workspaceService.ts
 *
 * Single source of truth linking:
 *   Supabase user UUID  ←→  sub_account_id (XXX-XXX-XXX)  ←→  businesses  ←→  projects
 *
 * Data scoping is enforced at the application layer — every data query is
 * restricted to the current workspace's owner_id / business_ids.
 */

import { supabaseClient as supabase } from "./supabaseClient";

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
  subAccountId: string | null;
}

export interface WorkspaceBusiness {
  id: string;
  name: string;
  status: string;
  /** Display account id (XXX-XXX-XXX), if set. */
  accountId: string | null;
  /** users.id of the owner; lets the UI tell "my business" from "someone else's". */
  ownerId: string | null;
}

/** @deprecated alias kept for readability inside this module */
type OwnedBusiness = WorkspaceBusiness;

export interface WorkspaceState {
  user: WorkspaceUser | null;
  /** UUID of the business currently selected */
  currentBusinessId: string | null;
  /**
   * Active business UUIDs this user may act on (used for data scoping).
   * Owners: businesses they own. Super admins: every business.
   */
  businessIds: string[];
  /** Every business visible to this user (any status), sorted by name. */
  businesses: WorkspaceBusiness[];
  /**
   * Total number of businesses owned regardless of status. When this is > 0
   * but `businessIds` is empty, every business is suspended/inactive.
   */
  ownedBusinessCount: number;
  /** True when the auth session exists but no `public.users` row was found. */
  profileMissing: boolean;
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
    businesses: [],
    ownedBusinessCount: 0,
    profileMissing: false,
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
   * Clear all workspace state and allow initialize() to run again. Called when
   * the signed-in identity changes (login / logout).
   */
  reset(): void {
    this.initPromise = null;
    this.state = {
      user: null,
      currentBusinessId: null,
      businessIds: [],
      businesses: [],
      ownedBusinessCount: 0,
      profileMissing: false,
      initialized: false,
    };
    this.emit();
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
      const { user: workspaceUser, hasSession } = await this.resolveWorkspaceUser();

      if (!workspaceUser) {
        this.state = {
          user: null,
          currentBusinessId: null,
          businessIds: [],
          businesses: [],
          ownedBusinessCount: 0,
          // A session without a users row cannot be repaired client-side
          // (RLS forbids inserting into `users`); surface it to the UI.
          profileMissing: hasSession,
          initialized: true,
        };
        this.emit();
        return this.state;
      }

      const owned = await this.fetchVisibleBusinesses(workspaceUser);
      const businessIds = this.scopedIds(workspaceUser, owned);

      const stored = localStorage.getItem("workspace_business_id");
      const currentBusinessId =
        stored && businessIds.includes(stored)
          ? stored
          : this.defaultBusinessId(owned, businessIds);

      if (currentBusinessId) {
        localStorage.setItem("workspace_business_id", currentBusinessId);
      }

      this.state = {
        user: workspaceUser,
        currentBusinessId,
        businessIds,
        businesses: owned,
        ownedBusinessCount: owned.length,
        profileMissing: false,
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

  private async resolveWorkspaceUser(): Promise<{
    user: WorkspaceUser | null;
    hasSession: boolean;
  }> {
    // The Supabase auth session is the sole source of identity.
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        return { user: await this.loadUserRecord(authUser.id), hasSession: true };
      }
    } catch {
      // Supabase auth not available / no session.
    }
    return { user: null, hasSession: false };
  }

  /**
   * Load the `public.users` row for the signed-in user and make sure the
   * sub_account_id is in display format. The row itself is created by the
   * auth signup trigger; RLS does not allow the client to insert one.
   */
  private async loadUserRecord(userId: string): Promise<WorkspaceUser | null> {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from("users")
        .select("id, email, name, role, sub_account_id")
        .eq("id", userId)
        .maybeSingle();

      if (fetchErr) {
        console.error(
          "[workspace] could not fetch user from Supabase:",
          serializeError(fetchErr),
        );
        return null;
      }

      if (existing) {
        // Display-format only; `users.sub_account_id` is not client-writable.
        const subAccountId = ensureFormattedId(existing.sub_account_id as string);
        return {
          id: existing.id as string,
          email: existing.email as string,
          name: existing.name as string,
          role: existing.role as string,
          subAccountId,
        };
      }

      console.warn("[workspace] no public.users row for authenticated user", userId);
      return null;
    } catch (err) {
      console.error("[workspace] loadUserRecord failed:", serializeError(err));
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Business scoping
  // -------------------------------------------------------------------------

  private static isSuperAdminRole(role: string | null | undefined): boolean {
    return (role || "").toLowerCase().replace(/[^a-z]/g, "") === "superadmin";
  }

  /** True when the workspace user is a super_admin (full access to all accounts). */
  isSuperAdmin(): boolean {
    return WorkspaceService.isSuperAdminRole(this.state.user?.role);
  }

  /**
   * Businesses this user can see. Owners get the businesses they own; super
   * admins get every business (RLS `is_super_admin()` allows the read).
   */
  private async fetchVisibleBusinesses(
    user: WorkspaceUser,
  ): Promise<OwnedBusiness[]> {
    if (WorkspaceService.isSuperAdminRole(user.role)) {
      return this.fetchAllBusinesses();
    }
    return isValidUUID(user.id)
      ? await this.fetchOwnedBusinesses(user.id)
      : this.noBusinessesForNonUuidUser(user.id);
  }

  /**
   * Business ids the user may act on. Owners are limited to their active
   * businesses (suspended ones are excluded so the UI can show the suspended
   * screen); super admins may open any business regardless of status.
   */
  private scopedIds(user: WorkspaceUser, list: OwnedBusiness[]): string[] {
    if (WorkspaceService.isSuperAdminRole(user.role)) {
      return list.map((b) => b.id);
    }
    return list.filter((b) => b.status === "active").map((b) => b.id);
  }

  /** Prefer the first active business, then fall back to any allowed id. */
  private defaultBusinessId(
    list: OwnedBusiness[],
    allowed: string[],
  ): string | null {
    const firstActive = list.find(
      (b) => b.status === "active" && allowed.includes(b.id),
    );
    return firstActive?.id ?? allowed[0] ?? null;
  }

  private mapRows(
    data: Array<{
      id: string;
      name: string | null;
      status: string | null;
      account_id: string | null;
      owner_id: string | null;
    }> | null,
  ): OwnedBusiness[] {
    return (data ?? []).map((b) => ({
      id: b.id,
      name: b.name ?? "Unnamed business",
      status: b.status ?? "active",
      accountId: b.account_id ?? null,
      ownerId: b.owner_id ?? null,
    }));
  }

  private async fetchOwnedBusinesses(
    userId: string,
  ): Promise<OwnedBusiness[]> {
    try {
      // Load every status so the UI can tell "suspended" apart from "none".
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, status, account_id, owner_id")
        .eq("owner_id", userId)
        .order("name", { ascending: true });

      if (error) {
        console.warn(
          "[workspace] fetchOwnedBusinesses error:",
          serializeError(error),
        );
        return [];
      }
      return this.mapRows(data);
    } catch {
      return [];
    }
  }

  private async fetchAllBusinesses(): Promise<OwnedBusiness[]> {
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, status, account_id, owner_id")
        .order("name", { ascending: true });

      if (error) {
        console.warn(
          "[workspace] fetchAllBusinesses error:",
          serializeError(error),
        );
        return [];
      }
      return this.mapRows(data);
    } catch {
      return [];
    }
  }

  /** Users without a real Supabase UUID cannot own businesses. */
  private noBusinessesForNonUuidUser(userId: string): OwnedBusiness[] {
    console.warn(
      `[workspace] user id "${userId}" is not a UUID; no businesses will be loaded.`,
    );
    return [];
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

  /** Businesses available to the switcher (`{ id, name, status }[]`). */
  getBusinessList(): WorkspaceBusiness[] {
    return this.state.businesses;
  }

  /** Name of the currently selected business, if known. */
  getCurrentBusinessName(): string | null {
    const id = this.state.currentBusinessId;
    if (!id) return null;
    return this.state.businesses.find((b) => b.id === id)?.name ?? null;
  }

  async switchBusiness(businessId: string): Promise<void> {
    if (!this.state.businessIds.includes(businessId)) return;
    this.state = { ...this.state, currentBusinessId: businessId };
    localStorage.setItem("workspace_business_id", businessId);
    this.emit();
  }

  async reloadBusinesses(): Promise<void> {
    const user = this.state.user;
    if (!user) return;
    const owned = await this.fetchVisibleBusinesses(user);
    const businessIds = this.scopedIds(user, owned);
    const currentBusinessId =
      this.state.currentBusinessId &&
      businessIds.includes(this.state.currentBusinessId)
        ? this.state.currentBusinessId
        : this.defaultBusinessId(owned, businessIds);

    this.state = {
      ...this.state,
      businessIds,
      businesses: owned,
      currentBusinessId,
      ownedBusinessCount: owned.length,
    };
    if (currentBusinessId)
      localStorage.setItem("workspace_business_id", currentBusinessId);
    this.emit();
  }
}

export const workspaceService = new WorkspaceService();
