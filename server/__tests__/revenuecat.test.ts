import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";

/**
 * RevenueCat webhook tests. Exercises auth, the TEST event, business/plan
 * resolution, and the subscription + billing_record writes for a purchase,
 * plus expiration -> canceled.
 */
const WEBHOOK_AUTH = "rc_test_secret_header";
const BIZ = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN = "11111111-1111-4111-8111-111111111111";
const USER = "owner-id";

const state = {
  businesses: [] as any[],
  plans: [] as any[],
  subscriptions: [] as any[],
  billing_records: [] as any[],
};
function reset() {
  state.businesses = [{ id: BIZ, owner_id: USER, name: "Biz", created_at: "2026-01-01T00:00:00Z" }];
  state.plans = [{ id: PLAN, name: "Pro", apple_product_id: "pro_monthly", google_product_id: "pro_monthly", revenuecat_entitlement_id: "pro" }];
  state.subscriptions = [];
  state.billing_records = [];
}
function tableFor(name: string): any[] {
  return (state as any)[name] ?? [];
}

function query(table: string) {
  const filters: Record<string, any> = {};
  const orClauses: Array<[string, any]> = [];
  let op = "select";
  let payload: any;
  let conflictKey: string | null = null;

  const matches = (r: any) => {
    if (!Object.entries(filters).every(([k, v]) => r[k] === v)) return false;
    if (orClauses.length && !orClauses.some(([k, v]) => r[k] === v)) return false;
    return true;
  };

  const resolve = () => {
    const rows = tableFor(table);
    if (op === "upsert") {
      const key = conflictKey || "id";
      const existing = rows.find((r) => r[key] === payload[key] && payload[key] != null);
      if (existing) { Object.assign(existing, payload); return { data: existing, error: null }; }
      const row = { id: payload.id || `${table}-${rows.length + 1}`, ...payload };
      rows.push(row);
      return { data: row, error: null };
    }
    return { data: rows.filter(matches), error: null };
  };

  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (c: string, v: any) => ((filters[c] = v), api),
    or: (expr: string) => {
      expr.split(",").forEach((clause) => {
        const [col, opName, val] = clause.split(".");
        if (opName === "eq") orClauses.push([col, val]);
      });
      return api;
    },
    upsert: (row: any, opts?: any) => ((op = "upsert"), (payload = row), (conflictKey = opts?.onConflict ?? null), api),
    maybeSingle: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    single: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    then: (ok: any, err?: any) => Promise.resolve(resolve()).then(ok, err),
  };
  return api;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({ from: (t: string) => query(t) }),
  createAnonClient: () => null,
}));

let app: any;
beforeAll(async () => {
  process.env.REVENUECAT_WEBHOOK_AUTH = WEBHOOK_AUTH;
  const { createServer } = await import("../index");
  app = createServer();
});
beforeEach(() => reset());

const url = "/api/webhooks/revenuecat";

describe("RevenueCat webhook", () => {
  it("401 with a wrong Authorization header", async () => {
    const res = await request(app).post(url).set("Authorization", "nope").send({ event: { type: "INITIAL_PURCHASE" } });
    expect(res.status).toBe(401);
  });

  it("acknowledges TEST events", async () => {
    const res = await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send({ event: { type: "TEST" } });
    expect(res.status).toBe(200);
    expect(res.body.test).toBe(true);
  });

  it("applies an initial purchase: active sub + paid billing record", async () => {
    const res = await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send({
      event: {
        type: "INITIAL_PURCHASE",
        app_user_id: USER,
        product_id: "pro_monthly",
        entitlement_ids: ["pro"],
        store: "APP_STORE",
        period_type: "NORMAL",
        transaction_id: "txn_1",
        price_in_purchased_currency: 79,
        currency: "USD",
        expiration_at_ms: 1893456000000,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(true);
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]).toMatchObject({ business_id: BIZ, plan_id: PLAN, status: "active", provider: "app_store", store: "app_store" });
    expect(state.billing_records).toHaveLength(1);
    expect(state.billing_records[0]).toMatchObject({ business_id: BIZ, status: "paid", amount_cents: 7900, payment_provider: "app_store", store_transaction_id: "txn_1" });
  });

  it("is idempotent on the store transaction id (no double charge)", async () => {
    const body = {
      event: { type: "INITIAL_PURCHASE", app_user_id: USER, product_id: "pro_monthly", store: "PLAY_STORE", transaction_id: "txn_dup", price: 79, currency: "USD" },
    };
    await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send(body);
    await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send(body);
    expect(state.billing_records).toHaveLength(1);
  });

  it("resolves the business from a subscriber attribute when present", async () => {
    const res = await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send({
      event: {
        type: "RENEWAL", app_user_id: "someone-else", product_id: "pro_monthly", store: "APP_STORE", transaction_id: "txn_2",
        subscriber_attributes: { business_id: { value: BIZ } },
      },
    });
    expect(res.status).toBe(200);
    expect(state.subscriptions[0]).toMatchObject({ business_id: BIZ, status: "active" });
  });

  it("expiration cancels the subscription", async () => {
    await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send({
      event: { type: "INITIAL_PURCHASE", app_user_id: USER, product_id: "pro_monthly", store: "APP_STORE", transaction_id: "txn_3" },
    });
    await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send({
      event: { type: "EXPIRATION", app_user_id: USER, product_id: "pro_monthly", store: "APP_STORE", transaction_id: "txn_3" },
    });
    expect(state.subscriptions[0].status).toBe("canceled");
  });

  it("acknowledges but does not apply when no business matches", async () => {
    const res = await request(app).post(url).set("Authorization", WEBHOOK_AUTH).send({
      event: { type: "INITIAL_PURCHASE", app_user_id: "unknown-user", product_id: "pro_monthly", store: "APP_STORE", transaction_id: "txn_x" },
    });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(false);
    expect(state.subscriptions).toHaveLength(0);
  });
});
