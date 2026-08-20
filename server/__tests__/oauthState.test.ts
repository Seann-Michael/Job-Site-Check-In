import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { __setSupabaseClientForTests } from "../supabaseClient";
import { createOAuthState, consumeOAuthState } from "../lib/oauthState";

/**
 * Minimal in-memory stand-in for the supabase-js query builder, covering only
 * the chains oauthState.ts uses:
 *   from(t).insert(row)
 *   from(t).delete().lt("expires_at", iso)
 *   from(t).delete().eq("state", nonce).gt("expires_at", iso).select("payload")
 */
function makeFakeClient(opts: { insertError?: unknown; deleteError?: unknown } = {}) {
  const rows = new Map<string, { payload: any; expires_at: string }>();
  const calls: string[] = [];

  const client = {
    rows,
    calls,
    from(table: string) {
      expect(table).toBe("oauth_states");
      return {
        insert: async (row: any) => {
          calls.push("insert");
          if (opts.insertError) return { error: opts.insertError };
          rows.set(row.state, { payload: row.payload, expires_at: row.expires_at });
          return { error: null };
        },
        delete() {
          const filters: { eq?: string; gt?: string; lt?: string } = {};
          const run = () => {
            calls.push(`delete:${JSON.stringify(filters)}`);
            if (opts.deleteError) return { data: null, error: opts.deleteError };
            const matched: any[] = [];
            for (const [state, r] of rows) {
              if (filters.eq !== undefined && state !== filters.eq) continue;
              if (filters.gt !== undefined && !(r.expires_at > filters.gt)) continue;
              if (filters.lt !== undefined && !(r.expires_at < filters.lt)) continue;
              matched.push({ payload: r.payload });
              rows.delete(state);
            }
            return { data: matched, error: null };
          };
          const chain: any = {
            eq(col: string, v: string) {
              expect(col).toBe("state");
              filters.eq = v;
              return chain;
            },
            gt(col: string, v: string) {
              expect(col).toBe("expires_at");
              filters.gt = v;
              return chain;
            },
            lt(col: string, v: string) {
              expect(col).toBe("expires_at");
              filters.lt = v;
              return chain;
            },
            select: async (_cols: string) => run(),
            then(onOk: (v: any) => any, onErr?: (e: any) => any) {
              return Promise.resolve(run()).then(onOk, onErr);
            },
          };
          return chain;
        },
      };
    },
  };
  return client;
}

describe("oauthState (DB-backed)", () => {
  let fake: ReturnType<typeof makeFakeClient>;

  beforeEach(() => {
    fake = makeFakeClient();
    __setSupabaseClientForTests(fake as any);
  });
  afterEach(() => {
    __setSupabaseClientForTests(null);
    vi.useRealTimers();
  });

  it("creates a 192-bit base64url nonce with a 10 minute expiry", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00Z") });
    const nonce = await createOAuthState({ workspace_id: "ws1", user_id: "u1" });
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(Buffer.from(nonce, "base64url").length).toBe(24);
    const row = fake.rows.get(nonce)!;
    expect(row.payload).toEqual({ workspace_id: "ws1", user_id: "u1", created_at: Date.now() });
    expect(row.expires_at).toBe(new Date(Date.now() + 10 * 60 * 1000).toISOString());
  });

  it("sweeps expired rows on create (fire-and-forget)", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00Z") });
    fake.rows.set("old", { payload: {}, expires_at: new Date(Date.now() - 1000).toISOString() });
    await createOAuthState({ workspace_id: "ws1", user_id: "u1" });
    await Promise.resolve();
    expect(fake.rows.has("old")).toBe(false);
    expect(fake.calls.some((c) => c.startsWith('delete:{"lt"'))).toBe(true);
  });

  it("consumes a nonce exactly once", async () => {
    const nonce = await createOAuthState({ workspace_id: "ws1", user_id: "u1" });
    const first = await consumeOAuthState(nonce);
    expect(first).toMatchObject({ workspace_id: "ws1", user_id: "u1" });
    expect(await consumeOAuthState(nonce)).toBeNull();
    expect(fake.rows.size).toBe(0);
  });

  it("rejects expired nonces", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00Z") });
    const nonce = await createOAuthState({ workspace_id: "ws1", user_id: "u1" });
    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1);
    expect(await consumeOAuthState(nonce)).toBeNull();
  });

  it("rejects missing, unknown and oversized nonces without hitting the DB", async () => {
    expect(await consumeOAuthState(undefined)).toBeNull();
    expect(await consumeOAuthState("")).toBeNull();
    expect(await consumeOAuthState("x".repeat(129))).toBeNull();
    expect(fake.calls).toEqual([]);
    expect(await consumeOAuthState("nope")).toBeNull();
  });

  it("throws when the insert fails", async () => {
    __setSupabaseClientForTests(makeFakeClient({ insertError: { message: "boom" } }) as any);
    await expect(createOAuthState({ workspace_id: "ws1", user_id: "u1" })).rejects.toThrow();
  });

  it("returns null (fail closed) when the delete fails", async () => {
    __setSupabaseClientForTests(makeFakeClient({ deleteError: { message: "boom" } }) as any);
    expect(await consumeOAuthState("anything")).toBeNull();
  });
});
