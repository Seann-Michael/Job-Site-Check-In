-- =====================================================================
-- W0 / 03 — jobs: field-service status vocabulary + the columns it was missing
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   jobs.status is a PostgreSQL enum (project_status) inherited from when
--   this table was called `projects` and modelled SEO engagements. Its values
--   — draft, active, in_progress, paused, completed, cancelled — cannot
--   express the states a dispatched field job actually moves through, and
--   every future value costs an ALTER TYPE plus a deploy. Enum values also
--   cannot be added and used in the same transaction (55P04), so the type is
--   actively hostile to iteration.
--
--   This migration converts the column to TEXT with a CHECK constraint.
--   New vocabulary:
--     draft -> scheduled -> dispatched -> in_progress -> needs_review
--           -> completed -> invoiced        (on_hold and cancelled branch off)
--
-- ============ READ THIS BEFORE APPLYING ============
--   THE CHECK CONSTRAINT ALSO ACCEPTS 'active' AND 'paused'.
--
--   That is not sloppiness. mobile/src/lib/data.ts ships
--     JOB_STATUSES = ['draft','active','in_progress','paused','completed','cancelled']
--   and WRITES those values. One live row is 'active' right now. A CHECK that
--   rejected them would turn every status write from every installed copy of
--   the app into a 23514, and would fail on existing data.
--
--   So 'active' and 'paused' are retained as explicitly-flagged LEGACY values,
--   recorded in app.job_status_catalog with is_legacy = true. Existing rows
--   are NOT rewritten — silently moving a row the web client filters on is a
--   worse bug than a slightly wide constraint.
--
--   FOLLOW-UP (tracked, not done here): once the mobile and web clients both
--   emit the new vocabulary, run a migration that maps active -> scheduled and
--   paused -> on_hold and drops the two legacy values from the CHECK. The
--   mapping is already recorded in app.job_status_catalog.replaced_by.
-- ===================================================
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 has run (app.w0_stash_views / app.w0_restore_views / helpers).
--   * jobs.status is of type project_status with DEFAULT 'draft'::project_status.
--   * FOUR views depend on jobs.status:
--       projects                      (1:1 passthrough; the WEB CLIENT READS IT)
--       project_activity_summary
--       business_performance_summary  (FILTER predicates with ::project_status casts)
--       user_dashboard_summary        (same)
--     They are discovered dynamically rather than hard-coded, so a fifth one
--     added since the survey is still handled.
--   * jobs already has `description` and `client_id` (with FK
--     projects_client_id_fkey — note the constraint kept its pre-rename name).
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/00: 42883, app.w0_stash_views does not exist.
--   Before W0/02: the client_id backfill still runs but cannot use the
--     clients_name_lower_idx index; correctness is unaffected, speed is not.
--   After W0/04: W0/04 stashes and restores project_activity_summary itself;
--     if this file ran second it would find that view already rebuilt against
--     a text status column and the enum rewrite map would simply not match
--     anything. Still safe, but the intended order is 03 then 04.
--
-- SAFETY / ROLLBACK
--   The type change is one transaction with the view drop and rebuild. If the
--   rebuild raises, the whole thing rolls back and the views are still there.
--   If it somehow commits half-done, app.w0_view_stash still holds every
--   dropped definition — check it:  SELECT * FROM app.w0_view_stash;
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The vocabulary, as data.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.job_status_catalog (
  status       text PRIMARY KEY,
  sort_order   integer NOT NULL,
  label        text NOT NULL,
  is_terminal  boolean NOT NULL DEFAULT false,
  is_legacy    boolean NOT NULL DEFAULT false,
  replaced_by  text,
  description  text
);

