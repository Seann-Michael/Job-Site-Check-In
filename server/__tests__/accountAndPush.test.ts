/* eslint-disable @typescript-eslint/no-explicit-any -- hand-rolled query-builder mocks */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

const rpc = vi.fn();
const deleteUser = vi.fn();
const storageRemove = vi.fn();
const upsert = vi.fn();
const tokenDelete = vi.fn();
let role = "business_owner";
let authed = true;

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc,
    auth: {
      getUser: async () =>
        authed
          ? { data: { user: { id: "user-1", email: "a@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
      admin: { deleteUser },
    },
    storage: { from: () => ({ remove: storageRemove }) },
    from: (table: string) => {
      if (table === "push_tokens") {
        const del: any = { eq: (col: string, val: string) => { tokenDelete(col, val); return del; }, then: (r: any) => r({ error: null }) };
        return { upsert, delete: () => del };
      }
      if (table === "users") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "user-1", email: "a@example.com", role, sub_account_id: null } }) }) }) };
      }
      const empty = { data: [], error: null };
      const chain: any = { select: () => chain, eq: () => chain, in: () => chain, then: (r: any) => r(empty) };
      return chain;
    },
  }),
}));

import { createServer } from "../index";
import { isExpoPushToken } from "../lib/push";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});
beforeEach(() => {
  authed = true;
  role = "business_owner";
  rpc.mockReset();
  deleteUser.mockReset();
  storageRemove.mockReset();
  upsert.mockReset();
  tokenDelete.mockReset();
  deleteUser.mockResolvedValue({ error: null });
  storageRemove.mockResolvedValue({ error: null });
  upsert.mockResolvedValue({ error: null });
});

const TOKEN = "ExponentPushToken[abcDEF123_-]";

describe("DELETE /api/auth/account", () => {
  it("requires a signed-in user", async () => {
    authed = false;
    const res = await request(app).delete("/api/auth/account").send({ confirm: "DELETE" });
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses without the typed confirmation and deletes nothing", async () => {
    for (const body of [{}, { confirm: "delete" }, { confirm: "yes" }]) {
      const res = await request(app).delete("/api/auth/account").set("Authorization", "Bearer t").send(body);
      expect(res.status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a super admin", async () => {
    role = "super_admin";
    const res = await request(app).delete("/api/auth/account").set("Authorization", "Bearer t").send({ confirm: "DELETE" });
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletes the token holder, never a user named in the body", async () => {
    rpc.mockResolvedValue({ data: { businesses_deleted: 1, jobs_deleted: 2, storage_paths: ["project-media/j1/a.jpg", "project-media/j1/b.jpg"] }, error: null });
    const res = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", "Bearer t")
      .send({ confirm: "DELETE", userId: "someone-else", p_user_id: "someone-else" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, businessesDeleted: 1 });
    expect(rpc).toHaveBeenCalledWith("delete_account", { p_user_id: "user-1" });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(storageRemove).toHaveBeenCalledWith(["project-media/j1/a.jpg", "project-media/j1/b.jpg"]);
  });

  it("removes nothing else when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await request(app).delete("/api/auth/account").set("Authorization", "Bearer t").send({ confirm: "DELETE" });
    expect(res.status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("still reports success when only file clean-up fails", async () => {
    rpc.mockResolvedValue({ data: { businesses_deleted: 1, storage_paths: ["project-media/j1/a.jpg"] }, error: null });
    storageRemove.mockResolvedValue({ error: { message: "storage down" } });
    const res = await request(app).delete("/api/auth/account").set("Authorization", "Bearer t").send({ confirm: "DELETE" });
    expect(res.status).toBe(200);
  });
});

describe("push registration", () => {
  it("accepts only well-formed tokens", () => {
    expect(isExpoPushToken(TOKEN)).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[x]")).toBe(true);
    expect(isExpoPushToken("https://evil.example/hook")).toBe(false);
    expect(isExpoPushToken("")).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
  });

  it("stores the token against the token holder", async () => {
    const res = await request(app)
      .post("/api/push/register")
      .set("Authorization", "Bearer t")
      .send({ token: TOKEN, platform: "android", user_id: "someone-else" });
    expect(res.status).toBe(204);
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-1", token: TOKEN, platform: "android" });
  });

  it("rejects a malformed token and an anonymous caller", async () => {
    const bad = await request(app).post("/api/push/register").set("Authorization", "Bearer t").send({ token: "nope" });
    expect(bad.status).toBe(400);
    authed = false;
    const anon = await request(app).post("/api/push/register").send({ token: TOKEN });
    expect(anon.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("only unregisters a token that belongs to the caller", async () => {
    const res = await request(app).delete("/api/push/register").set("Authorization", "Bearer t").send({ token: TOKEN });
    expect(res.status).toBe(204);
    expect(tokenDelete).toHaveBeenCalledWith("token", TOKEN);
    expect(tokenDelete).toHaveBeenCalledWith("user_id", "user-1");
  });
});
