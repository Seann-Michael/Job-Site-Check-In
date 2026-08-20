import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

/**
 * Google Business Profile API tests (/api/gbp/*).
 *
 * Verifies:
 *  - status → 409 / connected:false when no tokens exist
 *  - status → connected:false via mocked supabase returning no token row
 *  - sync requires business write access (403 for a viewer / non-member)
 *  - reply requires a write role (viewer → 403)
 *  - token refresh path: an expiring token triggers a Google token refresh and
 *    the refreshed value is used + persisted
 *
 * Global.fetch (Google) is mocked; supabase is mocked with an in-memory store.
 */

// ── In-memory supabase mock ──────────────────────────────────────────────────

const OWNER = "11111111-1111-4111-8111-111111111111";
const VIEWER = "22222222-2222-4222-8222-222222222222";
const BUSINESS_CONNECTED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BUSINESS_NO_TOKENS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const USERS: Record<string, any> = {
  [OWNER]: { id: OWNER, email: "owner@x.com", role: "business_owner", sub_account_id: "ws-owner" },
  [VIEWER]: { id: VIEWER, email: "viewer@x.com", role: "business_owner", sub_account_id: "ws-viewer" },
};
const TOKENS: Record<string, string> = { owner: OWNER, viewer: VIEWER };

let state: Record<string, any[]>;
function resetState() {
  state = {
    users: Object.values(USERS),
    businesses: [
      { id: BUSINESS_CONNECTED, owner_id: OWNER, account_id: "ws-owner", google_place_id: "place-1", settings: { selectedGmbAccountId: "accounts/9/locations/5" } },
      { id: BUSINESS_NO_TOKENS, owner_id: OWNER, account_id: "ws-owner", google_place_id: null, settings: {} },
    ],
    // OWNER owns both businesses; VIEWER is a viewer member of the connected one.
    business_members: [{ business_id: BUSINESS_CONNECTED, user_id: VIEWER, role: "viewer" }],
    google_oauth_tokens: [],
    gmb_profiles: [],
    gmb_hours: [],
    gmb_qas: [],
    gmb_audit_results: [],
    reviews: [],
    audit_logs: [],
  };
}

// Configure a token row for the connected business's workspace.
function seedTokens(opts: { expiresAt: string | null; refreshToken?: string | null }) {
  state.google_oauth_tokens.push({
    id: "tok-1",
    workspace_id: "ws-owner",
    user_id: OWNER,
    google_account_id: "accounts/9",
    email: "owner@x.com",
    access_token: "stored-access",
    refresh_token: opts.refreshToken === undefined ? "refresh-1" : opts.refreshToken,
    expires_at: opts.expiresAt,
    locations: [{ name: "accounts/9/locations/5", accountName: "accounts/9", title: "Test Location" }],
    updated_at: "2026-08-20T00:00:00.000Z",
  });
}

type Filter = { col: string; val: any; op: "eq" | "in" };

function query(table: string) {
  const filters: Filter[] = [];
  let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  let payload: any;
  let conflictKey: string | undefined;

  const applyFilters = (rows: any[]) =>
    rows.filter((r) =>
      filters.every((f) => {
        if (f.op === "eq") return r[f.col] === f.val;
        if (f.op === "in") return Array.isArray(f.val) && f.val.includes(r[f.col]);
        return true;
      }),
    );

  const resolve = () => {
    const rows = state[table] ?? (state[table] = []);
    if (op === "insert") {
      const toInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = toInsert.map((p, i) => ({ id: p.id || `${table}-${rows.length + i + 1}`, ...p }));
      rows.push(...inserted);
      return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
    }
    if (op === "update") {
      const matched = applyFilters(rows);
      matched.forEach((r) => Object.assign(r, payload));
      return { data: matched, error: null };
    }
    if (op === "upsert") {
      const key = conflictKey || "id";
      const existing = rows.find((r) => r[key] === payload[key]);
      if (existing) Object.assign(existing, payload);
      else rows.push({ id: `${table}-${rows.length + 1}`, ...payload });
      return { data: payload, error: null };
    }
    if (op === "delete") {
      const keep = rows.filter((r) => !applyFilters(rows).includes(r));
      state[table] = keep;
      return { data: null, error: null };
    }
    return { data: applyFilters(rows), error: null };
  };

  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (col: string, val: any) => (filters.push({ col, val, op: "eq" }), api),
    in: (col: string, val: any) => (filters.push({ col, val, op: "in" }), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    update: (row: any) => ((op = "update"), (payload = row), api),
    upsert: (row: any, opts?: any) => ((op = "upsert"), (payload = row), (conflictKey = opts?.onConflict), api),
    delete: () => ((op = "delete"), api),
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
  process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
  const { createServer } = await import("../index");
  app = createServer();
});
beforeEach(() => resetState());
afterEach(() => vi.restoreAllMocks());

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// A Google API fetch mock. `handlers` maps a URL substring → { status, body }.
function mockGoogle(handlers: Array<{ match: string; status?: number; body?: any }>) {
  const calls: string[] = [];
  const spy = vi.spyOn(globalThis, "fetch" as any).mockImplementation(async (url: any) => {
    const u = String(url);
    calls.push(u);
    const h = handlers.find((x) => u.includes(x.match));
    const status = h?.status ?? 200;
    const body = h?.body ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as any;
  });
  return { spy, calls };
}

