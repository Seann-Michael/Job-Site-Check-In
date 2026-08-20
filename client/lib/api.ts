import { supabaseClient } from "./supabaseClient";

/** Error thrown by apiFetch for non-2xx responses or network failures. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** True when the server reports the feature is not configured (503). */
  get isUnavailable(): boolean {
    return this.status === 503;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper for calls to this app's `/api/*` backend.
 * - Attaches `Authorization: Bearer <supabase access token>` when a session exists.
 * - Serialises plain-object bodies as JSON (FormData passes through untouched).
 * - Parses JSON responses; throws `ApiError` with status + server message on failure.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: BodyInit | Record<string, unknown> | null } = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  const token = await getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = undefined;
  if (init.body instanceof FormData || init.body instanceof Blob || typeof init.body === "string") {
    body = init.body as BodyInit;
  } else if (init.body && typeof init.body === "object") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, body });
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  }

  const contentType = response.headers.get("content-type") || "";
  let payload: unknown = null;
  if (response.status !== 204) {
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      payload = text.length ? text : null;
    }
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && typeof (payload as any).error === "string"
        ? (payload as any).error
        : payload && typeof payload === "object" && typeof (payload as any).message === "string"
          ? (payload as any).message
          : typeof payload === "string" && payload
            ? payload
            : response.statusText) || `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

/** Standard toast copy for a 503 from an AI endpoint. */
export const AI_UNAVAILABLE_MESSAGE = "AI features aren't configured";

/**
 * Convenience wrappers for the AI endpoints. Each throws ApiError; callers
 * should check `isApiError(e) && e.isUnavailable` to show AI_UNAVAILABLE_MESSAGE.
 */
export const aiApi = {
  enhanceDescription: (text: string, context?: string) =>
    apiFetch<{ text: string }>("/api/ai/enhance-description", {
      method: "POST",
      body: { text, context },
    }),
  generateKeywords: (text: string, location?: string, count?: number) =>
    apiFetch<{ keywords: string[] }>("/api/ai/generate-keywords", {
      method: "POST",
      body: { text, location, count },
    }),
  altText: (imageUrl: string) =>
    apiFetch<{ altText: string }>("/api/ai/alt-text", {
      method: "POST",
      body: { imageUrl },
    }),
  serviceDescription: (serviceName: string, businessName?: string, location?: string) =>
    apiFetch<{ text: string }>("/api/ai/service-description", {
      method: "POST",
      body: { serviceName, businessName, location },
    }),
  rewrite: (text: string, tone?: string) =>
    apiFetch<{ text: string }>("/api/ai/rewrite", {
      method: "POST",
      body: { text, tone },
    }),
};

/** Returns the user-facing message for an error from an AI call. */
export function aiErrorMessage(err: unknown): string {
  if (isApiError(err) && err.isUnavailable) return AI_UNAVAILABLE_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return "Request failed";
}
