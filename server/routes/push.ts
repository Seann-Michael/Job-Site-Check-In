import type { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { isExpoPushToken } from "../lib/push";

const log = logger.child({ module: "push-routes" });

/**
 * POST /api/push/register  (requireAuth)   body: { token, platform?, deviceName? }
 *
 * Records this phone as a place to notify the signed-in user. The owner is the
 * token holder, never a body field. Re-registering the same token moves it to
 * the current user: one phone, one account.
 */
export async function handlePushRegister(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  if (!isExpoPushToken(body.token)) return res.status(400).json({ error: "A valid push token is required" });

  const platform = body.platform === "android" ? "android" : "ios";
  const deviceName = typeof body.deviceName === "string" ? body.deviceName.trim().slice(0, 120) || null : null;

  const { error } = await getSupabaseClient()
    .from("push_tokens")
    .upsert(
      { user_id: req.user.id, token: body.token, platform, device_name: deviceName, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) {
    log.warn({ err: error.message }, "push token save failed");
    return res.status(503).json({ error: "Notifications are not available right now" });
  }
  return res.status(204).end();
}

/**
 * DELETE /api/push/register  (requireAuth)   body: { token }
 * Called on sign-out, so the next person to use the phone is not sent this
 * account's alerts. Only removes a token that belongs to the caller.
 */
export async function handlePushUnregister(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  if (!isExpoPushToken(body.token)) return res.status(400).json({ error: "A valid push token is required" });

  const { error } = await getSupabaseClient()
    .from("push_tokens")
    .delete()
    .eq("token", body.token)
    .eq("user_id", req.user.id);
  if (error) log.warn({ err: error.message }, "push token delete failed");
  return res.status(204).end();
}
