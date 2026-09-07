import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";

/**
 * RSS feed routes (/api/rss/:workflowId).
 *
 * The read side used to be public and service-role: any workflow UUID returned
 * that workflow's `rss_feed_items` to anyone who asked. It now requires a
 * session plus the same ownership check the write side performs, and rejects a
 * non-UUID workflow id with a 400 rather than letting it reach a uuid column.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";
const VIEWER = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";

const BUSINESS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BUSINESS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKFLOW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_WORKFLOW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MISSING_WORKFLOW = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const USERS: Record<string, any> = {
  [OWNER]: { id: OWNER, email: "owner@x.com", role: "business_owner", sub_account_id: "acct-owner" },
  [VIEWER]: { id: VIEWER, email: "viewer@x.com", role: "viewer", sub_account_id: "acct-viewer" },
  [OUTSIDER]: { id: OUTSIDER, email: "out@x.com", role: "business_owner", sub_account_id: "acct-out" },
};
const TOKENS: Record<string, string> = { owner: OWNER, viewer: VIEWER, outsider: OUTSIDER };

let state: Record<string, any[]>;
function reset() {
  state = {
    users: Object.values(USERS),
    businesses: [
      { id: BUSINESS, owner_id: OWNER, status: "active" },
      { id: OTHER_BUSINESS, owner_id: OUTSIDER, status: "active" },
    ],
    business_members: [{ business_id: BUSINESS, user_id: VIEWER, role: "viewer" }],
    workflows: [
      { id: WORKFLOW, business_id: BUSINESS },
      { id: OTHER_WORKFLOW, business_id: OTHER_BUSINESS },
    ],
    rss_feed_items: [
      {
        id: "item-1",
        workflow_id: WORKFLOW,
        feed_title: "Owner Feed",
        item_title: "Job done",
        item_description: "All finished",
        item_link: "https://app.example.com/j/1",
        item_guid: "guid-1",
        pub_date: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "item-2",
        workflow_id: OTHER_WORKFLOW,
        feed_title: "Secret Feed",
        item_title: "SECRET OTHER TENANT JOB",
        item_description: "not yours",
        item_guid: "guid-2",
        pub_date: "2026-08-02T00:00:00.000Z",
        created_at: "2026-08-02T00:00:00.000Z",
      },
    ],
  };
}

/** Track every table the handler queried, so we can assert it never read the feed. */
let queriedTables: string[] = [];

function query(table: string) {
  queriedTables.push(table);
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

import { createServer } from "../index";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});
beforeEach(() => {
  reset();
  queriedTables = [];
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("GET /api/rss/:workflowId", () => {
  it("401s without a session (the feed is no longer public)", async () => {
    const res = await request(app).get(`/api/rss/${WORKFLOW}`);
    expect(res.status).toBe(401);
    expect(queriedTables).not.toContain("rss_feed_items");
  });

  it("404s for a workflow the caller does not own, and never reads its items", async () => {
    const res = await request(app).get(`/api/rss/${OTHER_WORKFLOW}`).set(auth("owner"));
    expect(res.status).toBe(404);
    expect(res.text).not.toMatch(/SECRET OTHER TENANT JOB/);
    expect(queriedTables).not.toContain("rss_feed_items");
  });

  it("404s for a workflow that does not exist", async () => {
    const res = await request(app).get(`/api/rss/${MISSING_WORKFLOW}`).set(auth("owner"));
    expect(res.status).toBe(404);
    expect(queriedTables).not.toContain("rss_feed_items");
  });

  it("serves the feed to the owning business", async () => {
    const res = await request(app).get(`/api/rss/${WORKFLOW}`).set(auth("owner"));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/rss\+xml/);
    expect(res.text).toMatch(/<title>Owner Feed<\/title>/);
    expect(res.text).toMatch(/Job done/);
    expect(res.text).not.toMatch(/SECRET OTHER TENANT JOB/);
  });

  it("serves the feed to a read-only member of the business", async () => {
    const res = await request(app).get(`/api/rss/${WORKFLOW}`).set(auth("viewer"));
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Job done/);
  });

  it("400s on a malformed workflow id instead of hitting the uuid column", async () => {
    for (const id of ["not-a-uuid", "1", "abc'; select 1--"]) {
      queriedTables = [];
      const res = await request(app).get(`/api/rss/${encodeURIComponent(id)}`).set(auth("owner"));
      expect(res.status, id).toBe(400);
      expect(queriedTables, id).not.toContain("rss_feed_items");
    }
  });
});

describe("POST /api/rss/:workflowId/items", () => {
  it("401s without a session", async () => {
    const res = await request(app).post(`/api/rss/${WORKFLOW}/items`).send({ item_title: "x" });
    expect(res.status).toBe(401);
  });

  it("404s when writing to another tenant's workflow", async () => {
    const res = await request(app)
      .post(`/api/rss/${OTHER_WORKFLOW}/items`)
      .set(auth("owner"))
      .send({ item_title: "x" });
    expect(res.status).toBe(404);
    expect(state.rss_feed_items).toHaveLength(2);
  });

  it("403s for a read-only role", async () => {
    const res = await request(app)
      .post(`/api/rss/${WORKFLOW}/items`)
      .set(auth("viewer"))
      .send({ item_title: "x" });
    expect(res.status).toBe(403);
  });

  it("400s on a malformed workflow id", async () => {
    const res = await request(app).post("/api/rss/not-a-uuid/items").set(auth("owner")).send({ item_title: "x" });
    expect(res.status).toBe(400);
  });

  it("appends an item for the owning business", async () => {
    const res = await request(app)
      .post(`/api/rss/${WORKFLOW}/items`)
      .set(auth("owner"))
      .send({ item_title: "New job" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(state.rss_feed_items).toHaveLength(3);
  });
});
