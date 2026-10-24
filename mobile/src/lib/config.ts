/**
 * Runtime configuration for the app — ONE place that answers "where is the
 * web dashboard / API?".
 *
 * Resolution order (first non-empty wins):
 *   1. EXPO_PUBLIC_* env at build time (.env / EAS secrets)
 *   2. `expo.extra` in app.json — the committed production values
 *   3. '' (feature disabled; callers must handle that)
 *
 * Every screen and lib that used to read process.env.EXPO_PUBLIC_APP_URL /
 * EXPO_PUBLIC_API_BASE_URL directly goes through here now. The TestFlight
 * build shipped without a .env, which silently switched off share links,
 * review links, help, billing and publishing — the app.json fallback is what
 * keeps a store build wired to production.
 */
import Constants from 'expo-constants';

const EXTRA = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

function pick(env: string | undefined, extra: string | undefined): string {
  const fromEnv = clean(env);
  if (fromEnv) return fromEnv;
  return clean(extra);
}

/** Public web dashboard, e.g. https://app.mylocalseoranker.com. '' when unset. */
export const APP_URL = pick(process.env.EXPO_PUBLIC_APP_URL, EXTRA.appUrl);

/** Express API base (same host as the web app in production). '' when unset. */
export const API_BASE_URL = pick(process.env.EXPO_PUBLIC_API_BASE_URL, EXTRA.apiBaseUrl) || APP_URL;

/** GoHighLevel / publish workflow id (optional). */
export const PUBLISH_WEBHOOK_ID = pick(
  process.env.EXPO_PUBLIC_PUBLISH_WEBHOOK_ID,
  EXTRA.publishWebhookId,
);

/** Google Maps / Places browser key (optional; address autocomplete). */
export const GOOGLE_MAPS_API_KEY = pick(
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  EXTRA.googleMapsApiKey,
);

const HTTPS_ORIGIN = /^https?:\/\/[^\s/]+$/i;

/**
 * The web app origin when it is a well-formed http(s) origin, else null.
 * Links built from this get texted to customers, so a malformed value is
 * treated as "no link" rather than guessed at.
 */
export function webOrigin(): string | null {
  return HTTPS_ORIGIN.test(APP_URL) ? APP_URL : null;
}

/** Absolute dashboard URL for a path such as '/admin/settings', or null. */
export function webUrl(path: string): string | null {
  const origin = webOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export const isApiConfigured = Boolean(API_BASE_URL);
