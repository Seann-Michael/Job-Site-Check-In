import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

/**
 * Server-side Supabase client using the service role key for full DB access.
 * Lazy-initialised — returns null if env vars are missing (prevents startup crash).
 */
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB features disabled on server.",
    );
    return null;
  }
  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}
