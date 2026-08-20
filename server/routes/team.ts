/**
 * Team membership API — /api/team/* and /api/admin/staff/invite.
 *
 * The `business_members` table is READ-ONLY over PostgREST (INSERT/UPDATE/
 * DELETE revoked from `authenticated` in migration
 * 20260820008000_business_memberships.sql). Every mutation goes through these
 * handlers, which run with the service role and enforce:
 *
 *   - read  (GET)                     owner, member (staff/viewer), super admin
 *   - invite / role change / remove   owner or super admin ONLY
 *   - internal staff (super_admin)    super admin ONLY (/api/admin/staff/invite)
 *
 * Owners are implicit (businesses.owner_id) and never appear as member rows.
 * Every mutation writes an audit_logs row (actor, target, business).
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { getEnv } from "../lib/env";
import { logger } from "../lib/logger";
import {
  requireAuth,
  requireRole,
  canAccessBusiness,
  isBusinessOwner,
  isSuperAdmin,
} from "../middleware/requireAuth";

const log = logger.child({ module: "team" });
const reqLog = (req: Request) => (req.log ?? log).child({ module: "team" });

const MEMBER_ROLES = ["staff", "viewer"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

// Pragmatic email check: one "@", no whitespace, a dot in the domain, bounded length.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TeamUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: MemberRole;
  status: "active" | "invited";
  createdAt: string | null;
}

// ── Rate limits (per user) ───────────────────────────────────────────────────

const perUser = (limit: number, message: string) =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
    validate: { keyGeneratorIpFallback: false },
    message: { error: message },
  });

/** 20 invites / hour / user. */
export const inviteLimiter = perUser(20, "Too many invitations sent, please try again later");
/** 10 internal-staff invites / hour / user. */
export const staffInviteLimiter = perUser(10, "Too many staff invitations sent, please try again later");

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

function normalizeName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim().slice(0, 120);
  return n || null;
}

function isMemberRole(v: unknown): v is MemberRole {
  return typeof v === "string" && (MEMBER_ROLES as readonly string[]).includes(v);
}

function validBusinessId(req: Request, res: Response): string | null {
  const id = req.params.businessId;
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid business id" });
    return null;
  }
  return id;
}

/** Owner (or super admin) gate; 404 for outsiders so business ids aren't enumerable. */
function requireOwner(req: Request, res: Response, businessId: string): boolean {
  if (!canAccessBusiness(req, businessId)) {
    res.status(404).json({ error: "Business not found" });
    return false;
  }
  if (!isBusinessOwner(req, businessId)) {
    res.status(403).json({ error: "Only the business owner can manage the team" });
    return false;
  }
  return true;
}

async function writeAudit(
  req: Request,
  entry: {
    action: "create" | "update" | "delete" | "permission_change";
    resourceType: string;
    resourceId?: string | null;
    businessId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const db = getSupabaseClient();
    const { error } = await db.from("audit_logs").insert({
      user_id: req.user?.id ?? null,
      business_id: entry.businessId ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      details: { actor_email: req.profile?.email ?? req.user?.email ?? null, ...(entry.details ?? {}) },
      ip_address: req.ip ?? null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    });
    if (error) reqLog(req).warn({ err: error }, "audit_logs insert failed");
  } catch (err) {
    reqLog(req).warn({ err }, "audit_logs insert threw");
  }
}

/**
 * `invited` = the auth user has never signed in. Looked up per user via
 * auth.admin.getUserById (batched with bounded concurrency; listUsers is
 * paginated across the whole project and not usable for a per-business list).
 */
async function signInStatus(userIds: string[]): Promise<Map<string, "active" | "invited">> {
  const db = getSupabaseClient();
  const out = new Map<string, "active" | "invited">();
  const CONCURRENCY = 8;
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const slice = userIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (id) => {
        try {
          const { data } = await db.auth.admin.getUserById(id);
          return [id, data?.user?.last_sign_in_at ? "active" : "invited"] as const;
        } catch {
          return [id, "active"] as const; // unknown -> don't mislabel as pending
        }
      }),
    );
    for (const [id, s] of results) out.set(id, s);
  }
  return out;
}

