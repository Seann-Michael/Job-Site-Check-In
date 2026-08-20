import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./lib/env";

let _client: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the SERVICE ROLE key. Lazily created on
 * first use so importing server modules never requires env at load time
 * (the Vite client build imports the server for its dev middleware).
 *
 * Throws if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured. There
 * is deliberately no fallback to the anon key: the server must never run
 * with reduced privileges silently.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = getEnv("SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Fresh Supabase client using the ANON (public) key, with no session
 * persistence. Used to *verify* a user-supplied password via
 * `signInWithPassword` without touching the service-role singleton (and
 * without ever caching that session). A new client is returned per call so
 * concurrent verifications never share auth state.
 *
 * Returns null when SUPABASE_ANON_KEY (alias VITE_SUPABASE_ANON_KEY) is not
 * configured, so callers can respond 503 rather than crash.
 */
export function createAnonClient(): SupabaseClient | null {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Test hook: replace the singleton (used by vitest). */
export function __setSupabaseClientForTests(client: SupabaseClient | null) {
  _client = client;
}