describe("GET /api/gbp/:businessId/status", () => {
  it("401 without a token", async () => {
    const r = await request(app).get(`/api/gbp/${BUSINESS_CONNECTED}/status`);
    expect(r.status).toBe(401);
  });

  it("returns connected:false when no OAuth tokens exist", async () => {
    // No token rows seeded.
    const r = await request(app).get(`/api/gbp/${BUSINESS_NO_TOKENS}/status`).set(auth("owner"));
    expect(r.status).toBe(200);
    expect(r.body.connected).toBe(false);
  });

  it("reports approved:false when Google returns 403 on the location probe", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    mockGoogle([{ match: "mybusinessbusinessinformation", status: 403, body: { error: { message: "not approved" } } }]);
    const r = await request(app).get(`/api/gbp/${BUSINESS_CONNECTED}/status`).set(auth("owner"));
    expect(r.status).toBe(200);
    expect(r.body.connected).toBe(true);
    expect(r.body.approved).toBe(false);
  });
});

describe("access control", () => {
  it("sync requires business write access — viewer gets 403", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    const r = await request(app).post(`/api/gbp/${BUSINESS_CONNECTED}/sync`).set(auth("viewer"));
    expect(r.status).toBe(403);
  });

  it("reply requires a write role — viewer gets 403", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    const r = await request(app)
      .post(`/api/gbp/${BUSINESS_CONNECTED}/reviews/rev-1/reply`)
      .set(auth("viewer"))
      .send({ comment: "thanks" });
    expect(r.status).toBe(403);
  });

  it("reply by an owner succeeds and calls Google's PUT reply endpoint", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    const { calls } = mockGoogle([{ match: "/reply", status: 200, body: { comment: "thanks" } }]);
    const r = await request(app)
      .post(`/api/gbp/${BUSINESS_CONNECTED}/reviews/rev-1/reply`)
      .set(auth("owner"))
      .send({ comment: "thanks" });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(calls.some((c) => c.includes("/reviews/rev-1/reply"))).toBe(true);
  });

  it("reply with an empty comment is rejected (400)", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    const r = await request(app)
      .post(`/api/gbp/${BUSINESS_CONNECTED}/reviews/rev-1/reply`)
      .set(auth("owner"))
      .send({ comment: "  " });
    expect(r.status).toBe(400);
  });
});

describe("token refresh path", () => {
  it("refreshes an expiring token before calling Google and persists it", async () => {
    // Expired 1 minute ago → within the 2-minute window → must refresh.
    seedTokens({ expiresAt: new Date(Date.now() - 60_000).toISOString(), refreshToken: "refresh-1" });

    const { calls } = mockGoogle([
      { match: "oauth2.googleapis.com/token", status: 200, body: { access_token: "fresh-access", expires_in: 3600 } },
      { match: "mybusiness.googleapis.com/v4", status: 200, body: { reviews: [] } },
    ]);

    const r = await request(app).get(`/api/gbp/${BUSINESS_CONNECTED}/reviews`).set(auth("owner"));
    expect(r.status).toBe(200);

    // Token endpoint was hit.
    expect(calls.some((c) => c.includes("oauth2.googleapis.com/token"))).toBe(true);
    // Refreshed token was persisted to the store.
    expect(state.google_oauth_tokens[0].access_token).toBe("fresh-access");

    // The v4 reviews call carried the refreshed bearer token.
    const v4Call = (globalThis.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes("mybusiness.googleapis.com/v4"));
    expect(v4Call?.[1]?.headers?.Authorization).toBe("Bearer fresh-access");
  });

  it("does not refresh when the stored token is still valid", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    const { calls } = mockGoogle([{ match: "mybusiness.googleapis.com/v4", status: 200, body: { reviews: [] } }]);
    const r = await request(app).get(`/api/gbp/${BUSINESS_CONNECTED}/reviews`).set(auth("owner"));
    expect(r.status).toBe(200);
    expect(calls.some((c) => c.includes("oauth2.googleapis.com/token"))).toBe(false);
  });
});

