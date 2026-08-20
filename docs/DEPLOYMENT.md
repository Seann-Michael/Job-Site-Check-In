# Deployment

Local SEO Ranker deploys to DigitalOcean App Platform as two components
declared in [`.do/app.yaml`](../.do/app.yaml): a static site for the React
client and a Node service for the Express API. Supabase hosts Postgres, Auth
and Storage.

## Components

| Component | Type                | Build                                       | Run                                          | Route  |
| --------- | ------------------- | ------------------------------------------- | -------------------------------------------- | ------ |
| `web`     | static site         | `npm ci && npm run build:client` -> `dist/` | CDN, `catchall_document: index.html`         | `/`    |
| `api`     | service (basic-xxs) | `npm ci && npm run build:server`            | `node dist/server/node-build.mjs` on `:8080` | `/api` |

The API exposes `GET /health` (also `/api/health`) which App Platform polls.

## Environment variables

Keys are declared in `app.yaml`; values marked `SECRET` must be entered in the
DO dashboard (App -> Settings -> component -> Environment Variables).

**`web` (BUILD_TIME, inlined into the bundle - treat as public):**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`,
`VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`, `VITE_API_URL=/api`.

**`api` (RUN_TIME):**
required `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`; plus
`CORS_ORIGINS`, `SENTRY_DSN`, `GOOGLE_MAPS_API_KEY`,
`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
`DATAFORSEO_USERNAME/PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`PAYPAL_CLIENT_ID/SECRET`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER/WEBHOOK_URL`.

`server/lib/env.ts` validates required vars at boot and logs which optional
integrations are disabled.

## First deploy

```bash
# one-time: create the app from the spec
doctl apps create --spec .do/app.yaml

# later updates to the spec
doctl apps update <app-id> --spec .do/app.yaml
```

Then set secrets in the dashboard and trigger a deploy. With
`deploy_on_push: true` every push to `main` redeploys both components.

## Database migrations

Migrations are SQL files in `supabase/migrations/`. They are **not** applied by
the build or by CI. Before deploying code that needs a schema change:

```bash
supabase link --project-ref <ref>
supabase db push
```

or apply the file through the Supabase SQL editor / MCP `apply_migration`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. `npm ci` (Node 20)
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build` with dummy `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

CI does not deploy; DigitalOcean's GitHub integration does that from `main`.

## Caching / service worker

`public/sw.js` is network-first for navigations and cache-first only for hashed
`/assets/*` files. Its cache names include a build id that `vite.config.ts`
injects (`BUILD_ID`, `SOURCE_VERSION`, `GITHUB_SHA`, or a timestamp), so old
caches are purged on the first load after each deploy.

## Webhooks

Configure provider webhooks to the API service URL:

- Stripe: `https://<app-domain>/api/webhooks/stripe` (`STRIPE_WEBHOOK_SECRET`)
- Google Business Profile OAuth redirect:
  `https://<app-domain>/api/oauth/google_my_business/callback` (derived from
  `APP_URL`)
- Twilio status callbacks: value of `TWILIO_WEBHOOK_URL`

## Rollback

App Platform keeps previous deployments: App -> Activity -> pick a prior
deployment -> Rollback. Database migrations are forward-only; write a new
migration to undo schema changes.

## Troubleshooting

- **Build fails with Supabase "URL required"**: `VITE_SUPABASE_URL` missing at
  build time for `web`, or `SUPABASE_URL` missing at runtime for `api`.
- **Deep links 404 on the static site**: confirm `catchall_document: index.html`.
- **CORS errors**: set `CORS_ORIGINS` to the web component's URL (defaults to
  `APP_URL`).
- **Users see an old UI after deploy**: hard reload; the new service worker
  activates and clears prior build caches on next navigation.
