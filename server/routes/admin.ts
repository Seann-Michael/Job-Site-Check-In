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
 * Every call is written to `audit_logs`.
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

  try {
    // Resolve the target user's email from the profile table.
    const { data: target, error: lookupError } = await db
      .from("users")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const targetEmail = (target as any)?.email as string | undefined;
    if (!target || !targetEmail) {
      return res.status(404).json({ error: "Target user not found" });
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
      logger.error("[admin] generateLink returned no email_otp");
      return res.status(502).json({ error: "Failed to mint impersonation token" });
    }

    // Audit trail. Never block the response on a logging failure, but do log
    // the failure server-side.
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
      logger.error({ err: auditError.message }, "[admin] failed to write impersonation audit log");
    }

    return res.json({ email: targetEmail, token, actionLink });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[admin] impersonate failed");
    return res.status(500).json({ error: "Failed to impersonate user" });
  }
}
