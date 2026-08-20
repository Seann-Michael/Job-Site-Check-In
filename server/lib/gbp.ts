/**
 * Google Business Profile (GBP) API client.
 *
 * Pulls live data (location, reviews, local posts, Q&A, performance insights)
 * from Google and performs mutations (review replies, local posts) on behalf of
 * a connected business. OAuth tokens live in `public.google_oauth_tokens`
 * (service-role only) and are keyed by workspace_id = the business owner's
 * `users.sub_account_id` (see server/routes/googleOAuth.ts).
 *
 * HONEST APPROVAL GATE: the GBP v4 endpoints (reviews / posts / Q&A / insights)
 * require the Google Cloud project to be approved for the Business Profile API.
 * Until then Google returns 403; we surface that as `GbpNotApprovedError` with
 * Google's own message and NEVER fabricate data.
 *
 * Google API hosts used:
 *  - mybusinessbusinessinformation.googleapis.com  (v1 location read)
 *  - mybusinessaccountmanagement.googleapis.com    (accounts)
 *  - mybusiness.googleapis.com                      (v4 reviews / localPosts)
 *  - mybusinessqanda.googleapis.com                 (v1 questions & answers)
 *  - businessprofileperformance.googleapis.com      (v1 performance metrics)
 */
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";

const log = logger.child({ module: "gbp" });

// ── Typed errors (exported) ─────────────────────────────────────────────────

/** No Google connection for this business's workspace. Callers should 409. */
export class GbpNotConnectedError extends Error {
  status = 409;
  constructor(message = "Google Business Profile is not connected for this business.") {
    super(message);
    this.name = "GbpNotConnectedError";
  }
}

/**
 * Google returned 403: the Cloud project is not approved for the Business
 * Profile API (or the account lacks access to this location). Carries Google's
 * own message so the UI can be specific and honest.
 */
export class GbpNotApprovedError extends Error {
  status = 403;
  constructor(message = "The Google Business Profile API is not approved for this project yet.") {
    super(message);
    this.name = "GbpNotApprovedError";
  }
}

/** Any other GBP failure (bad request, upstream error, unresolved location). */
export class GbpError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GbpError";
    this.status = status;
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface GbpTokens {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  googleAccountId: string | null;
  workspaceId: string | null;
  email: string | null;
  locations: any[];
  expiresAt: string | null;
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: string;
  rating: number; // 1..5
  comment: string;
  createTime: string | null;
  updateTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
}

export interface GbpLocalPost {
  name: string;
  summary: string;
  state: string | null;
  topicType: string | null;
  createTime: string | null;
  searchUrl: string | null;
  callToAction: { actionType?: string; url?: string } | null;
  media: Array<{ googleUrl?: string; sourceUrl?: string }>;
}

export interface GbpQuestion {
  name: string;
  text: string;
  author: string;
  createTime: string | null;
  totalAnswerCount: number;
  topAnswer: { text: string; author: string } | null;
}

export interface GbpInsights {
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  views: number;
  searches: number;
  rangeDays: number;
}

// Google star-rating enum → number.
const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  STAR_RATING_UNSPECIFIED: 0,
};

// Google API hosts.
const HOST_INFO = "https://mybusinessbusinessinformation.googleapis.com";
const HOST_V4 = "https://mybusiness.googleapis.com";
const HOST_QANDA = "https://mybusinessqanda.googleapis.com";
const HOST_PERF = "https://businessprofileperformance.googleapis.com";

const DEFAULT_TIMEOUT_MS = 15000;

// ── Token resolution / refresh ──────────────────────────────────────────────

/**
 * Resolve a business to its owner's workspace and load the most recent Google
 * OAuth token row for that workspace. Returns null when nothing is connected.
 *
 * workspace_id = the business owner's `users.sub_account_id`. We also accept
 * the business's own `account_id` as a fallback candidate, in case the
 * connection was stored under the account id directly.
 */
