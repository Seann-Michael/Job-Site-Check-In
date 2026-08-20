# supabase/migrations — what to run, in what order, and what will bite you

This directory holds **two unrelated histories**. Read this before running anything.

1. **Eighteen legacy files** (`001_*` through `20260726010000_*`). Seventeen of these
   have **never been applied**, five are not valid PostgreSQL, and several collide
   with live objects. **Do not run them.** `supabase db push` would try all
   seventeen and fail part-way, leaving the database half-migrated. The reasons are
   recorded per file, in the database, by W0/00 — query them:

   ```sql
   SELECT file_name, disposition, reason FROM app.migration_notes ORDER BY file_name;
   ```

2. **The W0 series** (`20260727000000_*` and `20260728*_w0_*`). This is the live
   work. It is designed to be applied **one file at a time, in order**, checking the
   output of each before starting the next.

---

## Apply order

| # | File | Safe to run today? |
|---|------|--------------------|
| 0 | `20260727000000_lock_down_anon_role_and_media_bucket.sql` | **Yes — run first** |
| 1 | `20260728000000_w0_00_baseline_notes_and_helpers.sql` | Yes |
| 2 | `20260728001000_w0_01_identity_companies_membership.sql` | Yes |
| 3 | `20260728002000_w0_02_clients_name_split_backfill.sql` | Yes |
| 4 | `20260728003000_w0_03_jobs_status_vocabulary_and_columns.sql` | Yes |
| 5 | `20260728004000_w0_04_job_tasks_rebuild_and_checklists.sql` | Yes |
| 6 | `20260728005000_w0_05_field_tables_checkins_notes_state.sql` | Yes |
| 7 | `20260728006000_w0_06_job_events_and_publish_records.sql` | Yes |
| 8 | `20260728007000_w0_07_job_media_attribution_and_backfill.sql` | Yes |
| 9 | `20260728008000_w0_08_company_scoping_composite_fks.sql` | Yes |
| 10 | `20260728009000_w0_09_changes_log_and_sync_pull.sql` | Yes |
| — | **manual gate — see below** | |
| 11 | `20260728010000_w0_10_rls_HOLD_UNTIL_REAL_USERS_EXIST.sql` | **NO. Blocked until real users exist.** |

**Order 0 is not negotiable.** The lockdown file must run before any file that
creates a table, or the new tables inherit `anon` write grants from Supabase's
default privileges. (W0/00 additionally revokes the `SELECT` half of those default
privileges, which the lockdown file does not, and W0/04–06 each revoke `anon` on the
tables they create — belt and braces, because a new table being world-readable for
the entire duration of the manual gate is the failure this series is most exposed to.)

Each file records itself in `app.w0_series_log`. Check progress at any time:

```sql
SELECT step, applied_at, applied_by FROM app.w0_series_log ORDER BY applied_at;
```

---

## What to verify after each step

Run these **after** the corresponding file, before starting the next.

### After the lockdown (0)

```sql
-- anon must hold no write grants
SELECT count(*) FROM information_schema.role_table_grants
 WHERE grantee = 'anon' AND privilege_type <> 'SELECT';   -- expect 0
```

### After W0/00

```sql
SELECT count(*) FROM app.migration_notes;   -- expect 18
SELECT count(*) FROM app.w0_scope;          -- expect 21
-- anon must be gone from the default privileges for SELECT too:
SELECT defaclacl::text FROM pg_default_acl
 WHERE defaclnamespace = 'public'::regnamespace AND defaclobjtype = 'r';
-- no entry should read anon=...r...
```

If W0/00 printed `WARNING: could not revoke default SELECT for role postgres`, that
is expected when the migration runs as a non-superuser. The per-table revokes in
W0/04–06 cover it. Confirm with the `pg_default_acl` query above and, if `anon`
still has `r`, re-run the `ALTER DEFAULT PRIVILEGES` lines as `postgres`.

### After W0/01

W0/01 **verifies the JWT claim plumbing itself** and aborts if it is broken. If it
applied, that check passed. Also confirm:

```sql
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND proname = 'current_company_ids';  -- must exist
SELECT count(*) FROM public.companies;        -- 0 is expected and fine
```

### After W0/02, W0/03, W0/07

These backfill from JSON blobs and report what they could **not** work out. The
report is the deliverable, not the row count:

