import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Team membership API authorization matrix.
 *
 * Fixtures:
 *   biz-1  owned by owner-id; staff-id is a `staff` member; viewer-id a `viewer`.
 *   biz-2  owned by other-id (nobody else has access).
 *
 * Tokens: "owner" | "staff" | "viewer" | "other" | "super".
 *
 * PostgREST path: business_members has INSERT/UPDATE/DELETE revoked from
 * `authenticated` (see the migration-text assertion at the bottom), so these
 * routes are the ONLY way a membership can be created or changed.
 */

const BIZ1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BIZ2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const USERS: Record<string, any> = {
  "owner-id": { id: "owner-id", email: "owner@x.com", name: "Owner", role: "business_owner", sub_account_id: null },
  "staff-id": { id: "staff-id", email: "staff@x.com", name: "Staff", role: "business_owner", sub_account_id: null },
  "viewer-id": { id: "viewer-id", email: "viewer@x.com", name: "Viewer", role: "viewer", sub_account_id: null },
  "other-id": { id: "other-id", email: "other@x.com", name: "Other", role: "business_owner", sub_account_id: null },
  "super-id": { id: "super-id", email: "super@x.com", name: "Super", role: "super_admin", sub_account_id: null },
  "existing-id": { id: "existing-id", email: "existing@x.com", name: "Existing", role: "business_owner", sub_account_id: null },
  "admin2-id": { id: "admin2-id", email: "admin2@x.com", name: "Admin2", role: "super_admin", sub_account_id: null },
};
const TOKENS: Record<string, string> = { owner: "owner-id", staff: "staff-id", viewer: "viewer-id", other: "other-id", super: "super-id" };
const OWNED: Record<string, string[]> = { "owner-id": [BIZ1], "other-id": [BIZ2] };
const MEMBERSHIPS: Record<string, { business_id: string; role: string }[]> = {
  "staff-id": [{ business_id: BIZ1, role: "staff" }],
  "viewer-id": [{ business_id: BIZ1, role: "viewer" }],
};
const BUSINESSES: Record<string, { id: string; owner_id: string }> = {
  [BIZ1]: { id: BIZ1, owner_id: "owner-id" },
  [BIZ2]: { id: BIZ2, owner_id: "other-id" },
};

const state = {
  inserts: [] as { table: string; row: any }[],
  upserts: [] as { table: string; row: any }[],
  updates: [] as { table: string; row: any; filters: any }[],
  deletes: [] as { table: string; filters: any }[],
  invites: [] as { email: string; opts: any }[],
};

function makeServiceClient() {
  return {
    auth: {
      getUser: async (token: string) => {
        const id = TOKENS[token];
        if (!id) return { data: { user: null }, error: { message: "invalid" } };
        return { data: { user: { id, email: USERS[id].email } }, error: null };
      },
      admin: {
        getUserById: async (id: string) => ({
          data: { user: { id, last_sign_in_at: id === "staff-id" ? null : "2026-01-01T00:00:00Z" } },
          error: null,
        }),
        inviteUserByEmail: async (email: string, opts: any) => {
          state.invites.push({ email, opts });
          const id = `new-${email}`;
          USERS[id] = { id, email, name: opts?.data?.name ?? null, role: "business_owner", sub_account_id: null };
          return { data: { user: { id, email } }, error: null };
        },
      },
    },
    from: (table: string) => query(table),
  };
}

