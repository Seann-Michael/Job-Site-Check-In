Local SEO Ranker — Full System README

Purpose

This repository implements Local SEO Ranker: a web application with onboarding, OAuth integrations, payments (Stripe / PayPal / Coinbase Commerce), chat, CRM, auditing and automation features. This README documents the entire system for non-developers and developers: architecture, configuration, DB schema/migrations, internal & public APIs, deployment, and common workflows.

High-level summary (non-developer)

- What it does: helps agencies manage local SEO projects, integrate advertising/analytics platforms, onboard clients, and accept payments.
- Key flows:
  - Authentication: Google Workspace (federal Gmail) primary + email/password fallback.
  - Onboarding: multi-step wizard with tasks, progress tracking and token rewards.
  - Integrations: OAuth for platforms (Google Ads, Google My Business, Meta, etc.).
  - Payments: One-time and subscription support via Stripe, PayPal, Coinbase Commerce.
  - Webhooks: Server endpoints accept asynchronous events (payments, platform callbacks).
- Who this is for: product managers, sysops and developers who will run, maintain or extend the system.

Repository layout (developer)

- client/ — React TypeScript UI (Vite). Main front-end pages and components.
- client/pages — SPA routes (OnboardingWizard, Payments, Admin pages, etc.).
- client/lib — client-side helpers (supabaseClient.ts, paymentService.ts).
- api/ — serverless backend functions used by the app (OAuth flows, onboarding-api, payment checkout creators, webhook handlers, helpers).
- supabase/migrations — SQL migrations to build the DB schema in order.
- scripts/ — helper scripts (setup-supabase, populate-sample-data, create-payments-tables.sql).
- server_complete/ — optional backend server code that can be used for heavier server workloads.
- docs/ — supporting documents (SUPABASE_PRODUCTION_SETUP.md and other how-tos).

Architecture & data flow

- Frontend runs in the browser, authenticates users via Supabase Auth (Google + email/password), interacts with API functions for server-side operations.
- API functions use SUPABASE_SERVICE_ROLE_KEY to perform privileged DB operations (persist payment sessions, onboarding activity, OAuth tokens).
- Supabase stores users (auth.users) and extended tables (profiles, onboarding_tasks, user_task_progress, client_access, payments, user_subscriptions, etc.).
- Payments: frontend requests a checkout via /api/create-checkout-<provider>. Functions create provider checkout objects, persist sessions, then redirect users to provider-hosted pages.
- Webhooks: provider webhooks arrive at /api/webhook-<provider>, are verified, and persisted into payments/payments_sessions and user_subscriptions where applicable.

Key modules and what they do

- Onboarding
  - DB: supabase/migrations/20250902000000_profiles_onboarding.sql
  - Server: api/onboarding-api.ts — list tasks, complete tasks, award tokens, update profiles.
  - Client: client/pages/OnboardingWizard.tsx — UI to display tasks and progress.
