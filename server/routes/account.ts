import type { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";

const log = logger.child({ module: "account" });

const CONFIRM_WORD = "DELETE";
const STORAGE_CHUNK = 100;

/**
 * DELETE /api/auth/account  (requireAuth)   body: { confirm: "DELETE" }
 *
 * Permanently deletes the caller's account. Required by the App Store for any
 * app that lets people create one.
 *
 *  - A business the caller OWNS is deleted with everything in it.
 *  - A business they only work for is untouched; they are removed from it.
 *  - A super admin cannot delete themselves here.
 *
 * Order matters:
 *  1. `delete_account` removes every database row in one transaction and
 *     returns the stored files that belonged to the deleted businesses.
 *  2. The sign-in itself is removed. If this fails the data is already gone and
 *     the sign-in is orphaned, so it is logged loudly for manual removal — the
 *     caller is still told the deletion succeeded, because it did.
 *  3. Files are removed last, best-effort: an orphaned file is invisible (no
 *     row points at it and the bucket is private) and is logged for clean-up.
 *
 * The caller is identified only from the verified token. Nothing in the body
 * can name a different account.
 */
export async function handleDeleteAccount(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  if (body.confirm !== CONFIRM_WORD) {
    return res.status(400).json({ error: `Type ${CONFIRM_WORD} to confirm` });
  }
  if (req.profile?.isSuperAdmin) {
    return res.status(403).json({ error: "An administrator account cannot be deleted here" });
  }

  const db = getSupabaseClient();

  const { data, error } = await db.rpc("delete_account", { p_user_id: userId });
  if (error) {
    if (/super_admin_cannot_self_delete/.test(error.message || "")) {
      return res.status(403).json({ error: "An administrator account cannot be deleted here" });
    }
    log.error({ err: error.message, userId }, "delete_account failed");
    return res.status(500).json({ error: "The account could not be deleted. Nothing was removed." });
  }

  const summary = (data && typeof data === "object" ? data : {}) as {
    businesses_deleted?: number;
    jobs_deleted?: number;
    storage_paths?: unknown;
  };

  const { error: authErr } = await db.auth.admin.deleteUser(userId);
  if (authErr) {
    log.error({ err: authErr.message, userId }, "account data deleted but the sign-in could not be removed");
  }

  const paths = Array.isArray(summary.storage_paths)
    ? summary.storage_paths.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  let filesRemoved = 0;
  for (let i = 0; i < paths.length; i += STORAGE_CHUNK) {
    const chunk = paths.slice(i, i + STORAGE_CHUNK);
    try {
      const { error: rmErr } = await db.storage.from("media").remove(chunk);
      if (rmErr) log.error({ err: rmErr.message, userId, count: chunk.length }, "account files could not be removed");
      else filesRemoved += chunk.length;
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err), userId }, "account file removal threw");
    }
  }

  log.info(
    { userId, businesses: summary.businesses_deleted ?? 0, jobs: summary.jobs_deleted ?? 0, files: filesRemoved },
    "account deleted",
  );
  return res.json({
    success: true,
    businessesDeleted: summary.businesses_deleted ?? 0,
  });
}
