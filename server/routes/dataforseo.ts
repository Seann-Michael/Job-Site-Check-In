import { Router, Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * DataForSEO proxy. Credentials (DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD)
 * stay server-side. Mounted at /api/dataforseo behind requireAuth.
 *
 * Endpoints (see server/routes/README.md):
 *   GET  /api/dataforseo/status                 -> { configured: boolean }
 *   POST /api/dataforseo/test-connection        -> { ok: boolean }
 *   POST /api/dataforseo/v3/<dataforseo path>   -> raw DataForSEO response
 *        body: the DataForSEO task array (or object) exactly as the
 *        DataForSEO v3 API expects; e.g. POST /api/dataforseo/v3/serp/google/maps/live
 *   POST /api/dataforseo/proxy                  -> raw DataForSEO response
 *        body: { endpoint: "/serp/google/maps/live", method?: "POST"|"GET", body?: any }
 *        (legacy shape kept for the existing handler)
 *   POST /api/dataforseo/local-rankings         -> { status_code, tasks } (convenience)
 *        body: { keyword, latitude, longitude, language_code?, device?, os?, depth? }
 *
 * Every proxied POST counts against a per-user daily quota (see below);
 * bodies are capped at 5 tasks, `priority` is forced to 1 and `depth` <= 100.
 */
export const dataForSEORouter = Router();

const DATAFORSEO_BASE_URL = "https://api.dataforseo.com/v3";
const log = logger.child({ module: "dataforseo" });

/** Only these DataForSEO API families may be proxied. */
const ALLOWED_PREFIXES = [
  "serp/",
  "business_data/",
  "keywords_data/",
  "dataforseo_labs/",
  "on_page/",
  "backlinks/",
  "domain_analytics/",
  "appendix/",
];

const MAX_TASKS = 5;
const MAX_DEPTH = 100;

/**
 * Per-user daily quota (default 200 proxied calls/day, env DATAFORSEO_DAILY_LIMIT).
 *
 * CAVEAT: the counter is an in-memory Map keyed by `${userId}:${YYYY-MM-DD}`
 * (UTC). It is per process: with multiple instances each one has its own
 * budget, and a restart resets it. Good enough as a cost guard for a
 * single-instance deployment; move to Redis/Postgres before scaling out.
 */
const dailyUsage = new Map<string, number>();

function dailyLimit(): number {
  const n = Number(process.env.DATAFORSEO_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

function usageKey(userId: string, now = new Date()): string {
  return `${userId}:${now.toISOString().slice(0, 10)}`;
}

/** Increment today's counter for the user; returns false when over quota. */
export function consumeDailyQuota(userId: string): { ok: boolean; used: number; limit: number } {
  const key = usageKey(userId);
  // Drop stale days so the map does not grow unbounded.
  if (dailyUsage.size > 10_000) {
    const today = key.slice(key.lastIndexOf(":") + 1);
    for (const k of dailyUsage.keys()) if (!k.endsWith(today)) dailyUsage.delete(k);
  }
  const limit = dailyLimit();
  const used = (dailyUsage.get(key) ?? 0) + 1;
  if (used > limit) return { ok: false, used: used - 1, limit };
  dailyUsage.set(key, used);
  return { ok: true, used, limit };
}

/** Test hook: clear all counters. */
export function resetDailyQuota(): void {
  dailyUsage.clear();
}

function quotaMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
  const { ok, used, limit } = consumeDailyQuota(userId);
  res.setHeader("X-DataForSEO-Quota-Limit", String(limit));
  res.setHeader("X-DataForSEO-Quota-Used", String(Math.min(used, limit)));
  if (!ok) {
    log.warn({ userId, limit }, "DataForSEO daily quota exceeded");
    return res.status(429).json({ success: false, error: "Daily DataForSEO quota exceeded" });
  }
  return next();
}

/**
 * Normalise a pass-through task body: `priority` is forced to 1 (cheapest
 * queue) and `depth` is capped at MAX_DEPTH on every task object.
 */
function sanitizeTasks(body: unknown): unknown {
  const fix = (task: unknown) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) return task;
    const t = { ...(task as Record<string, unknown>) };
    if ("priority" in t) t.priority = 1;
    if (t.depth !== undefined) {
      const d = Number(t.depth);
      t.depth = Number.isFinite(d) ? Math.min(MAX_DEPTH, Math.max(1, Math.floor(d))) : MAX_DEPTH;
    }
    return t;
  };
  if (Array.isArray(body)) return body.map(fix);
  return fix(body);
}

function taskCount(body: unknown): number {
  if (Array.isArray(body)) return body.length;
  return body && typeof body === "object" ? 1 : 0;
}

function getCredentials(): { username: string; password: string } | null {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  return username && password ? { username, password } : null;
}

function normalizeEndpoint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let ep = raw.trim().replace(/^\/+/, "");
  if (ep.startsWith("v3/")) ep = ep.slice(3);
  if (!ep || ep.includes("..") || ep.includes("?") || ep.includes("#") || /[^a-zA-Z0-9_\-\/.]/.test(ep)) return null;
  if (!ALLOWED_PREFIXES.some((p) => ep.startsWith(p))) return null;
  return ep;
}

