Supabase — Production-ready setup checklist

Purpose

This document lists all SQL migration files in the repository, explains what each file does, and provides step-by-step instructions to prepare the Supabase backend for production. Keep this file updated whenever you add or change migrations, RLS policies, triggers, or Edge functions.

Location of SQL files (relative paths)

- supabase/migrations/001_create_audit_logs.sql
- supabase/migrations/20241220000001_create_gmb_leads_schema.sql
- supabase/migrations/20241220000002_create_client_oauth_schema.sql
- supabase/migrations/20241220000003_create_static_onboarding_schema.sql
- supabase/migrations/20241220000004_create_ai_chat_sessions.sql
- supabase/migrations/20241220000006_create_admin_agency_billing_schema.sql
- supabase/migrations/20241220000007_enhance_credit_allocation_system.sql
- supabase/migrations/20241220000009_create_social_media_posts_schema.sql
- supabase/migrations/20241220000010_create_chat_system_schema.sql
- supabase/migrations/20250901000000_create_user_subscriptions_and_platforms.sql
- supabase/migrations/20250902000000_profiles_onboarding.sql
- scripts/create-payments-tables.sql
- scripts/chat-schema.sql

What each file covers (high level)

- 001_create_audit_logs.sql — audit and media metadata tables
- 20241220000001_create_gmb_leads_schema.sql — GMB leads, credits, lead unlocks, geo scans, user_profiles
- 20241220000002_create_client_oauth_schema.sql — onboarding_sessions, client_access, oauth_activity_log, platform_configurations, webhook_events, custom_platforms
- 20241220000003_create_static_onboarding_schema.sql — agency_static_configs and client_onboarding_submissions
- 20241220000004_create_ai_chat_sessions.sql — ai_chat_sessions/messages and related tables
- 20241220000006_create_admin_agency_billing_schema.sql — admin billing relationships, history and preferences
- 20241220000007_enhance_credit_allocation_system.sql — credit allocation / overrides
- 20241220000008_create_audit_reports_schema.sql — audit reports, findings, analytics tables
- 20241220000009_create_social_media_posts_schema.sql — social media posts, templates, media assets
- 20241220000010_create_chat_system_schema.sql — chat channels/messages/attachments/presence
- 20250901000000_create_user_subscriptions_and_platforms.sql — user_subscriptions table and platform_configurations (Stripe/PayPal/Coinbase insertion)
- 20250902000000_profiles_onboarding.sql — profiles, onboarding_tasks, user_task_progress, tokens_history, triggers and RLS policies
- scripts/create-payments-tables.sql — payments_sessions and payments tables for payment provider events
- scripts/chat-schema.sql — additional chat schema (alternate location)

Important Netlify / Function endpoints related to Supabase

- Onboarding API: /.netlify/functions/onboarding-api (uses SUPABASE_SERVICE_ROLE_KEY for server operations)
- OAuth flows: /api/oauth/:platform/authorize and /api/oauth/:platform/callback (implemented in netlify/functions/oauth-flows.ts; route exposed at <SITE_URL>/api/oauth/<platform>/callback)
- Webhooks:
  - Stripe: <SITE_URL>/api/webhook-stripe -> netlify/functions/webhook-stripe
  - PayPal: <SITE_URL>/api/webhook-paypal -> netlify/functions/webhook-paypal
  - Coinbase: <SITE_URL>/api/webhook-coinbase -> netlify/functions/webhook-coinbase
- Federal domain validator (helper): /.netlify/functions/validate-federal-domain

Required environment variables (server-side)

Store these in Netlify (or your server env) and never expose secret keys in client builds.

