# Authentication & Row-Level Security

Real Supabase email/password authentication and database tenant isolation are
live as of 2026-08-20. Google sign-in is deferred (buttons exist but Google is
not configured yet).

## How auth works now

- **Supabase Auth is the credential store.** `public.users.id === auth.users.id`.
- A DB trigger (`on_auth_user_created`) auto-creates the `public.users` profile
  row on signup with role `business_owner`; `on_auth_user_updated` keeps
  email/verification/last-login in sync.
- The client uses `client/lib/auth.ts` (a thin, cached facade over
  `supabaseClient.auth`) — `signInWithPassword`, `signUpWithPassword`,
  `sendPasswordReset`, `updatePassword`, `signOut`, plus synchronous
  `getCurrentUser()/isSuperAdmin()` reading a session-backed cache refreshed by
  `onAuthStateChange`. The old localStorage "demo user" and "Dev Bypass" buttons
  are gone.
- `ProtectedRoute` redirects logged-out users to `/login`; `/super-admin/*` is
  gated to `role = super_admin`; a brand-new owner with no business is sent to
  `/onboarding` to create one.
- New routes: `/reset-password`, `/onboarding`.
- The Express server never checks passwords itself. `POST /api/auth/change-password`
  is authenticated (verifies the old password, changes the current user's).
  Impersonation is `POST /api/admin/impersonate` (super-admin only, issues a
  magic-link token the client redeems). Twilio SMS-send endpoints now require auth.

## Roles

`user_role` enum: `super_admin | agency_admin | business_owner | staff | viewer`.
`agency_admin` is unused (agency features removed). Today's effective roles:
`super_admin` (sees everything) and `business_owner` (owns businesses via
`businesses.owner_id`). Staff/viewer scoping (a real membership table) is a
follow-up — currently non-owners see only businesses they own.

## Row-Level Security

RLS is enabled on every tenant table. Policies (see
`supabase/migrations/20260820002000_rls_lockdown.sql`):

- **Business-scoped** (`analytics`, `jobs`, `clients`, `reviews`, `review_requests`,
  `workflows`, `gmb_*`, `billing_records`, `locations`, `sms_logs`, …):
  `is_super_admin() OR owns_business(business_id)`.
- **Job-scoped** (`job_media`, `job_photos`, `job_documents`, `job_tasks`,
  `server_media_metadata`): access through the parent job's business.
- **Public read** (`help_articles`, `changelog_entries`, `login_slides`,
  `signup_slides`, `plans`): anon + authenticated SELECT; super-admin writes.
- **Super-admin only** (`system_settings`, `email_*`, `broadcast_messages`,
  `workspaces`, `optimization_jobs`, `audit_logs`, `crash_logs`, …).
- **User-owned** (`notifications`, `idea_votes`): `user_id = auth.uid()`.
- `businesses`/`users`: owner/self + super-admin.

Anon table privileges are revoked. The two public flows that used to read tables
as anon now go through SECURITY DEFINER RPCs keyed by the row's UUID (the share
token): `review_request_public`, `review_request_mark_viewed`,
`submit_gate_review`, `public_job`. Public gallery already used `gallery_by_token`.
Storage `media` bucket: public read, authenticated write.

Verified at the database level: a super admin sees all rows; a stranger
authenticated user sees zero; anon is blocked on tenant tables and allowed only
on public-read tables and the RPCs. The four summary views were switched to
`security_invoker` so they respect RLS.

## First super admin

`swebb1988@gmail.com` was created as `super_admin` with a temporary password
(delivered separately). Change it on first login via Profile → password, or use
"Forgot password".

## Still deferred

- Google OAuth sign-in (configure provider + `google_oauth_tokens` already exists).
- Staff/viewer membership model (non-owner team access).
- MFA (removed the fake endpoints; real TOTP via `auth.mfa` is a follow-up).
- Payments (Stripe/PayPal) and Twilio webhook signature verification.
- Supabase project config: enable leaked-password protection; apply the pending
  Postgres security patch (both flagged by the Supabase linter).
