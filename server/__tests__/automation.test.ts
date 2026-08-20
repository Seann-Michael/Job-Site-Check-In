import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Automation API tests. Verifies the endpoints are super-admin only and that a
 * manual trigger run flows through the worker execution path. Tokens: "super"
 * (super_admin) | "owner".
 */
const TRIG1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const USERS: Record<string, any> = {
  "super-id": { id: "super-id", email: "super@x.com", role: "super_admin", sub_account_id: null },
  "owner-id": { id: "owner-id", email: "owner@x.com", role: "business_owner", sub_account_id: null },
};
const TOKENS: Record<string, string> = { super: "super-id", owner: "owner-id" };

const state: Record<string, any[]> = {};
function resetState() {
  for (const k of Object.keys(state)) delete state[k];
  state.users = Object.values(USERS);
  state.event_triggers = [
    {
      id: TRIG1,
      name: "New review alert",
      event: "review_received",
      conditions: [],
      actions: [],
      is_active: true,
      trigger_count: 0,
      last_triggered: null,
      created_at: "2026-08-01T00:00:00.000Z",
    },
  ];
  state.trigger_runs = [];
  state.worker_state = [];
  state.reviews = [];
  state.audit_logs = [];
  state.businesses = [];
  state.business_members = [];
}

function tableFor(name: string): any[] {
  if (!state[name]) state[name] = [];
  return state[name];
}

type Filter = { col: string; val: any; op: "eq" | "lte" | "gt" | "in" };

function query(table: string) {
  const filters: Filter[] = [];
  let op: "select" | "insert" | "update" | "upsert" = "select";
  let payload: any;
  let conflictKey: string | undefined;

  const applyFilters = (rows: any[]) =>
    rows.filter((r) =>
      filters.every((f) => {
        if (f.col.includes("->>")) return true;
        const v = r[f.col];
        if (f.op === "eq") return v === f.val;
        if (f.op === "lte") return v != null && v <= f.val;
        if (f.op === "gt") return v != null && v > f.val;
        if (f.op === "in") return Array.isArray(f.val) && f.val.includes(v);
        return true;
      }),
    );

  const resolve = () => {
    const rows = tableFor(table);
    if (op === "insert") {
      const toInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = toInsert.map((p, i) => ({ id: p.id || `${table}-${rows.length + i + 1}`, created_at: p.created_at || "2026-08-20T00:00:00.000Z", ...p }));
      rows.push(...inserted);
      return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
    }
    if (op === "update") {
      const matched = applyFilters(rows);
      matched.forEach((r) => Object.assign(r, payload));
      return { data: matched, error: null };
    }
    if (op === "upsert") {
      const key = conflictKey || "key";
      const existing = rows.find((r) => r[key] === payload[key]);
      if (existing) Object.assign(existing, payload);
      else rows.push({ ...payload });
      return { data: payload, error: null };
    }
    return { data: applyFilters(rows), error: null };
  };

  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => (filters.push({ col, val, op: "eq" }), api),
    lte: (col: string, val: any) => (filters.push({ col, val, op: "lte" }), api),
    gt: (col: string, val: any) => (filters.push({ col, val, op: "gt" }), api),
    in: (col: string, val: any) => (filters.push({ col, val, op: "in" }), api),
    filter: (col: string) => (filters.push({ col, val: null, op: "eq" }), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    update: (row: any) => ((op = "update"), (payload = row), api),
    upsert: (row: any, opts?: any) => ((op = "upsert"), (payload = row), (conflictKey = opts?.onConflict), api),
    maybeSingle: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    single: async () => { const r = resolve(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => Promise.resolve(resolve()).then(onOk, onErr),
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
  const { createServer } = await import("../index");
  app = createServer();
});
beforeEach(() => resetState());

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("POST /api/automation/triggers/:id/run", () => {
  it("401 without a token", async () => {
    const r = await request(app).post(`/api/automation/triggers/${TRIG1}/run`);
    expect(r.status).toBe(401);
  });
  it("403 for a non-super-admin", async () => {
    const r = await request(app).post(`/api/automation/triggers/${TRIG1}/run`).set(auth("owner"));
    expect(r.status).toBe(403);
  });
  it("400 for an invalid trigger id", async () => {
    const r = await request(app).post(`/api/automation/triggers/not-a-uuid/run`).set(auth("super"));
    expect(r.status).toBe(400);
  });
  it("404 for an unknown trigger id", async () => {
    const r = await request(app).post(`/api/automation/triggers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/run`).set(auth("super"));
    expect(r.status).toBe(404);
  });
  it("runs a trigger with no new activity and reports 'skipped' (super admin)", async () => {
    const r = await request(app).post(`/api/automation/triggers/${TRIG1}/run`).set(auth("super"));
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.result.status).toBe("skipped");
    // A manual run is logged even when it's a no-op.
    expect(state.trigger_runs).toHaveLength(1);
  });
});

describe("GET /api/automation/triggers/:id/runs", () => {
  it("403 for a non-super-admin", async () => {
    const r = await request(app).get(`/api/automation/triggers/${TRIG1}/runs`).set(auth("owner"));
    expect(r.status).toBe(403);
  });
  it("returns recent runs for a super admin", async () => {
    state.trigger_runs = [
      { id: "r1", trigger_id: TRIG1, event: "review_received", status: "success", detail: {}, created_at: "2026-08-20T01:00:00.000Z" },
    ];
    const r = await request(app).get(`/api/automation/triggers/${TRIG1}/runs`).set(auth("super"));
    expect(r.status).toBe(200);
    expect(r.body.runs).toHaveLength(1);
  });
});

describe("POST /api/automation/tick", () => {
  it("403 for a non-super-admin", async () => {
    const r = await request(app).post(`/api/automation/tick`).set(auth("owner"));
    expect(r.status).toBe(403);
  });
  it("returns a summary for a super admin", async () => {
    const r = await request(app).post(`/api/automation/tick`).set(auth("super"));
    expect(r.status).toBe(200);
    expect(r.body.summary).toHaveProperty("broadcasts");
    expect(r.body.summary).toHaveProperty("campaigns");
    expect(r.body.summary).toHaveProperty("triggers");
  });
});

describe("migration asserts the security posture", () => {
  it("worker tables: SELECT super-admin only; writes revoked; RLS enabled", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260820013000_worker.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.worker_state/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.trigger_runs/);
    expect(sql).toMatch(/ALTER TABLE public\.worker_state ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.trigger_runs ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY "trigger_runs_select" ON public\.trigger_runs[\s\S]*is_super_admin\(\)/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.worker_state FROM authenticated;/);
    expect(sql).toMatch(/trigger_runs_trigger_id_idx/);
  });
});
