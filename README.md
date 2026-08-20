# Local SEO Ranker

Admin web app for running local SEO for service businesses: Google Business
Profile optimisation, review requests and replies, job/media tracking, geo-grid
rank checks and automation workflows.

## Stack

- **Client**: React 18, TypeScript, Vite 5, Tailwind, Radix UI, TanStack Query,
  React Router 6 (`client/`)
- **API**: Express 5 on Node 20 (`server/`), bundled with Vite SSR build
- **Data/Auth/Storage**: Supabase (Postgres, Auth, Storage). Migrations live in
  `supabase/migrations/`
- **Integrations**: Google Maps/Places, Google Business Profile OAuth, OpenAI,
  DataForSEO, Stripe, PayPal, Twilio
- **Mobile**: Expo app in `mobile/` (separate package, not part of this build)

## Setup

```bash
npm ci
cp .env.example .env   # fill in values (see below)
npm run dev            # http://localhost:5173
```

`npm run dev` runs Vite and, when `SUPABASE_URL` (or `VITE_SUPABASE_URL`) is set,
mounts the Express API at `/api` inside the dev server. Without it the UI still
starts and logs that API proxying is disabled.

## Environment

All variables are listed with comments in [`.env.example`](.env.example).

| Group                             | Variables                                                                                                                                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client (public, inlined at build) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`, `VITE_API_URL`                                                                                                                            |
| Server (required)                 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`                                                                                                                                                                                                           |
| Server (optional)                 | `CORS_ORIGINS`, `SENTRY_DSN`, `LOG_LEVEL`, `PORT`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `DATAFORSEO_USERNAME/PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID/SECRET`, `TWILIO_*` |

Never put the service-role key in a `VITE_` variable; it would ship to browsers.

## Scripts

| Script                 | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Vite dev server with in-process API                            |
| `npm run build`        | `build:client` then `build:server`                             |
| `npm run build:client` | `tsc --noEmit` + `vite build` -> `dist/`                       |
| `npm run build:server` | bundles `server/node-build.ts` -> `dist/server/node-build.mjs` |
| `npm start`            | runs the built API (serves `dist/` too)                        |
| `npm run lint`         | ESLint (TS + React hooks); warnings allowed, errors fail       |
| `npm run typecheck`    | `tsc --noEmit`                                                 |
| `npm test`             | Vitest                                                         |
| `npm run format`       | Prettier                                                       |

## Deploy (DigitalOcean App Platform)

`.do/app.yaml` defines two components from this repo:

- `web` - static site built with `npm run build:client`, `catchall_document:
index.html`, `VITE_*` vars as build-time secrets.
- `api` - Node service running `node dist/server/node-build.mjs` on port 8080,
  health check `GET /health`, routed at `/api`.

Set the secrets in the DO dashboard (the yaml only declares keys). CI
(`.github/workflows/ci.yml`) runs lint, typecheck, tests and a full build on
every push/PR. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

## Database migrations

Migrations are plain SQL in `supabase/migrations/`, applied with the Supabase
CLI (`supabase db push`) or the Supabase MCP `apply_migration` tool. They are
not run automatically by the app or by CI. Apply pending migrations before
deploying code that depends on them.

## Repo layout

```
client/      React app (pages, components, hooks, lib)
server/      Express API (routes, middleware, lib)
supabase/    SQL migrations
public/      static assets, manifest, service worker
mobile/      Expo app (independent)
docs/        API docs, data models, deployment, utility reference
```
