/**
 * Fetch wrapper for this app's own Express API (`/api/*` on API_BASE_URL) —
 * the mobile counterpart of client/lib/api.ts on the web.
 *
 * - Attaches `Authorization: Bearer <supabase access token>` when signed in.
 * - Serialises plain-object bodies as JSON.
 * - Parses JSON responses; throws `ApiError` with status + server message.
 * - Times out (default 20s) so a dead network never hangs a screen.
 */
import { API_BASE_URL, isApiConfigured } from '@/lib/config';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function accessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface ApiInit extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown> | string | null;
  timeoutMs?: number;
}

export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiError(0, 'The web app API URL is not configured for this build.');
  }
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  const token = await accessToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  let body: string | undefined;
  if (typeof init.body === 'string') {
    body = init.body;
  } else if (init.body && typeof init.body === 'object') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers, body, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new ApiError(0, aborted ? 'The request timed out.' : 'Could not reach the server.');
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown = null;
  if (response.status !== 204) {
    const text = await response.text().catch(() => '');
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
  }

  if (!response.ok) {
    const record = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const message =
      (typeof record.error === 'string' && record.error) ||
      (typeof record.message === 'string' && record.message) ||
      `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

/** Human-readable message for any thrown value. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
