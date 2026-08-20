import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { signWithTimestamp, signPayload } from "../lib/webhookSignature";

/**
 * Integration tests for the production-hardening fixes. Token-aware Supabase
 * mock:
 *   Bearer "super"   -> super_admin
 *   Bearer "owner"   -> business_owner owning business "biz-1"
 *   Bearer "viewer"  -> viewer (read-only role)
 */
const WEBHOOK_SECRET = crypto.randomBytes(32).toString("hex");
const state = {
  auditInsertError: null as null | { message: string },
  inserts: [] as Array<{ table: string; row: any }>,
};

const USERS: Record<string, any> = {
  "super-id": { id: "super-id", email: "super@x.com", role: "super_admin", sub_account_id: "acct-super" },
  "super2-id": { id: "super2-id", email: "super2@x.com", role: "super_admin", sub_account_id: "acct-super2" },
  "owner-id": { id: "owner-id", email: "owner@x.com", role: "business_owner", sub_account_id: "acct-owner" },
  "viewer-id": { id: "viewer-id", email: "viewer@x.com", role: "viewer", sub_account_id: "acct-viewer" },
  "target-id": { id: "target-id", email: "target@x.com", role: "business_owner", sub_account_id: "acct-target" },
};
const TOKENS: Record<string, string> = { super: "super-id", owner: "owner-id", viewer: "viewer-id" };
const BUSINESSES: Record<string, string[]> = { "owner-id": ["biz-1"] };

function makeServiceClient() {
  return {
    auth: {
      getUser: async (token: string) => {
        const id = TOKENS[token];
        if (!id) return { data: { user: null }, error: { message: "invalid" } };
        return { data: { user: { id, email: USERS[id].email } }, error: null };
      },
      admin: {
        getUserById: async (id: string) => {
          const row = USERS[id];
          if (!row) return { data: { user: null }, error: { message: "User not found", status: 404 } };
          return { data: { user: { id, email: row.email } }, error: null };
        },
        generateLink: async ({ email }: { email: string }) => ({
          data: { properties: { email_otp: "otp-123", action_link: `https://app.example.com/verify?email=${email}` } },
          error: null,
        }),
      },
    },
    from: (table: string) => builder(table),
  };
}

/** Minimal chainable query builder that resolves based on table + filters. */
function builder(table: string) {
  const filters: Record<string, any> = {};
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: any;
  const resolve = () => {
    if (table === "users") {
      const row = USERS[filters.id];
      return { data: row ? { ...row } : null, error: null };
    }
    if (table === "businesses") {
      if (filters.owner_id) return { data: (BUSINESSES[filters.owner_id] || []).map((id) => ({ id })), error: null };
      if (filters.id) return { data: { owner_id: "owner-id" }, error: null };
    }
    if (table === "workflows") {
      if (filters.id === "wf-1") {
        return {
          data: {
            id: "wf-1",
            business_id: "biz-1",
            is_active: true,
            is_published: true,
            steps: [{ id: "t", type: "trigger", app: "webhook", action: "receive", configured: true, config: { webhook_secret: WEBHOOK_SECRET } }],
          },
          error: null,
        };
      }
      return { data: null, error: { message: "not found" } };
    }
    if (table === "audit_logs" && op === "insert") {
      state.inserts.push({ table, row: payload });
      return { data: null, error: state.auditInsertError };
    }
    if (table === "workflow_executions" && op === "insert") {
      return { data: { id: "exec-1" }, error: null };
    }
    if (op === "insert") {
      state.inserts.push({ table, row: payload });
      return { data: { id: "row-1" }, error: null };
    }
    return { data: null, error: null };
  };
  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => ((filters[col] = val), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    update: (row: any) => ((op = "update"), (payload = row), api),
    delete: () => ((op = "delete"), api),
    maybeSingle: async () => resolve(),
    single: async () => resolve(),
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => Promise.resolve(resolve()).then(onOk, onErr),
  };
  return api;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => makeServiceClient(),
  createAnonClient: () => ({ auth: { signInWithPassword: async () => ({ data: { user: null }, error: { message: "bad" } }) } }),
}));

// Twilio / DataForSEO upstreams are mocked at the fetch layer.
const fetchMock = vi.fn();