```sql
SELECT step, outcome, count(*) FROM app.w0_backfill_report GROUP BY 1,2 ORDER BY 1,2;
SELECT * FROM app.w0_backfill_report WHERE outcome IN ('ambiguous','unparseable');
```

### After W0/03 and W0/04 (the two that drop and rebuild views)

```sql
SELECT * FROM app.w0_view_stash;   -- MUST be empty
```

**A non-empty result means a view was dropped and never restored.** `projects` is a
compatibility shim the web client still reads; if it is missing, the web app is
broken. Do not continue.

### After W0/08

This is the one whose output you actually have to read.

```sql
-- every in-scope table should report 0
SELECT s.table_name,
       (SELECT count(*) FROM pg_class c WHERE c.relname = s.table_name) AS exists
  FROM app.w0_scope s WHERE s.company_scoped;

-- rows the backfill could not assign, named individually:
SELECT table_name, row_id, outcome, detail
  FROM app.w0_backfill_report
 WHERE step = '08_orphan_company_assignment' AND outcome = 'ambiguous';

-- the stamping trigger must be on every in-scope table
SELECT count(*) FROM pg_trigger WHERE tgname = 'aa_stamp_company_id' AND NOT tgisinternal;
```

If W0/08 reports rows still unassigned, **W0/10 will refuse to run.** Two live rows
genuinely cannot be resolved by any join (`clients` has one row with
`business_id IS NULL`; `job_documents` has one row with `job_id IS NULL`), so W0/08
has an orphan pass: with exactly one company it assigns them and says so; with more
than one it refuses to guess and prints the exact `UPDATE` to run for each row.

### After W0/09

```sql
SELECT count(*) FROM app.changes WHERE company_id IS NULL;   -- expect 0
```

`app.changes` **grows without limit** and adds an extra INSERT plus a full row
payload to every write on 17 tables. Nothing consumes `sync_pull()` yet. If that
write cost matters before the client ships, drop the triggers — the table and the
functions stay, and re-running W0/09 puts them back:

```sql
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT table_name FROM app.w0_scope WHERE log_changes LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                   'zz_log_change_' || t.table_name, t.table_name);
  END LOOP; END $$;
```

---

## ⚠️ The RLS migration — read all of this

**`20260728010000_w0_10_rls_HOLD_UNTIL_REAL_USERS_EXIST.sql` must not be applied
until real users exist.**

`auth.users` currently holds **zero rows**. Nobody has ever signed in. Every policy
in that file grants access on the basis of an active `company_members` row matched
to the caller's auth uid. Enable RLS with those tables empty and **every policy
evaluates to FALSE for every caller** — the mobile app, the web client and the
public pages all return zero rows, and the only way back in is the `service_role`
key or a direct superuser connection.

### The interlock

W0/10 will not let that happen by accident. Section 0 aborts unless **all seven**
hold:

1. W0/00–W0/09 are all recorded in `app.w0_series_log`
2. `auth.users` is non-empty
3. `public.companies` is non-empty
4. `public.company_members` has at least one **active** row
5. every active member resolves to a real `auth.users` row
6. no in-scope table has any row with `company_id IS NULL`
7. **the JWT claim plumbing resolves** — it sets `request.jwt.claims` itself and
   asserts `app.current_user_id()` reads it back
8. **the `company_id` stamping trigger is installed** on every in-scope table

Checks 7 and 8 exist because the original interlock could not see either failure,
and both are silent, total outages: 7 is a read blackout for every signed-in user,
8 is a `42501` on every write from every client.

### The gate: what to do before running it

```sql
-- 1. Create the tenant, assign the businesses, name the owner. One call.
--    The owner must already have signed up — user_id has to be an auth.users id.
SELECT app.w0_bootstrap_tenant('Your Company Name', 'you@example.com');

-- 2. Re-run W0/08. It is idempotent and now has parents to backfill from.

-- 3. Confirm nothing is left unassigned (W0/08 prints this too).
```

Then, **on a staging copy**, apply W0/10 and run the section 7 checklist — which
includes a **write**, not only reads. An earlier version of that checklist tested
reads only, which is exactly how a database nobody can write to passes every check.

### Required client change before applying W0/10

`client/pages/PublicGallery.tsx` must call
`supabase.rpc('gallery_by_token', { p_token: token })` instead of selecting from
`shared_galleries`. **This change is already in the repo.** W0/10 closes `anon`
`SELECT` on that table, because a `FOR SELECT TO anon` policy cannot require a
token filter — PostgREST serves a bare `select` happily, so the anon key bundled in
the app could list every gallery of every tenant. A function argument cannot be
omitted; that is the whole fix.