INSERT INTO app.job_status_catalog
  (status, sort_order, label, is_terminal, is_legacy, replaced_by, description) VALUES
  ('draft',        10, 'Draft',        false, false, NULL,        'Being written up. Not committed to anyone.'),
  ('scheduled',    20, 'Scheduled',    false, false, NULL,        'Accepted and placed on the calendar.'),
  ('dispatched',   30, 'Dispatched',   false, false, NULL,        'Assigned to a crew and sent to their device.'),
  ('in_progress',  40, 'In progress',  false, false, NULL,        'Crew is on site and working.'),
  ('on_hold',      50, 'On hold',      false, false, NULL,        'Blocked: weather, parts, permit, customer.'),
  ('needs_review', 60, 'Needs review', false, false, NULL,        'Work done, awaiting office sign-off before invoicing.'),
  ('completed',    70, 'Completed',    false, false, NULL,        'Signed off. Ready to invoice.'),
  ('invoiced',     80, 'Invoiced',     true,  false, NULL,        'Billed. Terminal for field purposes.'),
  ('cancelled',    90, 'Cancelled',    true,  false, NULL,        'Will not happen.'),
  ('active',      910, 'Active (legacy)', false, true, 'scheduled',
     'LEGACY. Emitted by the shipped mobile client (data.ts JOB_STATUSES). Retire once clients emit the new vocabulary; then map to scheduled.'),
  ('paused',      920, 'Paused (legacy)', false, true, 'on_hold',
     'LEGACY. Emitted by the shipped mobile client. Retire once clients emit the new vocabulary; then map to on_hold.')
ON CONFLICT (status) DO UPDATE
  SET sort_order  = EXCLUDED.sort_order,
      label       = EXCLUDED.label,
      is_terminal = EXCLUDED.is_terminal,
      is_legacy   = EXCLUDED.is_legacy,
      replaced_by = EXCLUDED.replaced_by,
      description = EXCLUDED.description;

COMMENT ON TABLE app.job_status_catalog IS
  'The job status vocabulary as queryable data. The CHECK constraint on '
  'jobs.status is kept in sync with this table BY HAND — a CHECK cannot '
  'reference another table. When you change one, change the other, in the '
  'same migration.';


-- ---------------------------------------------------------------------
-- 2. Convert jobs.status from the enum to text.
--
--    Order is not negotiable:
--      a. stash + drop dependent views      (else 0A000)
--      b. DROP DEFAULT                      (else "default cannot be cast automatically")
--      c. ALTER TYPE ... USING status::text
--      d. re-add the default as text
--      e. rebuild the views, rewriting ::project_status to ::text
--
--    project_status the TYPE is intentionally left in place: it is still used
--    by the `projects` / `project_activity_summary` view output signatures
--    for jobs.priority and jobs.type, which this migration does not touch.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_type    text;
  n_dropped integer;
  n_rebuilt integer;
BEGIN
  SELECT atttypid::regtype::text
    INTO v_type
    FROM pg_attribute
   WHERE attrelid = 'public.jobs'::regclass
     AND attname  = 'status'
     AND NOT attisdropped;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'public.jobs.status does not exist — refusing to continue';
  END IF;

  IF v_type = 'text' THEN
    RAISE NOTICE 'W0/03: jobs.status is already text — skipping the type conversion';
  ELSE
    RAISE NOTICE 'W0/03: converting jobs.status from % to text', v_type;

    n_dropped := app.w0_stash_views('public.jobs'::regclass);
    RAISE NOTICE 'W0/03: stashed and dropped % dependent view(s)', n_dropped;

    EXECUTE 'ALTER TABLE public.jobs ALTER COLUMN status DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.jobs ALTER COLUMN status TYPE text USING status::text';
    EXECUTE 'ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT ''draft''';

    -- The FILTER predicates in business_performance_summary and
    -- user_dashboard_summary compare against 'active'::project_status. That
    -- has no operator against text, so the cast must become ::text.
    n_rebuilt := app.w0_restore_views('{"::project_status": "::text"}'::jsonb);
    RAISE NOTICE 'W0/03: rebuilt % view(s)', n_rebuilt;

    IF n_dropped <> n_rebuilt THEN
      RAISE EXCEPTION 'W0/03: dropped % views but rebuilt % — aborting', n_dropped, n_rebuilt;
    END IF;
  END IF;