import { createServer } from "../index";
import { resetDailyQuota } from "../routes/dataforseo";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  process.env.TWILIO_PHONE_NUMBER = "+15550000000";
  process.env.DATAFORSEO_USERNAME = "u";
  process.env.DATAFORSEO_PASSWORD = "p";
  app = createServer({ skipEnvValidation: true });
});

beforeEach(() => {
  state.auditInsertError = null;
  state.inserts = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ sid: "SM123", status: "queued", status_code: 20000, tasks: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ── (a) Twilio send ───────────────────────────────────────────────────────────
describe("POST /api/twilio/sms/send", () => {
  it("400 on a non-E.164 phone number", async () => {
    for (const to of ["5551234567", "+05551234567", "+1 555 123 4567", "+1234", "+1234567890123456"]) {
      const res = await request(app)
        .post("/api/twilio/sms/send")
        .set("Authorization", "Bearer owner")
        .send({ to, message: "hi" });
      expect(res.status, to).toBe(400);
      expect(res.body.error).toMatch(/E\.164/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400 when the message exceeds 1600 characters", async () => {
    const res = await request(app)
      .post("/api/twilio/sms/send")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", message: "x".repeat(1601) });
    expect(res.status).toBe(400);
  });

  it("403 for a viewer role (read-only)", async () => {
    const res = await request(app)
      .post("/api/twilio/sms/send")
      .set("Authorization", "Bearer viewer")
      .send({ to: "+15551234567", message: "hi" });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403 for a business the caller does not own", async () => {
    const res = await request(app)
      .post("/api/twilio/sms/send")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", message: "hi", businessId: "biz-2" });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends for an owned business and never echoes Twilio errors", async () => {
    const ok = await request(app)
      .post("/api/twilio/sms/send")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", message: "hi", businessId: "biz-1" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, messageId: "SM123" });
    expect(ok.headers["x-request-id"]).toBeDefined();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 21211, message: "SECRET upstream detail" }), { status: 400 }),
    );
    const bad = await request(app)
      .post("/api/twilio/sms/send")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", message: "hi" });
    expect(bad.status).toBe(502);
    expect(JSON.stringify(bad.body)).not.toMatch(/SECRET upstream detail/);
  });

  it("review-request rejects links not on the APP_URL host", async () => {
    const res = await request(app)
      .post("/api/twilio/review-request")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", businessName: "Acme", reviewLink: "https://evil.example.net/r" });
    expect(res.status).toBe(400);
    const http = await request(app)
      .post("/api/twilio/review-request")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", businessName: "Acme", reviewLink: "http://app.example.com/r" });
    expect(http.status).toBe(400);
    const good = await request(app)
      .post("/api/twilio/review-request")
      .set("Authorization", "Bearer owner")
      .send({ to: "+15551234567", businessName: "Acme", reviewLink: "https://app.example.com/r/1" });
    expect(good.status).toBe(200);
  });
});

// ── (b) DataForSEO quota ──────────────────────────────────────────────────────
describe("DataForSEO per-user daily quota", () => {
  it("429 once the daily limit is exceeded; caps tasks; forces priority/depth", async () => {
    process.env.DATAFORSEO_DAILY_LIMIT = "2";
    resetDailyQuota();
    const send = (token = "owner") =>
      request(app)
        .post("/api/dataforseo/v3/serp/google/maps/live")
        .set("Authorization", `Bearer ${token}`)
        .send([{ keyword: "plumber", priority: 2, depth: 700 }]);

    const r1 = await send();
    expect(r1.status).toBe(200);
    const forwarded = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(forwarded[0].priority).toBe(1);
    expect(forwarded[0].depth).toBe(100);

    expect((await send()).status).toBe(200);
    const r3 = await send();
    expect(r3.status).toBe(429);
    expect(r3.body.error).toMatch(/quota/i);

    // Other users are unaffected.
    expect((await send("super")).status).toBe(200);

    const tooMany = await request(app)
      .post("/api/dataforseo/v3/serp/google/maps/live")
      .set("Authorization", "Bearer super")
      .send(Array.from({ length: 6 }, () => ({ keyword: "x" })));
    expect(tooMany.status).toBe(400);
    delete process.env.DATAFORSEO_DAILY_LIMIT;
    resetDailyQuota();
  });
});

// ── (c) Webhook replay protection ─────────────────────────────────────────────
describe("POST /api/workflows/webhook/:id timestamp replay protection", () => {
  const body = JSON.stringify({ hello: "world" });
  const post = (headers: Record<string, string>) =>
    request(app)
      .post("/api/workflows/webhook/wf-1")
      .set("Content-Type", "application/json")
      .set(headers)
      .send(body);

  it("401 when the timestamp header is missing", async () => {
    const legacy = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    const res = await post({ "x-webhook-signature": legacy });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/timestamp/i);
  });

  it("401 when the timestamp is older than 300s (replay)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const res = await post({ "x-webhook-signature": signPayload(WEBHOOK_SECRET, body, ts), "x-webhook-timestamp": String(ts) });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/window/i);
  });

  it("401 when the signature does not cover the timestamp", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const legacy = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    const res = await post({ "x-webhook-signature": legacy, "x-webhook-timestamp": String(ts) });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/signature/i);
  });

  it("accepts a fresh, correctly signed request", async () => {
    const { signature, timestamp } = signWithTimestamp(WEBHOOK_SECRET, body);
    const res = await post({ "x-webhook-signature": signature, "x-webhook-timestamp": timestamp });
    expect(res.status).toBe(200);
    expect(res.body.executionId).toBe("exec-1");
  });
});