export async function getTokensForBusiness(businessId: string): Promise<GbpTokens | null> {
  const db = getSupabaseClient();

  const { data: biz, error: bizErr } = await db
    .from("businesses")
    .select("id, owner_id, account_id")
    .eq("id", businessId)
    .maybeSingle();
  if (bizErr) {
    log.error({ err: bizErr.message, businessId }, "getTokensForBusiness: business load failed");
    throw new GbpError("Could not load business.");
  }
  if (!biz) return null;

  const candidates = new Set<string>();
  if ((biz as any).account_id) candidates.add(String((biz as any).account_id));

  if ((biz as any).owner_id) {
    const { data: owner } = await db
      .from("users")
      .select("sub_account_id")
      .eq("id", (biz as any).owner_id)
      .maybeSingle();
    if (owner?.sub_account_id) candidates.add(String(owner.sub_account_id));
  }

  if (candidates.size === 0) return null;

  const { data: rows, error: tokErr } = await db
    .from("google_oauth_tokens")
    .select("id, access_token, refresh_token, google_account_id, workspace_id, email, locations, expires_at, updated_at")
    .in("workspace_id", Array.from(candidates))
    .order("updated_at", { ascending: false })
    .limit(1);
  if (tokErr) {
    log.error({ err: tokErr.message, businessId }, "getTokensForBusiness: token load failed");
    throw new GbpError("Could not load Google connection.");
  }
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  return {
    id: row.id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? null,
    googleAccountId: row.google_account_id ?? null,
    workspaceId: row.workspace_id ?? null,
    email: row.email ?? null,
    locations: Array.isArray(row.locations) ? row.locations : [],
    expiresAt: row.expires_at ?? null,
  };
}

function clientId(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_ID || "";
}
function clientSecret(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
}

/** True when the token expires within 2 minutes (or is already expired/absent). */
function isExpiring(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return true;
  return ms - Date.now() <= 2 * 60 * 1000;
}

/**
 * Return a valid access token for the business, refreshing via Google's token
 * endpoint when the stored one is within 2 minutes of expiry. Throws
 * GbpNotConnectedError when no tokens exist.
 */
export async function getFreshAccessToken(businessId: string): Promise<string> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  return refreshIfNeeded(tokens);
}