- OAuth & Integrations
  - DB: supabase/migrations/20241220000002_create_client_oauth_schema.sql
  - Server: api/oauth-flows.ts (authorize/callback), api/oauth-api.ts (management endpoints).
  - Client: client/components/OAuth/* UI components and popup manager.
- Payments
  - DB: scripts/create-payments-tables.sql; migrations add user_subscriptions table.
  - Server: api/create-checkout-stripe.ts, create-checkout-paypal.ts, create-checkout-coinbase.ts and webhook handlers webhook-stripe.ts, webhook-paypal.ts, webhook-coinbase.ts.
  - Client: client/lib/paymentService.ts and client/pages/Payments.tsx
- Chat
  - Schemas under supabase/migrations (chat) and corresponding serverless functions in api/.

Environment variables (summary)

Set these in Digital Ocean App Platform environment settings for production. Never expose service keys to the client.

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- SUPABASE_ANON_KEY (client)
- VITE_SUPABASE_URL (client)
- VITE_SUPABASE_ANON_KEY (client)
- SITE_URL

Payments & OAuth providers
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID, PAYPAL_WEBHOOK_ID
- COINBASE_COMMERCE_API_KEY, COINBASE_COMMERCE_SHARED_SECRET
- GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
- META_APP_ID, META_APP_SECRET

See docs/SUPABASE_PRODUCTION_SETUP.md for the full list and step-by-step guide.

Database migrations

- All SQL migrations live in supabase/migrations/ and must be applied to your Supabase project in chronological order.
- Use Supabase CLI for repeatable deployment or the Supabase SQL editor for manual application.
- Important migrations added by this project:
  - 20250902000000_profiles_onboarding.sql — profiles, onboarding_tasks, user_task_progress, tokens_history and triggers
  - 20250901000000_create_user_subscriptions_and_platforms.sql — user_subscriptions and platform entries
  - scripts/create-payments-tables.sql — payments_sessions and payments
- After applying migrations, test triggers by creating a user and validating auto-created profiles.

Internal APIs (serverless functions)

All server functions live in api/. Core endpoints (internal and public):

- /api/onboarding-api?action=tasks — GET tasks & progress (requires Authorization: Bearer <access_token>)
- /api/onboarding-api?action=complete — POST complete a task
- /api/validate-federal-domain — POST { email } → { isFederal, domain }
- /api/oauth/:platform/authorize — redirect to provider OAuth (api/oauth-flows.ts)
- /api/oauth/:platform/callback — OAuth callback handler
- /api/create-checkout-stripe (and -paypal, -coinbase) — create provider checkout
- /api/webhook-stripe, /api/webhook-paypal, /api/webhook-coinbase — webhook receivers

Public API considerations

- Public endpoints that third-party services consume (webhooks) must be reachable at your SITE_URL and verify signatures.
- Protect all endpoints that modify server state using SUPABASE_SERVICE_ROLE_KEY on server functions; client-facing actions require authenticated session tokens.

How to run locally (developer)

1. Install dependencies: npm install
2. Setup your Supabase credentials (see scripts/setup-supabase.js): npm run setup
3. Populate sample data (optional): npm run populate-data
4. Start dev server: npm run dev (this runs vite dev server)
5. Alternatively run client-only dev server: npm run dev:vite

Deployment (Digital Ocean App Platform)

- Build: npm run build:client
- Digital Ocean App Platform will deploy the static site and API functions from api/.
- Ensure Digital Ocean environment variables include SUPABASE_SERVICE_ROLE_KEY and provider secrets.
- Configure routing in .do/app.yaml (already set up in repo for /api/* routing).

Security and RLS

- Row Level Security is enabled on many tables. Server operations must use SUPABASE_SERVICE_ROLE_KEY or elevated privileges.
- Never commit secrets. Use Digital Ocean App Platform environment variables for production secrets.
- Webhook endpoints must validate signatures (Stripe/PayPal/Coinbase handlers implement verification).

Testing

- Use provider sandboxes for payments.
- Use a staging Supabase project to apply migrations first.
- Smoke test steps are listed in docs/SUPABASE_PRODUCTION_SETUP.md.

Documentation

- docs/SUPABASE_PRODUCTION_SETUP.md — detailed migration & production steps (created & maintained).
- docs/PAYMENTS_ENV.md — payment provider env var guidance.
- This README is the single high-level entrypoint.

How this README is maintained

- I will update this README automatically when I add migrations, server functions, or other critical infra changes. If you add files, please add a short note in docs/ or request an update.

If you want, next I will:
- Add generated OpenAPI-style documentation for the public webhooks and onboarding API in docs/api/ (JSON + markdown), and
- Create a lightweight developer checklist for on-call runbook (how to inspect webhooks, rotate keys, rollback migrations).

Tell me which of the two to add next and I will create files under docs/api/ and docs/runbooks/ respectively.