interface MemberRow {
  id: string;
  business_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string | null;
}

async function serializeMember(row: MemberRow, user: { email?: string | null; name?: string | null } | null): Promise<TeamMember> {
  const status = (await signInStatus([row.user_id])).get(row.user_id) ?? "active";
  return {
    id: row.id,
    userId: row.user_id,
    email: user?.email ?? null,
    name: user?.name ?? null,
    role: row.role,
    status,
    createdAt: row.created_at ?? null,
  };
}

async function loadBusiness(businessId: string): Promise<{ id: string; owner_id: string | null } | null> {
  const db = getSupabaseClient();
  const { data } = await db.from("businesses").select("id, owner_id").eq("id", businessId).maybeSingle();
  return (data as any) ?? null;
}

/** Invite (or look up) the auth/profile user for an email. Returns the users row. */
async function findOrInviteUser(
  email: string,
  name: string | null,
): Promise<{ user: { id: string; email: string | null; name: string | null; role: string | null }; created: boolean } | { error: string; status: number }> {
  const db = getSupabaseClient();
  const { data: existing } = await db.from("users").select("id, email, name, role").eq("email", email).maybeSingle();
  if (existing) return { user: existing as any, created: false };

  const appUrl = (getEnv("APP_URL") || "").replace(/\/+$/, "");
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: name ? { name } : undefined,
    redirectTo: appUrl ? `${appUrl}/reset-password` : undefined,
  });
  if (error || !data?.user) {
    log.error({ err: error }, "inviteUserByEmail failed");
    return { error: "Failed to send invitation", status: 502 };
  }
  // The auth.users insert trigger creates the public.users row; read it back
  // (and fall back to the auth user if replication lags).
  const { data: row } = await db.from("users").select("id, email, name, role").eq("id", data.user.id).maybeSingle();
  return {
    user: (row as any) ?? { id: data.user.id, email: data.user.email ?? email, name, role: null },
    created: true,
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

// GET /api/team/:businessId
export async function handleGetTeam(req: Request, res: Response) {
  const businessId = validBusinessId(req, res);
  if (!businessId) return;
  if (!canAccessBusiness(req, businessId)) return res.status(404).json({ error: "Business not found" });

  try {
    const db = getSupabaseClient();
    const biz = await loadBusiness(businessId);
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const { data: rows, error } = await db
      .from("business_members")
      .select("id, business_id, user_id, role, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });
    if (error) {
      reqLog(req).error({ err: error }, "business_members select failed");
      return res.status(500).json({ error: "Failed to load team" });
    }
    const members = (rows as MemberRow[]) || [];

    const userIds = Array.from(new Set([biz.owner_id, ...members.map((m) => m.user_id)].filter(Boolean))) as string[];
    const usersById = new Map<string, { id: string; email: string | null; name: string | null }>();
    if (userIds.length) {
      const { data: users } = await db.from("users").select("id, email, name").in("id", userIds);
      for (const u of (users as any[]) || []) usersById.set(u.id, u);
    }
    const statuses = await signInStatus(members.map((m) => m.user_id));

    const ownerRow = biz.owner_id ? usersById.get(biz.owner_id) : undefined;
    const owner: TeamUser = {
      id: biz.owner_id ?? "",
      email: ownerRow?.email ?? null,
      name: ownerRow?.name ?? null,
    };

    return res.json({
      owner,
      members: members.map<TeamMember>((m) => ({
        id: m.id,
        userId: m.user_id,
        email: usersById.get(m.user_id)?.email ?? null,
        name: usersById.get(m.user_id)?.name ?? null,
        role: m.role,
        status: statuses.get(m.user_id) ?? "active",
        createdAt: m.created_at ?? null,
      })),
    });
  } catch (err) {
    reqLog(req).error({ err }, "get team failed");
    return res.status(500).json({ error: "Failed to load team" });
  }
}

// POST /api/team/:businessId/invite  { email, role, name? }
export async function handleInviteMember(req: Request, res: Response) {
  const businessId = validBusinessId(req, res);
  if (!businessId) return;
  if (!requireOwner(req, res, businessId)) return;

  const email = normalizeEmail(req.body?.email);
  const role = req.body?.role;
  const name = normalizeName(req.body?.name);
  if (!email) return res.status(400).json({ error: "A valid email is required" });
  if (!isMemberRole(role)) return res.status(400).json({ error: "role must be 'staff' or 'viewer'" });
  if (req.profile?.email && email === req.profile.email.toLowerCase()) {
    return res.status(400).json({ error: "You cannot invite yourself" });
  }

  try {
    const db = getSupabaseClient();
    const biz = await loadBusiness(businessId);
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const found = await findOrInviteUser(email, name);
    if ("error" in found) return res.status(found.status).json({ error: found.error });
    const { user, created } = found;

    if (user.id === biz.owner_id) return res.status(400).json({ error: "That user already owns this business" });
    if (user.id === req.user?.id) return res.status(400).json({ error: "You cannot invite yourself" });
    if ((user.role || "").toLowerCase().replace(/[^a-z]/g, "") === "superadmin") {
      return res.status(400).json({ error: "Super admins already have access to every business" });
    }

    // A brand-new invited user would otherwise default to business_owner
    // (signup trigger). Give them the invited role as their global role so the
    // server's role-based write gate matches their membership.
    if (created) {
      await db.from("users").update({ role }).eq("id", user.id);
    }

    const { data: row, error } = await db
      .from("business_members")
      .upsert(
        { business_id: businessId, user_id: user.id, role, invited_by: req.user?.id ?? null },
        { onConflict: "business_id,user_id" },
      )
      .select("id, business_id, user_id, role, created_at")
      .single();
    if (error || !row) {
      reqLog(req).error({ err: error }, "business_members upsert failed");
      return res.status(500).json({ error: "Failed to add team member" });
    }

    await writeAudit(req, {
      action: "permission_change",
      resourceType: "business_member",
      resourceId: (row as MemberRow).id,
      businessId,
      details: { event: "invite", target_user_id: user.id, target_email: email, role, new_auth_user: created },
    });

    const member = await serializeMember(row as MemberRow, { email: user.email ?? email, name: user.name ?? name });
    if (created) member.status = "invited";
    return res.status(201).json(member);
  } catch (err) {
    reqLog(req).error({ err }, "invite member failed");
    return res.status(500).json({ error: "Failed to add team member" });
  }
}

// PATCH /api/team/:businessId/members/:memberId  { role }
export async function handleUpdateMember(req: Request, res: Response) {
  const businessId = validBusinessId(req, res);
  if (!businessId) return;
  if (!requireOwner(req, res, businessId)) return;
  const { memberId } = req.params;
  if (typeof memberId !== "string" || !UUID_RE.test(memberId)) return res.status(400).json({ error: "Invalid member id" });
  const role = req.body?.role;
  if (!isMemberRole(role)) return res.status(400).json({ error: "role must be 'staff' or 'viewer'" });

  try {
    const db = getSupabaseClient();
    const { data: existing } = await db
      .from("business_members")
      .select("id, business_id, user_id, role, created_at")
      .eq("id", memberId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Member not found" });

    const { data: row, error } = await db
      .from("business_members")
      .update({ role })
      .eq("id", memberId)
      .eq("business_id", businessId)
      .select("id, business_id, user_id, role, created_at")
      .single();
    if (error || !row) {
      reqLog(req).error({ err: error }, "business_members update failed");
      return res.status(500).json({ error: "Failed to update team member" });
    }

    await writeAudit(req, {
      action: "permission_change",
      resourceType: "business_member",
      resourceId: memberId,
      businessId,
      details: { event: "role_change", target_user_id: (existing as MemberRow).user_id, from: (existing as MemberRow).role, to: role },
    });

    const { data: u } = await db.from("users").select("email, name").eq("id", (row as MemberRow).user_id).maybeSingle();
    return res.json(await serializeMember(row as MemberRow, (u as any) ?? null));
  } catch (err) {
    reqLog(req).error({ err }, "update member failed");
    return res.status(500).json({ error: "Failed to update team member" });
  }
}

// DELETE /api/team/:businessId/members/:memberId
export async function handleRemoveMember(req: Request, res: Response) {
  const businessId = validBusinessId(req, res);
  if (!businessId) return;
  if (!requireOwner(req, res, businessId)) return;
  const { memberId } = req.params;
  if (typeof memberId !== "string" || !UUID_RE.test(memberId)) return res.status(400).json({ error: "Invalid member id" });

  try {
    const db = getSupabaseClient();
    const { data: existing } = await db
      .from("business_members")
      .select("id, business_id, user_id, role, created_at")
      .eq("id", memberId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "Member not found" });

    // Membership only. The auth user is kept: they may belong to other businesses.
    const { error } = await db.from("business_members").delete().eq("id", memberId).eq("business_id", businessId);
    if (error) {
      reqLog(req).error({ err: error }, "business_members delete failed");
      return res.status(500).json({ error: "Failed to remove team member" });
    }

    // If this was their last access anywhere, end their live sessions so a
    // still-valid token can't keep a stale workspace UI open. Data access is
    // already cut by RLS the instant the membership row is gone.
    const removedUserId = (existing as MemberRow).user_id;
    try {
      const [{ count: owns }, { count: memberOf }] = await Promise.all([
        db.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", removedUserId),
        db.from("business_members").select("id", { count: "exact", head: true }).eq("user_id", removedUserId),
      ]);
      if ((owns ?? 0) === 0 && (memberOf ?? 0) === 0) {
        await db.rpc("revoke_user_sessions", { p_user_id: removedUserId });
      }
    } catch (revokeErr) {
      reqLog(req).warn({ err: revokeErr }, "revoke_user_sessions after removal failed (access already cut by RLS)");
    }

    await writeAudit(req, {
      action: "delete",
      resourceType: "business_member",
      resourceId: memberId,
      businessId,
      details: { event: "remove", target_user_id: removedUserId, role: (existing as MemberRow).role },
    });
    return res.status(204).end();
  } catch (err) {
    reqLog(req).error({ err }, "remove member failed");
    return res.status(500).json({ error: "Failed to remove team member" });
  }
}

// POST /api/admin/staff/invite  { email, name?, role: 'super_admin' }
export async function handleInviteStaff(req: Request, res: Response) {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const email = normalizeEmail(req.body?.email);
  const name = normalizeName(req.body?.name);
  if (!email) return res.status(400).json({ error: "A valid email is required" });
  if (req.body?.role !== "super_admin") return res.status(400).json({ error: "role must be 'super_admin'" });

  try {
    const db = getSupabaseClient();
    const found = await findOrInviteUser(email, name);
    if ("error" in found) return res.status(found.status).json({ error: found.error });
    const { user, created } = found;

    // Service role: auth.uid() is null, so guard_user_privileged_columns allows it.
    const { error } = await db.from("users").update({ role: "super_admin" }).eq("id", user.id);
    if (error) {
      reqLog(req).error({ err: error }, "users.role update failed");
      return res.status(500).json({ error: "Failed to grant super admin" });
    }

    await writeAudit(req, {
      action: "permission_change",
      resourceType: "user",
      resourceId: user.id,
      details: { event: "staff_invite", target_email: email, role: "super_admin", previous_role: user.role, new_auth_user: created },
    });

    return res.status(201).json({
      id: user.id,
      email: user.email ?? email,
      name: user.name ?? name,
      role: "super_admin",
      status: created ? "invited" : "active",
    });
  } catch (err) {
    reqLog(req).error({ err }, "staff invite failed");
    return res.status(500).json({ error: "Failed to invite staff" });
  }
}

// ── Routers ──────────────────────────────────────────────────────────────────

/** Mount at /api/team */
export const teamRouter = Router();
teamRouter.use(requireAuth);
teamRouter.get("/:businessId", handleGetTeam);
teamRouter.post("/:businessId/invite", inviteLimiter, handleInviteMember);
teamRouter.patch("/:businessId/members/:memberId", handleUpdateMember);
teamRouter.delete("/:businessId/members/:memberId", handleRemoveMember);

/** Mount at /api/admin/staff */
export const adminStaffRouter = Router();
adminStaffRouter.use(requireAuth, requireRole("super_admin"));
adminStaffRouter.post("/invite", staffInviteLimiter, handleInviteStaff);
