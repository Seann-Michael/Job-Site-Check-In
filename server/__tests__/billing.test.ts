import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Billing API tests. Stripe is DORMANT here (STRIPE_SECRET_KEY unset), so this
 * exercises the manual/comp path, the auth matrix, empty-overview zeros, and
 * webhook signature rejection.
 *
 * Tokens: "super" (super_admin) | "owner" (business_owner of BIZ1) | "other".
 */
const BIZ1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN1 = "11111111-1111-4111-8111-111111111111";

const USERS: Record<string, any> = {
  "super-id": { id: "super-id", email: "super@x.com", role: "super_admin", sub_account_id: null },
  "owner-id": { id: "owner-id", email: "owner@x.com", role: "business_owner", sub_account_id: null },
  "other-id": { id: "other-id", email: "other@x.com", role: "business_owner", sub_account_id: null },
};
const TOKENS: Record<string, string> = { super: "super-id", owner: "owner-id", other: "other-id" };
const OWNED: Record<string, string[]> = { "owner-id": [BIZ1] };

// Mutable table state the fake client reads/writes.
const state = {
  plans: [] as any[],
  subscriptions: [] as any[],
  billing_records: [] as any[],
  businesses: [{ id: BIZ1, owner_id: "owner-id", name: "Biz One", email: "biz@x.com", metadata: {}, stripe_customer_id: null }] as any[],
  audits: [] as any[],
};

