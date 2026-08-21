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
  Twilio SMS-send endpoints now require auth.

## Super admin access (no impersonation)

There is no impersonation. A `super_admin` never becomes another user; instead
their own session has full admin access to every account:

- **Database:** every RLS policy starts with `public.is_super_admin()`, so a
  super admin can read/write all tenant rows as themselves (audit trails keep
  the real actor id).
- **Server:** `requireAuth` sets `req.profile.isSuperAdmin`; `canAccessBusiness()`
  returns true for super admins regardless of `businessIds` (which only lists
  businesses they personally own).
- **Client workspace:** `workspaceService` loads *all* businesses (any status)
  for a super admin, so `businessIds` covers every account. The sidebar switcher
  becomes a searchable combobox (name + account id). "Open account" on
  `/super-admin/businesses` and the business detail page calls
  `workspaceService.switchBusiness(id)` and navigates to `/admin/jobs`; `AppLayout`
  shows a "Viewing <business> as super admin" banner with a link back.
- **Hidden from tenants:** super admins are excluded from business team/user
  lists in the client, and migration `20260820005000_hide_super_admins_from_tenants`
  tightens `users_select` so non-super-admin callers can only see non-super-admin
  rows (plus themselves).

## Roles

`user_role` enum: `super_admin | agency_admin | business_owner | staff | viewer`.
`agency_admin` is unused (agency features removed). `users.role` is the
user's *global* role (`super_admin` sees everything); per-business access is
decided by ownership plus team membership:

## Team membership

Migration `20260820008000_business_memberships.sql`.

| Role | Where it lives | Read tenant data | Write tenant data | Manage team / edit business |
|---|---|---|---|---|
| owner | `businesses.owner_id` (implicit, never a member row) | yes | yes | yes |
| staff | `business_members.role = 'staff'` | yes | yes | no |
| viewer | `business_members.role = 'viewer'` | yes | no | no |
| super_admin | `users.role` | every business | every business | every business |

`business_members (id, business_id, user_id, role check in ('staff','viewer'),
invited_by, created_at, unique(business_id,user_id))`, cascading on business /
user delete.

Helpers (SECURITY DEFINER, `search_path = public`, EXECUTE for `authenticated`
only; uuid and text overloads):

- `can_read_business(b)`  = `is_super_admin() OR owns_business(b) OR member`
- `can_write_business(b)` = `is_super_admin() OR owns_business(b) OR staff member`
- `current_business_ids()` = owned UNION member business ids.

**The membership table is read-only over PostgREST.** `INSERT/UPDATE/DELETE ON
business_members` is revoked from `authenticated` and the only policy is
`FOR SELECT USING (can_read_business(business_id))`. All mutations go through
the server (service role) at `/api/team/*` (owner or super admin only) and
`/api/admin/staff/invite` (super admin only, creates internal super admins).
Every mutation is written to `audit_logs`. See `server/routes/README.md`.

Server side, `requireAuth` loads `profile.businessIds` (owned ∪ member) and
`profile.memberRoles: { [businessId]: 'owner' | 'staff' | 'viewer' }`.
`canAccessBusiness()` = read, `canWriteBusiness()` = owner/staff/super admin,
`isBusinessOwner()` = owner/super admin. Business-scoped mutations (webhook
register, workflow webhook-url, Twilio send, RSS add item, Google OAuth
connect) use `canWriteBusiness`, so a viewer gets `403` even though the
route-level `requireWrite` (which looks at the global `users.role`) might pass.
A freshly invited user's global `users.role` is set to the invited role.

## Row-Level Security

RLS is enabled on every tenant table. Policies (see
`supabase/migrations/20260820002000_rls_lockdown.sql`):

Since `20260820008000_business_memberships.sql` every tenant policy is a pair:
`<table>_select FOR SELECT USING (can_read_business(...))` and
`<table>_write FOR ALL USING/WITH CHECK (can_write_business(...))`. The split
is required because a `FOR ALL` policy shares one `USING` for UPDATE/DELETE;
viewers pass the select policy and fail the write policy.

- **Business-scoped** (`analytics`, `jobs`, `clients`, `reviews`, `review_requests`,
  `workflows`, `gmb_*`, `billing_records`, `locations`, `sms_logs`, …):
  `can_read_business(business_id)` / `can_write_business(business_id)`.
- **Job-scoped** (`job_media`, `job_photos`, `job_documents`, `job_tasks`,
  `server_media_metadata`): access through the parent job's business
  (`job_media`/`job_documents` also via `clients` when `job_id` is NULL).
  `client_notes`, `rss_feed_items`, `webhook_deliveries` go through their parent.
- **Public read** (`help_articles`, `changelog_entries`, `login_slides`,
  `signup_slides`, `plans`): anon + authenticated SELECT; super-admin writes.
- **Super-admin only** (`system_settings`, `email_*`, `broadcast_messages`,
  `workspaces`, `optimization_jobs`, `audit_logs`, `crash_logs`, …).
- **User-owned** (`notifications`, `idea_votes`): `user_id = auth.uid()`.
- `businesses`: SELECT `can_read_business(id)`; INSERT/UPDATE/DELETE owner or
  super admin only (staff cannot edit the business record).
- `business_members`: SELECT `can_read_business(business_id)`; no write policy.
- `users`: self, job assignees, and fellow members/owners of businesses the
  caller can read (super admins stay hidden from tenants); UPDATE self only.

Anon table privileges are revoked. The two public flows that used to read tables
as anon now go through SECURITY DEFINER RPCs keyed by the row's UUID (the share
token): `review_request_public`, `review_request_mark_viewed`,
`submit_gate_review`, `public_job`. Public gallery already used `gallery_by_token`.
Storage: `storage_path_allowed(name)` (reads; `can_read_business`) and
`storage_path_writable(name)` (insert/update/delete; `can_write_business`) on
both the private `media` and the public `public-assets` buckets.

Verified at the database level: a super admin sees all rows; a stranger
authenticated user sees zero; anon is blocked on tenant tables and allowed only
on public-read tables and the RPCs. The four summary views were switched to
`security_invoker` so they respect RLS.

## First super admin

`swebb1988@gmail.com` was created as `super_admin` with a temporary password
(delivered separately). Change it on first login via Profile → password, or use
"Forgot password".

## Still deferred

- Google OAuth sign-in (configure the provider in Supabase Auth; the GBP
  connect flow and `google_oauth_tokens` / `oauth_states` tables already exist).
- MFA (removed the fake endpoints; real TOTP via `auth.mfa` is a follow-up).
- Payments (Stripe) and Twilio webhook signature verification.
- Supabase project config: enable leaked-password protection; apply the pending
  Postgres security patch (both flagged by the Supabase linter).

See [DEFERRED_WORK.md](DEFERRED_WORK.md) for the full list with details.
