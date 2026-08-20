# Deferred work (next steps after the production-hardening branch)

The `production-hardening` branch removed all mock data, dead UI, and dead code,
hardened the Express server, and made the database schema reproducible. The
owner asked that the following areas be left for dedicated follow-up steps.
Each item below is a known, open production blocker until its step lands.

## Step 1 — Authentication (highest priority)

Files intentionally left untouched: `client/lib/auth.ts`, `client/lib/accountManager.ts`,
`client/components/ProtectedRoute.tsx`, `client/hooks/useAuth.ts`,
`client/pages/Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `server/routes/authApi.ts`.

Open issues:
- `client/lib/auth.ts` fabricates a demo admin user in localStorage when nobody is signed in; `isAuthenticated()` is always true.
- "Dev Bypass" buttons on Login/Signup ship to production.
- Email/password login is a localStorage lookup with plaintext passwords (`accountManager.ts`).
- `POST /api/auth/login` never verifies the password; `POST /api/auth/change-password` resets any account by email with no auth; MFA endpoints always return success.
- No role guard on `/super-admin/*` routes; `SuperAdminLayout` has no role check.
- Client-side impersonation writes `auth_user` to localStorage (`BusinessDetail.tsx`, `BusinessManagement.tsx`).
- The Supabase session created by Google sign-in is ignored by the app shell.

Plan: use Supabase Auth end-to-end (one client, `onAuthStateChange`), delete the localStorage auth layer,
add a role guard, rewrite/remove `authApi.ts` on `signInWithPassword` + `auth.mfa`, move impersonation
server-side. `server/middleware/requireAuth.ts` already exists and is mounted on every new/hardened
route; it only needs the client to send the Supabase access token (`client/lib/api.ts` already does
when a session exists).

## Step 2 — Database RLS / anon lockdown (lands with Step 1)

`supabase/migrations_pending/` holds the anon lockdown and the W0 series. They are not applied
because the current client writes with the anon key and a fake identity; applying them first would
break the app. After Step 1, apply in order per `supabase/migrations_pending/README.md` and add
RLS policies for `notifications.user_id`.

Until then: the anon key (shipped in the web and mobile bundles) can read and write most tables.
Do not expose the current deployment to untrusted users.

## Step 3 — Payments (Stripe / PayPal)

`server/routes/payments.ts` and `client/pages/Payments.tsx` untouched. Open issues:
- Amount and business id are taken from the request body; server must own prices (from `plans`).
- No Stripe webhook handler; `express.raw` is already mounted at `/api/webhooks/stripe` in `server/index.ts` for it.
- PayPal hardcoded to sandbox, no capture, no webhook.
- Plan granted on a client-triggered `/confirm` call.

## Step 4 — Twilio / SMS and email delivery

`server/routes/twilio.ts` untouched. Open issues:
- `POST /api/twilio/sms/send` and `/review-request` are unauthenticated (toll-fraud risk) — mount `requireAuth`.
- `POST /api/webhooks/twilio` has no `X-Twilio-Signature` verification.
- Email campaigns/broadcast email have no sending backend (campaigns save as drafts; broadcast delivers in-app notifications only).

## Housekeeping

- Live database still contains demo rows (`demo@localseodemo.com`, 3 businesses, 9 jobs, reviews, analytics) and ~62 MB of anonymous test uploads in the `media` bucket. Owner chose to keep them during testing. Nothing in the repo seeds them any more. `kv_store_32071718` is a leftover scaffold table; safe to drop.
- `index.html` `og:url` uses the placeholder `https://localseoranker.com/` — confirm the real domain.
- `media` storage bucket is public; making it private is a one-line change and the server already supports signed URLs.
- OAuth `state` store is in-memory (fine for a single instance; move to the DB for multi-instance).
- Remaining `npm audit` findings require major upgrades: vite 6 → 8 (dev-server only issues) and react-router 6 → 7.
- ~1000 ESLint warnings (unused imports / `any`) remain; lint passes with 0 errors.
- `mobile/` (Expo app) is in this repo but has no shared build; it has its own demo mode and the same anon-key exposure as above.
