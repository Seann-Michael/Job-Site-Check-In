import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import {
  signPayload,
  signWithTimestamp,
  verifySignature,
  generateSecret,
  parseTimestamp,
  claimSignature,
  resetSeenSignatures,
  DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
} from "../lib/webhookSignature";

describe("webhook HMAC (timestamped)", () => {
  const secret = generateSecret();
  const body = JSON.stringify({ hello: "world", n: 1 });
  const now = 1_700_000_000_000; // ms
  const ts = Math.floor(now / 1000);

  it("round-trips sign/verify", () => {
    const sig = signPayload(secret, body, ts);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifySignature(secret, body, sig, String(ts), { now })).toEqual({ ok: true });
    expect(verifySignature(secret, Buffer.from(body), sig, String(ts), { now })).toEqual({ ok: true });
  });

  it("signWithTimestamp produces matching headers", () => {
    const { signature, timestamp } = signWithTimestamp(secret, body, now);
    expect(timestamp).toBe(String(ts));
    expect(verifySignature(secret, body, signature, timestamp, { now })).toEqual({ ok: true });
  });

  it("accepts a bare hex digest", () => {
    const hex = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(verifySignature(secret, body, hex, String(ts), { now })).toEqual({ ok: true });
    expect(verifySignature(secret, body, hex.toUpperCase(), String(ts), { now })).toEqual({ ok: true });
  });

  it("rejects replayed / stale timestamps (|now - ts| > 300s)", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body, sig, String(ts), { now: now + 301_000 })).toEqual({ ok: false, reason: "stale" });
    expect(verifySignature(secret, body, sig, String(ts), { now: now - 301_000 })).toEqual({ ok: false, reason: "stale" });
    // Inside the window is fine.
    expect(verifySignature(secret, body, sig, String(ts), { now: now + 299_000 })).toEqual({ ok: true });
  });

  it("rejects a signature computed without the timestamp prefix", () => {
    const legacy = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifySignature(secret, body, legacy, String(ts), { now })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a valid signature paired with a different timestamp", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body, sig, String(ts + 1), { now })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects missing or malformed timestamps", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body, sig, undefined, { now })).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(verifySignature(secret, body, sig, "abc", { now })).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(verifySignature(secret, body, sig, "1700000000000", { now })).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(parseTimestamp("12.5")).toBeNull();
    expect(parseTimestamp("1700000000")).toBe(1_700_000_000);
  });

  it("rejects tampered bodies, wrong secrets, and malformed headers", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body + " ", sig, String(ts), { now }).ok).toBe(false);
    expect(verifySignature(generateSecret(), body, sig, String(ts), { now }).ok).toBe(false);
    expect(verifySignature(secret, body, "sha256=deadbeef", String(ts), { now }).ok).toBe(false);
    expect(verifySignature(secret, body, "", String(ts), { now }).ok).toBe(false);
    expect(verifySignature(secret, body, undefined, String(ts), { now }).ok).toBe(false);
    expect(verifySignature(undefined, body, sig, String(ts), { now }).ok).toBe(false);
    expect(verifySignature("", body, sig, String(ts), { now }).ok).toBe(false);
  });
});

describe("replay protection (single-use signatures)", () => {
  const secret = generateSecret();
  const body = JSON.stringify({ replay: true });
  const now = 1_800_000_000_000;
  const ts = Math.floor(now / 1000);

  beforeEach(() => resetSeenSignatures());

  it("accepts a signature once and rejects the same one again", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body, sig, String(ts), { now, replayScope: "wf-1" })).toEqual({ ok: true });
    expect(verifySignature(secret, body, sig, String(ts), { now, replayScope: "wf-1" })).toEqual({
      ok: false,
      reason: "replayed",
    });
    // Still rejected later in the window.
    expect(verifySignature(secret, body, sig, String(ts), { now: now + 200_000, replayScope: "wf-1" })).toEqual({
      ok: false,
      reason: "replayed",
    });
  });

  it("scopes the store per workflow", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body, sig, String(ts), { now, replayScope: "wf-1" }).ok).toBe(true);
    expect(verifySignature(secret, body, sig, String(ts), { now, replayScope: "wf-2" }).ok).toBe(true);
  });

  it("does not apply the check when no scope is given", () => {
    const sig = signPayload(secret, body, ts);
    expect(verifySignature(secret, body, sig, String(ts), { now }).ok).toBe(true);
    expect(verifySignature(secret, body, sig, String(ts), { now }).ok).toBe(true);
  });

  it("accepts a bare hex digest and its sha256= form as the same signature", () => {
    const sig = signPayload(secret, body, ts);
    const bare = sig.replace(/^sha256=/, "");
    expect(verifySignature(secret, body, sig, String(ts), { now, replayScope: "wf-1" }).ok).toBe(true);
    expect(verifySignature(secret, body, bare, String(ts), { now, replayScope: "wf-1" })).toEqual({
      ok: false,
      reason: "replayed",
    });
  });

  it("forgets a signature once the tolerance window has passed", () => {
    const ttlMs = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS * 1000;
    expect(claimSignature("wf-1", "abc", { now })).toBe(true);
    expect(claimSignature("wf-1", "abc", { now: now + ttlMs - 1 })).toBe(false);
    expect(claimSignature("wf-1", "abc", { now: now + ttlMs + 1 })).toBe(true);
  });
});
