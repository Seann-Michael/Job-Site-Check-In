# supabase/ — schema, migrations, and how to reproduce the database

Project: `qfhbusqupidiwlrzkgqc` (Supabase). Schema of record: `public` + the
`media` storage bucket. Rebuilt as a reproducible baseline on **2026-08-20**.

```
supabase/
├── migrations/                      <- the ONLY directory `supabase db push` reads
│   ├── 20260820000000_baseline_live_schema.sql   full live schema, idempotent
│   └── 20260820000000_google_oauth_tokens.sql    (see "naming rule" -- duplicate stamp, must be renumbered)
├── migrations_pending/              <- parked; NOT applied; see its README
│   ├── 20260727000000_lock_down_anon_role_and_media_bucket.sql
│   ├── 20260728000000_w0_00_... through 20260728010000_w0_10_...
│   ├── README.md                    why each file is parked and when it lands
│   └── RUNBOOK_W0.md                original apply/verify/recover guide for the series
└── README.md                        this file
```

## History, in one paragraph

The live database was built through 45 dashboard/MCP migrations
(`supabase_migrations.schema_migrations` versions `20260311155641` ..
`20260327085246`) that were never saved to this repo. The repo meanwhile
accumulated 18 legacy SQL files that were never applied — five of them not valid
PostgreSQL, several colliding with live objects — plus a duplicate-stamped
`google_oauth_tokens` file. All 19 were deleted on 2026-08-20 (they are in git
history; W0/00's `app.migration_notes` records why each was unusable). What
replaces them is a single catalog-generated baseline that reproduces the live
schema exactly, including its insecure parts, so that the security work can be
expressed as ordinary forward migrations on top of a known state.

## Bootstrapping a fresh project

```bash
supabase link --project-ref <new-ref>
supabase db push            # applies supabase/migrations/* in version order
```

The baseline is self-contained: extensions, 12 enums, 1 sequence, 5 functions,
57 tables, 113 PK/UNIQUE/CHECK + 33 FK constraints, 56 indexes, 4 views,
5 triggers, RLS flags + 76 policies, grants, the `media` bucket and its 4
`storage.objects` policies. It creates no data.

It is also safe to run against a database that already has the schema: every
statement is guarded (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF
EXISTS` + `CREATE POLICY`, DO-block guards around enums and constraints,
`ON CONFLICT DO NOTHING` for the bucket row).

Local stack works the same way: `supabase start` then `supabase db reset`.

## Stamping the EXISTING project (do this once, before any `db push` to it)

The live project already has everything the baseline creates. Tell the CLI so,
instead of letting it re-run the file (harmless, but it would also try the
duplicate-stamped file and the two cannot both be recorded under one version).

Either with the CLI:

```bash
supabase migration repair --status applied 20260820000000
```

or directly in SQL (dashboard SQL editor, `postgres` role):

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260820000000',
  'baseline_live_schema',
  ARRAY['-- stamped 2026-08-20: schema was already present; file = supabase/migrations/20260820000000_baseline_live_schema.sql']
)
ON CONFLICT (version) DO NOTHING;
```

The 45 pre-existing rows in `schema_migrations` can stay. They do not
correspond to files, so `supabase db push` ignores them; `supabase migration
list` will show them as "remote only", which is accurate. If that noise
bothers you later, `supabase migration repair --status reverted <version>`
removes a row without touching the schema.

Verify after stamping:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE version >= '20260820000000' ORDER BY version;
```

## Naming rule: one timestamp per file, forever

`schema_migrations.version` is the primary key. Two files with the same
14-digit prefix cannot both be recorded, and the CLI's ordering between them is
undefined. This has already bitten this repo twice (`20241220000008_*` x2,
`20260727000000_*` x2).

* Prefix = `YYYYMMDDHHMMSS` in UTC, unique across `migrations/` **and**
  `migrations_pending/` (the parked files will move back with their names).
* Never reuse, never renumber an applied file.
* **Current violation:** `20260820000000_google_oauth_tokens.sql` shares its
  stamp with the baseline. It must be renamed before either is pushed, for
  example to `20260820000100_google_oauth_tokens.sql`. The file's content is
  self-contained (no FKs into baseline tables), so only the name changes.

## What is parked in `migrations_pending/` and when it lands

Short version: the anon lockdown and the W0 series (`app` schema, companies,
mobile field-service tables, change-log/sync, tenant RLS). They are coupled to
the auth step — the current web client writes as `anon`, `auth.users` is
empty, and W0/10 refuses to run until real users exist. Full per-file reasoning
and the preconditions list are in
[`migrations_pending/README.md`](migrations_pending/README.md).

## What the baseline reproduces that you should know is insecure

Reproduced on purpose; fixing it is the next step, not this one.

* 31 of 57 tables have **RLS disabled** and `anon`/`authenticated` hold ALL
  privileges on every table, view and sequence (stock Supabase defaults, never
  revoked).
* Of the 26 tables with RLS enabled, most carry `USING (true)` policies for
  `anon` or `public`. Only `webhooks`, `webhook_deliveries`, `workflows`,
  `workflow_executions` (keyed on `business_id = auth.uid()`, which is the
  wrong column) and the two `*_slides` read policies (`active = true`) have any
  predicate at all.
* The 4 views run as their owner (`postgres`), not `SECURITY INVOKER`; they
  bypass RLS on the tables underneath.
* The `media` bucket is public, and its four `storage.objects` policies are
  `TO public` with no owner check — anyone with the anon key can upload,
  overwrite or delete any object.
* `kv_store_32071718` has RLS enabled and no policies (service-role only) —
  that one is fine.

## Leftover demo data on the live project (report only — nothing deleted)

Surveyed 2026-08-20. The project is **not** empty; earlier notes saying "0 rows
in every table" were wrong. `auth.users` is 0 rows; `public` is not.

Row counts, non-empty tables only (40 of 57 are empty, including `plans`,
`login_slides`, `signup_slides`, `gmb_categories`):

| table | rows | what it is |
|---|---|---|
| `analytics` | 24 | demo metrics |
| `reviews` | 17 | demo reviews |
| `help_articles` | 12 | seeded help center ("Quick Start Guide" … "Agency Multi-Client Management"), all `published`, by "Super Admin" — arguably real content, not test junk |
| `job_media` | 11 | all on job `d3d9a713…` ("Test Project"); `file_path` = public storage URLs |
| `jobs` | 9 | 8 scripted demo jobs ("Water Heater Replacement – Johnson Residence" …) + 1 "Test Project" |
| `gmb_hours` | 7 | demo |
| `review_requests` | 6 | demo |
| `gmb_audit_results` | 5 | demo |
| `notification_templates` | 5 | seeded templates |
| `businesses` | 3 | `b1000000-…-0001/2/3`: Sunrise Plumbing & Heating, Apex Concrete & Paving, Green Leaf Landscaping |
| `job_documents` | 2 | test uploads |
| `clients` | 1 | "test" / john@gmail.com, `business_id IS NULL` |
| `client_notes` | 1 | — |
| `gmb_profiles` | 1 | — |
| `users` | 1 | `a1000000-0000-0000-0000-000000000001` demo@localseodemo.com "Demo Agency" (`agency_admin`) — no matching `auth.users` row |
| `system_settings` | 1 | `global => {}` |
| `kv_store_32071718` | 1 | see below |

The hand-made ids (`a1000000-…`, `b1000000-…`) and the `localseodemo.com`
address identify this as a seed script, not user activity.

`storage.objects`: **19 objects, ~62 MB**, all in `media`, all `owner = NULL`
(uploaded with the anon key), created 2026-03-14 .. 2026-03-17:

| prefix | count | notes |
|---|---|---|
| `project-media/d3d9a713-…/` | 13 | jpeg/jpg x11, one 6.1 MB `.MP4`, one **43.7 MB `.MOV`**; these back the 11 `job_media` rows (2 are orphans) |
| `project-media/a06e1078-…/`, `project-media/b21aad85-…/` | 2 | same 168 KB jpg uploaded to two job ids that do not exist in `jobs` |
| `project-documents/{a06e1078,d3d9a713,f68cea46}-…/` | 4 | the same 544 KB PDF x3 + one 42 KB PDF; only `d3d9a713` is a real job |
| `client-documents/60381c5e-…/` | 1 | 544 KB PDF for the "test" client |
| `review-gate-videos/` | 1 | the same 6.1 MB MP4 again |

### `kv_store_32071718` — what it is

A generic `(key text PRIMARY KEY, value jsonb)` table with RLS on and no
policies, two identical `text_pattern_ops` indexes, created by live migration
`20260324162040 create_kv_table_32071718`. This is the scaffold that
**Figma Make** generates for its Supabase edge-function template (the
`kv_store_<random>` name and the `kv_store.tsx` helper are its signature). It
holds exactly one row, `job_1774372062403`, a JSON job record
(`jobName: "test"`, `status: "active"`, created 2026-03-24) written by that
prototype's edge function. Nothing in this repo's client or server reads it
(`grep -r kv_store` finds only the migration). There are no edge functions in
`supabase/functions/` and `supabase_functions.hooks` is empty. It is a leftover
and can be dropped in a later migration once confirmed no deployed edge
function still references it — not done here because dropping is out of scope
for a baseline.

## Workflow from here

1. Stamp the live project (above). Renumber the oauth file.
2. New schema changes: one file, one fresh UTC timestamp, idempotent where
   practical, into `supabase/migrations/`. Apply with `supabase db push` (or
   `apply_migration` via MCP with the same name so `schema_migrations` stays
   honest).
3. Auth/RLS step: move the parked files back in order, per
   `migrations_pending/README.md`.
4. Demo-data cleanup: its own small migration or a one-off script, after
   deciding whether `help_articles` / `notification_templates` are content to
   keep.
