import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";

export interface AuthUser {
  id: string;
  email: string | null;
}

export type BusinessRole = "owner" | "staff" | "viewer";

export interface AuthProfile {
  id: string;
  email: string | null;
  role: string | null;
  /** users.sub_account_id — legacy text account identifier used by media/RSS. */
  accountId: string | null;
  /**
   * businesses.id values this user can access: businesses they own
   * (businesses.owner_id = users.id) UNION businesses they are a member of
   * (business_members.user_id). For super admins this is NOT the full access
   * set — check `isSuperAdmin` (or use canAccessBusiness()) which grants
   * access to every business.
   */
  businessIds: string[];
  /**
   * Per-business role: `owner` (businesses.owner_id), or the
   * business_members.role (`staff` = read+write, `viewer` = read-only).
   * Keyed by business id; only businesses in `businessIds` are present.
   */
  memberRoles: Record<string, BusinessRole>;
  /**
   * Subset of `businessIds` whose businesses.status is not 'active'. These stay
   * READABLE (a suspended tenant must still be able to see their data and reach
   * billing to reactivate) but canWriteBusiness() refuses them, mirroring the
   * database, where can_write_business() requires status = 'active'.
   * Suspension used to be enforced only in the browser.
   */
  suspendedBusinessIds: string[];
  /** True for role super_admin: full admin access to every business. */
  isSuperAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      profile?: AuthProfile;
      rawBody?: Buffer;
    }
  }
}

function normalizeRole(role: string | null | undefined): string {
  return (role || "").toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Requires `Authorization: Bearer <supabase access token>`. Verifies the JWT
 * with Supabase Auth (service client), attaches req.user and req.profile.
 * Responds 401 on any failure; never leaks why.
 */
export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header && /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user: AuthUser = { id: data.user.id, email: data.user.email ?? null };
    req.user = user;

    const [{ data: row }, { data: businesses }, { data: memberships }] = await Promise.all([
      db.from("users").select("id, email, role, sub_account_id").eq("id", user.id).maybeSingle(),
      db.from("businesses").select("id, status").eq("owner_id", user.id),
      db.from("business_members").select("business_id, role").eq("user_id", user.id),
    ]);

    // A valid token with no profile row is an anomaly (the signup trigger
    // creates the row). Refuse rather than proceed with a null-role profile.
    if (!row) {
      return res.status(401).json({ error: "User profile not found" });
    }

    const role: string | null = (row as any)?.role ?? null;
    const memberRoles: Record<string, BusinessRole> = {};
    // Memberships first, so an owner row (below) always wins if both exist.
    for (const m of ((memberships as any[]) || [])) {
      if (m?.business_id && (m.role === "staff" || m.role === "viewer")) memberRoles[m.business_id] = m.role;
    }
    const ownedStatus: Record<string, string | null> = {};
    for (const b of ((businesses as any[]) || [])) {
      if (b?.id) {
        memberRoles[b.id] = "owner";
        ownedStatus[b.id] = b.status ?? null;
      }
    }

    // Businesses a member belongs to are not covered by the owner query above,
    // so look their status up too — a staff member of a suspended business must
    // be write-blocked exactly like its owner.
    const memberOnlyIds = Object.keys(memberRoles).filter((id) => !(id in ownedStatus));
    if (memberOnlyIds.length) {
      // Secondary lookup: never let it fail the whole authentication. A status
      // we could not read is treated as "not suspended" (see the filter below).
      try {
        const { data: memberBiz } = await db
          .from("businesses")
          .select("id, status")
          .in("id", memberOnlyIds);
        for (const b of ((memberBiz as any[]) || [])) {
          if (b?.id) ownedStatus[b.id] = b.status ?? null;
        }
      } catch (err) {
        logger.warn({ err }, "requireAuth: member business status lookup failed");
      }
    }

    // Only a KNOWN non-active status suspends. businesses.status is NOT NULL in
    // the schema, so a missing value means "we could not read it", and failing
    // closed there would lock out every tenant on a transient read error.
    const suspendedBusinessIds = Object.keys(memberRoles).filter(
      (id) => ownedStatus[id] != null && ownedStatus[id] !== "active",
    );

    req.profile = {
      id: user.id,
      email: (row as any)?.email ?? user.email,
      role,
      accountId: (row as any)?.sub_account_id ?? null,
      businessIds: Object.keys(memberRoles),
      memberRoles,
      suspendedBusinessIds,
      isSuperAdmin: normalizeRole(role) === "superadmin",
    };
    return next();
  } catch (err) {
    logger.error({ err }, "requireAuth failed");
    return res.status(401).json({ error: "Authentication failed" });
  }
};

/**
 * Must be used after requireAuth. Accepts role names loosely
 * (`superadmin` matches the DB enum value `super_admin`).
 */
export function requireRole(...roles: string[]): RequestHandler {
  const wanted = roles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.profile) return res.status(401).json({ error: "Authentication required" });
    if (!wanted.includes(normalizeRole(req.profile.role))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

export function isSuperAdmin(req: Request): boolean {
  return req.profile?.isSuperAdmin === true || normalizeRole(req.profile?.role) === "superadmin";
}

/** Roles allowed to perform mutating (write) operations. `viewer` is read-only. */
const WRITE_ROLES = new Set(["superadmin", "businessowner", "staff"]);

/** True when the authenticated user's role may perform writes. */
export function canWrite(req: Request): boolean {
  return WRITE_ROLES.has(normalizeRole(req.profile?.role));
}

/**
 * Must be used after requireAuth. 403 for read-only roles (e.g. `viewer`) on
 * mutating routes.
 */
export const requireWrite: RequestHandler = (req, res, next) => {
  if (!req.profile) return res.status(401).json({ error: "Authentication required" });
  if (!canWrite(req)) return res.status(403).json({ error: "Forbidden: read-only role" });
  return next();
};

/** True when the authenticated user may READ the given business (owner, member, or super admin). */
export function canAccessBusiness(req: Request, businessId: string | null | undefined): boolean {
  if (!businessId) return false;
  if (isSuperAdmin(req)) return true;
  return !!req.profile?.memberRoles?.[businessId];
}

/**
 * True when the authenticated user may WRITE to the given business: super
 * admin, owner, or a `staff` member. `viewer` members are read-only.
 */
export function canWriteBusiness(req: Request, businessId: string | null | undefined): boolean {
  if (!businessId) return false;
  if (isSuperAdmin(req)) return true;
  // A suspended business is read-only for its own tenant. The database enforces
  // the same rule in can_write_business(), so a direct PostgREST write is
  // refused too; this keeps the API layer consistent rather than letting it
  // through to a 42501 from Postgres.
  if (req.profile?.suspendedBusinessIds?.includes(businessId)) return false;
  const r = req.profile?.memberRoles?.[businessId];
  return r === "owner" || r === "staff";
}

/** True when the authenticated user is the owner of the business (or a super admin). */
export function isBusinessOwner(req: Request, businessId: string | null | undefined): boolean {
  if (!businessId) return false;
  if (isSuperAdmin(req)) return true;
  return req.profile?.memberRoles?.[businessId] === "owner";
}
