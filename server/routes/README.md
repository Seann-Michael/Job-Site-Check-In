# Server API reference

All JSON unless noted. Errors are always `{ "error": string }` with no stack traces.

**Auth**: endpoints marked `auth` require `Authorization: Bearer <supabase access token>`
(`supabase.auth.getSession()` -> `session.access_token`). The server verifies the JWT and
loads the caller's `users` row; business/account scoping is derived from that, never from
`x-account-id` / `x-business-id` headers (those are no longer read).

Responses: `401` no/invalid token, `403` not allowed, `404` not found or not yours,
`413` too large, `415` bad media type, `429` rate limited, `502` upstream failed,
`503` feature not configured.

Rate limits: 300 req / 15 min per IP globally; 20 / 15 min on `/api/ai/*`,
`/api/ai-review-response`, `/api/auth/*`; 30 / hour **per user** on
`/api/twilio/sms/send` + `/api/twilio/review-request` (shared bucket). Limiters
run before body parsing.

Body limits: 1mb JSON globally; `/api/ai/*` accepts up to 8mb (base64 images).

**Roles.** `req.profile.role` drives a simple capability model: `super_admin`,
`business_owner` and `staff` may write; `viewer` is read-only and gets `403` on
every mutating route (media upload/delete, webhook register, workflow
webhook-url, Google OAuth connect, Twilio send/review-request, RSS add item).
Reads are unchanged. `super_admin` may act on any business; everyone else only
on businesses they own (`businesses.owner_id`).

Every response carries `X-Request-Id` (pino-http request id) for log correlation.
Logged URLs have their query string stripped (OAuth `?code=`/`?state=` never
reach the logs).

---

