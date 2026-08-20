import { logger } from "./logger";

/**
 * Canonical env var names, with legacy VITE_* aliases accepted for backward
 * compatibility. Always read env through these helpers so aliasing lives in
 * one place.
 */
const ALIASES: Record<string, string[]> = {
  SUPABASE_URL: ["VITE_SUPABASE_URL"],
  SUPABASE_ANON_KEY: ["VITE_SUPABASE_ANON_KEY"],
  GOOGLE_MAPS_API_KEY: ["VITE_GOOGLE_MAPS_API_KEY"],
  APP_URL: ["VITE_APP_URL"],
};

export function getEnv(name: string): string | undefined {
  const direct = process.env[name];
  if (direct) return direct;
  for (const alias of ALIASES[name] ?? []) {
    const v = process.env[alias];
    if (v) return v;
  }
  return undefined;
}

export class EnvError extends Error {
  status = 500;
  constructor(name: string) {
    super(`Server misconfigured: ${name} is not set`);
    this.name = "EnvError";
  }
}

/** Read a required env var at request time; throws EnvError (-> 500) if absent. */
export function requireEnv(name: string): string {
  const v = getEnv(name);
  if (!v) throw new EnvError(name);
  return v;
}

/** Public base URL of the app (no trailing slash). Never defaults to localhost. */
export function getAppUrl(): string {
  return requireEnv("APP_URL").replace(/\/+$/, "");
}

// Only the two Supabase vars are truly required for the app to function.
// APP_URL is needed for OAuth redirects and outbound webhook URLs (deferred
// features); if it's absent the server still boots and getAppUrl() returns a
// 500 only for the specific endpoints that need it, rather than crashing.
const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const OPTIONAL: Array<[string, string]> = [
  ["APP_URL", "OAuth redirects & webhook URLs (defaults to same-origin for CORS)"],
  ["SUPABASE_ANON_KEY", "Self-service password change (old-password verification)"],
  ["STRIPE_SECRET_KEY", "Payments (Stripe)"],
  ["PAYPAL_CLIENT_ID", "Payments (PayPal)"],
  ["PAYPAL_CLIENT_SECRET", "Payments (PayPal)"],
  ["TWILIO_ACCOUNT_SID", "SMS / Review Requests"],
  ["TWILIO_AUTH_TOKEN", "SMS / Review Requests"],
  ["TWILIO_PHONE_NUMBER", "SMS / Review Requests"],
  ["OPENAI_API_KEY", "AI features"],
  ["GOOGLE_MAPS_API_KEY", "Google Maps / Place Lookup"],
  ["GOOGLE_OAUTH_CLIENT_ID", "Google Business Profile OAuth"],
  ["GOOGLE_OAUTH_CLIENT_SECRET", "Google Business Profile OAuth"],
  ["DATAFORSEO_USERNAME", "DataForSEO rank tracking"],
  ["DATAFORSEO_PASSWORD", "DataForSEO rank tracking"],
  ["CORS_ORIGINS", "CORS allowlist (defaults to APP_URL)"],
];

let validated = false;

/**
 * Validate environment at startup. Throws if a REQUIRED variable is missing;
 * warns once for OPTIONAL ones. Skipped under NODE_ENV=test unless forced.
 */
export function validateEnv(opts: { force?: boolean } = {}): void {
  if (validated && !opts.force) return;
  validated = true;

  const missing = REQUIRED.filter((k) => !getEnv(k));
  if (missing.length) {
    const msg = `Missing required environment variables: ${missing.join(", ")}`;
    logger.fatal({ missing }, msg);
    throw new Error(msg);
  }

  const missingOptional = OPTIONAL.filter(([k]) => !getEnv(k));
  if (missingOptional.length) {
    logger.warn(
      { missing: missingOptional.map(([k, f]) => `${k} (${f})`) },
      "Optional environment variables not set; related features are disabled",
    );
  }
}
