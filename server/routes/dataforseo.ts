import { Router, Request, Response } from "express";
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

const MAX_TASKS = 25;

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
  res: Response,
  endpoint: string,
  method: "GET" | "POST",
  body: unknown,
) {
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
dataForSEORouter.post("/proxy", async (req: Request, res: Response) => {
  const endpoint = normalizeEndpoint(req.body?.endpoint);
  if (!endpoint) return res.status(400).json({ success: false, error: "Invalid or disallowed endpoint" });
  const method = String(req.body?.method || "POST").toUpperCase();
  if (method !== "GET" && method !== "POST") return res.status(400).json({ success: false, error: "Unsupported method" });
  const bodyError = validateBody(req.body?.body);
  if (bodyError) return res.status(400).json({ success: false, error: bodyError });
  return forward(res, endpoint, method, req.body?.body);
});

// POST /local-rankings  { keyword, latitude, longitude, ... }
dataForSEORouter.post("/local-rankings", async (req: Request, res: Response) => {
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
    depth: Math.min(100, Math.max(10, Number(depth) || 20)),
    se_domain: "google.com",
    calculate_rectangles: true,
  };
  return forward(res, "serp/google/maps/live", "POST", [task]);
});

// POST /v3/<path>   body = DataForSEO task payload
dataForSEORouter.post("/v3/*path", async (req: Request, res: Response) => {
  const p = req.params.path as unknown;
  const joined = Array.isArray(p) ? p.join("/") : String(p ?? "");
  const endpoint = normalizeEndpoint(joined);
  if (!endpoint) return res.status(400).json({ success: false, error: "Invalid or disallowed endpoint" });
  const bodyError = validateBody(req.body);
  if (bodyError) return res.status(400).json({ success: false, error: bodyError });
  return forward(res, endpoint, "POST", req.body);
});

// Kept for backward compatibility with existing imports.
export const handleDataForSEOStatus = (_req: Request, res: Response) => {
  res.json({ success: true, configured: !!getCredentials() });
};
