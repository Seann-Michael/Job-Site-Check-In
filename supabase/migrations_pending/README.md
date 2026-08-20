# supabase/migrations_pending — NOT applied, do not `db push` from here

Everything in this directory is **deliberately outside** `supabase/migrations/`
so that `supabase db push` cannot pick it up. None of it has been applied to the
live project (`qfhbusqupidiwlrzkgqc`). It is parked, not abandoned.

Nothing has been renumbered. The filenames are the ones the series was written
and cross-referenced with (`app.w0_series_log`, `app.migration_notes`, the
runbook). Moving a file back into `supabase/migrations/` is the act of
scheduling it; keep the name.

| File | What it does | Why it is parked |
|---|---|---|
| `20260727000000_lock_down_anon_role_and_media_bucket.sql` | Revokes every non-SELECT grant from `anon` on all tables/sequences in `public`, drops the three anon **write** policies on `storage.objects` for the `media` bucket and replaces them with `authenticated`-only ones. | **The shipped web client still writes as `anon`.** It has no sign-in flow wired to Supabase Auth (`auth.users` has 0 rows) and uses the anon key for every insert/update/delete, including media uploads. Applying this today breaks every write in the app. It lands in the same release as the auth step. |
| `20260728000000_w0_00_baseline_notes_and_helpers.sql` | Creates schema `app`, `app.migration_notes`, `app.w0_scope`, `app.w0_series_log`, helper functions; revokes anon from default privileges. | First file of the W0 series; nothing else in the series runs without it. It also INSERTs `app.migration_notes` rows describing 18 legacy files that **no longer exist on disk** (deleted 2026-08-20 — see `supabase/README.md`). The rows are historical record only; harmless. |
| `20260728001000_w0_01_identity_companies_membership.sql` | `companies`, `company_members`, `public.current_company_ids()`, JWT claim plumbing self-test. | Requires Supabase Auth to be the identity source. Aborts if the JWT claim plumbing does not resolve. |
| `20260728002000_w0_02_clients_name_split_backfill.sql` | Backfills `clients.first_name/last_name` from `name`. | Part of the series; harmless alone but pointless before W0/01. |
| `20260728003000_w0_03_jobs_status_vocabulary_and_columns.sql` | New `jobs` status vocabulary + columns; drops and rebuilds the `projects` view. | The `projects` view is a compatibility shim the web client reads; rebuild must be verified (`app.w0_view_stash` must be empty after). |
| `20260728004000_w0_04_job_tasks_rebuild_and_checklists.sql` | `DROP TABLE job_tasks` (guarded: aborts unless 0 rows — it is 0 today) and rebuilds it for the mobile app. | Destructive by design; coupled to the mobile field-service app. |
| `20260728005000_w0_05_field_tables_checkins_notes_state.sql` | `job_checkins`, `job_notes`, `shared_galleries`, `job_field_state`, `media_comments`. | Mobile-app tables. No consumer in the web client. |
| `20260728006000_w0_06_job_events_and_publish_records.sql` | `job_events`, `social_media_posts` (with idempotency key). | Mobile-app publishing pipeline. |
| `20260728007000_w0_07_job_media_attribution_and_backfill.sql` | `job_media` attribution columns + backfill from JSON blobs. | Part of the series. |
| `20260728008000_w0_08_company_scoping_composite_fks.sql` | Adds `company_id` to 21 in-scope tables, composite FKs, `aa_stamp_company_id` trigger, orphan assignment. | Needs `companies` rows to backfill into; has an orphan pass that prints manual `UPDATE`s when more than one company exists. |
| `20260728009000_w0_09_changes_log_and_sync_pull.sql` | `app.changes` change-log table, `zz_log_change_*` triggers on 17 tables, `sync_pull()`. | Adds an extra INSERT per write on 17 tables for a sync client that does not ship yet. |
| `20260728010000_w0_10_rls_HOLD_UNTIL_REAL_USERS_EXIST.sql` | Tenant RLS for every in-scope table, closes anon reads on `jobs`/`businesses`/`review_requests`/`shared_galleries`. | **Gated by its own interlock** (section 0): aborts unless `auth.users`, `companies`, and an active `company_members` row exist, every in-scope row has a `company_id`, the JWT plumbing resolves and the stamping trigger is installed. With zero users every policy evaluates FALSE for every caller — total read/write blackout. |

## When does it land

In one coordinated step, in this order, **after**:

1. the web client authenticates against Supabase Auth (sign-in + session on
   every request) instead of using the anon key for writes;
2. `PublicProject` and `ReviewGate` read through token-scoped RPCs (model:
   `gallery_by_token()` in W0/10) so closing anon reads does not blank them;
3. a first real user has signed up and `app.w0_bootstrap_tenant(...)` has
   created the tenant;
4. the whole series has been rehearsed on a branch/staging copy with the
   section 7 checklist of W0/10 (which includes a **write**, not only reads).

Until then these files stay here. Order 0 (lockdown) is not negotiable when the
time comes: it must run before any file that creates tables, or the new tables
inherit anon write grants from default privileges.

## Consistency with the baseline (checked 2026-08-20)

The files were cross-checked against
`supabase/migrations/20260820000000_baseline_live_schema.sql`:

* Every `public.<object>` they reference is either defined by the baseline or
  created earlier in the series. No dangling references.
* Every column they `ALTER`/backfill on existing tables (`clients`, `jobs`,
  `job_media`, `job_tasks`, `users`, `businesses`, `review_requests`,
  `job_documents`) exists in the baseline.
* Live facts the series asserts still hold: `job_tasks` has 0 rows (W0/04's
  drop guard passes), `job_media` has 11 rows, `clients` has exactly one row
  with `business_id IS NULL` (W0/08's orphan pass).
* The four `storage.objects` policies the lockdown file drops/replaces are
  present in the baseline under the same names.
* Discrepancy worth knowing: the baseline reproduces the storage policies as
  `TO public` (that is what is live — despite being named "Allow anon ...",
  they were created without a `TO` clause). The lockdown file's replacements
  are correctly scoped `TO authenticated`.
* Discrepancy worth knowing: W0/00's `app.migration_notes` and the runbook
  refer to 18 legacy files that were deleted from the repo on 2026-08-20. The
  notes remain correct as history; the files are in git history if needed.

`RUNBOOK_W0.md` is the original step-by-step apply/verify/recover guide for the
series. Its "Safe to run today" column is **no longer accurate for the lockdown
file** (see the table above); everything else in it still applies.
