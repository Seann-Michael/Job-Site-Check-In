import { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";

/**
 * POST /api/admin/impersonate  (requireAuth + super_admin)
 *
 * Lets a super_admin obtain a session for another user WITHOUT their password.
 * Supabase's admin API cannot mint a session token directly, so we generate a
 * one-time magic-link OTP for the target user's email and hand it back. The
 * client completes impersonation by calling:
 *
 *   supabase.auth.verifyOtp({ email, token, type: "magiclink" })
 *
 * which returns a real session for the target user.
 *
 * Body: { userId }
 * Response: { email, token, actionLink }
 *   - `email`      target user's email (pass to verifyOtp)
 *   - `token`      one-time OTP (pass as `token` to verifyOtp)
 *   - `actionLink` full magic-link URL (alternative to verifyOtp; opens a session)
 *
 * Every call is written to `audit_logs` BEFORE the token is minted; if the
 * audit insert fails the request fails (500) and no token is issued.
 * Targets with role super_admin cannot be impersonated (403). The target's
 * email comes from Supabase Auth (`auth.admin.getUserById`), not `public.users`.
 *
 * NOTE: the requireRole('super_admin') guard runs before this handler; the
 * check below is defense-in-depth in case the route is ever wired without it.
 */
export async function handleImpersonate(req: Request, res: Response) {
  const caller = req.user;
  const profile = req.profile;
  if (!caller?.id || !profile) {
    return res.status(401).json({ error: "Authentication required" });
  }
  // normalizeRole in requireAuth collapses "super_admin" -> "superadmin".
  if ((profile.role || "").toLowerCase().replace(/[^a-z]/g, "") !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }
  if (userId === caller.id) {
    return res.status(400).json({ error: "Cannot impersonate yourself" });
  }

  const db = getSupabaseClient();
  const log = req.log ?? logger;

  try {
    // Resolve the target from Supabase Auth (source of truth for email), then
    // check the target's role from the profile table: super_admins may never
    // be impersonated.
    const { data: targetAuth, error: lookupError } = await db.auth.admin.getUserById(userId);
    if (lookupError && !/not\s*found/i.test(lookupError.message || "")) throw lookupError;

    const targetEmail = targetAuth?.user?.email as string | undefined;
    if (!targetAuth?.user || !targetEmail) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const { data: targetProfile, error: roleError } = await db
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (roleError) throw roleError;
    const targetRole = ((targetProfile as any)?.role || "").toLowerCase().replace(/[^a-z]/g, "");
    if (targetRole === "superadmin") {
      log.warn({ actorId: caller.id, targetId: userId }, "[admin] refused to impersonate a super_admin");
      return res.status(403).json({ error: "Cannot impersonate another super_admin" });
    }

    // Audit trail is written BEFORE any token is minted and fails closed: if
    // the audit row cannot be recorded, no impersonation happens.
    const { error: auditError } = await db.from("audit_logs").insert({
      user_id: caller.id,
      action: "login",
      resource_type: "user",
      resource_id: userId,
      details: {
        event: "impersonate",
        actor_id: caller.id,
        actor_email: caller.email,
        target_id: userId,
        target_email: targetEmail,
      },
      ip_address: req.ip ?? null,
      user_agent: req.headers["user-agent"] ?? null,
    });
    if (auditError) {
      log.error({ err: auditError.message }, "[admin] failed to write impersonation audit log; refusing");
      return res.status(500).json({ error: "Failed to record audit log" });
    }

    // Mint a one-time magic-link OTP for the target (no password needed).
    const { data: link, error: linkError } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });
    if (linkError) throw linkError;

    const props = (link as any)?.properties ?? {};
    const token = props.email_otp as string | undefined;
    const actionLink = props.action_link as string | undefined;
    if (!token) {
      log.error("[admin] generateLink returned no email_otp");
      return res.status(502).json({ error: "Failed to mint impersonation token" });
    }

    return res.json({ email: targetEmail, token, actionLink });
  } catch (err: any) {
    log.error({ err: err?.message }, "[admin] impersonate failed");
    return res.status(500).json({ error: "Failed to impersonate user" });
  }
}
