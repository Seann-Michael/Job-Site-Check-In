import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";

/**
 * Business suspension must be enforced by the SERVER, not only by the browser.
 *
 * Before the 2026-09-07 audit fix, `businesses.status` was consulted only in
 * client/lib/workspaceService.ts and ProtectedRoute. A suspended tenant kept a
 * valid Supabase session and retained full read/write through every /api route
 * (and through PostgREST directly). Suspension was cosmetic.
 *
 * The rule now: a suspended business is READ-ONLY for its own tenant — they
 * must still be able to see their data and reach billing to reactivate — and
 * super admins are unaffected. The database enforces the same thing in
 * public.can_write_business(); this covers the API layer.
 *
 * Routes used as the read/write pair:
 *   GET  /api/rss/:workflowId        -> requireAuth + canAccessBusiness (read)
 *   POST /api/rss/:workflowId/items  -> requireAuth + requireWrite + canWriteBusiness
 */

const ACTIVE_BIZ = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUSPENDED_BIZ = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTIVE_WORKFLOW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUSPENDED_WORKFLOW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const OWNER = "11111111-1111-4111-8111-111111111111";
const STAFF = "22222222-2222-4222-8222-222222222222";
const SUPER = "33333333-3333-4333-8333-333333333333";

const USERS: Record<string, any> = {
  [OWNER]: { id: OWNER, email: "owner@x.com", role: "business_owner", sub_account_id: "acct-owner" },
  [STAFF]: { id: STAFF, email: "staff@x.com", role: "business_owner", sub_account_id: "acct-staff" },
  [SUPER]: { id: SUPER, email: "super@x.com", role: "super_admin", sub_account_id: "acct-super" },
};
const TOKENS: Record<string, string> = { owner: OWNER, staff: STAFF, super: SUPER };

let state: Record<string, any[]>;
function reset() {
  state = {
    users: Object.values(USERS),
    businesses: [
      { id: ACTIVE_BIZ, owner_id: OWNER, status: "active" },
      { id: SUSPENDED_BIZ, owner_id: OWNER, status: "suspended" },
    ],
    // STAFF is a staff member of the suspended business only.
    business_members: [{ business_id: SUSPENDED_BIZ, user_id: STAFF, role: "staff" }],
    workflows: [
      { id: ACTIVE_WORKFLOW, business_id: ACTIVE_BIZ },
      { id: SUSPENDED_WORKFLOW, business_id: SUSPENDED_BIZ },
    ],
    rss_feed_items: [
      {
        id: "item-1",
        workflow_id: SUSPENDED_WORKFLOW,
        feed_title: "Feed",
        item_title: "Existing item",
        item_guid: "guid-1",
        pub_date: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
  };
}

function query(table: string) {
  const filters: Record<string, any> = {};
  const inFilters: Record<string, any[]> = {};
  let op: "select" | "insert" = "select";
  let payload: any;

  const resolve = () => {
    const rows = state[table] ?? (state[table] = []);
    if (op === "insert") {
      const row = { id: `${table}-${rows.length + 1}`, ...payload };
      rows.push(row);
      return { data: row, error: null };
    }
    return {
      data: rows.filter(
        (r) =>
          Object.entries(filters).every(([k, v]) => r[k] === v) &&
          Object.entries(inFilters).every(([k, vs]) => vs.includes(r[k])),
      ),
      error: null,
    };
  };

  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => ((filters[col] = val), api),
    in: (col: string, vals: any[]) => ((inFilters[col] = vals), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    maybeSingle: async () => {
      const r = resolve();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
    },
    single: async () => {
      const r = resolve();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
    },
    then: (ok: any, err?: any) => Promise.resolve(resolve()).then(ok, err),
  };
  return api;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const id = TOKENS[token];
        if (!id) return { data: { user: null }, error: { message: "invalid" } };
        return { data: { user: { id, email: USERS[id].email } }, error: null };
      },
    },
    from: (t: string) => query(t),
  }),
  createAnonClient: () => null,
}));

let app: any;
beforeAll(async () => {
  const { createServer } = await import("../index");
  app = createServer({ skipEnvValidation: true });
});
beforeEach(() => reset());

const item = { item_title: "New item", item_description: "body", feed_title: "Feed" };

describe("business suspension", () => {
  it("owner can still WRITE to an active business", async () => {
    const res = await request(app)
      .post(`/api/rss/${ACTIVE_WORKFLOW}/items`)
      .set("Authorization", "Bearer owner")
      .send(item);
    expect(res.status).toBe(200);
  });

  it("owner can still READ a suspended business (billing/export must stay reachable)", async () => {
    const res = await request(app)
      .get(`/api/rss/${SUSPENDED_WORKFLOW}`)
      .set("Authorization", "Bearer owner");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Existing item");
  });

  it("owner CANNOT write to a suspended business", async () => {
    const before = state.rss_feed_items.length;
    const res = await request(app)
      .post(`/api/rss/${SUSPENDED_WORKFLOW}/items`)
      .set("Authorization", "Bearer owner")
      .send(item);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(state.rss_feed_items.length).toBe(before);
  });

  it("a staff member of a suspended business cannot write either", async () => {
    const before = state.rss_feed_items.length;
    const res = await request(app)
      .post(`/api/rss/${SUSPENDED_WORKFLOW}/items`)
      .set("Authorization", "Bearer staff")
      .send(item);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(state.rss_feed_items.length).toBe(before);
  });

  it("super admins are not blocked by suspension", async () => {
    const res = await request(app)
      .post(`/api/rss/${SUSPENDED_WORKFLOW}/items`)
      .set("Authorization", "Bearer super")
      .send(item);
    expect(res.status).toBe(200);
  });
});
