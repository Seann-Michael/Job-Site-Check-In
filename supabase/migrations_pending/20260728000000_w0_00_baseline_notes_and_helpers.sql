-- =====================================================================
-- W0 / 00 — Baseline record, quarantine notes, and shared helpers
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   The repo's supabase/migrations/ directory is a PARALLEL, DISCONNECTED
--   history. supabase_migrations.schema_migrations holds 45 rows (versions
--   20260311155641 .. 20260327085246) that were applied through the dashboard
--   / MCP apply_migration. NONE of the 18 pre-existing repo filenames appear
--   in that table. Seventeen of those eighteen files have never been applied
--   in any form, five of them are not even valid PostgreSQL, and several
--   collide with live objects.
--
--   A bare `supabase db push` would therefore try to run all seventeen and
--   fail part-way through, leaving the database in a half-migrated state.
--
--   This migration does NOT delete those files — nobody has verified what
--   downstream tooling still reads them. Instead it writes the quarantine
--   decision into the database as a durable, queryable note, and stamps the
--   real starting point of the W0 series.
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * PostgreSQL 13+ (uses gen_random_uuid(), xid8 in a later file).
--   * Schema `public` exists; `app` may or may not exist.
--   * Nothing else. This file creates only new objects in a new schema and
--     touches no existing table.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Everything downstream. Files 01..10 of this series call helpers defined
--   here (app.w0_stash_views, app.w0_restore_views, app.jsonb_num,
--   app.safe_timestamptz, app.touch_updated_at, app.w0_scope). Applying any
--   later W0 file first fails with 42883 "function ... does not exist" or
--   42P01 "relation app.w0_scope does not exist".
--
-- SAFETY: creates a new schema and new tables only. No DDL against any
--   existing table. Fully re-runnable.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS
  'Internal plumbing for the field-service platform: migration bookkeeping, '
  'guarded cast helpers, the change log, and sync functions. NOT exposed to '
  'PostgREST. Do not grant USAGE to anon or authenticated.';

-- Belt and braces: make sure the API roles cannot reach in here directly.
REVOKE ALL ON SCHEMA app FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA app FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA app FROM authenticated';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 0. CLOSE THE DEFAULT-PRIVILEGE HOLE BEFORE ANY NEW TABLE IS CREATED.
--
--    The lockdown migration 20260727000000 revokes INSERT/UPDATE/DELETE/
--    TRUNCATE/REFERENCES/TRIGGER from anon in the default privileges, but NOT
--    SELECT. Verified against the live catalog: pg_default_acl for schema
--    public, objtype 'r', still reads
--      {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}
--    — the `r` (SELECT) bit survives for anon.
--
--    Consequence if left alone: every table created by W0/04, W0/05 and W0/06
--    (job_checkins with crew GPS, job_notes with is_internal crew-only notes,
--    media_comments, shared_galleries with its tokens, publish_records with
--    its payloads) lands with GRANT SELECT TO anon and RLS off, and STAYS
--    that way for the entire duration of the manual gate in front of W0/10.
--    The anon key ships inside the mobile bundle, so that is a public read.
--
--    Fixing it here — in the first file of the series — means every table the
--    series creates afterwards is private by construction. anon SELECT is
--    then re-granted explicitly, per table, only where a public page needs it.
--
--    Both the "current role" and the "for role postgres" forms are issued:
--    default privileges are recorded per granting role, and `supabase db push`
--    and the dashboard/MCP runner do not always connect as the same role.
--    The supabase_admin variant is attempted too and is allowed to fail.
-- ---------------------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE NOTICE 'W0/00: no `anon` role — skipping default-privilege revoke';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
            'REVOKE SELECT ON TABLES FROM anon';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'W0/00: could not revoke default SELECT for the current '
                  'role (%): %', current_user, SQLERRM;
  END;

  FOREACH r IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
        'REVOKE SELECT ON TABLES FROM anon', r);
      RAISE NOTICE 'W0/00: default SELECT for anon revoked for role %', r;
    EXCEPTION WHEN OTHERS THEN
      -- Only the role itself (or a superuser) may alter its default
      -- privileges. Not fatal: the per-table REVOKEs in W0/04/05/06 are the
      -- belt to this migration's braces.
      RAISE WARNING 'W0/00: could not revoke default SELECT for role % (%). '
                    'The per-table REVOKE ALL ... FROM anon at the foot of '
                    'W0/04, W0/05 and W0/06 still closes this.', r, SQLERRM;
    END;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 0b. Per-table anon revoke, used by every file that creates a table.
