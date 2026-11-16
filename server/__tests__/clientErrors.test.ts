import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

const insert = vi.fn();
let authed = true;

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: async () =>
        authed
          ? { data: { user: { id: "user-1", email: "a@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
    },
    from: (table: string) => {
      if (table === "crash_logs") return { insert };
      if (table === "users") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "user-1", email: "a@example.com", role: "business_owner", sub_account_id: null } }) }) }) };
      }
      // businesses / business_members lookups in requireAuth
      const empty = { data: [], error: null };
      const chain: any = { select: () => chain, eq: () => chain, in: () => chain, then: (r: any) => r(empty) };
      return chain;
    },
  }),
}));

import { createServer } from "../index";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});
beforeEach(() => {
  authed = true;
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
});

describe("POST /api/client-errors", () => {
  it("requires a signed-in user", async () => {
    authed = false;
    const res = await request(app).post("/api/client-errors").send({ message: "boom" });
    expect(res.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a report with no message", async () => {
    const res = await request(app).post("/api/client-errors").set("Authorization", "Bearer t").send({ stack: "x" });
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores the report against the token's user, not the body's", async () => {
    const res = await request(app)
      .post("/api/client-errors")
      .set("Authorization", "Bearer t")
      .send({ message: "boom", severity: "FATAL", component: "mobile", user_id: "someone-else", stack: "s".repeat(20000) });
    expect(res.status).toBe(204);
    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe("user-1");
    expect(row.severity).toBe("fatal");
    expect(row.component).toBe("mobile");
    expect(row.stack.length).toBe(8000);
  });

  it("falls back to 'error' for an unknown severity and still answers 204 when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    const res = await request(app).post("/api/client-errors").set("Authorization", "Bearer t").send({ message: "boom", severity: "weird" });
    expect(res.status).toBe(204);
    expect(insert.mock.calls[0][0].severity).toBe("error");
  });
});
