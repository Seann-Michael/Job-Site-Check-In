# Google Business Profile (GBP) Live Integration

Live integration with Google Business Profile: pull real reviews, local posts,
Q&A and performance insights from Google, reply to reviews, and create posts —
then sync a subset into the app's own tables so the **GMB Optimization** page
shows live data.

> **Honest approval gate.** The GBP **v4** endpoints (reviews, posts, Q&A,
> insights) require the Google Cloud project to be **approved for the Business
> Profile API**. Until that approval is granted, Google returns **403** for
> those endpoints. The integration surfaces this as a clear, specific message
> and **never fabricates data**. The Business Information API (location, hours)
> is generally available and works before approval.

## What's built

- **`server/lib/gbp.ts`** — the GBP client. Token resolution + refresh, a timed
  bearer-auth `gbpFetch` wrapper, and typed helpers: `getLocation`,
  `listReviews`, `replyToReview`, `listLocalPosts`, `createLocalPost`,
  `listQuestions`, `getInsights`. Exports typed errors `GbpNotConnectedError`,
  `GbpNotApprovedError`, `GbpError`.
- **`server/routes/gbp.ts`** — `/api/gbp/*` routes (all `requireAuth`, per-
  business access checks, rate-limited mutations). Includes a `POST .../sync`
  that upserts live data into `gmb_profiles`, `gmb_hours`, `reviews`,
  `gmb_qas`, and `gmb_audit_results`.
- **`client/lib/gbpService.ts`** — typed `apiFetch` client.
- **`client/pages/GMBOptimization.tsx`** — "Sync from Google" button, live
  Reviews / Posts / Insights tabs and tiles, reply + create-post dialogs, and
  honest three-state messaging.
- **`supabase/migrations/20260820015000_gbp_reviews_dedup_index.sql`** — index +
  partial-unique index for review de-duplication (apply manually).

## OAuth scope

The connection (built separately in `server/routes/googleOAuth.ts`) requests:

```
openid email profile https://www.googleapis.com/auth/business.manage
```

`business.manage` is the scope Google requires for all GBP management APIs.

## Token & refresh model

- Tokens live in **`public.google_oauth_tokens`** (service-role only; RLS on,
  no client policies). The refresh token never reaches the browser.
- **Workspace key.** A token row's `workspace_id` = the business **owner's**
  `users.sub_account_id` (this equals `req.profile.accountId`). Resolution:
  `businesses.id` → `businesses.owner_id` → `users.sub_account_id`
  (with `businesses.account_id` as a fallback candidate). The most recently
  updated matching row is used.
- **Location selection.** A business picks its GBP location in
  `businesses.settings.selectedGmbAccountId` (a location resource name or bare
  id). The client resolves it against the `locations` jsonb captured at connect
  time to derive `accounts/{id}`, `locations/{id}`, and the v4 combined
  `accounts/{id}/locations/{id}` resource names.
- **Refresh.** `getFreshAccessToken(businessId)` returns the stored access token
  unless it is within **2 minutes** of expiry (or already expired), in which
  case it refreshes via
  `POST https://oauth2.googleapis.com/token`
  (`grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`),
  persists the new `access_token` + `expires_at`, and returns the new token.
  `gbpFetch` also refreshes **once** on a `401` and retries.
