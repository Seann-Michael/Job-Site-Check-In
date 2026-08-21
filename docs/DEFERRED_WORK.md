# Deferred work (after the production-hardening branch)

Status as of 2026-08-20. The `production-hardening` branch removed mock data
and dead code, hardened the Express server, made the schema reproducible, and
**completed the authentication and RLS work**: Supabase Auth is used
end-to-end, the localStorage auth layer and dev-bypass buttons are gone,
`requireAuth` / role guards are mounted on every route, impersonation is
server-side, and the anon-role lockdown + RLS policies are applied (see
[AUTH_AND_RLS.md](AUTH_AND_RLS.md)). The OAuth `state` store now lives in the
`oauth_states` table (migration `20260820007000`), so the API is safe to scale
horizontally.

What remains is listed below, roughly in priority order. None of these blocks
a launch with the current feature set; each is scoped so it can land as a
standalone PR.

## 1. Google OAuth sign-in provider

The Google Business Profile *connect* flow (`/api/oauth/google_my_business/*`)
is done. Signing **in** with Google is not enabled: the provider must be
configured in Supabase Auth (client id/secret, redirect
`https://<project>.supabase.co/auth/v1/callback`) and in Google Cloud, then
`VITE_GOOGLE_AUTH_ENABLED=true` at build time shows the button.

## 2. Payments (Stripe) - `server/routes/payments.ts`

Not production-ready; keep the Payments UI hidden or labelled "coming soon".

- `POST /api/stripe/create-checkout-session` takes `amount`, `planName` and
  `businessId` from the request body. The server must own prices (look up the
  plan in `plans` by id and use its Stripe price id); never trust a client
  amount.
- There is no Stripe webhook handler. `express.raw` is already mounted at
  `/api/webhooks/stripe` in `server/index.ts`; implement
  `checkout.session.completed` / `customer.subscription.*` with
  `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`.
- The plan is granted by a client-triggered `/confirm` call after redirect;
  it should be granted by the webhook instead.

## 3. Twilio webhook signature

`POST /api/webhooks/twilio` (`server/routes/twilio.ts`) does not verify
`X-Twilio-Signature`. Use `twilio.validateRequest(authToken, signature, url,
params)` with the public URL (`APP_URL` + path) and reject on mismatch. The
send endpoints are already behind `requireAuth` + write role + rate limits.

## 4. MFA

The fake MFA endpoints were removed. Real TOTP via Supabase `auth.mfa`
(enroll / challenge / verify) plus an AAL2 requirement for super-admin routes
is a follow-up.

## 5. Staff / viewer membership model — DONE

Implemented in `supabase/migrations/20260820008000_business_memberships.sql`
(`business_members` table, `can_read_business` / `can_write_business`
helpers, every tenant policy split into `_select` / `_write`, storage
`storage_path_writable`) and `server/routes/team.ts` (`/api/team/*`,
`/api/admin/staff/invite`). `business_members` is read-only over PostgREST;
all mutations are server-side and audited. See `docs/AUTH_AND_RLS.md`.

## 6. Shared galleries

Public per-job pages work through the `public_job` RPC. Customer-facing
*galleries* (a curated, shareable set of media with its own token and expiry)
need a `shared_galleries` table (token, business_id, job ids / media ids,
expires_at, created_by), a security-definer RPC that returns only the selected
media through signed URLs, and RLS so only the owning workspace can manage
them.

## 7. Dependency upgrades - DONE

- Vite 5 -> 8.2 (Rolldown), `@vitejs/plugin-react` 4 -> 6, React Router 6 -> 7
  (`react-router-dom@7`), `@supabase/supabase-js` -> 2.112, TypeScript -> 5.9.
  `npm audit` (prod and dev) reports 0 vulnerabilities. Node 20.19+ is still
  supported by Vite 8, so `.nvmrc` / `engines` are unchanged. React stays on
  18 and ESLint stays on 8 (ESLint 9 would force a flat-config rewrite).

## 8. Supabase project settings

Flagged by the Supabase advisor; both are dashboard toggles, not code:

- Enable leaked-password protection (Auth -> Settings -> Password).
- Apply the pending Postgres security patch (Settings -> Infrastructure).

## 9. Data cleanup

- The live database still holds demo rows (`demo@localseodemo.com`, 3
  businesses, 9 jobs, reviews, analytics) and ~62 MB of anonymous test
  uploads in the `media` bucket. Nothing in the repo seeds them. Delete once
  testing is finished.
- `kv_store_32071718` is a leftover scaffold table with no readers or
  writers; drop it with a migration (`drop table if exists
  public.kv_store_32071718;`).

## Smaller notes

- `index.html` `og:url` uses the placeholder `https://localseoranker.com/`;
  confirm the real domain.
- ~1000 ESLint warnings (unused imports / `any`) remain; lint passes with 0
  errors.
- `mobile/` (Expo app) is in the repo without a shared build and still has
  its own demo mode; treat it as unsupported until it is brought up to the
  web app's auth model.
- The CI workflow (`.github/workflows/ci.yml`) is in the repo but not yet
  active on GitHub; see [DEPLOYMENT.md](DEPLOYMENT.md#ci).