### Deliberate breaking changes in W0/10

* `anon` loses read access to `jobs`, `businesses` and `review_requests`. **The
  public `PublicProject` and `ReviewGate` pages will go blank.** Build token-scoped
  RPCs for them first (model them on `gallery_by_token`) or accept the outage.
* Cross-tenant **writes** are revoked from `authenticated` on ~19 tables outside
  `app.w0_scope` (`client_notes`, `gmb_*`, `billing_records`, `sms_logs`, …). Their
  **reads are still open** — W0/10 prints a WARNING naming every RLS-disabled table
  so the gap stays a decision rather than an oversight. Anything that wrote to those
  tables as `authenticated` must move to `service_role`.

### 🔥 Recovery if W0/10 locks you out

Keep this **somewhere you can reach without the application** — a password manager,
a runbook, not this repo. Run it from a `service_role` or superuser connection
(Supabase dashboard SQL editor works):

```sql
DO $x$ DECLARE t record; BEGIN
  FOR t IN SELECT table_name FROM app.w0_scope LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.table_name);
  END LOOP; END $x$;
```

That restores read/write immediately without dropping any policy, so you can
diagnose and then re-enable. To also remove the policies:

```sql
DO $x$ DECLARE p record; BEGIN
  FOR p IN SELECT pol.polname, c.relname FROM pg_policy pol
             JOIN pg_class c ON c.oid = pol.polrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname IN (SELECT table_name FROM app.w0_scope) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.polname, p.relname);
  END LOOP; END $x$;
```

**Diagnosing a blackout, in order:**

```sql
SELECT auth.uid();                    -- NULL  -> the JWT has no sub claim
SELECT public.current_company_ids();  -- '{}'  -> no active company_members row
```

Use `public.current_company_ids()`, not `app.current_company_ids()` — schema `app`
has no `USAGE` grant for `authenticated`, so the latter fails with `42501` **by
design** and that error means nothing about whether RLS is working.

---

## Safe today vs. blocked

**Safe to run today (steps 0–10):** all of them are additive or guarded. The only
destructive statement in the series is `DROP TABLE public.job_tasks` in W0/04, and
it aborts unless the table has zero rows (verified: it does). W0/03 and W0/04 drop
and rebuild dependent views inside the same transaction, and stash every definition
in `app.w0_view_stash` first.

**Blocked until real users exist (step 11):** W0/10 only. It enforces its own
preconditions, so a mistimed `supabase db push` aborts rather than blacking out the
database — but do not rely on that as a plan.

---

## Known follow-ups this series does *not* do

These are tracked deliberately, not forgotten:

* **Public pages.** `PublicProject` and `ReviewGate` need token-scoped RPCs before
  W0/10, or they break. `gallery_by_token()` is the pattern.
* **Read isolation on unmodelled tables.** W0/10 closes cross-tenant writes on the
  ~19 tenant-bearing tables outside `app.w0_scope`; reads remain open.
* **`company_members` seeding.** Not automated on purpose. `user_id` must be an
  `auth.users` id, and seeding it from `public.users` would pass locally and then
  permanently fail W0/10's interlock check 5. Use `app.w0_bootstrap_tenant()` after
  the first real signup.
* **Task assignment.** `job_tasks.assignee_user_id` expects an `auth.users` id, but
  the shipped client stores assignees inside the `job_field_state.tasks` JSON blob
  using `public.users` ids or literal demo strings. Reconciling the two is a
  follow-up; until then nothing can answer "tasks assigned to me".
* **Idempotent publishing.** `social_media_posts.idempotency_key` and
  `job_media.client_generated_id` exist with partial unique indexes, but the client
  does not send either yet. Until it does, `job_media`'s duplicate protection rests
  on the unique index on `file_path`.
* **`app.changes` retention.** `app.prune_changes(cutoff)` exists and is
  deliberately unscheduled — it needs a cutoff below the oldest watermark any device
  still holds, and there is no per-device watermark tracking yet.
* **Legacy status values.** `jobs.status` still accepts `'active'` and `'paused'`
  because the shipped client emits them. `app.job_status_catalog.replaced_by` holds
  the mapping for when it stops.
