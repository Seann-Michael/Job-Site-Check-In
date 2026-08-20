import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Background worker tests. A minimal in-memory Supabase stub backs the service
 * client so runTickOnce() exercises real claiming/fan-out logic with no network
 * or DB. No email provider is configured, so campaign sends are never attempted
 * (they stay 'scheduled'), and no real email is sent.
 */

// ── In-memory Supabase stub ────────────────────────────────────────────────────
interface State {
  [table: string]: any[];
}
const state: State = {};

function resetState() {
  for (const k of Object.keys(state)) delete state[k];
  state.broadcast_messages = [];
  state.email_campaigns = [];
  state.email_providers = [];
  state.email_templates = [];
  state.users = [];
  state.notifications = [];
  state.worker_state = [];
  state.event_triggers = [];
  state.trigger_runs = [];
  state.reviews = [];
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
        if (f.col.includes("->>")) return true; // json path filters: best-effort pass
        const v = r[f.col];
        switch (f.op) {
          case "eq":
            return v === f.val;
          case "lte":
            return v != null && v <= f.val;
          case "gt":
            return v != null && v > f.val;
          case "in":
            return Array.isArray(f.val) && f.val.includes(v);
        }
      }),
    );

  const resolve = () => {
    const rows = tableFor(table);
    if (op === "insert") {
      const toInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = toInsert.map((p, i) => ({
        id: p.id || `${table}-${rows.length + i + 1}`,
        created_at: p.created_at || "2026-08-20T00:00:00.000Z",
        ...p,
      }));
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
    maybeSingle: async () => {
      const r = resolve();
      return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error };
    },
    single: async () => {
      const r = resolve();
      return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error };
    },
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => {
      const r = resolve();
      return Promise.resolve(r).then(onOk, onErr);
    },
  };
  return api;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({ from: (t: string) => query(t) }),
  createAnonClient: () => null,
}));

let worker: typeof import("../lib/worker");
beforeEach(async () => {
  resetState();
  worker = await import("../lib/worker");
});

describe("startWorker", () => {
  it("does nothing under NODE_ENV=test (no interval scheduled)", () => {
    const spy = vi.spyOn(global, "setInterval");
    worker.startWorker();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("runTickOnce — scheduled broadcasts", () => {
  it("claims a past-due scheduled broadcast and fans out notifications", async () => {
    state.users = [
      { id: "u1", role: "business_owner" },
      { id: "u2", role: "staff" },
    ];
    state.broadcast_messages = [
      {
        id: "b1",
        title: "Heads up",
        content: "Maintenance tonight",
        type: "warning",
        target_audience: "all",
        custom_user_ids: null,
        status: "scheduled",
        scheduled_for: "2020-01-01T00:00:00.000Z", // past
      },
    ];

    const summary = await worker.runTickOnce();

    expect(summary.broadcasts).toEqual({ processed: 1, sent: 1, failed: 0 });
    const b = state.broadcast_messages[0];
    expect(b.status).toBe("sent");
    expect(b.sent_at).toBeTruthy();
    // One notification per user, mirroring the immediate-send columns.
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications[0]).toMatchObject({
      user_id: "u1",
      title: "Heads up",
      message: "Maintenance tonight",
      type: "warning",
      read: false,
      source: "system",
    });
  });

  it("does not touch a future-dated scheduled broadcast", async () => {
    state.users = [{ id: "u1", role: "business_owner" }];
    state.broadcast_messages = [
      {
        id: "b2",
        title: "Later",
        content: "Not yet",
        type: "info",
        target_audience: "all",
        custom_user_ids: null,
        status: "scheduled",
        scheduled_for: "2999-01-01T00:00:00.000Z",
      },
    ];

    const summary = await worker.runTickOnce();
    expect(summary.broadcasts.sent).toBe(0);
    expect(state.broadcast_messages[0].status).toBe("scheduled");
    expect(state.notifications).toHaveLength(0);
  });
});

describe("runTickOnce — scheduled campaigns", () => {
  it("leaves a scheduled campaign as 'scheduled' when no provider is configured (capped retry)", async () => {
    state.email_providers = []; // none configured
    state.email_campaigns = [
      { id: "c1", status: "scheduled", scheduled_at: "2020-01-01T00:00:00.000Z", stats: {} },
    ];

    const summary = await worker.runTickOnce();

    expect(summary.campaigns.skipped).toBe(1);
    expect(summary.campaigns.sent).toBe(0);
    const c = state.email_campaigns[0];
    expect(c.status).toBe("scheduled");
    expect(c.stats.worker_attempts).toBe(1);
  });
});
