import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthProfile {
  id: string;
  email: string | null;
  role: string | null;
  /** users.sub_account_id — legacy text account identifier used by media/RSS. */
  accountId: string | null;
  /** businesses.id values this user owns (businesses.owner_id = users.id). */
  businessIds: string[];
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

    const [{ data: row }, { data: businesses }] = await Promise.all([
      db.from("users").select("id, email, role, sub_account_id").eq("id", user.id).maybeSingle(),
      db.from("businesses").select("id").eq("owner_id", user.id),
    ]);

    req.profile = {
      id: user.id,
      email: (row as any)?.email ?? user.email,
      role: (row as any)?.role ?? null,
      accountId: (row as any)?.sub_account_id ?? null,
      businessIds: ((businesses as any[]) || []).map((b) => b.id as string),
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
  return normalizeRole(req.profile?.role) === "superadmin";
}

/** True when the authenticated user may act on the given business id. */
export function canAccessBusiness(req: Request, businessId: string | null | undefined): boolean {
  if (!businessId) return false;
  if (isSuperAdmin(req)) return true;
  return !!req.profile?.businessIds.includes(businessId);
}