END $$;

-- Paranoia: if anything is still sitting in the stash, this apply is not safe
-- to walk away from.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM app.w0_view_stash;
  IF n > 0 THEN
    RAISE EXCEPTION 'W0/03: % view(s) still un-restored in app.w0_view_stash', n;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 3. The CHECK constraint. NOT VALID first, then validated separately, so
--    the table is not held under an ACCESS EXCLUSIVE lock while every row is
--    scanned. With 9 rows that is theatre; with 900,000 it is not.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.jobs'::regclass AND conname = 'jobs_status_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_status_check
      CHECK (status IN (
        -- current vocabulary
        'draft', 'scheduled', 'dispatched', 'in_progress',
        'on_hold', 'needs_review', 'completed', 'invoiced', 'cancelled',
        -- LEGACY, still emitted by the shipped mobile client. See header.
        'active', 'paused'
      ))
      NOT VALID;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT status, ', ')
    INTO bad
    FROM public.jobs
   WHERE status NOT IN ('draft','scheduled','dispatched','in_progress','on_hold',
                        'needs_review','completed','invoiced','cancelled','active','paused');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'W0/03: jobs contains status value(s) outside the new '
                    'vocabulary: %. Decide how to map them, then re-run.', bad;
  END IF;

  ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_status_check;
END $$;

COMMENT ON COLUMN public.jobs.status IS
  'Field-service job status. TEXT + CHECK, not an enum, so adding a value is '
  'an ALTER CONSTRAINT rather than a type migration. Vocabulary and legacy '
  'mappings live in app.job_status_catalog. NOTE: ''active'' and ''paused'' '
  'are accepted for backward compatibility with the shipped mobile client.';

CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);


-- ---------------------------------------------------------------------
-- 4. New columns.
--
--    `description` and `client_id` ALREADY EXIST (verified against the live
--    table: description is attnum 4, client_id is attnum 25 with FK
--    projects_client_id_fkey). The ADD COLUMN IF NOT EXISTS calls below are
--    no-ops for those two and are present so this file is correct on a
--    database where they are missing.
-- ---------------------------------------------------------------------
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_id     uuid;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS keywords      text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tags          text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS city          text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS publish_state text NOT NULL DEFAULT 'unpublished';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS published_at  timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS search_body   tsvector;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.jobs'::regclass AND conname = 'jobs_publish_state_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_publish_state_check
      CHECK (publish_state IN ('unpublished', 'queued', 'publishing', 'published', 'failed'))
      NOT VALID;
    ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_publish_state_check;
  END IF;
END $$;

COMMENT ON COLUMN public.jobs.keywords IS
  'Local-SEO target keywords for this job, used when composing the Google '
  'Business Profile post (see mobile/src/lib/publish.ts, which currently '
  'derives them at publish time and throws them away). Backfilled from '
  'metadata->''keywords'' ONLY. These are NOT the job''s tags — see '
  'public.jobs.tags. data.ts keeps the two as separate keys in the same blob '
  '(updateJob writes both `tags` and `keywords`), and mapJob prefers the '
  'column over the blob, so merging them would make every job report its tags '
  'as its SEO keywords and render metadata.keywords unreachable.';

COMMENT ON COLUMN public.jobs.tags IS
  'Free-form job tags, promoted out of metadata->''tags'' where the web and '
  'mobile clients write them. A SEPARATE column from keywords on purpose: '
  'tags are how the office files a job, keywords are what the Google Business '
  'Profile post targets. The blob is left intact so the shipped client keeps '
  'working.';

