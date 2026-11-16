/**
 * Phone normalisation, shared by anything that has to compare or emit a number.
 *
 * It lives on its own rather than inside lib/sms because two unrelated callers
 * need the same answer: the SMS sender, which must match a stored number
 * against the opt-out list, and the public page renderer, which emits a `tel:`
 * link. A `tel:` href without a country code dials unreliably from outside the
 * number's own country, so "(216) 296-3191" and "+12162963191" have to resolve
 * to the same E.164 string in both places — two implementations would drift.
 */

export const E164_RE = /^\+[1-9]\d{6,14}$/;

/**
 * Best-effort E.164. Keeps digits and a leading +, and assumes +1 for a bare
 * 10-digit number, which is what this product's stored US data looks like.
 * Returns "" when there is nothing dialable.
 */
export function normalisePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}
