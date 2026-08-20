import crypto from "crypto";

/**
 * HMAC-SHA256 webhook signatures.
 *
 * Outbound: `X-Webhook-Signature: sha256=<hex>` over the raw body.
 * Inbound: the same scheme is required on /api/workflows/webhook/:id.
 * A bare hex digest (no `sha256=` prefix) is also accepted on verify.
 */

export function signPayload(secret: string, rawBody: string | Buffer): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifySignature(
  secret: string | undefined | null,
  rawBody: string | Buffer | undefined,
  header: string | undefined | null,
): boolean {
  if (!secret || !header || rawBody === undefined) return false;
  const provided = String(header).trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
