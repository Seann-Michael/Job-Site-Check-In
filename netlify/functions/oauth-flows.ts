import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OAuth credentials (these would be set in environment variables)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
}

// OAuth configurations for each platform
const getOAuthConfig = (platform: string, baseUrl: string): OAuthConfig => {
  const redirectUri = `${baseUrl}/api/oauth/${platform}/callback`;

  switch (platform) {
    case "google_ads":
      return {
        clientId: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/adwords"],
        redirectUri,
      };

    case "google_analytics":
      return {
        clientId: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        redirectUri,
      };

    case "google_search_console":
      return {
        clientId: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        redirectUri,
      };

    case "google_my_business":
      return {
        clientId: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/business.manage"],
        redirectUri,
      };

    case "meta_ads":
      return {
        clientId: META_APP_ID!,
        clientSecret: META_APP_SECRET!,
        authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
        scopes: ["ads_management", "ads_read", "business_management"],
        redirectUri,
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

// GET /api/oauth/:platform/authorize - Start OAuth flow
async function startOAuthFlow(event: HandlerEvent, platform: string) {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const token = params.get("token");

    if (!token) {
      throw new Error("Onboarding token is required");
    }

    // Verify onboarding session
    const { data: session, error } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("onboarding_token", token)
      .single();

    if (error || !session) {
      throw new Error("Invalid onboarding session");
    }

    if (new Date(session.expires_at) < new Date()) {
      throw new Error("Onboarding session expired");
    }

    // Check if platform is required for this session
    if (!session.required_platforms.includes(platform)) {
      throw new Error("Platform not required for this session");
    }

    const baseUrl =
      process.env.VITE_APP_URL ||
      event.headers.origin ||
      "https://localhost:3000";
    const config = getOAuthConfig(platform, baseUrl);

    // Generate state parameter for security
    const state = crypto.randomBytes(32).toString("base64url");

    // Store state and session info temporarily
    await supabase.from("oauth_activity_log").insert({
      session_id: session.id,
      platform,
      event_type: "oauth_started",
      event_data: { state },
    });

    // Build authorization URL
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", config.redirectUri);
    authUrl.searchParams.set("scope", config.scopes.join(" "));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", `${state}:${token}`);
    authUrl.searchParams.set("access_type", "offline"); // For Google APIs
    authUrl.searchParams.set("prompt", "consent"); // Force consent for refresh token

    // Redirect to OAuth provider
    return {
      statusCode: 302,
      headers: {
        ...headers,
        Location: authUrl.toString(),
      },
      body: "",
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// GET /api/oauth/:platform/callback - Handle OAuth callback
async function handleOAuthCallback(event: HandlerEvent, platform: string) {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error("Missing authorization code or state");
    }

    // Parse state to get original token
    const [stateParam, token] = state.split(":");

    if (!token) {
      throw new Error("Invalid state parameter");
    }

    // Verify onboarding session
    const { data: session, error: sessionError } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("onboarding_token", token)
      .single();

    if (sessionError || !session) {
      throw new Error("Invalid onboarding session");
    }

    const baseUrl =
      process.env.VITE_APP_URL ||
      event.headers.origin ||
      "https://localhost:3000";
    const config = getOAuthConfig(platform, baseUrl);

    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(code, config, platform);

    // Get account information
    const accountInfo = await getAccountInfo(
      tokenResponse.access_token,
      platform,
    );

    // Store access credentials
    await supabase.from("client_access").upsert({
      session_id: session.id,
      platform,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_expires_at: tokenResponse.expires_at,
      account_info: accountInfo,
      permissions: config.scopes,
      scopes: config.scopes,
      status: "connected",
      is_active: true,
      last_sync_at: new Date().toISOString(),
    });

    // Log successful connection
    await supabase.from("oauth_activity_log").insert({
      session_id: session.id,
      platform,
      event_type: "oauth_success",
      event_data: { accountInfo },
    });

    // Return success page with postMessage to parent window
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connected Successfully</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f8fafc;
          }
          .container {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 400px;
          }
          .success-icon {
            color: #10b981;
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          h1 { color: #1f2937; margin-bottom: 0.5rem; }
          p { color: #6b7280; margin-bottom: 1.5rem; }
          .account-info {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1.5rem;
          }
          button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          }
          button:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>Successfully Connected!</h1>
          <p>Your ${platform.replace("_", " ")} account has been connected.</p>
          ${
            accountInfo.accountName
              ? `
            <div class="account-info">
              <strong>Account:</strong> ${accountInfo.accountName}
              ${accountInfo.email ? `<br><strong>Email:</strong> ${accountInfo.email}` : ""}
            </div>
          `
              : ""
          }
          <p>You can close this window and continue with the onboarding process.</p>
          <button onclick="window.close()">Close Window</button>
        </div>
        <script>
          // Notify parent window of successful connection
          if (window.opener || window.parent) {
            const message = {
              type: 'oauth_callback',
              data: {
                success: true,
                platform: '${platform}',
                accountInfo: ${JSON.stringify(accountInfo)}
              }
            };
            (window.opener || window.parent).postMessage(message, '${baseUrl}');
          }
          
          // Auto-close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: successHtml,
    };
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Log error
    if (error instanceof Error) {
      try {
        const params = new URLSearchParams(event.queryStringParameters || {});
        const state = params.get("state");
        const [, token] = (state || "").split(":");

        if (token) {
          const { data: session } = await supabase
            .from("onboarding_sessions")
            .select("id")
            .eq("onboarding_token", token)
            .single();

          if (session) {
            await supabase.from("oauth_activity_log").insert({
              session_id: session.id,
              platform,
              event_type: "oauth_error",
              event_data: { error: error.message },
            });
          }
        }
      } catch (logError) {
        console.error("Failed to log OAuth error:", logError);
      }
    }

    const baseUrl =
      process.env.VITE_APP_URL ||
      event.headers.origin ||
      "https://localhost:3000";

    // Return error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Failed</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f8fafc;
          }
          .container {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 400px;
          }
          .error-icon {
            color: #ef4444;
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          h1 { color: #1f2937; margin-bottom: 0.5rem; }
          p { color: #6b7280; margin-bottom: 1.5rem; }
          .error-message {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            color: #dc2626;
          }
          button {
            background: #ef4444;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            margin-right: 0.5rem;
          }
          button:hover { background: #dc2626; }
          .secondary { background: #6b7280; }
          .secondary:hover { background: #4b5563; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">✗</div>
          <h1>Connection Failed</h1>
          <p>We couldn't connect your ${platform.replace("_", " ")} account.</p>
          <div class="error-message">
            ${(error as Error).message}
          </div>
          <button onclick="retry()">Try Again</button>
          <button class="secondary" onclick="window.close()">Close</button>
        </div>
        <script>
          // Notify parent window of error
          if (window.opener || window.parent) {
            const message = {
              type: 'oauth_callback',
              data: {
                success: false,
                platform: '${platform}',
                error: '${(error as Error).message}'
              }
            };
            (window.opener || window.parent).postMessage(message, '${baseUrl}');
          }
          
          function retry() {
            window.location.reload();
          }
        </script>
      </body>
      </html>
    `;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: errorHtml,
    };
  }
}

// Helper function to exchange authorization code for access token
async function exchangeCodeForToken(
  code: string,
  config: OAuthConfig,
  platform: string,
) {
  const tokenData = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const tokenResponse = await response.json();

  // Calculate token expiry
  let expiresAt = null;
  if (tokenResponse.expires_in) {
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + tokenResponse.expires_in);
    expiresAt = expiryDate.toISOString();
  }

  return {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: expiresAt,
  };
}

// Helper function to get account information from each platform
async function getAccountInfo(accessToken: string, platform: string) {
  switch (platform) {
    case "google_ads":
      return await getGoogleAdsAccountInfo(accessToken);
    case "google_analytics":
      return await getGoogleAnalyticsAccountInfo(accessToken);
    case "google_search_console":
      return await getGoogleSearchConsoleAccountInfo(accessToken);
    case "google_my_business":
      return await getGoogleMyBusinessAccountInfo(accessToken);
    case "meta_ads":
      return await getMetaAdsAccountInfo(accessToken);
    default:
      return { accountName: "Unknown Account", platform };
  }
}

async function getGoogleAdsAccountInfo(accessToken: string) {
  try {
    const response = await fetch(
      "https://googleads.googleapis.com/v14/customers:listAccessibleCustomers",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Google Ads account info");
    }

    const data = await response.json();
    const customerId = data.resourceNames?.[0]?.split("/")?.pop();

    if (customerId) {
      // Get customer details
      const customerResponse = await fetch(
        `https://googleads.googleapis.com/v14/customers/${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
          },
        },
      );

      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        return {
          accountId: customerId,
          accountName:
            customerData.descriptiveName || `Google Ads Account ${customerId}`,
          platform: "google_ads",
        };
      }
    }

    return {
      accountId: customerId || "unknown",
      accountName: "Google Ads Account",
      platform: "google_ads",
    };
  } catch (error) {
    console.error("Error getting Google Ads account info:", error);
    return {
      accountName: "Google Ads Account",
      platform: "google_ads",
    };
  }
}

async function getGoogleAnalyticsAccountInfo(accessToken: string) {
  try {
    const response = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Google Analytics account info");
    }

    const data = await response.json();
    const account = data.accounts?.[0];

    return {
      accountId: account?.name || "unknown",
      accountName: account?.displayName || "Google Analytics Account",
      platform: "google_analytics",
    };
  } catch (error) {
    console.error("Error getting Google Analytics account info:", error);
    return {
      accountName: "Google Analytics Account",
      platform: "google_analytics",
    };
  }
}

async function getGoogleSearchConsoleAccountInfo(accessToken: string) {
  try {
    const response = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Search Console account info");
    }

    const data = await response.json();
    const site = data.siteEntry?.[0];

    return {
      accountId: site?.siteUrl || "unknown",
      accountName: site?.siteUrl || "Google Search Console",
      platform: "google_search_console",
    };
  } catch (error) {
    console.error("Error getting Google Search Console account info:", error);
    return {
      accountName: "Google Search Console",
      platform: "google_search_console",
    };
  }
}

async function getGoogleMyBusinessAccountInfo(accessToken: string) {
  try {
    const response = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Google My Business account info");
    }

    const data = await response.json();
    const account = data.accounts?.[0];

    return {
      accountId: account?.name || "unknown",
      accountName: account?.accountName || "Google My Business",
      platform: "google_my_business",
    };
  } catch (error) {
    console.error("Error getting Google My Business account info:", error);
    return {
      accountName: "Google My Business",
      platform: "google_my_business",
    };
  }
}

async function getMetaAdsAccountInfo(accessToken: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?access_token=${accessToken}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Meta Ads account info");
    }

    const data = await response.json();
    const account = data.data?.[0];

    return {
      accountId: account?.id || "unknown",
      accountName: account?.name || "Meta Ads Account",
      platform: "meta_ads",
    };
  } catch (error) {
    console.error("Error getting Meta Ads account info:", error);
    return {
      accountName: "Meta Ads Account",
      platform: "meta_ads",
    };
  }
}

// Main handler
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const path = event.path.replace("/api/", "");
  const pathParts = path.split("/");

  try {
    if (pathParts[0] === "oauth" && pathParts[2] === "authorize") {
      return await startOAuthFlow(event, pathParts[1]);
    }

    if (pathParts[0] === "oauth" && pathParts[2] === "callback") {
      return await handleOAuthCallback(event, pathParts[1]);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Endpoint not found" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
