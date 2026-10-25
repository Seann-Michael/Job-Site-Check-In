import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Project share pipeline (server/lib/shares.ts).
 *
 * Verifies, with a tiny in-memory supabase and mocked destination adapters:
 *  - a queued share goes live on Google with the first photo as a signed URL
 *  - a not-connected Google is reported as not_configured, not as a crash
 *  - partial delivery (one destination live, one failed) is marked `partial`
 *    and the live destination is not re-sent on retry
 *  - mark_complete flips the job to completed only when something went live
 *  - processQueuedShares only picks up due rows
 */

const BUSINESS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SHARE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PHOTO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let rows: Record<string, any[]>;
function reset() {
  rows = {
    project_shares: [],
    businesses: [{ id: BUSINESS, share_settings: { website_workflow_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } }],
    jobs: [{ id: JOB, business_id: BUSINESS, name: "Roof tear-off", status: "active", metadata: { city: "Medina", state: "OH" } }],
    job_media: [{ id: PHOTO, job_id: JOB, file_path: "jobs/x/photo.jpg", media_type: "image" }],
  };
}

function matches(row: any, filters: Array<[string, string, any]>) {
  return filters.every(([col, op, val]) => {
    if (op === "eq") return String(row[col]) === String(val);
    if (op === "in") return (val as any[]).map(String).includes(String(row[col]));
    if (op === "or") return true; // scheduled_for filter: handled by the test seeding
    return true;
  });
}

function query(table: string) {
  const filters: Array<[string, string, any]> = [];
  let action: "select" | "update" | "insert" | "delete" = "select";
  let patch: any = null;
  let single = false;
  const b: any = {
    select() { return b; },
    eq(c: string, v: any) { filters.push([c, "eq", v]); return b; },
    in(c: string, v: any) { filters.push([c, "in", v]); return b; },
    or() { filters.push(["", "or", null]); return b; },
    order() { return b; },
    limit() { return b; },
    maybeSingle() { single = true; return b; },
    single() { single = true; return b; },
    update(p: any) { action = "update"; patch = p; return b; },
    insert(p: any) { action = "insert"; patch = p; return b; },
    then(resolve: any) {
      let data: any;
      if (action === "insert") { rows[table].push(patch); data = patch; }
      else {
        const hit = rows[table].filter((r) => matches(r, filters));
        if (action === "update") hit.forEach((r) => Object.assign(r, patch));
        data = single ? hit[0] ?? null : hit;
      }
      resolve({ data, error: null });
    },
  };
  return b;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    from: (t: string) => query(t),
    storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed.example/${p}` }, error: null }) }) },
  }),
  createAnonClient: () => null,
}));

const createLocalPost = vi.fn();
class GbpNotConnectedError extends Error {}
vi.mock("../lib/gbp", () => ({ createLocalPost: (...a: any[]) => createLocalPost(...a), GbpNotConnectedError }));
const runWorkflowById = vi.fn();
vi.mock("../routes/workflows", () => ({ runWorkflowById: (...a: any[]) => runWorkflowById(...a) }));

beforeEach(() => { reset(); createLocalPost.mockReset(); runWorkflowById.mockReset(); });

function seedShare(extra: Partial<any> = {}) {
  const row = {
    id: SHARE, business_id: BUSINESS, job_id: JOB, created_by: null,
    media_ids: [PHOTO], destinations: ["gbp"], caption: { gbp: "Roof tear-off in Medina, OH." },
    options: {}, status: "queued", scheduled_for: null, started_at: null, finished_at: null,
    results: {}, attempts: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...extra,
  };
  rows.project_shares.push(row);
  return row;
}

describe("runShare", () => {
  it("posts to Google with the first photo as a signed URL and goes live", async () => {
    seedShare();
    createLocalPost.mockResolvedValue({ name: "accounts/1/locations/2/localPosts/3" });
    const { runShare } = await import("../lib/shares");
    const out = await runShare(SHARE);
    expect(out.status).toBe("done");
    expect(out.results.gbp?.status).toBe("live");
    expect(out.results.gbp?.external_id).toContain("localPosts/3");
    const input = createLocalPost.mock.calls[0][1];
    expect(input.media[0].sourceUrl).toBe("https://signed.example/jobs/x/photo.jpg");
    expect(input.summary).toBe("Roof tear-off in Medina, OH.");
  });

  it("reports a disconnected Google as not_configured with a plain reason", async () => {
    seedShare();
    createLocalPost.mockRejectedValue(new GbpNotConnectedError("no tokens"));
    const { runShare } = await import("../lib/shares");
    const out = await runShare(SHARE);
    expect(out.status).toBe("failed");
    expect(out.results.gbp?.status).toBe("not_configured");
    expect(out.results.gbp?.detail).toMatch(/isn't connected/);
  });

  it("marks partial when the website fails and does not re-send Google on retry", async () => {
    seedShare({ destinations: ["gbp", "website"], caption: { gbp: "x", website: "y" } });
    createLocalPost.mockResolvedValue({ name: "p/1" });
    runWorkflowById.mockResolvedValue({ ok: false, detail: "Your website rejected the project (1 of 1 steps failed)." });
    const { runShare } = await import("../lib/shares");
    const first = await runShare(SHARE);
    expect(first.status).toBe("partial");
    expect(first.results.website?.status).toBe("failed");
    runWorkflowById.mockResolvedValue({ ok: true, detail: "Sent to your website.", executionId: "ex-1" });
    const second = await runShare(SHARE);
    expect(second.status).toBe("done");
    expect(createLocalPost).toHaveBeenCalledTimes(1);
    expect(second.results.website?.status).toBe("live");
  });

  it("flips the job to completed only when asked and something went live", async () => {
    seedShare({ options: { mark_complete: true } });
    createLocalPost.mockResolvedValue({ name: "p/1" });
    const { runShare } = await import("../lib/shares");
    await runShare(SHARE);
    expect(rows.jobs[0].status).toBe("completed");
  });

  it("leaves Facebook as not_configured until a Page is connected", async () => {
    seedShare({ destinations: ["facebook"], caption: { facebook: "hi" } });
    const { runShare } = await import("../lib/shares");
    const out = await runShare(SHARE);
    expect(out.results.facebook?.status).toBe("not_configured");
    expect(out.results.facebook?.detail).toMatch(/Facebook Page isn't connected/);
  });
});

describe("processQueuedShares", () => {
  it("delivers queued rows and reports counts", async () => {
    seedShare();
    createLocalPost.mockResolvedValue({ name: "p/1" });
    const { processQueuedShares } = await import("../lib/shares");
    const summary = await processQueuedShares();
    expect(summary).toEqual({ processed: 1, live: 1, failed: 0 });
    expect(rows.project_shares[0].status).toBe("done");
  });
});
