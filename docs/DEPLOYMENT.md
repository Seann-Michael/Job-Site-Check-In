# Deployment

Local SEO Ranker deploys to DigitalOcean App Platform as **one** Node web
service declared in [`.do/app.yaml`](../.do/app.yaml). The Express server
(`dist/server/node-build.mjs`) serves the API and the built React SPA from the
same process. Supabase hosts Postgres, Auth and Storage.

`.do/app.yaml` mirrors what must be configured in the DO dashboard; **the
dashboard is authoritative**. If the app was created in the dashboard, spec
edits are not picked up automatically (re-import with `doctl apps update` or
mirror the change by hand).

## Why a single service

The earlier two-component layout (a `static_sites` entry for the SPA at `/`
plus a `services` entry for the API at `/api`) broke in production:

- App Platform strips the route prefix before forwarding, so the API service
  received `/oauth/...` instead of `/api/oauth/...` and every route 404'd.
- Uploads served by Express under `/public/media/*` were unreachable because
  only `/api` was routed to the service.

One service routed at `/` avoids both. `server/node-build.ts` serves
`/assets/*` (immutable, 1y), other `dist/` files (1h; `.html` and `/sw.js`
`no-cache`), returns JSON 404 for unknown `/api/*` and `/public/media/*`, and
falls back to `dist/index.html` for client-side routes.

## Service

| Setting              | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| name                 | `web`                                                                 |
| source               | GitHub `Seann-Michael/Local-GMB-Booster`, branch `Main`, deploy on push |
| `source_dir`         | `/`                                                                   |
| `environment_slug`   | `node-js` (Node 20 via `.nvmrc` / `engines`)                          |
| `build_command`      | `npm ci && npm run build`                                             |
| `run_command`        | `node dist/server/node-build.mjs`                                     |
| `http_port`          | `8080`                                                                |
| health check         | `GET /health`, initial delay 15s, period 30s                          |
| routes               | `/`                                                                   |
| instance             | `basic-xxs` x 1                                                       |

## Environment variables

Set these in the dashboard (App -> Settings -> `web` -> Environment Variables).
`SECRET` values are encrypted by DO and never stored in the repo.

**BUILD_TIME** (inlined into the client bundle by Vite; treat as public):

| Key                         | Notes                                   |
| --------------------------- | --------------------------------------- |
| `VITE_SUPABASE_URL`         | Supabase project URL                    |
| `VITE_SUPABASE_ANON_KEY`    | Supabase anon (publishable) key         |
| `VITE_GOOGLE_MAPS_API_KEY`  | browser-restricted Maps key             |
| `VITE_SENTRY_DSN`           | optional                                |
| `VITE_VAPID_PUBLIC_KEY`     | optional (web push)                     |
| `VITE_GOOGLE_AUTH_ENABLED`  | `false` until the provider is configured |

**RUN_TIME** (server):

| Key                                                     | Type   | Notes                                                                                                   |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                              | value  | `production`                                                                                            |
| `PORT`                                                  | value  | `8080`                                                                                                  |
| `SUPABASE_URL`                                          | value  | **required**                                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                             | SECRET | **required**                                                                                            |
| `SUPABASE_ANON_KEY`                                     | value  | used for password re-verification                                                                       |
| `APP_URL`                                               | value  | **strongly recommended**; required for Google OAuth redirects and outbound webhooks (`${APP_URL}` works) |
| `CORS_ORIGINS`                                          | value  | comma list; defaults to `APP_URL`                                                                       |
| `LOG_LEVEL`                                             | value  | `info`                                                                                                  |
| `SENTRY_DSN`                                            | SECRET | optional                                                                                                |
| `GOOGLE_MAPS_API_KEY`                                   | SECRET | server-side Places/Geocoding                                                                            |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`  | SECRET | Google Business Profile connect                                                                         |
| `OPENAI_API_KEY`                                        | SECRET |                                                                                                         |
| `OPENAI_MODEL`                                          | value  | `gpt-4o-mini`                                                                                           |
| `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`            | SECRET |                                                                                                         |
| `DATAFORSEO_DAILY_LIMIT`                                | value  | per-user daily quota (default 200)                                                                      |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`            | SECRET | payments are not live; see DEFERRED_WORK.md                                                             |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`              | SECRET | payments are not live; see DEFERRED_WORK.md                                                             |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SECRET |                                                                                                |

`server/lib/env.ts` refuses to boot without the two Supabase vars and logs
which optional integrations are disabled.

## First deploy

```bash
# one-time: create the app from the spec
doctl apps create --spec .do/app.yaml

# later: push spec changes (or edit in the dashboard)
doctl apps update <app-id> --spec .do/app.yaml
```

Then set secrets in the dashboard and trigger a deploy. With
`deploy_on_push: true` every push to `Main` redeploys the service.

## Database migrations

Migrations are SQL files in `supabase/migrations/`. They are **not** applied by
the build or by CI. Before deploying code that needs a schema change:

```bash
supabase link --project-ref <ref>
supabase db push
```

or apply the file through the Supabase SQL editor / MCP `apply_migration`.
`20260820007000_oauth_states.sql` (OAuth state table) must be applied before
deploying the current server build, otherwise the Google connect flow fails.

## CI

`.github/workflows/ci.yml` is in the repo and, once enabled, runs on every push
and pull request:

1. `npm ci` (Node 20)
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build` with dummy `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

**It is not active yet.** GitHub rejected the push that added the workflow
because the token lacked the `workflow` scope. To enable it:

```bash
gh auth refresh -s workflow
git push
```

CI does not deploy; DigitalOcean's GitHub integration does that from `Main`.

## Caching / service worker

`public/sw.js` is network-first for navigations and cache-first only for hashed
`/assets/*` files. The server sends `Cache-Control: no-cache` for `/sw.js` and
`index.html` so a new deploy is picked up on the next navigation. Cache names
include a build id that `vite.config.ts` injects (`BUILD_ID`, `SOURCE_VERSION`,
`GITHUB_SHA`, or a timestamp), so old caches are purged after each deploy.

## Webhooks

Configure provider webhooks against the app URL:

- Stripe: `https://<app-domain>/api/webhooks/stripe` (`STRIPE_WEBHOOK_SECRET`)
- Google Business Profile OAuth redirect:
  `https://<app-domain>/api/oauth/google_my_business/callback` (derived from
  `APP_URL`; register it in the Google Cloud console)
- Twilio status callbacks: `https://<app-domain>/api/webhooks/twilio`

## Rollback

App Platform keeps previous deployments: App -> Activity -> pick a prior
deployment -> Rollback. Database migrations are forward-only; write a new
migration to undo schema changes.

## Troubleshooting

- **Build fails with Supabase "URL required"**: `VITE_SUPABASE_URL` missing at
  build time, or `SUPABASE_URL` missing at runtime.
- **`/api/*` returns 404 for everything**: the app is still using the old
  two-component layout with the API routed at `/api`. Switch to the single
  service routed at `/` (this spec).
- **Deep links 404**: the SPA fallback in `server/node-build.ts` handles them;
  confirm `dist/index.html` exists in the build output.
- **CORS errors**: set `CORS_ORIGINS` (defaults to `APP_URL`).
- **Google connect says "expired or invalid"**: the `oauth_states` migration
  was not applied, or `APP_URL` does not match the redirect URI registered in
  Google Cloud.
- **Users see an old UI after deploy**: hard reload; the new service worker
  activates and clears prior build caches on next navigation.
