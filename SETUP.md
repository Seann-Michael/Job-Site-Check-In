# Local development setup

## Prerequisites

- Node 20.19+ (22 works; see `engines` in `package.json`)
- A Supabase project (free tier is fine)
- Optional: Google Maps API key, OpenAI key, DataForSEO, Stripe/PayPal, Twilio

## 1. Install

```bash
npm ci
```

## 2. Configure environment

```bash
cp .env.example .env
```

Minimum to boot the UI and API locally:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only
APP_URL=http://localhost:5173
```

Keys come from Supabase dashboard -> Project Settings -> API. Do not put the
service-role key in any `VITE_` variable.

## 3. Database

Apply the SQL in `supabase/migrations/` to your project, e.g.

```bash
supabase link --project-ref <ref>
supabase db push
```

## 4. Run

```bash
npm run dev
```

- UI: http://localhost:5173
- API (mounted inside the dev server): http://localhost:5173/api/health

To run the production build locally:

```bash
npm run build
npm start            # serves dist/ and the API on :8080
```

## 5. Verify

```bash
npm run lint
npm run typecheck
npm test
```

## Troubleshooting

- **"API proxying is disabled"** on `npm run dev`: `SUPABASE_URL` /
  `VITE_SUPABASE_URL` is missing from `.env`.
- **Server exits with "Missing required env"**: set `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`.
- **Stale service worker after a deploy**: caches are namespaced per build id;
  hard-reload once or unregister the worker in DevTools -> Application.