COMMENT ON COLUMN public.jobs.city IS
  'Denormalised from metadata->''address''->>''city''. The mobile client '
  'already prefers a real `city` column and falls back to the JSON blob '
  '(data.ts mapJob), so populating this changes nothing for existing clients '
  'and makes the column indexable. SELF-MAINTAINING: the trigger '
  'jobs_search_body_tsync re-derives it from the blob on every write, because '
  'the shipped client sends city only inside metadata.address and never as a '
  'top-level column — without that, this column would be a one-shot snapshot '
  'that is empty for every job created after the migration.';

COMMENT ON COLUMN public.jobs.publish_state IS
  'Lifecycle of the Google Business Profile post for this job, independent of '
  'the job''s own status. A job can be `completed` and still `unpublished`.';

COMMENT ON COLUMN public.jobs.search_body IS
  'Full-text index body. Maintained by the trigger jobs_search_body_tsync, '
  'NOT a GENERATED column: array_to_string() is STABLE, not IMMUTABLE, so a '
  'generated column over keywords[] is rejected by the planner.';

CREATE INDEX IF NOT EXISTS jobs_city_lower_idx
  ON public.jobs (lower(city)) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_publish_state_idx
  ON public.jobs (publish_state);
CREATE INDEX IF NOT EXISTS jobs_keywords_gin
  ON public.jobs USING gin (keywords);
CREATE INDEX IF NOT EXISTS jobs_tags_gin
  ON public.jobs USING gin (tags);
CREATE INDEX IF NOT EXISTS jobs_search_body_gin
  ON public.jobs USING gin (search_body);
