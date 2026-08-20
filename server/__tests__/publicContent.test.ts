import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

const rpc = vi.fn();
const createSignedUrls = vi.fn();

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc,
    storage: { from: () => ({ createSignedUrls }) },
    auth: { getUser: async () => ({ data: { user: null }, error: { message: "invalid" } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));

import { createServer } from "../index";
import { mediaObjectKey } from "../routes/publicContent";

const JOB = "11111111-2222-4333-8444-555555555555";

let app: ReturnType<typeof createServer>;
beforeAll(() => {
  app = createServer({ skipEnvValidation: true });
});

describe("mediaObjectKey", () => {
  it("extracts keys from bare paths and legacy public URLs only", () => {
    expect(mediaObjectKey("project-media/abc/x.jpg")).toBe("project-media/abc/x.jpg");
    expect(mediaObjectKey("https://p.supabase.co/storage/v1/object/public/media/project-media/abc/x.jpg?v=1"))
      .toBe("project-media/abc/x.jpg");
    expect(mediaObjectKey("https://p.supabase.co/storage/v1/object/public/public-assets/business-logos/b/logo.png"))
      .toBeNull();
    expect(mediaObjectKey("https://example.com/a.png")).toBeNull();
    expect(mediaObjectKey("")).toBeNull();
    expect(mediaObjectKey(null)).toBeNull();
  });
});

describe("GET /api/public/job/:id", () => {
  it("rejects non-uuid ids without calling the database", async () => {
    rpc.mockClear();
    const res = await request(app).get("/api/public/job/not-a-uuid");
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("404s when the RPC returns no row", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app).get(`/api/public/job/${JOB}`);
    expect(res.status).toBe(404);
  });

  it("returns the row with signed photo URLs and no raw photo_paths", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        id: JOB, name: "Roof", description: null, created_at: "2026-01-01T00:00:00Z",
        seo_targets: null, metadata: { keywords: ["roof"] },
        photo_paths: [
          `https://p.supabase.co/storage/v1/object/public/media/project-media/${JOB}/a.jpg`,
          "https://cdn.example.com/external.jpg",
        ],
      }],
      error: null,
    });
    createSignedUrls.mockResolvedValueOnce({
      data: [{ path: `project-media/${JOB}/a.jpg`, signedUrl: "https://p.supabase.co/storage/v1/object/sign/media/a.jpg?token=t", error: null }],
      error: null,
    });
    const res = await request(app).get(`/api/public/job/${JOB}`);
    expect(res.status).toBe(200);
    expect(res.body.photo_paths).toBeUndefined();
    expect(res.body.photos).toEqual([
      "https://p.supabase.co/storage/v1/object/sign/media/a.jpg?token=t",
      "https://cdn.example.com/external.jpg",
    ]);
    expect(createSignedUrls).toHaveBeenCalledWith([`project-media/${JOB}/a.jpg`], 3600);
    expect(res.body.metadata.keywords).toEqual(["roof"]);
  });
});

describe("GET /api/public/review-request/:id", () => {
  it("passes public-assets URLs through untouched", async () => {
    createSignedUrls.mockClear();
    rpc.mockResolvedValueOnce({
      data: [{
        id: JOB, business_id: JOB, customer_name: "Pat", project_name: "Deck", business_name: "Acme",
        settings: { reviewGateVideoUrl: "https://p.supabase.co/storage/v1/object/public/public-assets/review-gate-videos/b/v.mp4" },
        address: {},
      }],
      error: null,
    });
    const res = await request(app).get(`/api/public/review-request/${JOB}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.reviewGateVideoUrl).toContain("/public-assets/");
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});
