import type { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";

const log = logger.child({ module: "client-errors" });

const SEVERITIES = new Set(["fatal", "error", "warning"]);

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * POST /api/client-errors  (requireAuth)
 *
 * The one writer of `crash_logs`. The mobile app and the web error boundary
 * report an uncaught error here so a crash reaches the operator without anyone
 * sending a screenshot. Until this existed the table had no writer at all.
 *
 * The reporter is taken from the verified token, never from the body, and every
 * free-text field is length-capped: this endpoint accepts text a client
 * controls, so it must not become a place to park arbitrary data.
 *
 * Always answers 204 once the request is authenticated and well-formed, even if
 * the insert fails — an error reporter that surfaces its own failure to the
 * user is worse than one that drops a report.
 */
export async function handleClientError(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const message = clip(body.message, 2000);
  if (!message) return res.status(400).json({ error: "message is required" });

  const severityRaw = typeof body.severity === "string" ? body.severity.toLowerCase() : "";
  const row = {
    severity: SEVERITIES.has(severityRaw) ? severityRaw : "error",
    component: clip(body.component, 200),
    message,
    stack: clip(body.stack, 8000),
    user_id: req.user.id,
    user_agent: clip(body.userAgent, 400) ?? clip(req.headers["user-agent"], 400),
    url: clip(body.url, 500),
  };

  try {
    const { error } = await getSupabaseClient().from("crash_logs").insert(row);
    if (error) log.warn({ err: error.message }, "crash log insert failed");
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "crash log insert threw");
  }
  log.error({ severity: row.severity, component: row.component, userId: row.user_id, url: row.url }, `client error: ${message.slice(0, 300)}`);
  return res.status(204).end();
}