function resetState() {
  state.plans = [
    { id: PLAN1, name: "Pro", price: "$49", features: [], amount_cents: 4900, interval: "month", is_active: true, stripe_price_id: null, stripe_product_id: null, sort_order: 0, max_users: null, max_businesses: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  ];
  state.subscriptions = [];
  state.billing_records = [];
  state.businesses = [{ id: BIZ1, owner_id: "owner-id", name: "Biz One", email: "biz@x.com", metadata: {}, stripe_customer_id: null }];
  state.audits = [];
}

// ── Minimal chainable Supabase fake (service role: no RLS) ───────────────────
const usersTable = Object.values(USERS);
function tableFor(name: string): any[] {
  if (name === "plans") return state.plans;
  if (name === "subscriptions") return state.subscriptions;
  if (name === "billing_records") return state.billing_records;
  if (name === "businesses") return state.businesses;
  if (name === "audit_logs") return state.audits;
  if (name === "users") return usersTable;
  return [];
}

function query(table: string) {
  const filters: Record<string, any> = {};
  let op = "select";
  let payload: any;
  let conflictKey: string | null = null;

  const applyFilters = (rows: any[]) => rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));

  const resolve = () => {
    const rows = tableFor(table);
    if (op === "insert") {
      const toInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = toInsert.map((p) => ({ id: p.id || `${table}-${rows.length + 1}`, created_at: "2026-08-20T00:00:00Z", updated_at: "2026-08-20T00:00:00Z", ...p }));
      rows.push(...inserted);
      return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
    }
    if (op === "upsert") {
      const key = conflictKey || "id";
      const existing = rows.find((r) => r[key] === payload[key]);
      if (existing) { Object.assign(existing, payload); return { data: existing, error: null }; }
      const row = { id: payload.id || `${table}-${rows.length + 1}`, created_at: "2026-08-20T00:00:00Z", ...payload };
      rows.push(row);
      return { data: row, error: null };
    }
    if (op === "update") {
      const matched = applyFilters(rows);
      matched.forEach((r) => Object.assign(r, payload));
      return { data: matched[0] ?? null, error: null };
    }
    if (op === "delete") {
      const remaining = rows.filter((r) => !applyFilters([r]).length);
      const removed = rows.length - remaining.length;
      tableFor(table).length = 0;
      tableFor(table).push(...remaining);
      return { data: null, error: null, count: removed };
    }
    // select
    const matched = applyFilters(rows).map((r) => ({ ...r, plans: r.plan_id ? state.plans.find((p) => p.id === r.plan_id) ?? null : null }));
    return { data: matched, error: null };
  };

  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => ((filters[col] = val), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    upsert: (row: any, opts?: any) => ((op = "upsert"), (payload = row), (conflictKey = opts?.onConflict ?? null), api),
    update: (row: any) => ((op = "update"), (payload = row), api),
    delete: () => ((op = "delete"), api),
    maybeSingle: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    single: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => {
      const r = resolve();
      // top-level select returns the array
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

let app: any;
beforeAll(async () => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const { createServer } = await import("../index");
  app = createServer();
});
beforeEach(() => resetState());

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("plans CRUD requires super admin", () => {
  it("401 without a token", async () => {
    expect((await request(app).get("/api/billing/plans")).status).toBe(401);
  });
  it("403 for a non-super-admin (owner)", async () => {
    expect((await request(app).get("/api/billing/plans").set(auth("owner"))).status).toBe(403);
    expect((await request(app).post("/api/billing/plans").set(auth("owner")).send({ name: "X", amount: 10 })).status).toBe(403);
    expect((await request(app).patch(`/api/billing/plans/${PLAN1}`).set(auth("owner")).send({ name: "X" })).status).toBe(403);
    expect((await request(app).delete(`/api/billing/plans/${PLAN1}`).set(auth("owner"))).status).toBe(403);
  });
  it("super admin can list, create, patch and delete plans (audited)", async () => {
    const list = await request(app).get("/api/billing/plans").set(auth("super"));
    expect(list.status).toBe(200);
    expect(list.body.plans).toHaveLength(1);

    const created = await request(app).post("/api/billing/plans").set(auth("super")).send({ name: "Starter", amount: 19, interval: "month", features: ["a", "b"] });
    expect(created.status).toBe(201);
    expect(created.body.plan).toMatchObject({ name: "Starter", amount_cents: 1900, interval: "month" });
    expect(state.audits.find((a) => a.resource_type === "plan" && a.action === "create")).toBeTruthy();

    const patched = await request(app).patch(`/api/billing/plans/${PLAN1}`).set(auth("super")).send({ amount: 59 });
    expect(patched.status).toBe(200);
    expect(patched.body.plan.amount_cents).toBe(5900);

    const del = await request(app).delete(`/api/billing/plans/${PLAN1}`).set(auth("super"));
    expect(del.status).toBe(204);
  });
  it("create rejects invalid input", async () => {
    expect((await request(app).post("/api/billing/plans").set(auth("super")).send({ amount: 10 })).status).toBe(400);
    expect((await request(app).post("/api/billing/plans").set(auth("super")).send({ name: "X", amount: -1 })).status).toBe(400);
  });
});

describe("assign comp works without Stripe", () => {
  it("comp creates a comped subscription (no Stripe) and audits", async () => {
    const r = await request(app).post(`/api/billing/business/${BIZ1}/assign`).set(auth("super")).send({ planId: PLAN1, mode: "comp" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, mode: "comp", status: "comped" });
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]).toMatchObject({ business_id: BIZ1, plan_id: PLAN1, status: "comped", stripe_subscription_id: null });
    // plan name mirrored onto businesses.metadata.plan
    expect(state.businesses[0].metadata.plan).toBe("Pro");
    expect(state.audits.find((a) => a.resource_type === "subscription")).toBeTruthy();
  });
  it("manual records an active subscription without Stripe", async () => {
    const r = await request(app).post(`/api/billing/business/${BIZ1}/assign`).set(auth("super")).send({ planId: PLAN1, mode: "manual" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, mode: "manual", status: "active" });
  });
  it("stripe mode returns 503 when Stripe is not configured", async () => {
    const r = await request(app).post(`/api/billing/business/${BIZ1}/assign`).set(auth("super")).send({ planId: PLAN1, mode: "stripe" });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("stripe_not_configured");
  });
  it("validates mode and planId", async () => {
    expect((await request(app).post(`/api/billing/business/${BIZ1}/assign`).set(auth("super")).send({ planId: PLAN1, mode: "bogus" })).status).toBe(400);
    expect((await request(app).post(`/api/billing/business/${BIZ1}/assign`).set(auth("super")).send({ planId: "nope", mode: "comp" })).status).toBe(400);
  });
  it("comp then cancel marks the subscription canceled without Stripe", async () => {
    await request(app).post(`/api/billing/business/${BIZ1}/assign`).set(auth("super")).send({ planId: PLAN1, mode: "comp" });
    const c = await request(app).post(`/api/billing/business/${BIZ1}/cancel`).set(auth("super")).send({});
    expect(c.status).toBe(200);
    expect(state.subscriptions[0].status).toBe("canceled");
  });
  it("manual invoice records into billing_records", async () => {
    const r = await request(app).post(`/api/billing/business/${BIZ1}/invoices`).set(auth("super")).send({ amount: 49, status: "paid" });
    expect(r.status).toBe(201);
    expect(state.billing_records[0]).toMatchObject({ business_id: BIZ1, amount_cents: 4900, status: "paid", payment_provider: "manual" });
  });
});