- Refresh uses `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.

## Google APIs & hosts used

| Purpose | Method + path | Host |
| --- | --- | --- |
| Read location (name, address, phone, website, hours, categories, profile) | `GET /v1/{locations/ID}?readMask=…` | `mybusinessbusinessinformation.googleapis.com` |
| List accounts (connect flow) | `GET /v1/accounts` | `mybusinessaccountmanagement.googleapis.com` |
| List reviews | `GET /v4/{accounts/A/locations/L}/reviews` | `mybusiness.googleapis.com` |
| Reply to a review | `PUT /v4/{accounts/A/locations/L}/reviews/{ID}/reply` | `mybusiness.googleapis.com` |
| List local posts | `GET /v4/{accounts/A/locations/L}/localPosts` | `mybusiness.googleapis.com` |
| Create a local post | `POST /v4/{accounts/A/locations/L}/localPosts` | `mybusiness.googleapis.com` |
| List Q&A | `GET /v1/{locations/ID}/questions` | `mybusinessqanda.googleapis.com` |
| Performance metrics (30 days) | `GET /v1/{locations/ID}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=…&dailyRange…` | `businessprofileperformance.googleapis.com` |
| Token refresh | `POST /token` | `oauth2.googleapis.com` |

Insights request these daily metrics and summarize them: `CALL_CLICKS`,
`WEBSITE_CLICKS`, `BUSINESS_DIRECTION_REQUESTS`, and the four
`BUSINESS_IMPRESSIONS_{DESKTOP,MOBILE}_{MAPS,SEARCH}` impression metrics
(→ total views + search views).

> These are fixed, trusted Google hosts, so `gbpFetch` uses a plain
> `AbortController`-timed `fetch` — **not** the SSRF-guarded `safeFetch`, whose
> private-range blocking / DNS pinning would only get in the way here.

## API surface (`/api/gbp/*`)

| Route | Access | Notes |
| --- | --- | --- |
| `GET /:businessId/status` | read | `{ connected, email?, locationName?, approved? }`; probes `getLocation`, reports `approved:false` on 403 |
| `GET /:businessId/reviews` | read | live reviews |
| `POST /:businessId/reviews/:reviewId/reply` | write | `{ comment }`, rate-limited |
| `GET /:businessId/posts` | read | local posts |
| `POST /:businessId/posts` | write | `{ summary, topicType?, callToAction? }`, rate-limited |
| `GET /:businessId/questions` | read | Q&A |
| `GET /:businessId/insights` | read | 30-day summary |
| `POST /:businessId/sync` | write | pull + upsert into app tables |

Error mapping: **409** = not connected (`GbpNotConnectedError`), **403** =
connected but not approved (`GbpNotApprovedError`, carries Google's message).
`sync` still saves whatever the Business Information API returned (location /
hours) when the v4 parts 403, and reports `approved:false` with a message.

## Three UI states (GMB Optimization page)

1. **Not connected** → prompt to connect under Settings → Google Integration.
2. **Connected but API not approved (403)** → a yellow banner explains that
   basic profile info is available but reviews / posts / insights require
   Google's Business Profile API approval. Whatever synced (location / hours) is
   still shown.
3. **Connected + approved** → full live data across the Reviews, Posts,
   Insights, Hours, and Q&A tabs.

The state is derived from `gbpApproved` (`null` unknown / `true` approved /
`false` unapproved), set from the `sync` response's `approved` flag and from any
`403` returned by a live call.

## Still needed to go live

1. In the Google Cloud project, **enable these 5 APIs**:
   - Business Profile API (`mybusinessbusinessinformation.googleapis.com`)
   - Account Management API (`mybusinessaccountmanagement.googleapis.com`)
   - My Business (v4) API (`mybusiness.googleapis.com`)
   - Business Profile Q&A API (`mybusinessqanda.googleapis.com`)
   - Business Profile Performance API (`businessprofileperformance.googleapis.com`)
2. **Request Business Profile API access** (the review/verification form):
   https://developers.google.com/my-business/content/prereqs — until approved,
   the v4 endpoints return **403** and reviews / posts / insights stay gated.
3. Verify the **connected Google account manages the selected location** (it
   must appear under the account's locations with management rights).
4. Set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` and
   `APP_URL` (for the OAuth redirect) in the server environment.
5. Apply `supabase/migrations/20260820015000_gbp_reviews_dedup_index.sql`.

Reference: enable the APIs at
https://console.cloud.google.com/apis/library (search "Business Profile").
