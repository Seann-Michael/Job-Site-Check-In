import { Request, Response } from "express";
import { getSupabaseClient, createAnonClient } from "../supabaseClient";
import { logger } from "../lib/logger";

/**
 * POST /api/auth/logout
 * Server-side logout acknowledgment. The client destroys its own Supabase
 * session; this endpoint just exists so the client hook doesn't throw on a
 * missing route.
 */
export async function handleLogout(_req: Request, res: Response) {
  return res.json({ success: true });
}

/**
 * POST /api/auth/change-password  (requireAuth)
 * Changes the CURRENT user's password only. The caller is identified from the
 * verified bearer token (req.user), never from the request body.
 *
 * Body: { oldPassword, newPassword }
 *  1. Verify `oldPassword` by signing in as req.user.email with an anon client
 *     (a fresh, non-persisted client). A failure -> 400 (bad current password).
 *  2. Set the new password via the service-role admin API.
 *
 * newPassword must be >= 8 chars.
 */
export async function handleChangePassword(req: Request, res: Response) {
  const { oldPassword, newPassword } = req.body as {
    oldPassword?: string;
    newPassword?: string;
  };

  if (!req.user?.id || !req.user.email) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "oldPassword and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // 1. Verify the current password with an anon client so we never trust the
  //    caller's claim that they know it. Fresh client -> no cached session.
  const anon = createAnonClient();
  if (!anon) {
    return res.status(503).json({ error: "Auth service unavailable" });
  }

  try {
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
      email: req.user.email,
      password: oldPassword,
    });
    if (signInError || !signIn?.user) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    // Defensive: the signed-in identity must match the token holder.
    if (signIn.user.id !== req.user.id) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // 2. Apply the new password with the service-role admin API.
    const db = getSupabaseClient();
    const { error } = await db.auth.admin.updateUserById(req.user.id, {
      password: newPassword,
    });
    if (error) throw error;

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[authApi] change-password failed");
    return res.status(500).json({ error: "Failed to change password" });
  }
}