async function refreshIfNeeded(tokens: GbpTokens): Promise<string> {
  if (!isExpiring(tokens.expiresAt)) return tokens.accessToken;
  if (!tokens.refreshToken) {
    // Nothing to refresh with; the stored token is our only option. If it's
    // truly expired the API call will 401 and be surfaced clearly.
    return tokens.accessToken;
  }
  if (!clientId() || !clientSecret()) {
    throw new GbpError("Google OAuth is not configured on the server.", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let json: any;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: controller.signal,
    });
    json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      log.error({ status: res.status, error: json.error }, "Google token refresh failed");
      throw new GbpError("Could not refresh the Google connection. Please reconnect in Settings.", 502);
    }
  } catch (err) {
    if (err instanceof GbpError) throw err;
    log.error({ err }, "Google token refresh threw");
    throw new GbpError("Could not reach Google to refresh the connection.", 502);
  } finally {
    clearTimeout(timer);
  }

  const newAccess = json.access_token as string;
  const expiresAt = json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : null;

  // Persist the refreshed token.
  try {
    const db = getSupabaseClient();
    await db
      .from("google_oauth_tokens")
      .update({ access_token: newAccess, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("id", tokens.id);
  } catch (err) {
    log.warn({ err }, "Failed to persist refreshed Google token");
  }

  tokens.accessToken = newAccess;
  tokens.expiresAt = expiresAt;
  return newAccess;
}

// ── Location resolution ─────────────────────────────────────────────────────

interface ResolvedLocation {
  /** `accounts/{id}` — the GBP account resource. */
  accountName: string;
  /** `locations/{id}` — used by v1 / Q&A / performance APIs. */
  locationName: string;
  /** `accounts/{id}/locations/{id}` — used by v4 reviews / posts. */
  v4Name: string;
}

function idFrom(resource: string, kind: "locations" | "accounts"): string | null {
  if (!resource) return null;
  // Accept "locations/123", "accounts/9/locations/123", or a bare id.
  const m = new RegExp(`${kind}/([^/]+)`).exec(resource);
  if (m) return m[1];
  if (kind === "locations" && !resource.includes("/")) return resource; // bare id
  return null;
}

/**
 * Resolve the selected GBP location for a business into the resource names the
 * various Google APIs need. Uses `businesses.settings.selectedGmbAccountId`
 * plus the `locations` jsonb captured at connect time (which carries each
 * location's `name` and its parent `accountName`).
 */
async function resolveLocation(businessId: string, tokens: GbpTokens): Promise<ResolvedLocation> {
  const db = getSupabaseClient();
  const { data: biz } = await db
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  const settings = ((biz as any)?.settings as any) || {};
  const selected: string = settings.selectedGmbAccountId || "";
  const locs: any[] = Array.isArray(tokens.locations) ? tokens.locations : [];

  // Find the location entry whose name matches the selected resource (or, when
  // only one location is connected, use it).
  const selectedLocId = idFrom(selected, "locations");
  let match: any =
    locs.find((l) => l?.name && (l.name === selected || (selectedLocId && idFrom(l.name, "locations") === selectedLocId))) ||
    (locs.length === 1 ? locs[0] : undefined) ||
    (selected ? locs.find((l) => l?.name === selected) : undefined);

  // Derive the account + location ids.
  let accountId: string | null = null;
  let locationId: string | null = null;

  if (match) {
    accountId = idFrom(match.accountName || "", "accounts") || idFrom(match.name || "", "accounts");
    locationId = idFrom(match.name || "", "locations");
  }
  // Fall back to parsing the selected resource directly.
  if (!locationId) locationId = idFrom(selected, "locations");
  if (!accountId) accountId = idFrom(selected, "accounts") || idFrom(tokens.googleAccountId || "", "accounts");
  // Last resort: a single connected location's account.
  if (!accountId && locs.length === 1) accountId = idFrom(locs[0]?.accountName || locs[0]?.name || "", "accounts");

  if (!locationId) {
    throw new GbpError(
      "No Google Business Profile location is selected for this business. Choose a location in Settings.",
      400,
    );
  }
  if (!accountId) {
    throw new GbpError(
      "Could not resolve the Google account for the selected location. Reconnect Google in Settings.",
      400,
    );
  }

  return {
    accountName: `accounts/${accountId}`,
    locationName: `locations/${locationId}`,
    v4Name: `accounts/${accountId}/locations/${locationId}`,
  };
}

// ── Core fetch wrapper ──────────────────────────────────────────────────────

/**
 * Bearer-authenticated fetch against a fixed Google API host with a timeout.
 * On 401 it refreshes the token once and retries. On 403 it throws
 * GbpNotApprovedError (Business Profile API not approved). Other non-2xx
 * responses throw GbpError with a sanitized message.
 *
 * NOTE: these are fixed, trusted Google API hosts, so this deliberately uses a
 * plain timed fetch (AbortController timeout) rather than the SSRF-guarded
 * safeFetch. safeFetch's DNS-pinning and private-range blocking add no value
 * for constant Google hostnames and its rewrites would only get in the way.
 */
export async function gbpFetch(
  businessId: string,
  url: string,
  init: RequestInit = {},
  _retried = false,
): Promise<any> {
  const accessToken = await getFreshAccessToken(businessId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new GbpError("Google API request timed out.", 504);
    throw new GbpError("Could not reach the Google Business Profile API.", 502);
  } finally {
    clearTimeout(timer);
  }

  // 401 → refresh once and retry (unless we already retried).
  if (res.status === 401 && !_retried) {
    const tokens = await getTokensForBusiness(businessId);
    if (tokens) {
      // Force a refresh by pretending the token is expiring.
      tokens.expiresAt = null;
      await refreshIfNeeded(tokens);
    }
    return gbpFetch(businessId, url, init, true);
  }

  const bodyText = await res.text().catch(() => "");
  let body: any = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }
  }

  if (res.status === 403) {
    const gMsg = body?.error?.message || "The Business Profile API is not approved for this Google Cloud project yet.";
    throw new GbpNotApprovedError(gMsg);
  }
  if (res.status === 404) {
    throw new GbpError(body?.error?.message || "Google resource not found.", 404);
  }
  if (!res.ok) {
    const gMsg = body?.error?.message || `Google API error (${res.status}).`;
    log.warn({ status: res.status, url: url.split("?")[0] }, "gbpFetch non-ok");
    throw new GbpError(gMsg, res.status >= 500 ? 502 : 400);
  }

  return body ?? {};
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Business Information API: read the selected location's core fields. */
export async function getLocation(businessId: string): Promise<any> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { locationName } = await resolveLocation(businessId, tokens);
  const readMask =
    "name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,profile,metadata";
  const url = `${HOST_INFO}/v1/${locationName}?readMask=${encodeURIComponent(readMask)}`;
  return gbpFetch(businessId, url);
}