function validateBody(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (Array.isArray(body)) {
    if (body.length > MAX_TASKS) return `Too many tasks (max ${MAX_TASKS})`;
    return null;
  }
  if (typeof body === "object") return null;
  return "Body must be a JSON array of tasks or an object";
}

async function forward(
  req: Request,
  res: Response,
  endpoint: string,
  method: "GET" | "POST",
  body: unknown,
) {
  const reqLog = req.log ?? log;
  reqLog.info({ userId: req.user?.id, endpoint, method, tasks: taskCount(body) }, "DataForSEO proxy call");
  const credentials = getCredentials();
  if (!credentials) {
    return res.status(503).json({ success: false, error: "DataForSEO is not configured" });
  }

  const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const upstream = await fetch(`${DATAFORSEO_BASE_URL}/${endpoint}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      signal: controller.signal,
      ...(method === "POST" && body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await upstream.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      log.error({ status: upstream.status, body: text.slice(0, 300) }, "DataForSEO returned non-JSON");
      return res.status(502).json({ success: false, error: "DataForSEO returned an invalid response" });
    }

    if (!upstream.ok) {
      log.error({ status: upstream.status, status_code: data?.status_code, status_message: data?.status_message }, "DataForSEO error");
      return res.status(502).json({
        success: false,
        error: "DataForSEO request failed",
        status_code: data?.status_code,
        status_message: data?.status_message,
      });
    }

    // Pass the DataForSEO envelope straight through (status_code, tasks, ...)
    return res.json(data);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return res.status(504).json({ success: false, error: "DataForSEO request timed out" });
    }
    log.error({ err }, "DataForSEO proxy error");
    return res.status(502).json({ success: false, error: "DataForSEO request failed" });
  } finally {
    clearTimeout(timer);
  }
}

// GET /status
dataForSEORouter.get("/status", (_req, res) => {
  res.json({ success: true, configured: !!getCredentials() });
});

// POST /test-connection
dataForSEORouter.post("/test-connection", async (_req, res) => {
  const credentials = getCredentials();
  if (!credentials) return res.status(503).json({ ok: false, error: "DataForSEO is not configured" });
  const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
  try {
    const r = await fetch(`${DATAFORSEO_BASE_URL}/appendix/user_data`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await r.json().catch(() => ({}))) as any;
    res.json({ ok: r.ok && data?.status_code === 20000 });
  } catch (err) {
    log.warn({ err }, "DataForSEO connection test failed");
    res.json({ ok: false });
  }
});

// POST /proxy  { endpoint, method?, body? }   (legacy handler shape)
dataForSEORouter.post("/proxy", quotaMiddleware, async (req: Request, res: Response) => {
  const endpoint = normalizeEndpoint(req.body?.endpoint);
  if (!endpoint) return res.status(400).json({ success: false, error: "Invalid or disallowed endpoint" });
  const method = String(req.body?.method || "POST").toUpperCase();
  if (method !== "GET" && method !== "POST") return res.status(400).json({ success: false, error: "Unsupported method" });
  const bodyError = validateBody(req.body?.body);
  if (bodyError) return res.status(400).json({ success: false, error: bodyError });
  return forward(req, res, endpoint, method, sanitizeTasks(req.body?.body));
});

// POST /local-rankings  { keyword, latitude, longitude, ... }
dataForSEORouter.post("/local-rankings", quotaMiddleware, async (req: Request, res: Response) => {
  const { keyword, latitude, longitude, language_code, device, os, depth } = req.body ?? {};
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (typeof keyword !== "string" || !keyword.trim() || keyword.length > 200) {
    return res.status(400).json({ success: false, error: "keyword is required" });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, error: "latitude/longitude are required" });
  }
  const task = {
    keyword: keyword.trim(),
    location_coordinate: `${lat},${lng}`,
    language_code: typeof language_code === "string" ? language_code.slice(0, 8) : "en",
    device: device === "mobile" ? "mobile" : "desktop",
    os: typeof os === "string" ? os.slice(0, 16) : "windows",
    depth: Math.min(MAX_DEPTH, Math.max(10, Number(depth) || 20)),
    se_domain: "google.com",
    calculate_rectangles: true,
  };
  return forward(req, res, "serp/google/maps/live", "POST", [task]);
});

// POST /v3/<path>   body = DataForSEO task payload
dataForSEORouter.post("/v3/*path", quotaMiddleware, async (req: Request, res: Response) => {
  const p = req.params.path as unknown;
  const joined = Array.isArray(p) ? p.join("/") : String(p ?? "");
  const endpoint = normalizeEndpoint(joined);
  if (!endpoint) return res.status(400).json({ success: false, error: "Invalid or disallowed endpoint" });
  const bodyError = validateBody(req.body);
  if (bodyError) return res.status(400).json({ success: false, error: bodyError });
  return forward(req, res, endpoint, "POST", sanitizeTasks(req.body));
});

// Kept for backward compatibility with existing imports.
export const handleDataForSEOStatus = (_req: Request, res: Response) => {
  res.json({ success: true, configured: !!getCredentials() });
};
