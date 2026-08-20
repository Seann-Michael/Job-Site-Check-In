import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { signPayload, verifySignature, generateSecret } from "../lib/webhookSignature";

describe("webhook HMAC", () => {
  const secret = generateSecret();
  const body = JSON.stringify({ hello: "world", n: 1 });

  it("round-trips sign/verify", () => {
    const sig = signPayload(secret, body);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifySignature(secret, body, sig)).toBe(true);
    expect(verifySignature(secret, Buffer.from(body), sig)).toBe(true);
  });

  it("accepts a bare hex digest", () => {
    const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifySignature(secret, body, hex)).toBe(true);
    expect(verifySignature(secret, body, hex.toUpperCase())).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets, and malformed headers", () => {
    const sig = signPayload(secret, body);
    expect(verifySignature(secret, body + " ", sig)).toBe(false);
    expect(verifySignature(generateSecret(), body, sig)).toBe(false);
    expect(verifySignature(secret, body, "sha256=deadbeef")).toBe(false);
    expect(verifySignature(secret, body, "")).toBe(false);
    expect(verifySignature(secret, body, undefined)).toBe(false);
    expect(verifySignature(undefined, body, sig)).toBe(false);
    expect(verifySignature("", body, sig)).toBe(false);
  });
});