/** v4: list reviews for the selected location. */
export async function listReviews(businessId: string): Promise<GbpReview[]> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { v4Name } = await resolveLocation(businessId, tokens);
  const url = `${HOST_V4}/v4/${v4Name}/reviews`;
  const data = await gbpFetch(businessId, url);
  const reviews: any[] = Array.isArray(data?.reviews) ? data.reviews : [];
  return reviews.map(mapReview);
}

function mapReview(r: any): GbpReview {
  return {
    name: r.name || "",
    reviewId: r.reviewId || (typeof r.name === "string" ? r.name.split("/").pop() : "") || "",
    reviewer: r.reviewer?.displayName || "Anonymous",
    rating: STAR_MAP[r.starRating as string] ?? 0,
    comment: r.comment || "",
    createTime: r.createTime || null,
    updateTime: r.updateTime || null,
    reply: r.reviewReply
      ? { comment: r.reviewReply.comment || "", updateTime: r.reviewReply.updateTime || null }
      : null,
  };
}

/**
 * v4: reply to a review. `reviewName` is the full resource
 * (`accounts/x/locations/y/reviews/z`); a bare review id is also accepted and
 * expanded against the resolved location.
 */
export async function replyToReview(businessId: string, reviewName: string, comment: string): Promise<any> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { v4Name } = await resolveLocation(businessId, tokens);
  const full = reviewName.includes("/reviews/")
    ? reviewName
    : `${v4Name}/reviews/${reviewName.split("/").pop()}`;
  const url = `${HOST_V4}/v4/${full}/reply`;
  return gbpFetch(businessId, url, { method: "PUT", body: JSON.stringify({ comment }) });
}

/** v4: list local posts. */
export async function listLocalPosts(businessId: string): Promise<GbpLocalPost[]> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { v4Name } = await resolveLocation(businessId, tokens);
  const url = `${HOST_V4}/v4/${v4Name}/localPosts`;
  const data = await gbpFetch(businessId, url);
  const posts: any[] = Array.isArray(data?.localPosts) ? data.localPosts : [];
  return posts.map(mapLocalPost);
}

function mapLocalPost(p: any): GbpLocalPost {
  return {
    name: p.name || "",
    summary: p.summary || "",
    state: p.state || null,
    topicType: p.topicType || null,
    createTime: p.createTime || null,
    searchUrl: p.searchUrl || null,
    callToAction: p.callToAction || null,
    media: Array.isArray(p.media) ? p.media.map((m: any) => ({ googleUrl: m.googleUrl, sourceUrl: m.sourceUrl })) : [],
  };
}

export interface CreateLocalPostInput {
  summary: string;
  topicType?: string;
  callToAction?: { actionType: string; url?: string };
  media?: Array<{ mediaFormat?: string; sourceUrl: string }>;
}

