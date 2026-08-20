import { Request, Response } from "express";
import { getAppUrl } from "../lib/env";
import { logger } from "../lib/logger";
import { createOAuthState, consumeOAuthState } from "../lib/oauthState";
import { getSupabaseClient } from "../supabaseClient";

const log = logger.child({ module: "googleOAuth" });

// Scopes needed for Google Business Profile access
const SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/business.manage"].join(" ");

function clientId(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_ID || "";
}
function clientSecret(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
}

/** Redirect URI is derived from APP_URL, never from Host headers. */
function getRedirectUri(): string {
  return `${getAppUrl()}/api/oauth/google_my_business/callback`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON safe to embed inside a <script> block. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function popupPage(res: Response, status: number, message: unknown, payload: Record<string, unknown>, closeDelayMs = 0) {
  res
    .status(status)
    .type("html")
    .send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google connection</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
  <p>${escapeHtml(message)}</p>
  <script>
    (function () {
      var msg = ${scriptJson(payload)};
      if (window.opener) { window.opener.postMessage(msg, window.location.origin); }
      setTimeout(function () { window.close(); }, ${Number(closeDelayMs) || 0});
    })();
  </script>
</body></html>`);
}

const errorPage = (res: Response, status: number, msg: string, delay = 0) =>
  popupPage(res, status, msg, { type: "oauth_error", platform: "google", error: msg }, delay);

function buildAuthorizeUrl(req: Request): { url?: string; error?: { status: number; message: string } } {
  if (!clientId() || !clientSecret()) {
    return { error: { status: 503, message: "Google OAuth is not configured on the server." } };
  }
  let redirectUri: string;
  try {
    redirectUri = getRedirectUri();
  } catch (err) {
    log.error({ err }, "APP_URL missing for OAuth redirect");
    return { error: { status: 500, message: "Server is misconfigured." } };
  }

  const rawWorkspace = (req.body?.workspace_id ?? req.query.workspace_id) as unknown;
  const workspaceId = typeof rawWorkspace === "string" ? rawWorkspace.slice(0, 128) : "";
  const state = createOAuthState({ workspace_id: workspaceId, user_id: req.user?.id || "" });

  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}

/**
 * POST /api/oauth/google_my_business/start  (auth)  { workspace_id? }
 * Returns { authorizeUrl } for the client to open in a popup. This is the
 * recommended flow: a popup cannot carry an Authorization header, so the
 * authenticated request happens here and the popup only visits Google.
 */
export function handleGoogleStart(req: Request, res: Response) {
  const { url, error } = buildAuthorizeUrl(req);
  if (error) return res.status(error.status).json({ error: error.message });
  res.json({ authorizeUrl: url });
}

/**
 * GET /api/oauth/google_my_business/authorize?workspace_id=  (auth)
 * Redirects straight to Google's consent screen. Only usable by callers that
 * can send a Bearer header on a navigation (API clients); browsers should use
 * the POST /start endpoint above.
 */
export function handleGoogleAuthorize(req: Request, res: Response) {
  const { url, error } = buildAuthorizeUrl(req);
  if (error) return errorPage(res, error.status, error.message, 4000);
  res.redirect(url!);
}

/**
 * GET /api/oauth/google_my_business/callback  (public; protected by state nonce)
 * Exchanges the code for tokens, stores them server-side in
 * google_oauth_tokens, then posts a summary (no refresh token) to the opener.
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  const { code, error, state } = req.query as Record<string, string | undefined>;

  const stateData = consumeOAuthState(state);
  if (!stateData) {
    return errorPage(res, 400, "This sign-in link has expired or is invalid. Please try again.");
  }
  if (error) {
    log.warn({ error }, "Google OAuth denied");
    return errorPage(res, 400, "Google denied access.");
  }
  if (!code) return errorPage(res, 400, "No authorization code received.");

  const workspaceId = stateData.workspace_id;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId(),
        client_secret: clientSecret(),
        redirect_uri: getRedirectUri(),
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenRes.json()) as any;
    if (!tokenRes.ok || tokens.error) {
      log.error({ status: tokenRes.status, error: tokens.error, description: tokens.error_description }, "Google token exchange failed");
      return errorPage(res, 502, "Could not complete Google sign-in. Please try again.");
    }

    const authHeader = { Authorization: `Bearer ${tokens.access_token}` };

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: authHeader });
    const profile = (await profileRes.json()) as any;

    // Google Business Profile accounts, then locations under each account.
    const gmbLocations: any[] = [];
    const debugErrors: string[] = [];
    let gmbAccounts: any[] = [];
    try {
      const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: authHeader });
      const accountsData = (await accountsRes.json()) as any;
      if (accountsData.error) {
        debugErrors.push(`Accounts API error: ${accountsData.error.message || "unknown"}`);
      } else {
        gmbAccounts = accountsData.accounts || [];
      }
    } catch (e: any) {
      debugErrors.push("Accounts fetch failed");
      log.warn({ err: e }, "GBP accounts fetch failed");
    }

    for (const account of gmbAccounts) {
      try {
        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,phoneNumbers`,
          { headers: authHeader },
        );
        const locData = (await locRes.json()) as any;
        if (locData.error) {
          debugErrors.push(`Locations API error for ${account.name}: ${locData.error.message || "unknown"}`);
        } else if (locData.locations?.length) {
          for (const loc of locData.locations) {
            gmbLocations.push({
              name: loc.name,
              title: loc.title || "",
              address: loc.storefrontAddress
                ? [loc.storefrontAddress.addressLines?.[0], loc.storefrontAddress.locality, loc.storefrontAddress.administrativeArea]
                    .filter(Boolean)
                    .join(", ")
                : "",
              phone: loc.phoneNumbers?.primaryPhone || "",
              accountName: account.name,
            });
          }
          continue;
        }
      } catch (e: any) {
        debugErrors.push(`Locations fetch failed for ${account.name}`);
        log.warn({ err: e, account: account.name }, "GBP locations v1 fetch failed");
      }

      // Legacy v4 fallback
      try {
        const legacyRes = await fetch(`https://mybusiness.googleapis.com/v4/${account.name}/locations`, { headers: authHeader });
        const legacyData = (await legacyRes.json()) as any;
        if (legacyData.locations?.length) {
          for (const loc of legacyData.locations) {
            gmbLocations.push({
              name: loc.name,
              title: loc.locationName || loc.name,
              address: loc.address
                ? [loc.address.addressLines?.[0], loc.address.locality, loc.address.administrativeArea].filter(Boolean).join(", ")
                : "",
              phone: loc.primaryPhone || "",
              accountName: account.name,
            });
          }
        } else if (legacyData.error) {
          debugErrors.push(`Legacy API error for ${account.name}: ${legacyData.error.message || "unknown"}`);
        }
      } catch (e: any) {
        debugErrors.push(`Legacy locations fetch failed for ${account.name}`);
        log.warn({ err: e, account: account.name }, "GBP locations v4 fetch failed");
      }
    }

    const expiresAtMs = tokens.expires_in ? Date.now() + Number(tokens.expires_in) * 1000 : null;

    // Persist tokens server-side (service role only table).
    await storeTokens({
      workspaceId,
      userId: stateData.user_id,
      googleAccountId: profile.sub,
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
      scopes: typeof tokens.scope === "string" ? tokens.scope.split(" ") : SCOPES.split(" "),
      locations: gmbLocations,
    });

    // The refresh token is intentionally NOT sent to the browser; it lives in
    // google_oauth_tokens and is used by server-side GBP calls.
    const accountInfo = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      googleId: profile.sub,
      accessToken: tokens.access_token,
      expiresAt: expiresAtMs,
      gmbAccounts: gmbLocations,
      gmbAccountsRaw: gmbAccounts,
      gmbDebugErrors: debugErrors,
      workspaceId,
    };

    return popupPage(res, 200, "Connected. You can close this window.", {
      type: "oauth_success",
      platform: "google",
      data: accountInfo,
    });
  } catch (err) {
    log.error({ err }, "Google OAuth callback failed");
    return errorPage(res, 502, "Connection failed. Please try again.");
  }
}

async function storeTokens(t: {
  workspaceId: string;
  userId: string;
  googleAccountId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string | null;
  scopes: string[];
  locations: any[];
}) {
  if (!t.googleAccountId) return;
  try {
    const db = getSupabaseClient();
    const row: Record<string, any> = {
      workspace_id: t.workspaceId || null,
      user_id: t.userId || null,
      google_account_id: t.googleAccountId,
      email: t.email ?? null,
      access_token: t.accessToken,
      expires_at: t.expiresAt,
      scopes: t.scopes,
      locations: t.locations,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the refresh token when Google issued a new one.
    if (t.refreshToken) row.refresh_token = t.refreshToken;

    const { error } = await db
      .from("google_oauth_tokens")
      .upsert(row, { onConflict: "workspace_id,google_account_id" });
    if (error) log.error({ err: error }, "Failed to store Google OAuth tokens");
  } catch (err) {
    log.error({ err }, "Failed to store Google OAuth tokens");
  }
}
