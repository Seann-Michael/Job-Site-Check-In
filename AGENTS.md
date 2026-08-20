# Local SEO Ranker - guide for coding agents

## What this is

Admin SPA + Express API for local SEO operations (Google Business Profile,
reviews, jobs/media, geo-grid ranks, workflows), backed by Supabase.

## Layout

```
client/        React 18 + Vite + TS. Routes in client/App.tsx, nav in client/components/AppLayout.tsx
  pages/       one file per route
  components/  shared UI; components/ui is shadcn/Radix primitives
  hooks/, lib/ data access (lib/api.ts, lib/supabaseClient.ts), auth, utils
server/        Express 5 API. Entry server/index.ts (createServer), prod entry server/node-build.ts
  routes/      one file per feature; middleware/ has auth + rate limits; lib/env.ts validates env
supabase/      SQL migrations (not applied automatically)
public/        static assets, manifest.json, sw.js (build id injected by vite.config.ts)
mobile/        Expo app, separate package - ignore unless asked
```

Path aliases: `@/` -> `client/`, `@shared/` -> `shared/`.

## Commands

- `npm run dev` - Vite + in-process API (needs `SUPABASE_URL` in `.env`)
- `npm run lint` / `npm run typecheck` / `npm test` - must pass before a PR
- `npm run build` - client then server bundle
- `.github/workflows/ci.yml` runs all four on push/PR once it is enabled on GitHub (the workflow file exists in the repo but the push was rejected for lack of `workflow` token scope: run `gh auth refresh -s workflow`, then push)

## Conventions

- TypeScript, no `any` where a type is easy; `strict` is off for legacy reasons.
- Client talks to Supabase directly for CRUD and to `/api/*` for anything that
  needs secrets (OpenAI, DataForSEO, payments, OAuth, Twilio).
- Secrets only in server env. `VITE_*` values are public.
- `ProtectedRoute` wraps authenticated pages; add new pages to `client/App.tsx`
  above the `*` catch-all and to the nav in `AppLayout.tsx`.
- No UI/UX changes unless the task asks for them.
- Brand name is "Local SEO Ranker" everywhere.
- Do not add docs or summary files unless asked; update README/CHANGELOG instead.
