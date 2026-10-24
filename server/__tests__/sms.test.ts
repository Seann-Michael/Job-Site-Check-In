import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Outbound SMS and the opt-out list.
 *
 * STOP is a legal obligation under the TCPA, not a feature, so the behaviour
 * worth pinning down is: who gets suppressed, what happens when the
 * suppression list cannot be read, and that no sender can bypass the check.
 */

type Row = Record<string, unknown>;

const store: { optOuts: Row[]; logs: Row[]; failWith: null | { code?: string; message: string } } = {
  optOuts: [],
  logs: [],
  failWith: null,
};

/** Chainable builder over the in-memory `store`. */
function builder(table: string) {
  const eq: Row = {};
  const isNull: string[] = [];
  let op: "select" | "insert" | "upsert" | "delete" = "select";
  let payload: Row | Row[] | null = null;

  const resolve = () => {
    if (table === "sms_opt_outs") {
      if (store.failWith && op === "select") return { data: null, error: store.failWith };
      if (op === "insert" || op === "upsert") {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const r of rows) {
          const dup = store.optOuts.some(
            (o) => o.phone === r.phone && (o.business_id ?? null) === (r.business_id ?? null),
          );
          if (!dup) store.optOuts.push({ ...r });
        }
        return { data: null, error: null };
      }
      if (op === "delete") {
        store.optOuts = store.optOuts.filter((o) => {
          const phoneMatch = eq.phone === undefined || o.phone === eq.phone;
          const bizMatch =
            isNull.includes("business_id")
              ? (o.business_id ?? null) === null
              : eq.business_id === undefined || o.business_id === eq.business_id;
          return !(phoneMatch && bizMatch);
        });
        return { data: null, error: null };
      }
      const found = store.optOuts.filter((o) => {
        if (eq.phone !== undefined && o.phone !== eq.phone) return false;
        if (isNull.includes("business_id")) return (o.business_id ?? null) === null;
        if (eq.business_id !== undefined) return o.business_id === eq.business_id;
        return true;
      });
      return { data: found.map((f) => ({ id: f.phone })), error: null };
    }
    if (table === "sms_logs" && (op === "insert" || op === "upsert")) {
      store.logs.push(Array.isArray(payload) ? payload[0] : payload);
      return { data: null, error: null };
    }
    return { data: [], error: null };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a chainable
  // PostgREST stand-in: every method returns the same object, which no
  // non-recursive type expresses without obscuring what the mock does.
  const api: any = {
    select: () => api,
    limit: () => api,
    order: () => api,
    eq: (c: string, v: unknown) => ((eq[c] = v), api),
    is: (c: string, _v: unknown) => (isNull.push(c), api),
    not: () => api,
    insert: (r: Row | Row[]) => ((op = "insert"), (payload = r), api),
    upsert: (r: Row | Row[]) => ((op = "upsert"), (payload = r), api),
    delete: () => ((op = "delete"), api),
    maybeSingle: async () => resolve(),
    single: async () => resolve(),
    then: (ok: (v: unknown) => void, err?: (e: unknown) => void) =>
      Promise.resolve(resolve()).then(ok, err),
  };
  return api;
}

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({ from: (t: string) => builder(t) }),
  createAnonClient: () => null,
}));

import {
  classifyInbound,
  isOptedOut,
  recordOptOut,
  clearOptOut,
  reviewRequestMessage,
  sendSms,
  statusForSendFailure,
} from "../lib/sms";
import { normalisePhone } from "../lib/phone";

const fetchMock = vi.fn();

