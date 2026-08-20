import crypto from "crypto";

/**
 * HMAC-SHA256 webhook signatures with replay protection.
 *
 * Signed input is `${timestamp}.${rawBody}` where `timestamp` is unix
 * seconds, sent in `X-Webhook-Timestamp`.
 *
 * Outbound: `X-Webhook-Signature: sha256=<hex>` + `X-Webhook-Timestamp`.
 * Inbound: the same scheme is required on /api/workflows/webhook/:id; the
 * timestamp must be within `toleranceSeconds` (default 300) of server time.
 * A bare hex digest (no `sha256=` prefix) is also accepted on verify.
 */

export const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

function signedInput(timestamp: number, rawBody: string | Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8")]);
}

/** Parse a timestamp header into unix seconds; null when missing/invalid. */
export function parseTimestamp(header: unknown): number | null {
  if (typeof header !== "string" && typeof header !== "number") return null;
  const s = String(header).trim();
  if (!/^\d{1,12}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** Sign a payload for the given timestamp (unix seconds). */
export function signPayload(secret: string, rawBody: string | Buffer, timestamp: number): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(signedInput(timestamp, rawBody)).digest("hex");
}

/** Convenience: sign with the current time; returns both header values. */
export function signWithTimestamp(secret: string, rawBody: string | Buffer, now = Date.now()): { signature: string; timestamp: string } {
  const ts = Math.floor(now / 1000);
  return { signature: signPayload(secret, rawBody, ts), timestamp: String(ts) };
}

export type VerifyFailure = "missing" | "bad_timestamp" | "stale" | "bad_signature";

export function verifySignature(
  secret: string | undefined | null,
  rawBody: string | Buffer | undefined,
  header: string | undefined | null,
  timestampHeader: string | number | undefined | null,
  opts: { toleranceSeconds?: number; now?: number } = {},
): { ok: true } | { ok: false; reason: VerifyFailure } {
  if (!secret || !header || rawBody === undefined) return { ok: false, reason: "missing" };
  const ts = parseTimestamp(timestampHeader);
  if (ts === null) return { ok: false, reason: "bad_timestamp" };
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > tolerance) return { ok: false, reason: "stale" };

  const provided = String(header).trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return { ok: false, reason: "bad_signature" };
  const expected = crypto.createHmac("sha256", secret).update(signedInput(ts, rawBody)).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

export function generateSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
