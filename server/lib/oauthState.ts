import crypto from "crypto";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";

/**
 * Single-use OAuth `state` nonces with a 10 minute TTL, stored in
 * `public.oauth_states` (service-role only, see migration
 * 20260820007000_oauth_states.sql) so they survive restarts and work across
 * multiple API instances.
 */
export interface OAuthStateData {
  workspace_id: string;
  user_id: string;
  created_at: number;
}

const log = logger.child({ module: "oauthState" });
const TABLE = "oauth_states";
const TTL_MS = 10 * 60 * 1000;

/** Fire-and-forget removal of expired rows. */
function sweepExpired(now: number) {
  try {
    void getSupabaseClient()
      .from(TABLE)
      .delete()
      .lt("expires_at", new Date(now).toISOString())
      .then(({ error }) => {
        if (error) log.warn({ err: error }, "oauth_states sweep failed");
      });
  } catch (err) {
    log.warn({ err }, "oauth_states sweep failed");
  }
}

/** Create a nonce (192-bit, base64url) bound to `data`, valid for 10 minutes. */
export async function createOAuthState(data: Omit<OAuthStateData, "created_at">): Promise<string> {
  const now = Date.now();
  sweepExpired(now);
  const nonce = crypto.randomBytes(24).toString("base64url");
  const payload: OAuthStateData = { ...data, created_at: now };
  const { error } = await getSupabaseClient().from(TABLE).insert({
    state: nonce,
    payload,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + TTL_MS).toISOString(),
  });
  if (error) {
    log.error({ err: error }, "Failed to persist OAuth state");
    throw new Error("Could not create OAuth state");
  }
  return nonce;
}

/**
 * Consume (one-shot) a nonce; returns null if unknown or expired. A single
 * conditional DELETE ... RETURNING makes this atomic: two concurrent
 * callbacks with the same nonce cannot both succeed.
 */
export async function consumeOAuthState(nonce: string | undefined): Promise<OAuthStateData | null> {
  if (!nonce || typeof nonce !== "string" || nonce.length > 128) return null;
  const { data, error } = await getSupabaseClient()
    .from(TABLE)
    .delete()
    .eq("state", nonce)
    .gt("expires_at", new Date().toISOString())
    .select("payload");
  if (error) {
    log.error({ err: error }, "Failed to consume OAuth state");
    return null;
  }
  const row = Array.isArray(data) ? data[0] : null;
  const payload = row?.payload as Partial<OAuthStateData> | undefined;
  if (!payload || typeof payload.workspace_id !== "string" || typeof payload.user_id !== "string") return null;
  return {
    workspace_id: payload.workspace_id,
    user_id: payload.user_id,
    created_at: typeof payload.created_at === "number" ? payload.created_at : 0,
  };
}
