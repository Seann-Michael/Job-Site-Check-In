import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";

const log = logger.child({ module: "push" });

/** Expo's push gateway. A fixed, public host — not a caller-supplied URL. */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const BATCH = 100;

export function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && EXPO_TOKEN_RE.test(token);
}

export interface PushMessage {
  title: string;
  body: string;
  /** Small routing payload the app reads when the notification is tapped. */
  data?: Record<string, string>;
}

export interface PushResult {
  devices: number;
  sent: number;
  removed: number;
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

/**
 * Send one notification to every phone registered to the given users.
 *
 * Best-effort by design: a notification that cannot be delivered must never
 * fail the work that triggered it, so this never throws. A token Expo reports
 * as no longer registered (app deleted, permission revoked) is removed so it
 * is not retried forever.
 *
 * An absent `push_tokens` table is treated as "no devices" — the code can
 * deploy ahead of its migration without breaking the worker.
 */
export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<PushResult> {
  const result: PushResult = { devices: 0, sent: 0, removed: 0 };
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return result;

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.from("push_tokens").select("token").in("user_id", ids);
    if (error) {
      log.warn({ err: error.message }, "push token lookup failed");
      return result;
    }
    const tokens = Array.from(
      new Set(((data as Array<{ token: string }> | null) || []).map((r) => r.token).filter(isExpoPushToken)),
    );
    result.devices = tokens.length;
    if (tokens.length === 0) return result;

    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      const payload = chunk.map((to) => ({
        to,
        title: message.title.slice(0, 120),
        body: message.body.slice(0, 400),
        data: message.data ?? {},
        sound: "default",
      }));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          log.warn({ status: res.status }, "push gateway rejected the batch");
          continue;
        }
        const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
        const tickets = Array.isArray(json?.data) ? json!.data! : [];
        tickets.forEach((ticket, index) => {
          if (ticket?.status === "ok") result.sent += 1;
          else if (ticket?.details?.error === "DeviceNotRegistered") dead.push(chunk[index]);
        });
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, "push send failed");
      } finally {
        clearTimeout(timer);
      }
    }

    if (dead.length > 0) {
      const { error: delErr } = await db.from("push_tokens").delete().in("token", dead);
      if (!delErr) result.removed = dead.length;
    }
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "push failed");
  }
  return result;
}
