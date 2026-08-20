import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Email API tests. No real provider send happens here: the 503 / auth paths
 * are exercised before any network call, and the status endpoint only reads
 * the providers table. Tokens: "super" (super_admin) | "owner" | "none".
 */
const CAMP1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROV1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const USERS: Record<string, any> = {
  "super-id": { id: "super-id", email: "super@x.com", role: "super_admin", sub_account_id: null },
  "owner-id": { id: "owner-id", email: "owner@x.com", role: "business_owner", sub_account_id: null },
};
const TOKENS: Record<string, string> = { super: "super-id", owner: "owner-id" };

const state = {
  email_providers: [] as any[],
  email_campaigns: [] as any[],
  email_templates: [] as any[],
  email_events: [] as any[],
  user_segments: [] as any[],
  users: [] as any[],
  audit_logs: [] as any[],
};

function resetState() {
  state.email_providers = [];
  state.email_campaigns = [
    { id: CAMP1, name: "Newsletter", subject: "Hello", template_id: null, content: "Body", target_segment: "all", recipient_count: 0, status: "draft", scheduled_at: null, sent_at: null, stats: {} },
  ];
  state.email_templates = [];
  state.email_events = [];
  state.user_segments = [];
  state.users = [
    ...Object.values(USERS).map((u) => ({ ...u, name: u.email, last_login: null, created_at: "2026-01-01T00:00:00Z", metadata: null })),
    { id: "u1", email: "u1@x.com", name: "User One", role: "business_owner", last_login: null, created_at: "2026-01-01T00:00:00Z", metadata: null },
  ];
  state.audit_logs = [];
}

const usersTable = () => state.users;
function tableFor(name: string): any[] {
  return (state as any)[name] ?? [];
}

function query(table: string) {
  const filters: Record<string, any> = {};
  let op = "select";
  let payload: any;

  const applyFilters = (rows: any[]) => rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));

  const resolve = () => {
    const rows = tableFor(table);
    if (op === "insert") {
      const toInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = toInsert.map((p) => ({ id: p.id || `${table}-${rows.length + 1}`, created_at: "2026-08-20T00:00:00Z", ...p }));
      rows.push(...inserted);
      return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
    }
    if (op === "update") {
      const matched = applyFilters(rows);
      matched.forEach((r) => Object.assign(r, payload));
      return { data: matched[0] ?? null, error: null };
    }
    const matched = applyFilters(rows);
    return { data: matched, error: null };
  };

  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => ((filters[col] = val), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    update: (row: any) => ((op = "update"), (payload = row), api),
    maybeSingle: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    single: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => {
      const r = resolve();
      return Promise.resolve(op === "select" ? { data: r.data, error: r.error } : r).then(onOk, onErr);
    },
  };
  return api;
}

function makeServiceClient() {
  return {
    auth: {
      getUser: async (token: string) => {
        const id = TOKENS[token];
        if (!id) return { data: { user: null }, error: { message: "invalid" } };
        return { data: { user: { id, email: USERS[id].email } }, error: null };
      },
    },
    from: (table: string) => query(table),
  };
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => makeServiceClient(),
  createAnonClient: () => null,
}));

// requireAuth also queries businesses/business_members; the fake returns [] for
// unknown tables, which is fine for these users.
let app: any;
beforeAll(async () => {
  const { createServer } = await import("../index");
  app = createServer();
});
beforeEach(() => resetState());

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("GET /api/email/status", () => {
  it("401 without a token", async () => {
    expect((await request(app).get("/api/email/status")).status).toBe(401);
  });
  it("403 for a non-super-admin", async () => {
    expect((await request(app).get("/api/email/status").set(auth("owner"))).status).toBe(403);
  });
  it("200 with configured=false when no provider is active", async () => {
    const r = await request(app).get("/api/email/status").set(auth("super"));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ configured: false, provider: null });
  });
  it("200 with configured=true and provider name when a provider is active", async () => {
    state.email_providers.push({ id: PROV1, name: "My SMTP", type: "smtp", provider_key: null, config: { host: "smtp.x.com", from: "no-reply@x.com" }, is_active: true, is_default: true, stats: {}, created_at: "2026-01-01T00:00:00Z" });
    const r = await request(app).get("/api/email/status").set(auth("super"));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ configured: true, provider: "My SMTP" });
  });
});

describe("POST /api/email/campaigns/:id/send", () => {
  it("503 when no provider is configured, and does NOT mark the campaign sent", async () => {
    const r = await request(app).post(`/api/email/campaigns/${CAMP1}/send`).set(auth("super"));
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/no email provider/i);
    // Campaign untouched.
    expect(state.email_campaigns[0].status).toBe("draft");
    expect(state.email_campaigns[0].sent_at).toBeNull();
  });
  it("404 for an unknown campaign id (with a provider present)", async () => {
    state.email_providers.push({ id: PROV1, name: "My SMTP", type: "smtp", provider_key: null, config: { host: "smtp.x.com", from: "no-reply@x.com" }, is_active: true, is_default: true, stats: {}, created_at: "2026-01-01T00:00:00Z" });
    const r = await request(app).post(`/api/email/campaigns/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/send`).set(auth("super"));
    expect(r.status).toBe(404);
  });
});

describe("POST /api/email/providers/:id/test requires super admin", () => {
  it("401 without a token", async () => {
    const r = await request(app).post(`/api/email/providers/${PROV1}/test`).send({ to: "a@b.com" });
    expect(r.status).toBe(401);
  });
  it("403 for a non-super-admin", async () => {
    const r = await request(app).post(`/api/email/providers/${PROV1}/test`).set(auth("owner")).send({ to: "a@b.com" });
    expect(r.status).toBe(403);
  });
  it("400 for a missing/invalid recipient (super admin)", async () => {
    const r = await request(app).post(`/api/email/providers/${PROV1}/test`).set(auth("super")).send({ to: "not-an-email" });
    expect(r.status).toBe(400);
  });
});

describe("migration asserts the security posture", () => {
  it("email_events: SELECT super-admin only; writes revoked; RLS enabled", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260820012000_email_events.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.email_events/);
    expect(sql).toMatch(/ALTER TABLE public\.email_events ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY "email_events_select" ON public\.email_events[\s\S]*is_super_admin\(\)/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.email_events FROM authenticated;/);
    expect(sql).toMatch(/email_events_campaign_id_idx/);
  });
});
