import { createClient } from "@supabase/supabase-js";

/**
 * Initialize a Supabase client for server-side usage. The URL and API key
 * should be provided via environment variables. On the server we recommend
 * using the service role key (SUPABASE_SERVICE_ROLE_KEY) for full access,
 * but fall back to the anon key (SUPABASE_ANON_KEY) if it's not available.
 */
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL environment variable is required to initialize Supabase client");
}

const supabaseKey = supabaseServiceKey || supabaseAnonKey;
if (!supabaseKey) {
  throw new Error(
    "Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable must be provided"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);