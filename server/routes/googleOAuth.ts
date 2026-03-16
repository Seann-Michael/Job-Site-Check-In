import { Request, Response } from "express";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

// Scopes needed for Google Business Profile access
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
].join(" ");

function getRedirectUri(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  return `${proto}://${host}/api/oauth/google_my_business/callback`;
}

/**
 * GET /api/auth/google/authorize
 * Also accessible at /api/oauth/google_my_business/authorize
 * Redirects the popup to Google's OAuth consent screen.
 * Query params:
 *   workspace_id - the workspace/account to attach the token to
 */
export function handleGoogleAuthorize(req: Request, res: Response) {
  if (!CLIENT_ID) {
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2 style="color:#c00">Google OAuth Not Configured</h2>
        <p>GOOGLE_OAUTH_CLIENT_ID is not set. Please add your Google OAuth credentials in Settings.</p>
        <script>
          window.opener && window.opener.postMessage(
            { type: 'oauth_error', platform: 'google', error: 'Google OAuth credentials not configured.' },
            window.location.origin
          );
          setTimeout(() => window.close(), 4000);
        </script>
      </body></html>
    `);
  }

  const state = Buffer.from(
    JSON.stringify({ workspace_id: req.query.workspace_id || "" })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * GET /api/auth/google/callback
 * Exchanges the authorization code for tokens, then closes the popup
 * and messages the opener with the result.
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  const { code, error, state } = req.query as Record<string, string>;

  const closeWithError = (msg: string) => {
    res.send(`
      <html><body>
        <script>
          window.opener && window.opener.postMessage(
            { type: 'oauth_error', platform: 'google', error: ${JSON.stringify(msg)} },
            window.location.origin
          );
          window.close();
        </script>
        <p>${msg}</p>
      </body></html>
    `);
  };

  if (error) return closeWithError(`Google denied access: ${error}`);
  if (!code) return closeWithError("No authorization code received.");

  let workspaceId = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    workspaceId = decoded.workspace_id || "";
  } catch {}

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: getRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json() as any;
    if (tokens.error) return closeWithError(`Token error: ${tokens.error_description || tokens.error}`);

    // Fetch the user's Google profile info
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json() as any;

    // Fetch Google Business Profile accounts (if scope was granted)
    let gmbAccounts: any[] = [];
    try {
      const gmbRes = await fetch(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const gmbData = await gmbRes.json() as any;
      gmbAccounts = gmbData.accounts || [];
    } catch {}

    const accountInfo = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      googleId: profile.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : null,
      gmbAccounts,
      workspaceId,
    };

    res.send(`
      <html><body>
        <script>
          window.opener && window.opener.postMessage(
            {
              type: 'oauth_success',
              platform: 'google',
              data: ${JSON.stringify(accountInfo)}
            },
            window.location.origin
          );
          window.close();
        </script>
        <p>Connected! You can close this window.</p>
      </body></html>
    `);
  } catch (err: any) {
    closeWithError(`Connection failed: ${err.message}`);
  }
}
