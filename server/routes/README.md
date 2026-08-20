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
`/api/ai-review-response`, `/api/auth/*`.

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
| POST | `/api/dataforseo/v3/<dataforseo path>` e.g. `/api/dataforseo/v3/serp/google/maps/live` | the DataForSEO task array exactly as today (`[{ keyword, location_coordinate, language_code, device, os, depth, se_domain, calculate_rectangles }]`, max 25 tasks) | raw DataForSEO envelope `{ status_code, status_message, tasks:[...] }` |
| POST | `/api/dataforseo/local-rankings` | `{ keyword*, latitude*, longitude*, language_code?, device?, os?, depth? }` | raw DataForSEO envelope for `serp/google/maps/live` |
| POST | `/api/dataforseo/proxy` | `{ endpoint:"/serp/google/maps/live", method?:"POST"\|"GET", body? }` | raw DataForSEO envelope |

Allowed path families: `serp/`, `business_data/`, `keywords_data/`, `dataforseo_labs/`,
`on_page/`, `backlinks/`, `domain_analytics/`, `appendix/`.
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
| POST | `/api/oauth/google_my_business/start` | auth | body `{ workspace_id? }` -> `{ authorizeUrl }`. Open `authorizeUrl` in the popup. **Use this instead of navigating the popup to `/authorize`** (a popup cannot send a Bearer header). |
| GET | `/api/oauth/google_my_business/authorize?workspace_id=` | auth | redirects to Google (API clients only) |
| GET | `/api/oauth/google_my_business/callback` | state nonce (10 min, single use) | posts `{ type:"oauth_success", platform:"google", data }` to `window.opener`. `data` no longer contains `refreshToken`; tokens are stored server-side in `google_oauth_tokens`. `data.accessToken` / `expiresAt` are still included for now. |

Client change needed in `client/pages/Settings.tsx` (`handleConnectGoogle`): call the
`/start` endpoint, then `window.open(authorizeUrl)`; drop the `googleRefreshToken` setting.

## Workflows

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/workflows/webhook-url` | auth | `{ workflowId*, business_id?, rotateSecret? }` | `{ success, webhookUrl, path, secret, signatureHeader:"x-webhook-signature", signatureScheme }` |
| POST | `/api/workflows/webhook/:workflowId` | **HMAC** | header `x-webhook-signature: sha256=<hex HMAC-SHA256(secret, raw body)>`; JSON body | `{ success, executionId, status, steps[], results?, message }`; `401` bad/missing signature, `403` no secret yet |
| GET | `/api/workflows/deliveries/:executionId` | auth | | `{ success, deliveries[] }` |
| POST | `/api/webhooks/register` | auth | `{ url*, events?, headers?, business_id? }` | `201 { success, webhook:{ id, url, secret } }` |

Inbound secret lives on the workflow's trigger step config (`steps[].config.webhook_secret`)
because `workflows` has no secret column. The mobile app / senders must sign payloads.

Action handlers: `webhook_send_webhook` (optional `config.signing_secret` adds an outbound
`X-Webhook-Signature`), `jobs_create_job` (inserts into `jobs`; reads `name/title`,
`description`, client name/email/phone, `address` from step config templates or payload),
`rss_add_item`. `reviews_send_review_email` and the `gmb` destination were removed.

## RSS

| Method | Path | Auth | |
|---|---|---|---|
| GET | `/api/rss/:workflowId` | no | RSS 2.0 XML |
| POST | `/api/rss/:workflowId/items` | auth | `{ item_title*, item_description?, item_link?, feed_title?, sub_account_id? }` -> `{ success, item }` |

## Unchanged (auth/payments step pending)

`/api/auth/*`, `/api/twilio/*`, `/api/webhooks/twilio`, `/api/payments/*`,
`/api/create-checkout-*`. `/api/webhooks/stripe` has a raw-body parser mounted but no handler yet.

## Removed

`/api/ping`, `/api/demo`, `server/routes/auth.ts`, `server/routes/demo.ts`, `shared/api.ts`,
`server_complete/`.

## Environment

Required (server refuses to start without): `SUPABASE_URL` (alias `VITE_SUPABASE_URL`),
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (alias `VITE_APP_URL`; public origin, e.g.
`https://app.example.com`).

Optional: `CORS_ORIGINS` (comma list; default `APP_URL`), `PORT` (default 8080),
`LOG_LEVEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VISION_MODEL`,
`GOOGLE_MAPS_API_KEY` (alias `VITE_GOOGLE_MAPS_API_KEY`), `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`,
`APP_VERSION`, plus the existing Stripe/PayPal/Twilio vars.
