import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// Avoid real network calls from requireAuth: stub the supabase client.
vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: "invalid" } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));

import { createServer } from "../index";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});

describe("platform", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.version).toBe("string");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("unknown /api route returns JSON 404", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("malformed JSON returns 400 JSON without a stack", async () => {
    const res = await request(app)
      .post("/api/workflows/webhook/abc")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid JSON body");
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts/);
  });
});

describe("requireAuth", () => {
  it("returns 401 without a token", async () => {
    for (const url of ["/api/ai/rewrite", "/api/dataforseo/status", "/api/resolve-url?url=x", "/api/media"]) {
      const res = await request(app)[url.startsWith("/api/ai") ? "post" : "get"](url);
      expect(res.status, url).toBe(401);
      expect(res.body.error).toBeDefined();
    }
  });

  it("returns 401 with an invalid bearer token", async () => {
    const res = await request(app).get("/api/media").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });
});