- SUPABASE_URL — Supabase project URL (https://<project>.supabase.co)
- SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (server-only)
- SUPABASE_ANON_KEY — public anon key (client)
- VITE_SUPABASE_URL — client-side env variable (same as SUPABASE_URL)
- VITE_SUPABASE_ANON_KEY — client-side anon key
- SITE_URL — public site URL (used to build redirect URLs)

Payment provider env vars
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_PLAN_ID
- COINBASE_COMMERCE_API_KEY, COINBASE_COMMERCE_SHARED_SECRET

OAuth provider keys
- GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (set in Supabase Auth providers or use netlify functions OAuth config)
- META_APP_ID, META_APP_SECRET (example for Meta/Facebook)

Supabase production checklist

1. Validate SQL migrations and their order
  - Review each migration file listed above for correctness and foreign key references.
  - Recommended order: core schemas (users, projects) -> features (onboarding, oauth, payments, chat, crm) -> auxiliary (reports, social media).
  - Apply migrations in chronological order by filename timestamp to avoid dependency issues.

2. Apply migrations (recommended methods)

Option A — Supabase CLI (recommended for repeatable deployments):
  - Install and login: `npm install -g supabase && supabase login`
  - Push migrations to remote (if using supabase migration directory): `supabase db push --project-ref <project-ref>`
  - Or run specific SQL files: `supabase db query < migrations/20250902000000_profiles_onboarding.sql` (check CLI docs for exact command)

Option B — Supabase Dashboard SQL editor (manual):
  - Go to Supabase Project -> SQL Editor -> New query
  - Paste the contents of each migration file in order and run

Option C — psql with connection string (service role)
  - Get the DB connection string from Supabase (Project > Settings > Database > Connection String)
  - Use psql or any client to run: `psql <CONN_STR> -f supabase/migrations/20250902000000_profiles_onboarding.sql`

3. Confirm RLS (Row Level Security) policies
  - Many migrations enable and create RLS policies. Verify policies are applied and test with normal user accounts (anon) and service role operations.

4. Create required Supabase Functions & Triggers
  - The migration files already define triggers (eg. handle_new_user for auth.users) and stored procedures.
  - Confirm that triggers are present and working (create a test user to check profile creation).

5. OAuth provider & Supabase Auth setup
  - In Supabase Dashboard -> Authentication -> Providers: enable Google and add OAuth client id/secret
  - Add redirect URL(s):
    - <SITE_URL>/api/oauth/google_my_business/callback (or appropriate platform path as implemented by netlify oauth-flows)
    - The code uses callbacks at: <SITE_URL>/api/oauth/:platform/callback (so add those URLs for platforms you enable)
  - If you want Supabase to manage provider tokens directly, configure providers in Supabase Auth; otherwise the existing netlify function oauth-flows handles OAuth for platform integrations.

6. Webhook setup (payment providers)
  - Configure webhook endpoints in each provider's dashboard using these public URLs (Netlify routes):
    - Stripe webhook URL: <SITE_URL>/api/webhook-stripe
    - PayPal webhook URL: <SITE_URL>/api/webhook-paypal
    - Coinbase Commerce webhook URL: <SITE_URL>/api/webhook-coinbase
  - After adding webhooks, store provider webhook signing secrets in Netlify environment variables.

7. Edge functions and serverless functions
  - The repository provides Netlify serverless functions under netlify/functions/. These should be deployed with the site and have access to server env vars.
  - If you prefer Supabase Edge Functions for domain validation and token logic, implement them separately in Supabase functions and adapt the onboarding-api to call them.

8. Secrets, rotation, and access control
  - Limit SUPABASE_SERVICE_ROLE_KEY to server environments only (Netlify functions). Do not push it to git or client bundles.
  - Rotate keys periodically and after personnel changes.

9. Backups and migrations strategy
  - Schedule nightly logical backups (pg_dump) and store them in secure storage.
  - For schema migrations, use the Supabase CLI and keep migrations in the repository to support CI/CD.

10. Monitoring and alerts
  - Enable database metrics in Supabase and set up alerting for slow queries, high connections, or replication lag.
  - Integrate Sentry (or alternative) to capture serverless function errors.

11. Testing your deployment
  - Create a staging project and run through these tests:
    - Create a user via Google OAuth and confirm profiles.created trigger executed
    - Call /.netlify/functions/onboarding-api?action=tasks as an authenticated user and verify tasks return
    - Execute payment flows in sandbox: create a Stripe Checkout session and simulate webhook events
    - Connect an OAuth platform via /api/oauth/:platform/authorize and validate callback stores client_access

12. Post-deploy checklist
  - Verify RLS policies do not block legitimate server-side inserts (server must use SUPABASE_SERVICE_ROLE_KEY)
  - Ensure all webhooks show recent successful deliveries in the providers dashboard
  - Confirm Cloudflare/Netlify/CDN caching settings do not interfere with webhook endpoints (webhooks must be delivered directly to server)

SQL application order recommendation (minimal to full)

1. Core tables and auth extensions (user_profiles, projects, businesses) — files: 001_create_audit_logs.sql, 20241220000001_create_gmb_leads_schema.sql
2. Onboarding & OAuth (onboarding_sessions, client_access) — 20241220000002_create_client_oauth_schema.sql
3. Onboarding UI & profiles/tokens — supabase/migrations/20250902000000_profiles_onboarding.sql
4. Payments and subscriptions — scripts/create-payments-tables.sql, 20250901000000_create_user_subscriptions_and_platforms.sql
5. Features (chat, social) — other migration files in chronological order

How to test onboarding API (smoke test)

1. Obtain a valid Supabase session token (login via Supabase client or use a user session).
2. Call tasks endpoint:
   curl -H "Authorization: Bearer <ACCESS_TOKEN>" "https://<SITE_URL>/.netlify/functions/onboarding-api?action=tasks"
3. Complete a task:
   curl -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d '{"task_id":"<TASK_ID>","status":"completed"}' "https://<SITE_URL>/.netlify/functions/onboarding-api?action=complete"

Notes and recommendations

- Keep the migrations directory under version control and include only additive changes. Test migrations in staging before applying to production.
- Prefer Supabase CLI for repeatable deployments.
- Ensure Netlify site environment includes all server keys and that functions have access to SUPABASE_SERVICE_ROLE_KEY.
- Add monitoring and rate-limiting for webhook endpoints to protect from abuse.

Maintenance and updates

- When new SQL migrations are added, append them to this document with a brief description and recommended order.
- When adding new serverless or Edge functions, add the function path and the required env vars here.

If you want, I will:
- Apply the migrations to the connected Supabase project now (requires SUPABASE_SERVICE_ROLE_KEY in environment), and
- Run a small smoke test calling the onboarding API endpoints and validating the profile creation trigger.

This file will be updated whenever new migrations, triggers, or server functions are added. If you want me to also include exact psql/supabase CLI commands tailored to your Supabase project reference, provide the project reference or grant environment access and I will add them here.