beforeEach(() => {
  store.optOuts = [];
  store.logs = [];
  store.failWith = null;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  process.env.TWILIO_PHONE_NUMBER = "+15550000000";
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ sid: "SM123", status: "queued" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("normalisePhone", () => {
  it("resolves the formats this product stores to one E.164 string", () => {
    expect(normalisePhone("(216) 296-3191")).toBe("+12162963191");
    expect(normalisePhone("216-296-3191")).toBe("+12162963191");
    expect(normalisePhone("12162963191")).toBe("+12162963191");
    expect(normalisePhone("+1 216 296 3191")).toBe("+12162963191");
  });

  it("returns an empty string for nothing dialable", () => {
    expect(normalisePhone("")).toBe("");
    expect(normalisePhone("N/A")).toBe("");
    expect(normalisePhone(null)).toBe("");
    expect(normalisePhone(undefined)).toBe("");
  });
});

describe("classifyInbound", () => {
  it("treats the recognised opt-out keywords as STOP, in any case", () => {
    for (const body of ["STOP", "stop", " Stop ", "UNSUBSCRIBE", "cancel", "quit", "END", "stop."]) {
      expect(classifyInbound(body), body).toBe("stop");
    }
  });

  it("reads a short sentence that plainly asks us to stop", () => {
    expect(classifyInbound("please stop texting me")).toBe("stop");
  });

  it("does not mistake an ordinary reply for an opt-out", () => {
    for (const body of ["non-stop service was great", "thanks!", "I'll leave a review tomorrow"]) {
      expect(classifyInbound(body), body).toBe("other");
    }
  });

  it("recognises an explicit opt back in", () => {
    for (const body of ["START", "unstop", "yes", "subscribe"]) {
      expect(classifyInbound(body), body).toBe("start");
    }
  });
});

describe("isOptedOut", () => {
  it("is false for a number nobody has suppressed", async () => {
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(false);
  });

  it("suppresses a number opted out for that business", async () => {
    await recordOptOut("+12162963191", "biz-1");
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(true);
  });

  it("does not leak one business's opt-out to another", async () => {
    await recordOptOut("+12162963191", "biz-1");
    expect(await isOptedOut("+12162963191", "biz-2")).toBe(false);
  });

  it("honours a platform-wide opt-out for every business", async () => {
    // An inbound STOP that cannot be attributed to a tenant is recorded
    // globally, and must then stop everyone.
    await recordOptOut("+12162963191", null);
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(true);
    expect(await isOptedOut("+12162963191", "biz-2")).toBe(true);
  });

  it("matches regardless of how the number was formatted when stored", async () => {
    await recordOptOut("(216) 296-3191", "biz-1");
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(true);
  });

  it("fails CLOSED when the suppression list cannot be read", async () => {
    store.failWith = { code: "57014", message: "canceling statement due to statement timeout" };
    // Not knowing whether someone opted out is not permission to message them.
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(true);
  });

  it("treats an absent table as an empty list, so a deploy ahead of its migration still sends", async () => {
    store.failWith = { code: "42P01", message: 'relation "sms_opt_outs" does not exist' };
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(false);
  });

  it("clears on an explicit opt back in", async () => {
    await recordOptOut("+12162963191", "biz-1");
    await clearOptOut("+12162963191", "biz-1");
    expect(await isOptedOut("+12162963191", "biz-1")).toBe(false);
  });
});

describe("sendSms", () => {
  it("sends and logs when the number is not suppressed", async () => {
    const result = await sendSms({ to: "+12162963191", message: "hi", businessId: "biz-1" });
    expect(result.ok).toBe(true);
    expect(result.sid).toBe("SM123");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(store.logs[0]).toMatchObject({ business_id: "biz-1", to_number: "+12162963191", direction: "outbound" });
  });

  it("refuses a suppressed number without calling the provider at all", async () => {
    await recordOptOut("+12162963191", "biz-1");
    const result = await sendSms({ to: "+12162963191", message: "hi", businessId: "biz-1" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("opted_out");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.logs).toHaveLength(0);
  });

  it("reports not_configured rather than throwing when credentials are absent", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const result = await sendSms({ to: "+12162963191", message: "hi", businessId: "biz-1" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never echoes the provider's error text back to the caller", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 21211, message: "The 'To' number +1555 is not a valid phone number." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await sendSms({ to: "+12162963191", message: "hi", businessId: "biz-1" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("provider_error");
    expect(result.error).not.toContain("21211");
    expect(result.error).not.toContain("not a valid phone number");
  });

  it("rejects a message over the length limit before sending", async () => {
    const result = await sendSms({ to: "+12162963191", message: "x".repeat(1601), businessId: "biz-1" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reviewRequestMessage", () => {
  it("always carries the opt-out instruction", () => {
    const msg = reviewRequestMessage({
      customerName: "Dana Whitfield",
      businessName: "Acme Plumbing",
      reviewLink: "https://app.example.com/review/abc",
    });
    expect(msg).toContain("Reply STOP to opt out.");
  });

  it("greets by first name and includes the link", () => {
    const msg = reviewRequestMessage({
      customerName: "Dana Whitfield",
      businessName: "Acme Plumbing",
      reviewLink: "https://app.example.com/review/abc",
    });
    expect(msg).toContain("Hi Dana!");
    expect(msg).toContain("Acme Plumbing");
    expect(msg).toContain("https://app.example.com/review/abc");
    expect(msg).not.toContain("Whitfield");
  });

  it("falls back to a neutral greeting with no name", () => {
    const msg = reviewRequestMessage({
      customerName: null,
      businessName: "Acme Plumbing",
      reviewLink: "https://app.example.com/review/abc",
    });
    expect(msg).toContain("Hi there!");
  });

  it("words a follow-up differently from a first ask", () => {
    const first = reviewRequestMessage({
      customerName: "Dana",
      businessName: "Acme",
      reviewLink: "https://x.example/r",
    });
    const nudge = reviewRequestMessage({
      customerName: "Dana",
      businessName: "Acme",
      reviewLink: "https://x.example/r",
      followUp: true,
    });
    expect(nudge).not.toBe(first);
    expect(nudge).toContain("follow-up");
  });
});

describe("statusForSendFailure", () => {
  it("maps an opt-out to 409, not to a server error", () => {
    // The customer declining is the caller's answer, not a fault.
    expect(statusForSendFailure("opted_out")).toBe(409);
    expect(statusForSendFailure("not_configured")).toBe(503);
    expect(statusForSendFailure("invalid")).toBe(400);
    expect(statusForSendFailure("provider_error")).toBe(502);
    expect(statusForSendFailure(undefined)).toBe(502);
  });
});
