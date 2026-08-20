import { Request, Response } from "express";
import { GOOGLE_MAPS_HOSTS, resolveFinalUrl, SafeFetchError } from "../lib/safeFetch";
import { logger } from "../lib/logger";

const UA = "Mozilla/5.0 (compatible; GoogleMapsURLResolver/1.0)";

/**
 * GET /api/resolve-url?url=  (auth)
 * Expands a short Google Maps link (maps.app.goo.gl, share.google, g.page, ...)
 * by following redirects server-side. Only Google Maps hosts are allowed.
 */
export async function handleResolveUrl(req: Request, res: Response) {
  const { url } = req.query;

  if (!url || typeof url !== "string" || url.length > 2048) {
    return res.status(400).json({ error: "Missing or invalid url query parameter" });
  }

  try {
    const resolvedUrl = await resolveFinalUrl(url, {
      allowedHosts: GOOGLE_MAPS_HOSTS,
      maxRedirects: 5,
      timeoutMs: 8000,
      headers: { "User-Agent": UA },
    });
    return res.json({ resolvedUrl });
  } catch (error) {
    if (error instanceof SafeFetchError) {
      const status = error.code === "host_not_allowed" || error.code === "bad_scheme" || error.code === "invalid_url" ? 400 : 502;
      return res.status(status).json({ error: error.message });
    }
    logger.error({ err: error }, "URL resolution error");
    return res.status(502).json({ error: "Failed to resolve URL" });
  }
}
