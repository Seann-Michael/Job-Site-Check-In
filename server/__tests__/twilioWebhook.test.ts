import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

/**
 * POST /api/webhooks/twilio — X-Twilio-Signature verification.
 *
 * The endpoint is unauthenticated (Twilio calls it) and performs a
 * service-role write to `sms_logs` keyed on the caller-supplied MessageSid, so
 * the HMAC is the only thing standing between an attacker and that write. It
 * must fail closed whenever TWILIO_AUTH_TOKEN is configured.
 */

const AUTH_TOKEN = "twilio-auth-token-under-test";
const WEBHOOK_PATH = "/api/webhooks/twilio";
const SID = "SM0123456789abcdef0123456789abcdef";

/** Every `sms_logs` update the handler performed. */
const updates: Array<{ payload: any; filters: Record<string, any> }> = [];

function builder(table: string) {
  const filters: Record<string, any> = {};
  let payload: any;
  let op: "select" | "update" = "select";
  const resolve = () => {
    if (op === "update") updates.push({ payload, filters: { ...filters, __table: table } });
    return { data: null, error: null };
  };
  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => ((filters[col] = val), api),
    update: (row: any) => ((op = "update"), (payload = row), api),
    insert: (row: any) => ((op = "update"), (payload = row), api),
    maybeSingle: async () => resolve(),
    single: async () => resolve(),
    then: (ok: any, err?: any) => Promise.resolve(resolve()).then(ok, err),
  };
  return api;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({ from: (t: string) => builder(t) }),
  createAnonClient: () => null,
}));

import { computeTwilioSignature } from "../lib/twilioSignature";
import { createServer } from "../index";

let app: ReturnType<typeof createServer>;
const savedToken = process.env.TWILIO_AUTH_TOKEN;
const savedWebhookUrl = process.env.TWILIO_WEBHOOK_URL;

beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});
beforeEach(() => {
  updates.length = 0;
  process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
  delete process.env.TWILIO_WEBHOOK_URL;
});
afterAll(() => {
  if (savedToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
  else process.env.TWILIO_AUTH_TOKEN = savedToken;
  if (savedWebhookUrl === undefined) delete process.env.TWILIO_WEBHOOK_URL;
  else process.env.TWILIO_WEBHOOK_URL = savedWebhookUrl;
});

/** APP_URL comes from the test setup file. */
const DERIVED_URL = `${process.env.APP_URL}${WEBHOOK_PATH}`;

const post = (params: Record<string, string>, signature?: string) => {
  const req = request(app).post(WEBHOOK_PATH).type("form");
  if (signature !== undefined) req.set("X-Twilio-Signature", signature);
  return req.send(params);
};

const signed = (params: Record<string, string>, url = DERIVED_URL) =>
  computeTwilioSignature(AUTH_TOKEN, url, params);

describe("Twilio webhook signature verification", () => {
  it("accepts a correctly signed request and updates the SMS log", async () => {
    const params = { MessageSid: SID, MessageStatus: "delivered" };
    const res = await post(params, signed(params));
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0].filters.twilio_sid).toBe(SID);
    expect(updates[0].payload.status).toBe("delivered");
  });

  it("403s when the signature header is absent — and writes nothing", async () => {
    const res = await post({ MessageSid: SID, MessageStatus: "delivered" });
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("403s on a wrong signature", async () => {
    const params = { MessageSid: SID, MessageStatus: "delivered" };
    const res = await post(params, computeTwilioSignature("some-other-token", DERIVED_URL, params));
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("403s when a signed body is tampered with in flight", async () => {
    const signature = signed({ MessageSid: SID, MessageStatus: "delivered" });
    const res = await post({ MessageSid: SID, MessageStatus: "failed" }, signature);
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("403s when an extra parameter is appended to a signed body", async () => {
    const signature = signed({ MessageSid: SID, MessageStatus: "delivered" });
    const res = await post({ MessageSid: SID, MessageStatus: "delivered", Extra: "x" }, signature);
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("403s on a signature computed for a different URL (Host header is not trusted)", async () => {
    const params = { MessageSid: SID, MessageStatus: "delivered" };
    const res = await request(app)
      .post(WEBHOOK_PATH)
      .type("form")
      .set("Host", "attacker.example.net")
      .set("X-Twilio-Signature", signed(params, `https://attacker.example.net${WEBHOOK_PATH}`))
      .send(params);
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it("uses TWILIO_WEBHOOK_URL when it is configured", async () => {
    process.env.TWILIO_WEBHOOK_URL = "https://hooks.example.com/twilio/status";
    const params = { MessageSid: SID, MessageStatus: "sent" };

    const wrong = await post(params, signed(params));
    expect(wrong.status).toBe(403);

    const right = await post(params, signed(params, "https://hooks.example.com/twilio/status"));
    expect(right.status).toBe(200);
    expect(updates).toHaveLength(1);
  });

  it("403s when the token is set but no URL can be derived", async () => {
    const savedAppUrl = process.env.APP_URL;
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;
    try {
      const params = { MessageSid: SID, MessageStatus: "delivered" };
      const res = await post(params, signed(params));
      expect(res.status).toBe(403);
      expect(updates).toHaveLength(0);
    } finally {
      process.env.APP_URL = savedAppUrl;
    }
  });

  it("keeps the legacy open behaviour when TWILIO_AUTH_TOKEN is unset", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const res = await post({ MessageSid: SID, MessageStatus: "delivered" });
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
  });
});

describe("Twilio webhook body validation", () => {
  it("400s on a malformed MessageSid and writes nothing", async () => {
    for (const sid of ["not-a-sid", "SM123", "SM" + "z".repeat(32), "../../etc", "x".repeat(400)]) {
      updates.length = 0;
      const params = { MessageSid: sid, MessageStatus: "delivered" };
      const res = await post(params, signed(params));
      expect(res.status, sid).toBe(400);
      expect(updates, sid).toHaveLength(0);
    }
  });

  it("acknowledges (and no-ops) a callback with no MessageSid", async () => {
    const params = { MessageStatus: "delivered" };
    const res = await post(params, signed(params));
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
  });

  it("normalises an unknown status and bounds the error fields", async () => {
    const params = {
      MessageSid: SID,
      MessageStatus: "PWNED'; drop table sms_logs; --",
      ErrorCode: "not-a-number",
      ErrorMessage: "e".repeat(2000),
    };
    const res = await post(params, signed(params));
    expect(res.status).toBe(200);
    expect(updates[0].payload.status).toBe("unknown");
    expect(updates[0].payload.error_code).toBeNull();
    expect(updates[0].payload.error_message).toHaveLength(500);
  });

  it("keeps a well-formed status and numeric error code", async () => {
    const params = { MessageSid: SID, MessageStatus: "UNDELIVERED", ErrorCode: "30003", ErrorMessage: "Unreachable" };
    const res = await post(params, signed(params));
    expect(res.status).toBe(200);
    expect(updates[0].payload).toMatchObject({
      status: "undelivered",
      error_code: "30003",
      error_message: "Unreachable",
    });
  });
});