describe("overview returns zeros on empty", () => {
  it("all-zero metrics with no subscriptions/invoices", async () => {
    const r = await request(app).get("/api/billing/overview").set(auth("super"));
    expect(r.status).toBe(200);
    expect(r.body.mrrCents).toBe(0);
    expect(r.body.activeCount).toBe(0);
    expect(r.body.byPlan).toEqual([]);
    expect(r.body.revenueByMonth).toHaveLength(12);
    expect(r.body.revenueByMonth.every((m: any) => m.revenueCents === 0)).toBe(true);
    expect(r.body.churn).toMatchObject({ canceledLast30: 0, activeCount: 0, rate: 0 });
    expect(r.body.stripeConfigured).toBe(false);
  });
  it("computes MRR from an active sub and normalizes yearly", async () => {
    state.plans.push({ id: "22222222-2222-4222-8222-222222222222", name: "Annual", amount_cents: 12000, interval: "year", is_active: true });
    state.subscriptions.push({ business_id: BIZ1, plan_id: PLAN1, status: "active" });
    state.subscriptions.push({ business_id: "b2", plan_id: "22222222-2222-4222-8222-222222222222", status: "active" });
    const r = await request(app).get("/api/billing/overview").set(auth("super"));
    // 4900 (monthly) + 12000/12 = 4900 + 1000 = 5900
    expect(r.body.mrrCents).toBe(5900);
    expect(r.body.activeCount).toBe(2);
  });
  it("403 for non-super-admin", async () => {
    expect((await request(app).get("/api/billing/overview").set(auth("owner"))).status).toBe(403);
  });
});

describe("webhook signature rejected when bad", () => {
  it("503 when STRIPE_WEBHOOK_SECRET/secret key unset (dormant)", async () => {
    const r = await request(app).post("/api/webhooks/stripe").set("stripe-signature", "t=1,v1=abc").send({ id: "evt_1" });
    expect(r.status).toBe(503);
  });
  it("400 on a bad signature when Stripe is configured", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    const { __resetStripeForTests } = await import("../lib/stripe");
    __resetStripeForTests();
    const r = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=1,v1=deadbeef")
      .set("content-type", "application/json")
      .send(Buffer.from(JSON.stringify({ id: "evt_1", type: "invoice.paid" })));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_signature");
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    __resetStripeForTests();
  });
});

describe("GET /api/billing/my (owner-readable)", () => {
  it("owner can read their business billing; other business is 404", async () => {
    const ok = await request(app).get(`/api/billing/my?businessId=${BIZ1}`).set(auth("owner"));
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty("invoices");
    const denied = await request(app).get(`/api/billing/my?businessId=${BIZ1}`).set(auth("other"));
    expect(denied.status).toBe(404);
  });
});

describe("migration asserts the security posture", () => {
  it("subscriptions: SELECT-only for authenticated; writes revoked", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260820011000_billing.sql"), "utf8");
    expect(sql).toMatch(/CREATE POLICY "subscriptions_select" ON public\.subscriptions/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.subscriptions FROM authenticated;/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.subscriptions/);
    // billing_records writes tightened to super admin only
    expect(sql).toMatch(/CREATE POLICY "billing_records_write" ON public\.billing_records[\s\S]*is_super_admin\(\)/);
  });
});

// Referenced so OWNED map is used by the auth layer via memberRoles resolution.
void OWNED;
