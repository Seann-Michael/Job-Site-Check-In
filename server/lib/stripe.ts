import type Stripe from "stripe";

/**
 * Shared Stripe client factory.
 *
 * The Stripe integration is DORMANT until `STRIPE_SECRET_KEY` is set: every
 * caller must treat a `null` return as "Stripe not configured" and respond
 * with a clear 503 (see `stripeUnavailable`). The `stripe` package is imported
 * dynamically so the server never requires it at load time (and never crashes
 * if the dependency is absent in an environment that doesn't use payments).
 *
 * The client is cached per secret key so repeated calls in one process reuse a
 * single instance; if the key changes (tests) a fresh client is built.
 */
let _stripe: Stripe | null = null;
let _forKey: string | null = null;

const STRIPE_API_VERSION = "2023-10-16";

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Returns a Stripe client, or `null` when `STRIPE_SECRET_KEY` is unset.
 * Async because it dynamically imports the `stripe` package on first use.
 */
export async function getStripe(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    _stripe = null;
    _forKey = null;
    return null;
  }
  if (_stripe && _forKey === key) return _stripe;
  const StripeCtor = (await import("stripe")).default;
  _stripe = new StripeCtor(key, { apiVersion: STRIPE_API_VERSION as any });
  _forKey = key;
  return _stripe;
}

/** Standard 503 body for endpoints that require Stripe but it isn't configured. */
export const STRIPE_NOT_CONFIGURED = {
  error: "stripe_not_configured",
  message:
    "Stripe is not configured. Add STRIPE_SECRET_KEY to enable live billing; manual and comp controls still work.",
} as const;

/** Test hook: reset the cached client (used by vitest). */
export function __resetStripeForTests() {
  _stripe = null;
  _forKey = null;
}