CREATE INDEX IF NOT EXISTS jobs_client_id_idx
  ON public.jobs (client_id) WHERE client_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 5. search_body maintenance.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.jobs_search_body()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Keep the denormalised columns in step with the blob FIRST, then index
  -- them. The shipped client (data.ts createJob / updateJob) writes city only
  -- inside metadata.address and never as a top-level column, so without this
  -- line jobs.city is a one-shot snapshot that stays NULL for every job
  -- created after the migration, and both jobs_city_lower_idx and the
  -- 'B'-weighted city term below are dead weight for all new rows.
  NEW.city := coalesce(
                nullif(btrim(NEW.city), ''),
                nullif(btrim(NEW.metadata #>> '{address,city}'), ''),
                CASE WHEN jsonb_typeof(NEW.metadata -> 'city') = 'string'
                     THEN nullif(btrim(NEW.metadata ->> 'city'), '') END);

  -- Same reasoning for tags: the client writes metadata.tags, never a column.
  -- NOTE this is metadata->'tags', and it feeds jobs.tags. jobs.keywords comes
  -- from metadata->'keywords' and the two must never be merged — see the
  -- COMMENT on public.jobs.keywords.
  IF NEW.tags = '{}'::text[] THEN
    NEW.tags := coalesce(app.jsonb_text_array(NEW.metadata -> 'tags'), '{}'::text[]);
  END IF;
  IF NEW.keywords = '{}'::text[] THEN
    NEW.keywords := coalesce(app.jsonb_text_array(NEW.metadata -> 'keywords'), '{}'::text[]);
  END IF;

  NEW.search_body :=
      setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A')
   || setweight(to_tsvector('english', coalesce(NEW.city, '')), 'B')
   || setweight(to_tsvector('english',
        coalesce(array_to_string(NEW.keywords, ' '), '')), 'B')
   || setweight(to_tsvector('english',
        coalesce(array_to_string(NEW.tags, ' '), '')), 'B')
   || setweight(to_tsvector('english',
        coalesce(NEW.client_contact ->> 'name', '')), 'B')
   || setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C')
   || setweight(to_tsvector('english',
        coalesce(NEW.metadata #>> '{address,street}', '')), 'C')
   || setweight(to_tsvector('english', coalesce(NEW.metadata ->> 'notes', '')), 'D');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobs_search_body_tsync ON public.jobs;
CREATE TRIGGER jobs_search_body_tsync
  BEFORE INSERT OR UPDATE OF name, description, city, keywords, tags, client_contact, metadata
  ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION app.jobs_search_body();


-- ---------------------------------------------------------------------
-- 6. Backfill city and keywords out of the metadata blob, guarded.
--
--    Live shape (written by the web client's AdminAddProject.tsx and by the
--    mobile client): metadata = {address:{street,city,state,zipCode,country,
--    coordinates}, service_type, tags, notes, source, street_view_available}.
--    Older rows may have metadata.city as a bare string instead. Both are
--    handled; anything else is left NULL rather than coerced.
-- ---------------------------------------------------------------------
UPDATE public.jobs
   SET city = btrim(coalesce(
         NULLIF(metadata #>> '{address,city}', ''),
         CASE WHEN jsonb_typeof(metadata -> 'city') = 'string'
              THEN NULLIF(metadata ->> 'city', '') END))
 WHERE city IS NULL
   AND metadata IS NOT NULL
   AND coalesce(
         NULLIF(metadata #>> '{address,city}', ''),
         CASE WHEN jsonb_typeof(metadata -> 'city') = 'string'
              THEN NULLIF(metadata ->> 'city', '') END) IS NOT NULL;

-- keywords comes from metadata->'keywords'. It did NOT, in an earlier cut of
-- this file, which read metadata->'tags' instead — and because data.ts mapJob
-- prefers the column over the blob, that silently replaced every job's
-- local-SEO keyword list with its tags and made the real metadata.keywords
-- unreachable. The wrong values then propagated into jobs.search_body and
-- into publish.ts's target_keywords. Two separate keys, two separate columns.
UPDATE public.jobs
   SET keywords = app.jsonb_text_array(metadata -> 'keywords')
 WHERE keywords = '{}'::text[]
   AND app.jsonb_text_array(metadata -> 'keywords') IS NOT NULL;

UPDATE public.jobs
   SET tags = app.jsonb_text_array(metadata -> 'tags')
 WHERE tags = '{}'::text[]
   AND app.jsonb_text_array(metadata -> 'tags') IS NOT NULL;

-- Populate search_body for every existing row. The trigger only fires on
-- write, so a no-op UPDATE is the cheapest way to make it run once.
UPDATE public.jobs SET name = name WHERE search_body IS NULL;


-- ---------------------------------------------------------------------
-- 7. jobs -> clients: add the real link, backfill it, CHANGE NOTHING ELSE.
--
--    Today a job identifies its client by NAME STRING, in
--    client_contact->>'name'. mobile/src/lib/data.ts:205-230 renames a client
--    by rewriting that string across every matching job. That is a live
--    data-integrity bug: two clients with the same name are the same client,
--    and a typo orphans history.
--
--    This migration adds and populates client_id. It does NOT remove, rewrite
--    or stop maintaining client_contact->>'name' — the shipped app reads it
--    and would break. Both paths coexist.
--
--    CUTOVER, AS A FOLLOW-UP (not done here):
--      1. ship a client build that reads client_id and writes both,
--      2. re-run this backfill for rows created in between,
--      3. make client_id NOT NULL,
--      4. leave client_contact as a denormalised display cache, or drop the
--         name key from it.
-- ---------------------------------------------------------------------

-- The existing FK kept its pre-rename name: `projects_client_id_fkey`, not
-- `jobs_client_id_fkey`. Check for the constraint by DEFINITION, not by a
-- guessed name, or this block silently adds a duplicate.
DO $$
DECLARE fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.conrelid  = 'public.jobs'::regclass
     AND c.contype   = 'f'
     AND c.confrelid = 'public.clients'::regclass
     AND a.attname   = 'client_id'
     AND array_length(c.conkey, 1) = 1
   LIMIT 1;

  IF fk_name IS NULL THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_client_id_fkey;
    RAISE NOTICE 'W0/03: added jobs_client_id_fkey';
  ELSE
    RAISE NOTICE 'W0/03: jobs.client_id already has FK % — leaving it alone', fk_name;
  END IF;
END $$;

DO $$
DECLARE
  r         record;
  hits      uuid[];
  n_matched integer := 0;
  n_ambig   integer := 0;
  n_missing integer := 0;
BEGIN
  DELETE FROM app.w0_backfill_report WHERE step = '03_jobs_client_id';

  FOR r IN
    SELECT j.id,
           j.business_id,
           btrim(coalesce(j.client_contact ->> 'name', '')) AS cname
      FROM public.jobs j
     WHERE j.client_id IS NULL
  LOOP
    IF r.cname = '' OR lower(r.cname) = 'unknown client' THEN
      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('03_jobs_client_id', 'jobs', r.id::text, 'skipped',
              'job carries no usable client name in client_contact->>''name''');
      n_missing := n_missing + 1;
      CONTINUE;
    END IF;

    -- Match on name OR business_name, case- and whitespace-insensitive.
    -- Scope to the same business when BOTH sides know their business, so two
    -- tenants with a customer called "Smith" cannot cross-link.
    SELECT array_agg(c.id)
      INTO hits
      FROM public.clients c
     WHERE (lower(btrim(c.name)) = lower(r.cname)
            OR lower(btrim(coalesce(c.business_name, ''))) = lower(r.cname)
            OR lower(btrim(coalesce(c.legacy_full_name, ''))) = lower(r.cname))
       AND (c.business_id IS NULL OR r.business_id IS NULL OR c.business_id = r.business_id);

    IF hits IS NULL OR array_length(hits, 1) IS NULL THEN
      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('03_jobs_client_id', 'jobs', r.id::text, 'skipped',
              format('no clients row matches %L — the name-string path still works, '
                     'so this job is not broken, just unlinked', r.cname));
      n_missing := n_missing + 1;

    ELSIF array_length(hits, 1) > 1 THEN
      -- Two clients share this name. Guessing would attach a job to the wrong
      -- customer's history. Refuse.
      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('03_jobs_client_id', 'jobs', r.id::text, 'ambiguous',
              format('%s clients match %L (%s) — NOT linked. Resolve by hand.',
                     array_length(hits, 1), r.cname, array_to_string(hits, ', ')));
      n_ambig := n_ambig + 1;

    ELSE
      UPDATE public.jobs SET client_id = hits[1] WHERE id = r.id;
      INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
      VALUES ('03_jobs_client_id', 'jobs', r.id::text, 'applied',
              format('linked to clients.id=%s by name %L', hits[1], r.cname));
      n_matched := n_matched + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'W0/03 jobs.client_id backfill: % linked, % ambiguous, % unmatched',
               n_matched, n_ambig, n_missing;
  RAISE NOTICE 'W0/03: the name-string path in client_contact->>''name'' is '
               'UNCHANGED and still authoritative for the shipped client.';
END $$;

COMMENT ON COLUMN public.jobs.client_id IS
  'Real foreign key to clients. Coexists with the legacy name-string link in '
  'client_contact->>''name'', which the shipped mobile client still reads and '
  'writes (data.ts). Do not drop the name path until the clients have shipped '
  'a build that uses client_id. Backfill results: app.w0_backfill_report '
  'WHERE step = ''03_jobs_client_id''.';

INSERT INTO app.w0_series_log (step, detail)
VALUES ('03_jobs_status_vocabulary_and_columns',
        'jobs.status converted enum -> text + CHECK (legacy active/paused '
        'retained); 4 dependent views dropped and rebuilt; keywords (from '
        'metadata->keywords), tags (from metadata->tags, a SEPARATE column), '
        'city, publish_state, published_at, search_body added; city/tags/'
        'keywords are re-derived from the metadata blob by the search_body '
        'trigger on every write so they do not go stale; client_id backfilled '
        'by name without disturbing the name-string path.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