--
--     Called at the foot of W0/04, W0/05 and W0/06. Idempotent, guarded on
--     the role and the table existing, so it is safe on a plain PostgreSQL
--     instance with no Supabase roles.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.w0_revoke_anon(p_tables text[])
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
  n integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RETURN 0;
  END IF;

  FOREACH t IN ARRAY p_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'w0_revoke_anon: anon privileges removed from % table(s)', n;
  RETURN n;
END $$;

COMMENT ON FUNCTION app.w0_revoke_anon(text[]) IS
  'Removes every anon privilege from the named public tables. Called at the '
  'foot of each W0 file that creates tables, so a new table is closed the '
  'moment it exists rather than whenever W0/10 finally lands. anon SELECT is '
  're-granted explicitly and per table only where a public page needs it.';


-- ---------------------------------------------------------------------
-- 1. Migration bookkeeping: what is quarantined and why.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.migration_notes (
  file_name    text PRIMARY KEY,
  disposition  text NOT NULL
    CHECK (disposition IN ('quarantined', 'superseded', 'applied_elsewhere', 'active')),
  reason       text NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.migration_notes IS
  'Durable record of which files in supabase/migrations/ must NOT be run. '
  'The files are deliberately left on disk: deleting migrations nobody has '
  'audited is how you lose the only copy of a schema decision.';

INSERT INTO app.migration_notes (file_name, disposition, reason) VALUES
 ('001_create_audit_logs.sql', 'quarantined',
  'audit_logs EXISTS LIVE WITH A DIFFERENT SHAPE (action audit_action enum, business_id, resource_type, risk_score). This file''s CREATE TABLE IF NOT EXISTS is a silent no-op and its indexes then fail on columns that were never added (idx_audit_logs_table_name, idx_audit_logs_operation). Also calls bare uuid_generate_v4(); uuid-ossp lives in schema extensions, not public.'),

 ('002_setup_storage_buckets.sql', 'quarantined',
  'Targets media_files (does not exist) and INSERTs into audit_logs using the OLD column names. Would fail outright. Live storage policies are the four "Allow anon ..." ones, since replaced by 20260727000000.'),

 ('20241220000001_create_gmb_leads_schema.sql', 'quarantined',
  'HARD CONFLICT: line 5 does an unguarded CREATE TYPE user_role AS ENUM (''super_admin'',''admin'',''agency''). A user_role type already exists with different values (super_admin, agency_admin, business_owner, staff, viewer) and is in use by users.role and the user_dashboard_summary view. Fails with 42710. "Fixing" it by DROP TYPE ... CASCADE would destroy users.role.'),

 ('20241220000002_create_client_oauth_schema.sql', 'quarantined',
  'onboarding_sessions / client_access never applied and not part of the W0 surface. Re-evaluate before running.'),

 ('20241220000003_create_static_onboarding_schema.sql', 'quarantined',
  'agency_static_configs never applied and not part of the W0 surface.'),

 ('20241220000006_create_admin_agency_billing_schema.sql', 'quarantined',
  'INVALID POSTGRESQL: MySQL-style inline INDEX definitions inside the CREATE TABLE body at lines 86-88. PostgreSQL has no such table element; syntax error.'),

 ('20241220000007_enhance_credit_allocation_system.sql', 'quarantined',
  'INVALID POSTGRESQL: inline INDEX inside CREATE TABLE at lines 43-46 and 57-58. Also targets credit tables that the applied migration drop_credit_and_agency_tables (20260314115119) deliberately removed.'),

 ('20241220000008_create_audit_reports_schema.sql', 'quarantined',
  'INVALID POSTGRESQL: inline INDEX inside CREATE TABLE at lines 50-53, 87-89, 131-132, 163-164. ALSO shares the version stamp 20241220000008 with another file — supabase db push cannot order the pair deterministically.'),

 ('20241220000008_fix_credit_tables_use_uuid_and_account_number.sql', 'superseded',
  'Content was applied as schema_migrations version 20260311155641, then its tables were deliberately removed by drop_credit_and_agency_tables (20260314115119). Do not resurrect. Also a duplicate version stamp (see the other 20241220000008 file).'),

 ('20241220000009_create_social_media_posts_schema.sql', 'quarantined',
  'INVALID POSTGRESQL: inline INDEX inside CREATE TABLE at lines 84-89, 126-129, 170-173, 208-210, 245-248, 280-281. Even if the syntax were fixed it carries CHECK (scheduled_for IS NULL OR scheduled_for > created_at) with created_at DEFAULT NOW(), which rejects the mobile app''s own payload (publish.ts sets scheduled_for to a timestamp captured BEFORE the insert), and a generated content_length with CHECK (platform != ''gmb'' OR content_length <= 1500). social_media_posts is authored fresh in W0/06 instead.'),

 ('20241221000001_add_performance_indexes.sql', 'quarantined',
  'Indexes tables under their pre-rename names (project*/projects). Those relations no longer exist.'),

 ('20250901000000_create_user_subscriptions_and_platforms.sql', 'quarantined',
  'user_subscriptions never applied; not part of the W0 surface.'),

 ('20250902000000_profiles_onboarding.sql', 'quarantined',
  'INVALID POSTGRESQL: CREATE POLICY IF NOT EXISTS at lines 59, 62, 65, 68 — PostgreSQL has no IF NOT EXISTS clause for CREATE POLICY at any version. Second defect at lines 68-69: a FOR INSERT policy declared with USING instead of WITH CHECK.'),

 ('20251001000000_create_wordpress_schema.sql', 'quarantined',
  'wordpress_connections / page_templates / bulk_page_jobs / generated_pages never applied; not part of the W0 surface.'),

 ('20260314000000_create_project_media_table.sql', 'applied_elsewhere',
  'Its content WAS applied, under version stamp 20260314151349, and the table was then renamed to job_media by 20260326223156. Re-running this file would create a stray empty project_media table alongside the real job_media (11 rows).'),

 ('20260726000000_create_mobile_field_tables.sql', 'superseded',
  'job_checkins / job_notes / shared_galleries. Never applied. W0/05 creates all three with IF NOT EXISTS plus the extra columns W0 needs, so it is safe whether or not this file ran first. Prefer W0/05.'),

 ('20260726010000_create_field_state_tables.sql', 'superseded',
  'job_field_state / media_comments. Never applied. W0/05 creates both with IF NOT EXISTS. Its job_id TEXT primary key and media_id TEXT choices are CORRECT and are preserved — the mobile app passes non-uuid local ids (demo-*, local-*, m-*).'),

 ('20260727000000_lock_down_anon_role_and_media_bucket.sql', 'active',
  'NOT YET APPLIED as of this survey (anon still holds 244 write grants and 61 select grants; the three anon media-bucket policies are still present). This file is CORRECT and SHOULD be applied — run it BEFORE the W0 series so that new tables do not inherit anon write grants from default privileges.')
ON CONFLICT (file_name) DO UPDATE
  SET disposition = EXCLUDED.disposition,
      reason      = EXCLUDED.reason,
      recorded_at = now();


-- ---------------------------------------------------------------------
-- 2. The W0 table scope. Single source of truth for files 08, 09 and 10.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.w0_scope (
  table_name       text PRIMARY KEY,
  company_scoped   boolean NOT NULL DEFAULT true,
  job_key          text,        -- column linking to jobs.id, NULL if none
  job_key_is_uuid  boolean NOT NULL DEFAULT true,
  log_changes      boolean NOT NULL DEFAULT true,
  public_read      boolean NOT NULL DEFAULT false,
  note             text
);

-- Added after the first cut of this file: the company_id stamping trigger in
-- W0/08 needs to know, per table, which parent row tenancy is inherited FROM.
-- ADD COLUMN IF NOT EXISTS so a database that already ran the earlier version
-- picks them up on a re-run.
ALTER TABLE app.w0_scope ADD COLUMN IF NOT EXISTS parent_table       text;
ALTER TABLE app.w0_scope ADD COLUMN IF NOT EXISTS parent_key         text;
ALTER TABLE app.w0_scope ADD COLUMN IF NOT EXISTS parent_child_col   text;
ALTER TABLE app.w0_scope ADD COLUMN IF NOT EXISTS parent_child_uuid  boolean NOT NULL DEFAULT true;

COMMENT ON TABLE app.w0_scope IS
  'The set of tables the W0 series manages. "company_id on every table" is '
  'scoped to THIS list, not to all 57 public tables — blanket DDL across '
  'tables nobody audited is how you break the web client.';

COMMENT ON COLUMN app.w0_scope.parent_table IS
  'Table this one inherits tenancy from on INSERT. app.stamp_company_id() '
  'resolves NEW.company_id as parent.company_id where '
  'parent.<parent_key> = NEW.<parent_child_col>. NULL means there is no '
  'parent and the caller''s single active membership is used instead.';

COMMENT ON COLUMN app.w0_scope.parent_child_uuid IS
  'FALSE when the child-side column is TEXT (job_field_state.job_id, '
  'media_comments.media_id). The stamping trigger then compares '
  'parent.<parent_key>::text instead of casting the child value to uuid, '
  'which would raise 22P02 on the local ids the mobile client sends.';

INSERT INTO app.w0_scope (table_name, company_scoped, job_key, job_key_is_uuid, log_changes, public_read,
                          parent_table, parent_key, parent_child_col, parent_child_uuid, note) VALUES
  ('companies',              false, NULL,       true,  true,  false, NULL,                  NULL,  NULL,          true,  'tenant root; company_id would be self-referential. log_changes is TRUE but app.log_change() stamps company_id from the row''s OWN id — see W0/09.'),
  ('company_members',        true,  NULL,       true,  true,  false, NULL,                  NULL,  NULL,          true,  'membership; company_id is supplied explicitly, never stamped'),
  ('businesses',             true,  NULL,       true,  false, true,  NULL,                  NULL,  NULL,          true,  'anon read backs the public review-gate page; tenancy is set by hand (W0/01 §8)'),
  ('clients',                true,  NULL,       true,  true,  false, 'businesses',          'id',  'business_id', true,  NULL),
  ('jobs',                   true,  'id',       true,  true,  true,  'businesses',          'id',  'business_id', true,  'anon read backs the PublicProject page; see W0/10 header'),
  ('job_media',              true,  'job_id',   true,  true,  true,  'jobs',                'id',  'job_id',      true,  'anon read backs share pages'),
  ('job_documents',          true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('job_photos',             true,  'job_id',   true,  false, true,  'jobs',                'id',  'job_id',      true,  'legacy, 0 rows; kept because project_activity_summary joins it'),
  ('job_tasks',              true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  'rebuilt in W0/04'),
  ('checklist_templates',    true,  NULL,       true,  true,  false, NULL,                  NULL,  NULL,          true,  'no parent; stamped from the caller''s single membership'),
  ('checklist_template_items', true, NULL,      true,  true,  false, 'checklist_templates', 'id',  'template_id', true,  NULL),
  ('job_checklists',         true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('job_notes',              true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('job_checkins',           true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('job_events',             true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('publish_records',        true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('social_media_posts',     true,  'job_id',   true,  true,  false, 'jobs',                'id',  'job_id',      true,  NULL),
  ('shared_galleries',       true,  'job_id',   true,  true,  true,  'jobs',                'id',  'job_id',      true,  'public read is served by public.gallery_by_token(), NOT by an anon SELECT policy — see W0/10 §5'),
  ('job_field_state',        true,  'job_id',   false, true,  false, 'jobs',                'id',  'job_id',      false, 'job_id is TEXT on purpose — no composite FK possible; the stamp trigger doubles as the cross-tenant guard'),
  ('media_comments',         true,  NULL,       true,  true,  false, 'job_media',           'id',  'media_id',    false, 'media_id is TEXT on purpose — no composite FK possible; the stamp trigger doubles as the cross-tenant guard'),
  ('review_requests',        true,  NULL,       true,  true,  true,  'businesses',          'id',  'business_id', true,  'anon read backs the review gate')
ON CONFLICT (table_name) DO UPDATE
  SET company_scoped    = EXCLUDED.company_scoped,
      job_key           = EXCLUDED.job_key,
      job_key_is_uuid   = EXCLUDED.job_key_is_uuid,
      log_changes       = EXCLUDED.log_changes,
      public_read       = EXCLUDED.public_read,
      parent_table      = EXCLUDED.parent_table,
      parent_key        = EXCLUDED.parent_key,
      parent_child_col  = EXCLUDED.parent_child_col,
      parent_child_uuid = EXCLUDED.parent_child_uuid,
      note              = EXCLUDED.note;


-- ---------------------------------------------------------------------
-- 3. Backfill reporting. Backfills that guess must say what they guessed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.w0_backfill_report (
  id          bigserial PRIMARY KEY,
  step        text NOT NULL,
  table_name  text NOT NULL,
  row_id      text,
  outcome     text NOT NULL,   -- 'applied' | 'skipped' | 'ambiguous' | 'unparseable'
  detail      text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS w0_backfill_report_step_idx
  ON app.w0_backfill_report (step, outcome);

COMMENT ON TABLE app.w0_backfill_report IS
  'Every backfill in the W0 series writes here. Rows with outcome = '
  '''ambiguous'' are the ones a human must look at — the migration '
  'deliberately did NOT guess.';


-- ---------------------------------------------------------------------
-- 4. Guarded cast helpers.
--
--    Every backfill in this series runs over JSON blobs written by a mobile
--    client across many app versions. A single malformed value must not abort
--    a migration, so all extraction goes through these.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.jsonb_num(v jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF v IS NULL OR jsonb_typeof(v) NOT IN ('number', 'string') THEN
    RETURN NULL;
  END IF;
  RETURN (v #>> '{}')::double precision;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

COMMENT ON FUNCTION app.jsonb_num(jsonb) IS
  'Numeric extraction that returns NULL instead of raising 22P02 on junk. '
  'Float parsing does not depend on any GUC, so IMMUTABLE is honest here.';


CREATE OR REPLACE FUNCTION app.jsonb_ts(v jsonb)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF v IS NULL OR jsonb_typeof(v) NOT IN ('string', 'number') THEN
    RETURN NULL;
  END IF;
  -- Epoch millis / seconds are common in mobile payloads.
  IF jsonb_typeof(v) = 'number' THEN
    RETURN CASE
             WHEN (v #>> '{}')::double precision > 100000000000
               THEN to_timestamp((v #>> '{}')::double precision / 1000.0)
             ELSE to_timestamp((v #>> '{}')::double precision)
           END;
  END IF;
  RETURN (v #>> '{}')::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

COMMENT ON FUNCTION app.jsonb_ts(jsonb) IS
  'Timestamp extraction that returns NULL instead of raising on junk. Marked '
  'STABLE, not IMMUTABLE: text -> timestamptz depends on DateStyle/TimeZone. '
  'Therefore it must NOT be used in an index or a generated column.';


CREATE OR REPLACE FUNCTION app.jsonb_text_array(v jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF v IS NULL OR jsonb_typeof(v) <> 'array' THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT coalesce(array_agg(e #>> '{}' ORDER BY ord), '{}'::text[])
    FROM jsonb_array_elements(v) WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(e) IN ('string', 'number')
      AND coalesce(e #>> '{}', '') <> ''
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

COMMENT ON FUNCTION app.jsonb_text_array(jsonb) IS
  'Returns NULL (not an empty array) when the input is not a JSON array, so '
  'callers can distinguish "no data" from "explicitly empty".';


-- ---------------------------------------------------------------------
-- 5. updated_at trigger. Used by every table this series creates.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;


-- ---------------------------------------------------------------------
-- 6. Optimistic-locking version bump. Used by job_tasks (W0/04).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.bump_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version IS NULL OR NEW.version = OLD.version THEN
    -- Caller did not participate in versioning (PostgREST sends the row it
    -- read). Treat as an unconditional write and advance the counter.
    NEW.version := OLD.version + 1;
  ELSIF NEW.version < OLD.version THEN
    RAISE EXCEPTION
      'stale write to %.% id=% : caller held version %, row is at version %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id, NEW.version, OLD.version
      USING ERRCODE = '40001';   -- serialization_failure: clients retry on this
  ELSE
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION app.bump_version() IS
  'Offline conflict handling. A device that read version N and writes back N '
  'while the row has moved to N+2 gets 40001 instead of silently clobbering. '
  'A client that does not send version at all still works.';


-- ---------------------------------------------------------------------
-- 7. Dependent-view stash / restore.
--
--    Changing jobs.status''s type is blocked by FOUR views (projects,
--    project_activity_summary, business_performance_summary,
--    user_dashboard_summary). Rebuilding job_tasks is blocked by
--    project_activity_summary. Rather than hard-code definitions this
--    migration series does not have a verified copy of, these two functions
--    capture the live definitions with pg_get_viewdef(), drop, and rebuild
--    them — including owner, ACLs and comments.
--
--    `projects` is a live compatibility shim the WEB CLIENT still reads.
--    Dropping it without restoring breaks the web app. Hence the restore
--    half is not optional.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.w0_view_stash (
  view_schema text NOT NULL,
  view_name   text NOT NULL,
  view_kind   "char" NOT NULL,          -- 'v' = view, 'm' = materialized view
  view_owner  text NOT NULL,
  depth       integer NOT NULL,
  definition  text NOT NULL,
  acl         text,
  comment     text,
  reloptions  text[],
  stashed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (view_schema, view_name)
);

ALTER TABLE app.w0_view_stash ADD COLUMN IF NOT EXISTS reloptions text[];

COMMENT ON COLUMN app.w0_view_stash.reloptions IS
  'pg_class.reloptions of the stashed view, replayed verbatim on restore. '
  'THIS IS A SECURITY COLUMN, not bookkeeping: public.job_activity is defined '
  'WITH (security_invoker = true), and a view rebuilt without that option '
  'silently runs as its OWNER and bypasses RLS on every table it reads. '
  'Losing this on a stash/restore cycle would turn a tenant-scoped view into '
  'a cross-tenant leak with no error and no diff.';

COMMENT ON TABLE app.w0_view_stash IS
  'Holding pen for view definitions dropped so a column type could change. '
  'A NON-EMPTY row here after a migration finishes means a view was dropped '
  'and never restored. Check it after every W0 apply: '
  'SELECT * FROM app.w0_view_stash;';


CREATE OR REPLACE FUNCTION app.w0_stash_views(p_table regclass)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v record;
  n integer := 0;
BEGIN
  FOR v IN
    WITH RECURSIVE deps AS (
      SELECT rw.ev_class AS reloid, 1 AS depth
        FROM pg_depend d
        JOIN pg_rewrite rw ON rw.oid = d.objid
       WHERE d.classid = 'pg_rewrite'::regclass
         AND d.refobjid = p_table
         AND rw.ev_class <> p_table
      UNION
      SELECT rw.ev_class, deps.depth + 1
        FROM deps
        JOIN pg_depend d  ON d.classid = 'pg_rewrite'::regclass
                         AND d.refobjid = deps.reloid
        JOIN pg_rewrite rw ON rw.oid = d.objid
       WHERE rw.ev_class <> deps.reloid
         AND deps.depth < 10            -- cycle guard
    )
    SELECT c.oid,
           n.nspname,
           c.relname,
           c.relkind,
           pg_get_userbyid(c.relowner) AS owner,
           max(deps.depth)             AS depth
      FROM deps
      JOIN pg_class     c ON c.oid = deps.reloid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('v', 'm')
     GROUP BY c.oid, n.nspname, c.relname, c.relkind, c.relowner
     -- Deepest (most dependent) first, so each DROP has no remaining dependents.
     ORDER BY max(deps.depth) DESC, c.relname
  LOOP
    INSERT INTO app.w0_view_stash
      (view_schema, view_name, view_kind, view_owner, depth, definition, acl,
       comment, reloptions)
    VALUES
      (v.nspname, v.relname, v.relkind, v.owner, v.depth,
       pg_get_viewdef(v.oid, true),
       (SELECT relacl::text FROM pg_class WHERE oid = v.oid),
       obj_description(v.oid, 'pg_class'),
       (SELECT reloptions FROM pg_class WHERE oid = v.oid))
    ON CONFLICT (view_schema, view_name) DO UPDATE
      SET view_kind  = EXCLUDED.view_kind,
          view_owner = EXCLUDED.view_owner,
          depth      = EXCLUDED.depth,
          definition = EXCLUDED.definition,
          acl        = EXCLUDED.acl,
          comment    = EXCLUDED.comment,
          reloptions = EXCLUDED.reloptions,
          stashed_at = now();

    IF v.relkind = 'm' THEN
      EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I', v.nspname, v.relname);
    ELSE
      EXECUTE format('DROP VIEW IF EXISTS %I.%I', v.nspname, v.relname);
    END IF;

    RAISE NOTICE 'w0_stash_views: stashed and dropped %.% (depth %)',
                 v.nspname, v.relname, v.depth;
    n := n + 1;
  END LOOP;

  RETURN n;
END $$;

COMMENT ON FUNCTION app.w0_stash_views(regclass) IS
  'Discovers every view/matview depending on the given relation (recursively, '
  'via pg_depend/pg_rewrite), records its full definition, owner, ACL and '
  'comment in app.w0_view_stash, then drops it deepest-first. Never uses '
  'CASCADE: CASCADE drops objects you did not enumerate.';


CREATE OR REPLACE FUNCTION app.w0_restore_views(p_rewrites jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v     record;
  g     record;
  sql   text;
  opts  text;
  k     text;
  n     integer := 0;
BEGIN
  FOR v IN
    SELECT * FROM app.w0_view_stash
     ORDER BY depth ASC, view_name   -- least dependent first
  LOOP
    sql := v.definition;

    -- Apply literal rewrites. The caller uses this to turn enum casts that no
    -- longer type-check (e.g. '::project_status') into '::text'.
    FOR k IN SELECT jsonb_object_keys(p_rewrites) LOOP
      sql := replace(sql, k, p_rewrites ->> k);
    END LOOP;

    -- Replay reloptions VERBATIM. For a plain view this is almost always
    -- empty, but when it is not it can carry `security_invoker = true`, and a
    -- view rebuilt without that runs as its owner with RLS bypassed. Rebuild
    -- the WITH (...) clause rather than dropping it on the floor.
    opts := NULL;
    IF v.reloptions IS NOT NULL AND array_length(v.reloptions, 1) > 0 THEN
      -- reloptions come back as 'key=value' strings, which is exactly the
      -- syntax WITH (...) wants.
      opts := ' WITH (' || array_to_string(v.reloptions, ', ') || ')';
    END IF;

    IF v.view_kind = 'm' THEN
      EXECUTE format('CREATE MATERIALIZED VIEW %I.%I%s AS %s',
                     v.view_schema, v.view_name, coalesce(opts, ''), sql);
    ELSE
      EXECUTE format('CREATE VIEW %I.%I%s AS %s',
                     v.view_schema, v.view_name, coalesce(opts, ''), sql);
    END IF;

    -- Owner. Not fatal if the migration role cannot reassign.
    BEGIN
      IF v.view_kind = 'm' THEN
        EXECUTE format('ALTER MATERIALIZED VIEW %I.%I OWNER TO %I',
                       v.view_schema, v.view_name, v.view_owner);
      ELSE
        EXECUTE format('ALTER VIEW %I.%I OWNER TO %I',
                       v.view_schema, v.view_name, v.view_owner);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'w0_restore_views: could not restore owner % on %.%: %',
                    v.view_owner, v.view_schema, v.view_name, SQLERRM;
    END;

    -- Grants. CREATE VIEW resets the ACL, so replay what was there.
    IF v.acl IS NOT NULL THEN
      FOR g IN
        SELECT privilege_type,
               CASE WHEN grantee = 0 THEN 'PUBLIC'
                    ELSE quote_ident(pg_get_userbyid(grantee)) END AS who
          FROM aclexplode(v.acl::aclitem[])
      LOOP
        BEGIN
          EXECUTE format('GRANT %s ON %I.%I TO %s',
                         g.privilege_type, v.view_schema, v.view_name, g.who);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'w0_restore_views: could not regrant % on %.% to %: %',
                        g.privilege_type, v.view_schema, v.view_name, g.who, SQLERRM;
        END;
      END LOOP;
    END IF;

    IF v.comment IS NOT NULL THEN
      EXECUTE format('COMMENT ON %s %I.%I IS %L',
                     CASE WHEN v.view_kind = 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END,
                     v.view_schema, v.view_name, v.comment);
    END IF;

    RAISE NOTICE 'w0_restore_views: restored %.%', v.view_schema, v.view_name;
    n := n + 1;
  END LOOP;

  -- Empty the stash only after every restore succeeded. If one raised, the
  -- whole migration rolls back and the stash still holds everything.
  DELETE FROM app.w0_view_stash;
  RETURN n;
END $$;

COMMENT ON FUNCTION app.w0_restore_views(jsonb) IS
  'Rebuilds everything app.w0_stash_views() dropped, least-dependent first, '
  'restoring owner, grants, comment AND reloptions. p_rewrites is a {from: to} '
  'map of literal string substitutions applied to each definition. The '
  'reloptions replay is a security requirement, not a nicety — see the COMMENT '
  'on app.w0_view_stash.reloptions.';


-- ---------------------------------------------------------------------
-- 8. Stamp the baseline.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.w0_series_log (
  step        text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  applied_by  text NOT NULL DEFAULT current_user,
  detail      text
);

INSERT INTO app.w0_series_log (step, detail)
VALUES ('00_baseline_notes_and_helpers',
        'Quarantine notes recorded for 17 unapplied repo migrations; app schema, '
        'w0_scope (with parent-tenancy mapping), view stash/restore and guarded '
        'cast helpers created; anon removed from the schema-public default '
        'privileges for SELECT so tables created later are private by '
        'construction; app.w0_revoke_anon() installed.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
