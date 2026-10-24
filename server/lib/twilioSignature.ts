import crypto from "crypto";

/**
 * Twilio request signature verification (`X-Twilio-Signature`).
 *
 * The `twilio` helper library is not a dependency, so the documented scheme is
 * implemented here:
 *
 *   1. Take the full URL Twilio requested (scheme + host + path + query).
 *   2. Append each POST parameter, sorted by key, as `key` + `value` with no
 *      separators.
 *   3. HMAC-SHA1 that string with the account's auth token, base64-encode it.
 *   4. Compare against the `X-Twilio-Signature` header in constant time.
 *
 * See https://www.twilio.com/docs/usage/security#validating-requests.
 */

/** Build the string Twilio signs for a form-encoded POST. */
export function twilioSignedString(url: string, params: Record<string, string>): string {
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  return data;
}

/** Compute the base64 HMAC-SHA1 signature for a Twilio request. */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  return crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(twilioSignedString(url, params), "utf8"))
    .digest("base64");
}

/**
 * Constant-time check of a provided `X-Twilio-Signature` header. Returns false
 * for a missing token, a missing/!string header, or any mismatch — callers
 * must fail closed on false.
 */
export function verifyTwilioSignature(
  authToken: string | undefined | null,
  url: string | undefined | null,
  params: Record<string, string>,
  header: unknown,
): boolean {
  if (!authToken || !url) return false;
  if (typeof header !== "string" || header.length === 0) return false;
  const expected = computeTwilioSignature(authToken, url, params);
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Flatten a parsed form body into the `Record<string, string>` Twilio signs.
 * Non-string values (arrays / nested objects produced by the extended
 * urlencoded parser from crafted input) are dropped rather than coerced, so a
 * caller cannot influence the signed string through parser quirks.
 */
export function twilioParamsFromBody(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body || typeof body !== "object") return out;
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Parse the raw form-encoded body into the exact params Twilio signed. */
export function twilioParamsFromRawBody(raw: Buffer | string): Record<string, string> {
  const out: Record<string, string> = {};
  const search = new URLSearchParams(typeof raw === "string" ? raw : raw.toString("utf8"));
  for (const [k, v] of search) out[k] = v;
  return out;
}
