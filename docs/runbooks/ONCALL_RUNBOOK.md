On-call Runbook — Local SEO Ranker

Purpose

This runbook provides step-by-step procedures for common operational incidents: webhook delivery failures, payment processing errors, OAuth failures, DB migration rollbacks, and urgent secret rotations.

Contacts
- Primary: Dev on-call (team)
- Escalation: Platform engineer / CTO
- Tools: Netlify dashboard (functions logs), Supabase dashboard (SQL editor, logs), Sentry (if configured), provider dashboards (Stripe/PayPal/Coinbase).

Access requirements
- SUPABASE_SERVICE_ROLE_KEY (server role)
- Netlify account with environment variable access
- Provider dashboard accounts for testing and webhooks

Common incidents & resolution steps

1) Webhook delivery failures (Stripe / PayPal / Coinbase)
- Symptoms: provider dashboard shows failed webhook deliveries; payments not reflected in app; users report payment issues.
- Immediate actions:
  1. Open provider dashboard -> Webhooks -> view recent deliveries and error messages.
  2. Check Netlify function logs: `netlify logs --name <site>` or use Netlify web UI -> Functions -> Logs for webhook functions.
  3. Inspect function error message and stack trace.
- If signature verification failed:
  - Verify the webhook signing secret in Netlify environment variables (STRIPE_WEBHOOK_SECRET, PAYPAL_WEBHOOK_ID/secret, COINBASE_COMMERCE_SHARED_SECRET).
  - If secret was recently rotated, update the env var and re-deploy/functions redeploy automatically on Netlify.
- If function crashed due to code error:
  - Review code in netlify/functions/webhook-<provider>.ts, fix, and push commit.
  - Redeploy; re-send webhook from provider dashboard (most providers allow replay).
- If DB errors (Supabase insert failed):
  - Check Supabase logs & table schema (missing column or RLS blocking).
  - If RLS blocked, ensure function uses SUPABASE_SERVICE_ROLE_KEY.
  - If table missing, apply missing migration.

2) Payment checkout or redirect fails
- Symptoms: customers cannot complete checkout or provider returns error on session creation.
- Steps:
  1. Check Netlify function create-checkout-<provider> logs for error details.
  2. Verify provider API keys (STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID/SECRET, COINBASE_COMMERCE_API_KEY) in Netlify env.
  3. Test in provider sandbox: create a checkout manually using curl or provider API.
  4. If necessary, replay or manually settle payments in provider dashboard and insert record into Supabase payments table for reconciliation.

3) OAuth callback fails (integrations)
- Symptoms: OAuth popup shows error or callback page shows "Connection Failed".
- Steps:
  1. Check netlify/functions/oauth-flows.ts logs for callback handling errors.
  2. Ensure OAuth client ID/secret are correctly configured in environment or platform_configurations table and redirect URLs match provider settings.
  3. Check oauth_activity_log table in Supabase for more context.
  4. If refresh token missing, re-initiate OAuth flow.

4) Database migration failure or bad migration
- Symptoms: failed DB migration, missing tables, or runtime SQL errors.
- Steps:
  1. Stop deployments to production (if possible).
  2. Inspect migration file that failed. Revert problematic migration if necessary.
  3. Restore DB from most recent backup (pg_dump) if corruption or data loss.
  4. Apply corrected migration on staging and test before applying to production.
- Rollback guidance:
  - If migration introduced a new table with no data, drop table.
  - If migration altered existing table (dropped column), restore from backup.
  - Use Supabase CLI to apply or revert migrations consistently.

5) Secret compromise (rotating keys)
- Steps:
  1. Immediately rotate compromised key in provider dashboard (Stripe, PayPal, Coinbase) and Supabase if service key compromised.
  2. Update Netlify environment variables with new keys.
  3. Redeploy site to ensure functions pick up new keys.
  4. If billing keys rotated, notify finance and affected customers as needed.

Logs & diagnostics
- Netlify function logs: Netlify dashboard or netlify CLI. Filter by function name (webhook-*, create-checkout-*).
- Supabase logs & SQL: Supabase dashboard -> Logs; SQL editor for debugging queries.
- Webhooks: provider dashboards provide delivery logs and payloads; use replay mechanisms.

Monitoring & alerts (recommendations)
- Set up Sentry for serverless function errors.
- Configure provider alerts for repeated webhook failures.
- Set up uptime monitoring for webhook endpoints.

Playbooks (quick commands)
- View Netlify function logs (CLI): netlify functions:list && netlify functions:invoke <name>
- Replay webhook from Stripe dashboard: Select event -> Resend to endpoint
- Query Supabase table via psql: psql <CONN_STR> -c "SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;"

Post-incident actions
- Write a blameless post-mortem noting root cause, detection time, mitigation, and preventive steps.
- Add automated tests or monitoring to detect similar issues earlier.

Appendix — Key file locations
- Netlify functions: netlify/functions/*.ts
- Migrations: supabase/migrations/*.sql
- Onboarding API: netlify/functions/onboarding-api.ts
- Webhooks: netlify/functions/webhook-*.ts
- Runbook: docs/runbooks/ONCALL_RUNBOOK.md (this file)

If you want, I will now generate OpenAPI JSON files and also publish an interactive Swagger UI under docs/api/swagger.html so non-developers can explore the APIs. Should I proceed?