/** v4: create a local post. */
export async function createLocalPost(businessId: string, input: CreateLocalPostInput): Promise<GbpLocalPost> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { v4Name } = await resolveLocation(businessId, tokens);
  const url = `${HOST_V4}/v4/${v4Name}/localPosts`;
  const body: any = {
    languageCode: "en-US",
    summary: input.summary,
    topicType: input.topicType || "STANDARD",
  };
  if (input.callToAction) {
    body.callToAction = {
      actionType: input.callToAction.actionType,
      ...(input.callToAction.url ? { url: input.callToAction.url } : {}),
    };
  }
  if (input.media && input.media.length) {
    body.media = input.media.map((m) => ({ mediaFormat: m.mediaFormat || "PHOTO", sourceUrl: m.sourceUrl }));
  }
  const data = await gbpFetch(businessId, url, { method: "POST", body: JSON.stringify(body) });
  return mapLocalPost(data);
}

/** Q&A API: list questions (with the top answer) for the selected location. */
export async function listQuestions(businessId: string): Promise<GbpQuestion[]> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { locationName } = await resolveLocation(businessId, tokens);
  const url = `${HOST_QANDA}/v1/${locationName}/questions?answersPerQuestion=1&pageSize=50`;
  const data = await gbpFetch(businessId, url);
  const questions: any[] = Array.isArray(data?.questions) ? data.questions : [];
  return questions.map((q) => {
    const top = Array.isArray(q.topAnswers) && q.topAnswers.length ? q.topAnswers[0] : null;
    return {
      name: q.name || "",
      text: q.text || "",
      author: q.author?.displayName || "Customer",
      createTime: q.createTime || null,
      totalAnswerCount: Number(q.totalAnswerCount || 0),
      topAnswer: top ? { text: top.text || "", author: top.author?.displayName || "Business" } : null,
    } as GbpQuestion;
  });
}

/** Performance API metrics we request over the trailing window. */
const PERF_METRICS = [
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
];

function ymd(d: Date): { year: number; month: number; day: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Performance API: fetch the trailing-30-day daily metric time series and
 * return a compact summary (calls, website clicks, direction requests, total
 * views, search views).
 */
export async function getInsights(businessId: string, rangeDays = 30): Promise<GbpInsights> {
  const tokens = await getTokensForBusiness(businessId);
  if (!tokens) throw new GbpNotConnectedError();
  const { locationName } = await resolveLocation(businessId, tokens);

  const end = new Date();
  const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const s = ymd(start);
  const e = ymd(end);

  const params = new URLSearchParams();
  for (const m of PERF_METRICS) params.append("dailyMetrics", m);
  params.set("dailyRange.start_date.year", String(s.year));
  params.set("dailyRange.start_date.month", String(s.month));
  params.set("dailyRange.start_date.day", String(s.day));
  params.set("dailyRange.end_date.year", String(e.year));
  params.set("dailyRange.end_date.month", String(e.month));
  params.set("dailyRange.end_date.day", String(e.day));

  const url = `${HOST_PERF}/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
  const data = await gbpFetch(businessId, url);

  const totals: Record<string, number> = {};
  const series: any[] = Array.isArray(data?.multiDailyMetricTimeSeries) ? data.multiDailyMetricTimeSeries : [];
  for (const group of series) {
    const inner: any[] = Array.isArray(group?.dailyMetricTimeSeries) ? group.dailyMetricTimeSeries : [];
    for (const dm of inner) {
      const metric = dm?.dailyMetric as string;
      const dated: any[] = dm?.timeSeries?.datedValues || [];
      const sum = dated.reduce((acc, dv) => acc + Number(dv?.value || 0), 0);
      totals[metric] = (totals[metric] || 0) + sum;
    }
  }

  const impressions =
    (totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) +
    (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) +
    (totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) +
    (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
  const searches =
    (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);

  return {
    calls: totals.CALL_CLICKS || 0,
    websiteClicks: totals.WEBSITE_CLICKS || 0,
    directionRequests: totals.BUSINESS_DIRECTION_REQUESTS || 0,
    views: impressions,
    searches,
    rangeDays,
  };
}

// Re-export for callers that need the resolver (e.g. the sync route logs it).
export { resolveLocation };
export type { ResolvedLocation };
