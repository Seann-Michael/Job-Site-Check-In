import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";

/**
 * Token-aware Supabase mock.
 *  - Bearer "super"  -> super_admin profile
 *  - Bearer "owner"  -> business_owner profile
 *  - anything else   -> invalid token (401)
 */
function makeServiceClient() {
  const usersRow = (val: string) => {
    if (val === "super-id")
      return { id: val, email: "super@x.com", role: "super_admin", sub_account_id: null };
    if (val === "owner-id")
      return { id: val, email: "owner@x.com", role: "business_owner", sub_account_id: null };
    if (val === "target-id") return { id: val, email: "target@x.com" };
    return null;
  };

  return {
    auth: {
      getUser: async (token: string) => {
        if (token === "super")
          return { data: { user: { id: "super-id", email: "super@x.com" } }, error: null };
        if (token === "owner")
          return { data: { user: { id: "owner-id", email: "owner@x.com" } }, error: null };
        return { data: { user: null }, error: { message: "invalid" } };
      },
      admin: {
        generateLink: async ({ email }: { email: string }) => ({
          data: {
            properties: {
              email_otp: "otp-123",
              action_link: `https://app.example.com/verify?email=${email}`,
            },
          },
          error: null,
        }),
        updateUserById: async () => ({ data: {}, error: null }),
      },
    },
    from: (table: string) => {
      const api: any = {
        _val: undefined as string | undefined,
        select() {
          return api;
        },
        eq(_col: string, val: string) {
          api._val = val;
          return api;
        },
        async maybeSingle() {
          if (table === "users") return { data: usersRow(api._val as string), error: null };
          return { data: null, error: null };
        },
        // businesses lookup: `.select("id").eq("owner_id", id)` is awaited directly.
        then(resolve: (v: any) => void) {
          resolve({ data: [], error: null });
        },
        async insert() {
          return { error: null };
        },
      };
      return api;
    },
  };
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => makeServiceClient(),
  // anon client: sign-in always fails -> exercises the "wrong current password" path.
  createAnonClient: () => ({
    auth: {
      signInWithPassword: async () => ({ data: { user: null }, error: { message: "bad" } }),
    },
  }),
}));

import { createServer } from "../index";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});

describe("POST /api/auth/change-password", () => {
  it("401 without a token (requireAuth)", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ oldPassword: "oldpass12", newPassword: "newpass12" });
    expect(res.status).toBe(401);
  });

  it("400 when the current password is wrong", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", "Bearer owner")
      .send({ oldPassword: "wrongpass", newPassword: "newpass12" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/current password/i);
  });

  it("400 when newPassword is too short", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", "Bearer owner")
      .send({ oldPassword: "oldpass12", newPassword: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/);
  });
});

describe("POST /api/admin/impersonate", () => {
  it("401 without a token", async () => {
    const res = await request(app).post("/api/admin/impersonate").send({ userId: "target-id" });
    expect(res.status).toBe(401);
  });

  it("403 for a non-super_admin caller", async () => {
    const res = await request(app)
      .post("/api/admin/impersonate")
      .set("Authorization", "Bearer owner")
      .send({ userId: "target-id" });
    expect(res.status).toBe(403);
  });

  it("mints a one-time token for a super_admin caller", async () => {
    const res = await request(app)
      .post("/api/admin/impersonate")
      .set("Authorization", "Bearer super")
      .send({ userId: "target-id" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "target@x.com", token: "otp-123" });
    expect(res.body.actionLink).toContain("target@x.com");
  });

  it("404 when the target user does not exist", async () => {
    const res = await request(app)
      .post("/api/admin/impersonate")
      .set("Authorization", "Bearer super")
      .send({ userId: "missing-id" });
    expect(res.status).toBe(404);
  });
});