describe("approval gate on live calls", () => {
  it("reviews → 403 with approved:false when Google 403s", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    mockGoogle([{ match: "mybusiness.googleapis.com/v4", status: 403, body: { error: { message: "API not enabled" } } }]);
    const r = await request(app).get(`/api/gbp/${BUSINESS_CONNECTED}/reviews`).set(auth("owner"));
    expect(r.status).toBe(403);
    expect(r.body.approved).toBe(false);
  });
});

describe("POST /api/gbp/:businessId/sync", () => {
  it("409 when the business has no Google connection", async () => {
    // No token row for this workspace → getTokensForBusiness returns null.
    // Use a business whose workspace has no tokens: clear tokens entirely.
    state.google_oauth_tokens = [];
    const r = await request(app).post(`/api/gbp/${BUSINESS_CONNECTED}/sync`).set(auth("owner"));
    expect(r.status).toBe(409);
    expect(r.body.connected).toBe(false);
  });

  it("syncs location + hours and reports approved:false when v4 parts 403", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    mockGoogle([
      {
        match: "mybusinessbusinessinformation",
        status: 200,
        body: {
          name: "locations/5",
          title: "Test Location",
          phoneNumbers: { primaryPhone: "555-1000" },
          websiteUri: "https://example.com",
          storefrontAddress: { addressLines: ["1 Main St"], locality: "Town", administrativeArea: "OH" },
          regularHours: { periods: [{ openDay: "MONDAY", openTime: { hours: 9 }, closeTime: { hours: 17 } }] },
          profile: { description: "Hello" },
        },
      },
      // Everything v4 (reviews/posts/qanda/performance) is unapproved.
      { match: "mybusiness.googleapis.com/v4", status: 403, body: { error: { message: "not approved" } } },
      { match: "mybusinessqanda", status: 403, body: { error: { message: "not approved" } } },
      { match: "businessprofileperformance", status: 403, body: { error: { message: "not approved" } } },
    ]);

    const r = await request(app).post(`/api/gbp/${BUSINESS_CONNECTED}/sync`).set(auth("owner"));
    expect(r.status).toBe(200);
    expect(r.body.locationSynced).toBe(true);
    expect(r.body.approved).toBe(false);
    // Location + hours were persisted despite the v4 403s.
    expect(state.gmb_profiles).toHaveLength(1);
    expect(state.gmb_profiles[0].business_name).toBe("Test Location");
    expect(state.gmb_hours.length).toBe(1);
  });

  it("full sync upserts reviews and Q&A when approved", async () => {
    seedTokens({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    mockGoogle([
      {
        match: "mybusinessbusinessinformation",
        status: 200,
        body: { name: "locations/5", title: "Test Location", regularHours: { periods: [] } },
      },
      {
        match: "mybusiness.googleapis.com/v4/accounts/9/locations/5/reviews",
        status: 200,
        body: {
          reviews: [
            { name: "accounts/9/locations/5/reviews/r1", starRating: "FIVE", comment: "great", createTime: "2026-08-01T00:00:00Z", reviewer: { displayName: "Jane" } },
          ],
        },
      },
      { match: "mybusiness.googleapis.com/v4/accounts/9/locations/5/localPosts", status: 200, body: { localPosts: [] } },
      { match: "mybusinessqanda", status: 200, body: { questions: [{ name: "q1", text: "Open Sundays?", topAnswers: [{ text: "Yes", author: { displayName: "Owner" } }] }] } },
      { match: "businessprofileperformance", status: 200, body: { multiDailyMetricTimeSeries: [] } },
    ]);

    const r = await request(app).post(`/api/gbp/${BUSINESS_CONNECTED}/sync`).set(auth("owner"));
    expect(r.status).toBe(200);
    expect(r.body.approved).toBe(true);
    expect(r.body.reviews).toBe(1);
    expect(r.body.questions).toBe(1);
    expect(state.reviews).toHaveLength(1);
    expect(state.reviews[0].platform_review_id).toBe("accounts/9/locations/5/reviews/r1");
    expect(state.reviews[0].rating).toBe(5);
    expect(state.gmb_qas).toHaveLength(1);
  });
});
