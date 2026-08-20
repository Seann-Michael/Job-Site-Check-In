import crypto from "crypto";

/**
 * In-memory, single-use OAuth `state` nonces with a 10 minute TTL.
 * Good enough for a single-instance deployment; swap for a shared store if
 * the API is ever scaled horizontally.
 */
export interface OAuthStateData {
  workspace_id: string;
  user_id: string;
  created_at: number;
}

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, OAuthStateData>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.created_at > TTL_MS) store.delete(k);
  }
}

export function createOAuthState(data: Omit<OAuthStateData, "created_at">): string {
  sweep();
  const nonce = crypto.randomBytes(24).toString("base64url");
  store.set(nonce, { ...data, created_at: Date.now() });
  return nonce;
}

/** Consume (one-shot) a nonce; returns null if unknown or expired. */
export function consumeOAuthState(nonce: string | undefined): OAuthStateData | null {
  if (!nonce) return null;
  const entry = store.get(nonce);
  store.delete(nonce);
  if (!entry || Date.now() - entry.created_at > TTL_MS) return null;
  return entry;
}

export function __clearOAuthStateForTests() {
  store.clear();
}
