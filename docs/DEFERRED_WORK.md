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

## 2. Payments (Stripe / PayPal) - `server/routes/payments.ts`

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
- PayPal is hardcoded to `api-m.sandbox.paypal.com`, never captures the order,
  and has no webhook. Needs a live/sandbox switch, capture on approval, and
  `PAYMENT.CAPTURE.COMPLETED` handling with signature verification.

## 3. Twilio webhook signature

`POST /api/webhooks/twilio` (`server/routes/twilio.ts`) does not verify
`X-Twilio-Signature`. Use `twilio.validateRequest(authToken, signature, url,
params)` with the public URL (`APP_URL` + path) and reject on mismatch. The
send endpoints are already behind `requireAuth` + write role + rate limits.

## 4. MFA

The fake MFA endpoints were removed. Real TOTP via Supabase `auth.mfa`
(enroll / challenge / verify) plus an AAL2 requirement for super-admin routes
is a follow-up.

## 5. Staff / viewer membership model

Access is owner-only today (`owns_business()` in RLS; one account per
workspace). A `memberships` table (user, account, role: owner | staff |
viewer) with matching RLS helpers and a team-management page is needed for
non-owner access. `supabase/migrations_pending/` has an earlier draft
(`w0_01_identity_companies_membership`) to mine for ideas; it does not apply
cleanly to the current schema.

## 6. Shared galleries

Public per-job pages work through the `public_job` RPC. Customer-facing
*galleries* (a curated, shareable set of media with its own token and expiry)
need a `shared_galleries` table (token, business_id, job ids / media ids,
expires_at, created_by), a security-definer RPC that returns only the selected
media through signed URLs, and RLS so only the owning workspace can manage
them.

## 7. Dependency upgrades (deferred to post-launch)

- **Vite 5 -> 8** and **React Router 6 -> 7** resolve the remaining
  `npm audit` findings. Both are major upgrades touching the build config,
  the server bundle (`vite.config.server.ts`) and every route definition, and
  the open advisories affect the dev server only. Deferred so the launch
  build stays on the configuration that has been tested end-to-end; do it as
  the first post-launch PR.

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