function query(table: string) {
  const filters: Record<string, any> = {};
  let op = "select";
  let payload: any;
  const resolve = () => {
    if (table === "users") {
      if (filters.id) {
        if (op === "update") {
          state.updates.push({ table, row: payload, filters: { ...filters } });
          if (USERS[filters.id]) USERS[filters.id] = { ...USERS[filters.id], ...payload };
          return { data: null, error: null };
        }
        return { data: USERS[filters.id] ? { ...USERS[filters.id] } : null, error: null };
      }
      if (filters.email) {
        const u = Object.values(USERS).find((u) => u.email === filters.email);
        return { data: u ? { ...u } : null, error: null };
      }
      if (filters.__in_id) return { data: filters.__in_id.map((id: string) => USERS[id]).filter(Boolean), error: null };
    }
    if (table === "businesses") {
      if (filters.owner_id) return { data: (OWNED[filters.owner_id] || []).map((id) => ({ id })), error: null };
      if (filters.id) return { data: BUSINESSES[filters.id] ?? null, error: null };
    }
    if (table === "business_members") {
      if (op === "upsert") {
        state.upserts.push({ table, row: payload });
        return { data: { id: "member-new", ...payload, created_at: "2026-08-20T00:00:00Z" }, error: null };
      }
      if (op === "update") {
        state.updates.push({ table, row: payload, filters: { ...filters } });
        return { data: { id: filters.id, business_id: filters.business_id, user_id: "staff-id", role: payload.role, created_at: null }, error: null };
      }
      if (op === "delete") {
        state.deletes.push({ table, filters: { ...filters } });
        return { data: null, error: null };
      }
      if (filters.user_id) return { data: MEMBERSHIPS[filters.user_id] || [], error: null };
      if (filters.id) {
        if (filters.id === MEMBER_STAFF && filters.business_id === BIZ1) {
          return { data: { id: MEMBER_STAFF, business_id: BIZ1, user_id: "staff-id", role: "staff", created_at: null }, error: null };
        }
        return { data: null, error: null };
      }
      if (filters.business_id === BIZ1) {
        return {
          data: [
            { id: MEMBER_STAFF, business_id: BIZ1, user_id: "staff-id", role: "staff", created_at: null },
            { id: "m-viewer", business_id: BIZ1, user_id: "viewer-id", role: "viewer", created_at: null },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    }
    if (op === "insert") {
      state.inserts.push({ table, row: payload });
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };
  const api: any = {
    select: () => api,
    order: () => api,
    limit: () => api,
    in: (col: string, vals: any[]) => ((filters[`__in_${col}`] = vals), api),
    eq: (col: string, val: any) => ((filters[col] = val), api),
    insert: (row: any) => ((op = "insert"), (payload = row), api),
    upsert: (row: any) => ((op = "upsert"), (payload = row), api),
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
  createAnonClient: () => null,
}));

let app: any;
beforeAll(async () => {
  const { createServer } = await import("../index");
  app = createServer();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("GET /api/team/:businessId", () => {
  it("401 without a token", async () => {
    const r = await request(app).get(`/api/team/${BIZ1}`);
    expect(r.status).toBe(401);
  });
  it("owner, staff, viewer and super admin can read; outsiders get 404", async () => {
    for (const t of ["owner", "staff", "viewer", "super"]) {
      const r = await request(app).get(`/api/team/${BIZ1}`).set(auth(t));
      expect(r.status, t).toBe(200);
      expect(r.body.owner).toEqual({ id: "owner-id", email: "owner@x.com", name: "Owner" });
      expect(r.body.members).toHaveLength(2);
      const staff = r.body.members.find((m: any) => m.userId === "staff-id");
      expect(staff).toMatchObject({ id: MEMBER_STAFF, role: "staff", email: "staff@x.com", status: "invited" });
      const viewer = r.body.members.find((m: any) => m.userId === "viewer-id");
      expect(viewer).toMatchObject({ role: "viewer", status: "active" });
    }
    const r = await request(app).get(`/api/team/${BIZ1}`).set(auth("other"));
    expect(r.status).toBe(404);
  });
  it("400 on a non-uuid business id", async () => {
    const r = await request(app).get(`/api/team/not-a-uuid`).set(auth("owner"));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/team/:businessId/invite", () => {
  const body = { email: "New.Person@x.com", role: "viewer", name: "New" };

  it("403 for a staff member", async () => {
    const r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("staff")).send(body);
    expect(r.status).toBe(403);
  });
  it("403 for a viewer", async () => {
    const r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("viewer")).send(body);
    expect(r.status).toBe(403);
  });
  it("404 for a non-member (business not visible)", async () => {
    const r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("other")).send(body);
    expect(r.status).toBe(404);
  });
  it("200/201 for the owner: invites a new auth user, upserts membership, audits", async () => {
    state.invites.length = 0;
    state.upserts.length = 0;
    state.inserts.length = 0;
    state.updates.length = 0;
    const r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send(body);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id: "member-new", email: "new.person@x.com", role: "viewer", status: "invited" });
    expect(state.invites).toHaveLength(1);
    expect(state.invites[0].email).toBe("new.person@x.com");
    expect(state.invites[0].opts.redirectTo).toBe("https://app.example.com/reset-password");
    expect(state.upserts[0].row).toMatchObject({ business_id: BIZ1, user_id: "new-new.person@x.com", role: "viewer", invited_by: "owner-id" });
    // new user gets the invited role as their global users.role
    expect(state.updates.find((u) => u.table === "users")?.row).toEqual({ role: "viewer" });
    const audit = state.inserts.find((i) => i.table === "audit_logs");
    expect(audit?.row).toMatchObject({ user_id: "owner-id", business_id: BIZ1, action: "permission_change", resource_type: "business_member" });
    expect(audit?.row.details).toMatchObject({ event: "invite", role: "viewer", target_email: "new.person@x.com" });
  });
  it("existing users are not re-invited, just added", async () => {
    state.invites.length = 0;
    state.upserts.length = 0;
    const r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send({ email: "existing@x.com", role: "staff" });
    expect(r.status).toBe(201);
    expect(state.invites).toHaveLength(0);
    expect(state.upserts[0].row).toMatchObject({ user_id: "existing-id", role: "staff" });
    expect(r.body.status).toBe("active");
  });
  it("super admin can invite into any business", async () => {
    const r = await request(app).post(`/api/team/${BIZ2}/invite`).set(auth("super")).send({ email: "existing@x.com", role: "staff" });
    expect(r.status).toBe(201);
  });
  it("rejects the owner, yourself, and super admins as targets", async () => {
    let r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send({ email: "owner@x.com", role: "staff" });
    expect(r.status).toBe(400);
    r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("super")).send({ email: "owner@x.com", role: "staff" });
    expect(r.status).toBe(400);
    r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send({ email: "admin2@x.com", role: "staff" });
    expect(r.status).toBe(400);
  });
  it("validates email and role", async () => {
    let r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send({ email: "nope", role: "staff" });
    expect(r.status).toBe(400);
    r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send({ email: "a@b.co", role: "owner" });
    expect(r.status).toBe(400);
    r = await request(app).post(`/api/team/${BIZ1}/invite`).set(auth("owner")).send({ email: "a@b.co", role: "super_admin" });
    expect(r.status).toBe(400);
  });
});

describe("PATCH / DELETE /api/team/:businessId/members/:memberId", () => {
  it("staff and viewer get 403; outsiders 404", async () => {
    for (const t of ["staff", "viewer"]) {
      expect((await request(app).patch(`/api/team/${BIZ1}/members/${MEMBER_STAFF}`).set(auth(t)).send({ role: "viewer" })).status).toBe(403);
      expect((await request(app).delete(`/api/team/${BIZ1}/members/${MEMBER_STAFF}`).set(auth(t))).status).toBe(403);
    }
    expect((await request(app).patch(`/api/team/${BIZ1}/members/${MEMBER_STAFF}`).set(auth("other")).send({ role: "viewer" })).status).toBe(404);
  });
  it("owner can change a role (audited)", async () => {
    state.inserts.length = 0;
    const r = await request(app).patch(`/api/team/${BIZ1}/members/${MEMBER_STAFF}`).set(auth("owner")).send({ role: "viewer" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: MEMBER_STAFF, role: "viewer" });
    expect(state.inserts.find((i) => i.table === "audit_logs")?.row.details).toMatchObject({ event: "role_change", from: "staff", to: "viewer" });
  });
  it("owner can remove a member (membership only, audited)", async () => {
    state.inserts.length = 0;
    state.deletes.length = 0;
    const r = await request(app).delete(`/api/team/${BIZ1}/members/${MEMBER_STAFF}`).set(auth("owner"));
    expect(r.status).toBe(204);
    expect(state.deletes[0]).toMatchObject({ table: "business_members", filters: { id: MEMBER_STAFF, business_id: BIZ1 } });
    expect(state.inserts.find((i) => i.table === "audit_logs")?.row.details).toMatchObject({ event: "remove", target_user_id: "staff-id" });
  });
  it("404 for a member of another business", async () => {
    const r = await request(app).delete(`/api/team/${BIZ2}/members/${MEMBER_STAFF}`).set(auth("super"));
    expect(r.status).toBe(404);
  });
});

describe("POST /api/admin/staff/invite", () => {
  it("403 for every non-super-admin", async () => {
    for (const t of ["owner", "staff", "viewer", "other"]) {
      const r = await request(app).post(`/api/admin/staff/invite`).set(auth(t)).send({ email: "x@y.co", role: "super_admin" });
      expect(r.status, t).toBe(403);
    }
  });
  it("super admin invites and promotes to super_admin (audited)", async () => {
    state.invites.length = 0;
    state.updates.length = 0;
    state.inserts.length = 0;
    const r = await request(app).post(`/api/admin/staff/invite`).set(auth("super")).send({ email: "newadmin@x.com", role: "super_admin", name: "NA" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ email: "newadmin@x.com", role: "super_admin", status: "invited" });
    expect(state.invites).toHaveLength(1);
    expect(state.updates.find((u) => u.table === "users")?.row).toEqual({ role: "super_admin" });
    expect(state.inserts.find((i) => i.table === "audit_logs")?.row).toMatchObject({ action: "permission_change", resource_type: "user" });
  });
  it("rejects any role other than super_admin", async () => {
    const r = await request(app).post(`/api/admin/staff/invite`).set(auth("super")).send({ email: "x@y.co", role: "staff" });
    expect(r.status).toBe(400);
  });
});

describe("business-scoped write gate (canWriteBusiness)", () => {
  it("viewer member cannot register a webhook for the business; staff can", async () => {
    const v = await request(app).post("/api/webhooks/register").set(auth("viewer")).send({ url: "https://example.com/h", business_id: BIZ1 });
    expect(v.status).toBe(403);
    const s = await request(app).post("/api/webhooks/register").set(auth("staff")).send({ url: "https://example.com/h", business_id: BIZ1 });
    // staff passes authorization; whatever happens next is not a 403
    expect(s.status).not.toBe(403);
  });
});

describe("PostgREST path is closed", () => {
  /**
   * The client-side Supabase SDK talks to PostgREST as `authenticated`. The
   * migration revokes INSERT/UPDATE/DELETE on business_members from that role
   * and defines no write policy, so the only way to create, change or remove a
   * membership is through the service-role server routes tested above.
   */
  it("migration revokes writes on business_members from authenticated and defines only a SELECT policy", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260820008000_business_memberships.sql"), "utf8");
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE(, TRUNCATE)? ON public\.business_members FROM authenticated;/);
    const policies = sql.match(/CREATE POLICY "business_members_[a-z_]+" ON public\.business_members[^;]*;/g) || [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/FOR SELECT TO authenticated USING \(public\.can_read_business\(business_id\)\)/);
    // helpers exist and are authenticated-only
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.can_read_business\(bid uuid\)/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.can_write_business\(bid uuid\)/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.can_write_business\(uuid\) +FROM PUBLIC, anon;/);
  });
});