// ── (d) Impersonation ─────────────────────────────────────────────────────────
describe("POST /api/admin/impersonate hardening", () => {
  it("403 when the target is another super_admin", async () => {
    const res = await request(app)
      .post("/api/admin/impersonate")
      .set("Authorization", "Bearer super")
      .send({ userId: "super2-id" });
    expect(res.status).toBe(403);
    expect(state.inserts.filter((i) => i.table === "audit_logs")).toHaveLength(0);
  });

  it("writes the audit row before minting and fails closed when it cannot", async () => {
    state.auditInsertError = { message: "db down" };
    const res = await request(app)
      .post("/api/admin/impersonate")
      .set("Authorization", "Bearer super")
      .send({ userId: "target-id" });
    expect(res.status).toBe(500);
    expect(res.body.token).toBeUndefined();
  });

  it("still works for a normal target (email from auth.admin.getUserById)", async () => {
    const res = await request(app)
      .post("/api/admin/impersonate")
      .set("Authorization", "Bearer super")
      .send({ userId: "target-id" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "target@x.com", token: "otp-123" });
    expect(state.inserts.filter((i) => i.table === "audit_logs")).toHaveLength(1);
  });
});

// ── (e) canWrite on media ─────────────────────────────────────────────────────
describe("write-role guard", () => {
  it("viewer gets 403 on DELETE /api/media/:id", async () => {
    const res = await request(app).delete("/api/media/some-id").set("Authorization", "Bearer viewer");
    expect(res.status).toBe(403);
  });

  it("viewer gets 403 on POST /api/media/upload", async () => {
    const res = await request(app)
      .post("/api/media/upload")
      .set("Authorization", "Bearer viewer")
      .attach("file", Buffer.from("x"), { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it("viewer gets 403 on webhook register / webhook-url / oauth start", async () => {
    for (const path of ["/api/webhooks/register", "/api/workflows/webhook-url", "/api/oauth/google_my_business/start"]) {
      const res = await request(app).post(path).set("Authorization", "Bearer viewer").send({});
      expect(res.status, path).toBe(403);
    }
  });

  it("viewer can still read", async () => {
    const res = await request(app).get("/api/media").set("Authorization", "Bearer viewer");
    expect(res.status).toBe(200);
  });
});

// ── OAuth workspace scoping ───────────────────────────────────────────────────
describe("POST /api/oauth/google_my_business/start", () => {
  it("403 when asking for a workspace the caller cannot access", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "sec";
    const res = await request(app)
      .post("/api/oauth/google_my_business/start")
      .set("Authorization", "Bearer owner")
      .send({ workspace_id: "someone-else" });
    expect(res.status).toBe(403);
    const ok = await request(app)
      .post("/api/oauth/google_my_business/start")
      .set("Authorization", "Bearer owner")
      .send({});
    expect(ok.status).toBe(200);
    expect(ok.body.authorizeUrl).toMatch(/accounts\.google\.com/);
  });
});