## Platform

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health`, `/api/health` | no | `{ status:"ok", uptime:number, version:string }` |

## AI (`/api/ai/*`, auth, 503 `{error:"AI not configured"}` without `OPENAI_API_KEY`)

| Method | Path | Request body | Response |
|---|---|---|---|
| POST | `/api/ai/enhance-description` | `{ description*, businessName?, city?, industry?, keywords?: string[], tone?, maxWords? (30-400, default 150) }` | `{ description }` |
| POST | `/api/ai/generate-keywords` | `{ businessName?, industry?, services?: string[], city?, description?, count? (3-40, default 15) }` (at least one of the first four) | `{ keywords: string[] }` |
| POST | `/api/ai/alt-text` | `{ imageUrl? \| imageBase64? (data URL or raw base64 + mimeType), mimeType?, context?, businessName?, city?, keywords?: string[] }` (max ~6MB image) | `{ altText, caption }` |
| POST | `/api/ai/service-description` | `{ serviceName*, businessName?, city?, industry?, details?, keywords?: string[], tone?, maxWords? (30-300, default 80) }` | `{ description }` |
| POST | `/api/ai/rewrite` | `{ text*, instruction?, tone?, maxWords? }` | `{ text }` |
| POST | `/api/ai-review-response` | `{ reviewText?, rating?, customerName?, projectName?, businessName?, existingResponse?, keywords?: string[] }` | `{ response, seoTips: string[] }` (no template fallback any more) |

Model: `OPENAI_MODEL` (default `gpt-4o-mini`); alt-text uses `OPENAI_VISION_MODEL` if set.

## DataForSEO proxy (`/api/dataforseo/*`, auth, 503 without `DATAFORSEO_USERNAME/PASSWORD`)

The client must stop calling `https://api.dataforseo.com/v3` directly and stop storing
credentials in localStorage.

| Method | Path | Request body | Response |
|---|---|---|---|
| GET | `/api/dataforseo/status` | | `{ success:true, configured:boolean }` |
| POST | `/api/dataforseo/test-connection` | | `{ ok:boolean }` |
| POST | `/api/dataforseo/v3/<dataforseo path>` e.g. `/api/dataforseo/v3/serp/google/maps/live` | the DataForSEO task array exactly as today (`[{ keyword, location_coordinate, language_code, device, os, depth, se_domain, calculate_rectangles }]`, **max 5 tasks**) | raw DataForSEO envelope `{ status_code, status_message, tasks:[...] }` |
| POST | `/api/dataforseo/local-rankings` | `{ keyword*, latitude*, longitude*, language_code?, device?, os?, depth? }` | raw DataForSEO envelope for `serp/google/maps/live` |
| POST | `/api/dataforseo/proxy` | `{ endpoint:"/serp/google/maps/live", method?:"POST"\|"GET", body? }` | raw DataForSEO envelope |

Allowed path families: `serp/`, `business_data/`, `keywords_data/`, `dataforseo_labs/`,
`on_page/`, `backlinks/`, `domain_analytics/`, `appendix/`.

**Quota and sanitisation.** Each proxied POST (`/v3/*`, `/proxy`, `/local-rankings`)
counts against a per-user daily quota: `DATAFORSEO_DAILY_LIMIT` requests/day
(default 200, UTC days). Over quota -> `429 { error:"Daily DataForSEO quota exceeded" }`;
`X-DataForSEO-Quota-Limit` / `X-DataForSEO-Quota-Used` headers report usage. The
counter is in-memory per process (single-instance only; resets on restart).
Bodies are capped at 5 tasks; on every task `priority` is forced to `1` and
`depth` is capped at `100`. Every proxied call is logged at info with
`userId`, `endpoint` and task count.
Drop-in for `client/lib/dataForSEO.ts`: change `makeRequest` to
`fetch("/api/dataforseo/v3" + endpoint, { method:"POST", headers:{ Authorization, "Content-Type":"application/json" }, body })`.

## Media (auth; Supabase Storage bucket `media`, path `<account_id>/<uuid>.<ext>`)

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/media/upload` | `multipart/form-data`: `file` (image/jpeg,png,webp,gif,heic,heif or video/mp4,quicktime,webm; max 25MB), `mediaType?`, `jobId?` (alias `projectId`), `isPublic?` ("true"/"false") | `201 { success:true, mediaFile:{ id, originalName, mimeType, size, mediaType, isPublic, jobId, storagePath, uploadedAt, uploadedBy, url, secureUrl, publicUrl } }` — `url` is a permanent public URL when `isPublic`, else a 1h signed URL |
| GET | `/api/media?jobId=` | | `{ media: MediaFile[] }` |
| GET | `/api/media/metadata/:mediaId` | | `MediaFile` (with fresh `url`) |
| GET | `/api/media/:mediaId/:filename` | | `302` to a 1h signed URL |
| DELETE | `/api/media/:mediaId` | | `{ success:true }` |
| GET | `/public/media/:publicId/:filename` | no auth | `302` to the public object URL |

Thumbnail endpoints (`/api/media/thumbs/...`, `/public/media/thumbs/...`) were removed.

## Google Maps helpers (auth)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/resolve-url?url=` | short Google Maps link (hosts: goo.gl, maps.app.goo.gl, google.com, www.google.com, maps.google.com, g.page, share.google) | `{ resolvedUrl }` |
| POST | `/api/google-place-lookup` | `{ url }` (same host allowlist) | place profile object (unchanged shape) — `503` when `GOOGLE_MAPS_API_KEY` missing |

## Google Business Profile OAuth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/oauth/google_my_business/start` | auth + write role | body `{ workspace_id? }` -> `{ authorizeUrl }`. Open `authorizeUrl` in the popup. **Use this instead of navigating the popup to `/authorize`** (a popup cannot send a Bearer header). |
| GET | `/api/oauth/google_my_business/authorize?workspace_id=` | auth + write role | redirects to Google (API clients only) |
| GET | `/api/oauth/google_my_business/callback` | state nonce (10 min, single use) | posts `{ type:"oauth_success", platform:"google", data }` to `window.opener`. `data` = `{ email, name, picture, googleId, expiresAt, gmbAccounts (locations), gmbAccountsRaw ({name,accountName,type}), gmbDebugErrors, workspaceId }`. **No tokens of any kind** (`accessToken` removed; `refreshToken` was already gone) — both live server-side in `google_oauth_tokens`. |

`workspace_id` is the caller's own account id (`users.sub_account_id`) from the
authenticated profile. A body/query `workspace_id` is only honoured when it equals
the caller's account id or one of their business ids; anything else -> `403`.

Client change needed in `client/pages/Settings.tsx` (`handleConnectGoogle`): call the
`/start` endpoint, then `window.open(authorizeUrl)`; drop the `googleRefreshToken` setting.

## Workflows

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/workflows/webhook-url` | auth + write role | `{ workflowId*, business_id?, rotateSecret? }` | `{ success, webhookUrl, path, secret, signatureHeader:"x-webhook-signature", timestampHeader:"x-webhook-timestamp", signatureScheme }` |
| POST | `/api/workflows/webhook/:workflowId` | **HMAC + timestamp** | headers `x-webhook-timestamp: <unix seconds>` and `x-webhook-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>`; JSON body | `{ success, executionId, status, steps[], results?, message }`; `401` missing/invalid timestamp, timestamp outside +/-300s, or bad signature; `403` no secret yet |
| GET | `/api/workflows/deliveries/:executionId` | auth | | `{ success, deliveries[] }` |
| POST | `/api/webhooks/register` | auth + write role | `{ url*, events?, headers?, business_id? }` | `201 { success, webhook:{ id, url, secret } }` |

Inbound secret lives on the workflow's trigger step config (`steps[].config.webhook_secret`)
because `workflows` has no secret column. The mobile app / senders must sign payloads.

**Signing (replay-protected, breaking change — the old body-only scheme is no
longer accepted):**

```js
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = "sha256=" + crypto.createHmac("sha256", secret)
  .update(`${timestamp}.${rawBody}`).digest("hex");
await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Signature": signature,
  },
  body: rawBody,
});
```

The server rejects requests whose timestamp differs from its clock by more than
300 seconds. Outbound `webhook_send_webhook` deliveries with `config.signing_secret`
use the same scheme and send both headers. Outbound responses are read up to
2 MB (larger bodies mark the delivery failed). `rss_add_item` derives
`sub_account_id` from the workflow's business owner, never from the payload.

Action handlers: `webhook_send_webhook` (optional `config.signing_secret` adds an outbound
`X-Webhook-Signature`), `jobs_create_job` (inserts into `jobs`; reads `name/title`,
`description`, client name/email/phone, `address` from step config templates or payload),
`rss_add_item`. `reviews_send_review_email` and the `gmb` destination were removed.

## RSS

| Method | Path | Auth | |
|---|---|---|---|
| GET | `/api/rss/:workflowId` | no | RSS 2.0 XML |
| POST | `/api/rss/:workflowId/items` | auth + write role | `{ item_title*, item_description?, item_link?, feed_title? }` -> `{ success, item }`. `sub_account_id` is always the caller's own account (a body value is ignored). |

## Auth (`/api/auth/*`, strict rate limit 20/15min)

Login and password reset are **not** server endpoints anymore — the client talks
to Supabase directly (`supabase.auth.signInWithPassword` /
`supabase.auth.resetPasswordForEmail`). MFA is deferred (fake handlers removed).

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/auth/logout` | no | | `{ success:true }` (session teardown is client-side) |
| POST | `/api/auth/change-password` | **auth** | `{ oldPassword*, newPassword* (>=8) }` | `{ success:true, message }` |

`change-password` changes **only the caller's own** password (identity comes from
the bearer token, never the body). The current password is verified with an anon
Supabase client (`signInWithPassword`) before the service-role admin API sets the
new one. `400` bad/missing current password or `newPassword` < 8; `503` when
`SUPABASE_ANON_KEY` is not configured.

**Removed:** `POST /api/auth/login`, `POST /api/auth/enable-mfa`,
`POST /api/auth/verify-mfa` (and their handlers).

## Admin (`/api/admin/*`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/admin/impersonate` | **auth + super_admin** | `{ userId* }` | `{ email, token, actionLink }` |

Impersonation without the target's password: the server generates a one-time
magic-link OTP for the target user (`auth.admin.generateLink({ type:"magiclink" })`)
and returns it. **The client completes impersonation by calling**
`supabase.auth.verifyOtp({ email, token, type:"magiclink" })` (using the returned
`email` + `token`), which yields a real session for the target user. `actionLink`
is the full magic-link URL as an alternative. The target's email is read from
Supabase Auth (`auth.admin.getUserById`). The `audit_logs` row (`action:"login"`,
`resource_type:"user"`, `details.event:"impersonate"` with actor/target ids +
emails) is written **before** the token is minted; if the insert fails the
request fails with `500` and no token is issued. `400` missing/self `userId`,
`403` caller not super_admin **or target is a super_admin**, `404` target not
found.

## Twilio (`/api/twilio/*`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/twilio/sms/send` | **auth + write role**, 30/h/user | `{ to*, message*, campaignId?, businessId? }` -> `{ success, messageId, status }`. `to` must be E.164 (`^\+[1-9]\d{6,14}$`), `message` <= 1600 chars; `businessId`, if given, must be one the caller owns (`403`). Upstream failures are a generic `502 { error:"SMS provider request failed" }` (Twilio error text is never echoed). `503` when Twilio is not configured. |
| POST | `/api/twilio/review-request` | **auth + write role**, 30/h/user | `{ to*, businessName* (<=120), reviewLink*, customerName? (<=80), businessId? }`. `reviewLink` must be an `https` URL whose host equals the `APP_URL` host (`400` otherwise, including when `APP_URL` is unset). Same `to`/`businessId` rules as above. |
| GET | `/api/twilio/test` | **auth** | upstream account check (leaks account info -> protected) |
| GET | `/api/twilio/status` | no | `{ success, configured, hasPhoneNumber }` — booleans only, no secrets |
| POST | `/api/webhooks/twilio` | no | Twilio delivery-status callbacks. **Left open because Twilio calls it; still needs Twilio signature (`X-Twilio-Signature`) verification — deferred to the Twilio step.** |

## Still open (intentionally)

- `/api/payments/*`, `/api/create-checkout-*` — deferred to the payments step (not touched here).
- `/api/webhooks/stripe` — raw-body parser mounted, handler lands with payments.
- `/api/webhooks/twilio` — Twilio-called, signature verification deferred (above).
- `/api/workflows/webhook/:workflowId` — public but HMAC-verified.
- `/api/rss/:workflowId` (GET feed) and `/api/oauth/google_my_business/callback` — public by design (feed readers / OAuth redirect with a single-use state nonce).
- `/api/twilio/status`, `/health`, `/api/health` — no secrets, safe to leave open.

## Removed

`/api/ping`, `/api/demo`, `server/routes/auth.ts`, `server/routes/demo.ts`, `shared/api.ts`,
`server_complete/`.

## Environment

Required (server refuses to start without): `SUPABASE_URL` (alias `VITE_SUPABASE_URL`),
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (alias `VITE_APP_URL`; public origin, e.g.
`https://app.example.com`).

Optional: `SENTRY_DSN` (enables `@sentry/node` error reporting for 5xx handler
errors and unhandled rejections; off when unset), `SENTRY_ENVIRONMENT`,
`SENTRY_TRACES_SAMPLE_RATE`, `DATAFORSEO_DAILY_LIMIT` (default 200),
`SUPABASE_ANON_KEY` (alias `VITE_SUPABASE_ANON_KEY`; required for
`/api/auth/change-password` old-password verification), `CORS_ORIGINS` (comma
list; default `APP_URL`), `PORT` (default 8080),
`LOG_LEVEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VISION_MODEL`,
`GOOGLE_MAPS_API_KEY` (alias `VITE_GOOGLE_MAPS_API_KEY`), `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`,
`APP_VERSION`, plus the existing Stripe/PayPal/Twilio vars.
