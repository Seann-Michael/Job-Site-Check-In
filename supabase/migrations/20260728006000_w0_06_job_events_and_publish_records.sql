-- =====================================================================
-- W0 / 06 — Activity log, the publishing table, and idempotent publishing
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--
--   job_events: there is no answer to "who changed this job's status, and
--   when". audit_logs exists but is a generic, RLS-enabled security log with
--   a completely different shape (action audit_action enum, resource_type,
--   risk_score) and zero rows. Jobs need a cheap, per-job, human-readable
--   activity feed with an actor and a timestamp, and it should not be
--   entangled with the security audit trail.
--
--   social_media_posts: mobile/src/lib/publish.ts:247 inserts into it. THE
--   TABLE DOES NOT EXIST. Unlike almost every other Supabase call in the
--   mobile client, publish.ts does not swallow the failure —
--     if (error) return { error: error.message, results: [] }
--   so the entire "Publish to Google Business Profile" feature is a hard,
--   user-visible error today.
--
--   publish_records: a Google Business Profile post that gets double-sent
--   because a phone on a flaky connection retried is publicly embarrassing
--   and cannot be undone quietly. Delivery attempts get their own table with
--   a unique idempotency key.
--
-- ============ WHY social_media_posts IS AUTHORED FRESH ============
--   The repo has 20241220000009_create_social_media_posts_schema.sql. Do NOT
--   fix and apply it. Beyond being invalid PostgreSQL (MySQL-style inline
--   INDEX definitions inside CREATE TABLE at six separate places), it carries
--   two constraints that reject the mobile client's own payload:
--
--     CONSTRAINT valid_scheduled_date
--       CHECK (scheduled_for IS NULL OR scheduled_for > created_at)
--     -- created_at DEFAULTs to NOW(), and publish.ts sets scheduled_for to a
--     -- timestamp captured BEFORE the insert. scheduled_for is therefore
--     -- always <= created_at and every single publish fails with 23514.
--
--     content_length INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
--     CHECK (platform != 'gmb' OR content_length <= 1500)
--     -- publish.ts concatenates content + hashtags, so a long post is
--     -- rejected at the database layer with no way for the user to see why.
--
--     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
--     -- auth.users has 0 rows. See below.
--
--   The table below has none of those. The length limit belongs in the
--   publisher, where it can truncate and tell the user, not in a CHECK.
-- ==================================================================
--
-- ============ WHY THERE IS NO FK TO auth.users ============
--   auth.users is EMPTY. Nobody has ever signed in. A NOT NULL FK to it
--   means no row can ever be written until the auth flow ships. user_id is a
--   plain uuid holding an auth.users.id, with the FK deferred to the same
--   follow-up that adds company_members.user_id -> auth.users (see W0/01 §9).
-- ==========================================================
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 (helpers), W0/01 (companies) and W0/03 (jobs.publish_state) have run.
--   * jobs exists. No FK on job_id here — composite FKs land in W0/08.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/03: the publish_records trigger updates jobs.publish_state,
--     which does not exist yet, and every insert fails with 42703.
--   Before W0/01: 42P01 on public.companies.
--
-- SAFETY: purely additive. No RLS enabled here — see W0/10.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. job_events — the activity feed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL,
  company_id     uuid,

  event_type     text NOT NULL,

  -- ACTOR. Three columns because all three are separately useful and none is
  -- reliably available: actor_user_id is NULL for anything the system did,
  -- and actor_name is the only thing that survives a user being deleted.
  actor_user_id  uuid,
  actor_name     text NOT NULL DEFAULT 'System',
  actor_role     text,

  -- WHEN. Device clock and server clock, same reasoning as job_checkins.
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  recorded_at    timestamptz NOT NULL DEFAULT now(),

  -- WHAT it was about, loosely typed so this table never needs another
  -- migration to describe a new kind of thing.
  subject_type   text,
  subject_id     text,

  summary        text,
  from_value     text,
  to_value       text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS company_id    uuid;
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS actor_role    text;
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS recorded_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS subject_type  text;
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS subject_id    text;
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS from_value    text;
ALTER TABLE public.job_events ADD COLUMN IF NOT EXISTS to_value      text;

CREATE INDEX IF NOT EXISTS job_events_job_id_idx
  ON public.job_events (job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS job_events_company_id_idx
  ON public.job_events (company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS job_events_actor_idx
  ON public.job_events (actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_events_type_idx
  ON public.job_events (event_type);

COMMENT ON TABLE public.job_events IS
  'Per-job activity feed: who did what to this job and when. Deliberately '
  'separate from public.audit_logs, which is the security audit trail with a '
  'fixed audit_action enum and its own RLS. Append-only by convention; W0/10 '
  'grants INSERT and SELECT but not UPDATE or DELETE.';

COMMENT ON COLUMN public.job_events.actor_name IS
  'Denormalised display name captured at write time. Survives the actor being '
  'deleted or renamed, which is the entire point of an activity log.';

COMMENT ON COLUMN public.job_events.occurred_at IS
  'When the thing happened, per the device. May be earlier than recorded_at '
  'when a crew was offline. recorded_at is the server clock.';

-- Status transitions are the events people actually ask about, so record
-- them automatically rather than trusting every caller to remember.
-- SECURITY DEFINER is required, not cosmetic: this function calls
-- app.current_user_id() and reads public.company_members by name. W0/00 does
-- REVOKE ALL ON SCHEMA app FROM authenticated, and calling a function by
-- qualified name needs USAGE on its schema — so as SECURITY INVOKER this
-- trigger would raise 42501 "permission denied for schema app" on every job
-- status update made by a signed-in user. It writes only into job_events,
-- with values derived from the row being updated, so running as the definer
-- grants no reachable extra capability.
CREATE OR REPLACE FUNCTION app.jobs_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company uuid;
BEGIN
  -- jobs.company_id does not exist until W0/08. Read it through to_jsonb so
  -- this trigger works both before and after that migration instead of
  -- raising 42703 on every status change in between.
  BEGIN
    v_company := nullif(to_jsonb(NEW) ->> 'company_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_company := NULL;
  END;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.job_events
      (job_id, company_id, event_type, actor_user_id, actor_name,
       subject_type, subject_id, summary, from_value, to_value)
    VALUES
      (NEW.id, v_company, 'job.status_changed',
       app.current_user_id(),
       coalesce(
         (SELECT m.display_name FROM public.company_members m
           WHERE m.user_id = app.current_user_id() LIMIT 1),
         'System'),
       'job', NEW.id::text,
       format('Status changed from %s to %s', OLD.status, NEW.status),
       OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobs_log_status_change ON public.jobs;
CREATE TRIGGER jobs_log_status_change
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION app.jobs_log_status_change();


-- ---------------------------------------------------------------------
-- 2. social_media_posts — authored fresh. See the header.
--
--    Exact insert shape from mobile/src/lib/publish.ts:247:
--      { user_id, title, platform: 'gmb', content, hashtags,
--        target_keywords, target_location, generation_method: 'manual',
--        images: [{url}], primary_image_url, scheduled_for, status: 'scheduled' }
--    Every one of those columns exists below with a compatible type, and
--    nothing else is NOT NULL without a default.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid,
  job_id             uuid,

  -- Holds an auth.users.id. NO FK — see the header.
  user_id            uuid NOT NULL,

  title              text NOT NULL,
  platform           text NOT NULL,
  content            text NOT NULL,

  hashtags           text[] NOT NULL DEFAULT '{}'::text[],
  target_keywords    text[] NOT NULL DEFAULT '{}'::text[],
  target_location    text,

  generation_method  text NOT NULL DEFAULT 'manual',

  images             jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_image_url  text,

  scheduled_for      timestamptz,
  published_at       timestamptz,
  status             text NOT NULL DEFAULT 'draft',

  external_post_id   text,
  external_url       text,
  error_message      text,
  syndicated_to      text[] NOT NULL DEFAULT '{}'::text[],

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS company_id       uuid;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS job_id           uuid;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS external_post_id text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS external_url     text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS error_message    text;
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS syndicated_to    text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.social_media_posts ADD COLUMN IF NOT EXISTS idempotency_key  text;

-- WHY THIS COLUMN EXISTS, AND WHY THE INDEX IS PARTIAL.
--
--   publish_records carries the idempotency machinery, but publish.ts never
--   writes a publish_records row: its only publish call is a bare
--     supabase.from('social_media_posts').insert({...})
--   and there is no .rpc() call anywhere in mobile/src. So the unique index on
--   publish_records protects a table the shipped client does not touch, while
--   the table the web pipeline actually drains has no content-derived key at
--   all. A retry after a dropped response inserts a second row and the
--   pipeline posts to Google twice — which is the exact failure publish_records
--   was built to prevent.
--
--   The index is PARTIAL (WHERE idempotency_key IS NOT NULL) on purpose: the
--   shipped client does not send the column, and a full unique index would
--   collapse every legacy insert onto a single NULL-keyed row. Partial means
--   today's client keeps working unchanged, and de-duplication switches on the
--   moment a build ships that sends
--     idempotency_key: <app.publish_idempotency_key(job_id, platform, content)>
--   Use ON CONFLICT (idempotency_key) DO NOTHING on that insert.
CREATE UNIQUE INDEX IF NOT EXISTS social_media_posts_idempotency_key
  ON public.social_media_posts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.social_media_posts.idempotency_key IS
  'Content-derived de-duplication key, same construction as '
  'publish_records.idempotency_key — use app.publish_idempotency_key(job_id, '
  'platform, content). NULLABLE, with a PARTIAL unique index, because the '
  'shipped mobile client does not send it yet. Sending it makes a retried '
  'publish collide with the original row instead of posting twice.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.social_media_posts'::regclass
                    AND conname = 'social_media_posts_platform_check') THEN
    ALTER TABLE public.social_media_posts
      ADD CONSTRAINT social_media_posts_platform_check
      CHECK (platform IN ('gmb', 'facebook', 'instagram', 'linkedin', 'x', 'nextdoor'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.social_media_posts'::regclass
                    AND conname = 'social_media_posts_status_check') THEN
    ALTER TABLE public.social_media_posts
      ADD CONSTRAINT social_media_posts_status_check
      -- 'scheduled' is what publish.ts sends. It is listed FIRST here as a
      -- reminder that removing it breaks the shipped mobile client.
      CHECK (status IN ('scheduled', 'draft', 'queued', 'publishing',
                        'published', 'failed', 'cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.social_media_posts'::regclass
                    AND conname = 'social_media_posts_generation_method_check') THEN
    ALTER TABLE public.social_media_posts
      ADD CONSTRAINT social_media_posts_generation_method_check
      CHECK (generation_method IN ('manual', 'ai', 'template', 'import'));
  END IF;
END $$;

-- NOTE the absent constraints, and do not add them back:
--   * NO CHECK (scheduled_for > created_at). publish.ts captures `now` before
--     the insert, so scheduled_for is always <= created_at.
--   * NO generated content_length + length CHECK. Platform length limits are
--     enforced by the publisher, which can truncate and explain; a CHECK can
--     only reject.

CREATE INDEX IF NOT EXISTS social_media_posts_company_id_idx ON public.social_media_posts (company_id);
CREATE INDEX IF NOT EXISTS social_media_posts_job_id_idx     ON public.social_media_posts (job_id);
CREATE INDEX IF NOT EXISTS social_media_posts_user_id_idx    ON public.social_media_posts (user_id);
CREATE INDEX IF NOT EXISTS social_media_posts_due_idx
  ON public.social_media_posts (scheduled_for)
  WHERE status IN ('scheduled', 'queued');
CREATE INDEX IF NOT EXISTS social_media_posts_keywords_gin
  ON public.social_media_posts USING gin (target_keywords);

DROP TRIGGER IF EXISTS social_media_posts_touch_updated_at ON public.social_media_posts;
CREATE TRIGGER social_media_posts_touch_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

COMMENT ON TABLE public.social_media_posts IS
  'The publish queue the web pipeline drains. Authored fresh for W0; do NOT '
  'apply the repo file 20241220000009, which is invalid SQL and whose CHECK '
  'constraints reject the mobile client''s own payload. See this migration''s '
  'header for the specifics.';

COMMENT ON COLUMN public.social_media_posts.user_id IS
  'auth.users.id of whoever pressed publish. NO foreign key: auth.users is '
  'empty and a NOT NULL FK to an empty table makes the row unwritable.';


-- ---------------------------------------------------------------------
-- 3. publish_records — one row per delivery ATTEMPT, with an idempotency key.
--
--    social_media_posts says "we intend to post this". publish_records says
--    "we tried to hand it to Google at 14:03 and here is what came back".
--    Separating them is what makes a retry safe.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publish_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid,
  job_id             uuid,
  post_id            uuid REFERENCES public.social_media_posts (id) ON DELETE SET NULL,

  destination        text NOT NULL,

  -- THE POINT OF THIS TABLE. Unique per (destination, key). A retry that
  -- reuses the key hits the unique index and does nothing instead of posting
  -- to Google a second time.
  idempotency_key    text NOT NULL,

  status             text NOT NULL DEFAULT 'queued',
  attempt_count      integer NOT NULL DEFAULT 0,
  max_attempts       integer NOT NULL DEFAULT 5,

  request_payload    jsonb,
  response_payload   jsonb,
  external_id        text,
  external_url       text,
  error_code         text,
  error_message      text,

  first_attempted_at timestamptz,
  last_attempted_at  timestamptz,
  succeeded_at       timestamptz,
  next_retry_at      timestamptz,

  requested_by       uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.publish_records ADD COLUMN IF NOT EXISTS company_id    uuid;
ALTER TABLE public.publish_records ADD COLUMN IF NOT EXISTS external_url  text;
ALTER TABLE public.publish_records ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE public.publish_records ADD COLUMN IF NOT EXISTS requested_by  uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.publish_records'::regclass
                    AND conname = 'publish_records_destination_check') THEN
    ALTER TABLE public.publish_records
      ADD CONSTRAINT publish_records_destination_check
      -- 'website' and 'gohighlevel' are listed FIRST after 'gmb' because they
      -- are the other two members of publish.ts's
      --   export type Destination = 'gmb' | 'website' | 'gohighlevel'
      -- An earlier cut of this CHECK omitted both, which made it impossible to
      -- record a per-destination outcome for two thirds of the destinations
      -- the shipped client actually publishes to — and therefore impossible
      -- for app.publish_records_sync_job_state() to ever set jobs.publish_state
      -- for them.
      CHECK (destination IN ('gmb', 'website', 'gohighlevel',
                             'facebook', 'instagram', 'linkedin',
                             'x', 'nextdoor', 'webhook'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.publish_records'::regclass
                    AND conname = 'publish_records_status_check') THEN
    ALTER TABLE public.publish_records
      ADD CONSTRAINT publish_records_status_check
      CHECK (status IN ('queued', 'in_flight', 'succeeded', 'failed',
                        'cancelled', 'abandoned'));
  END IF;
END $$;

-- Repair path for a database that already applied an earlier cut of this file,
-- where the guard above ("IF NOT EXISTS ... conname = ...") would otherwise
-- leave the too-narrow destination CHECK in place forever.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.publish_records'::regclass
     AND conname  = 'publish_records_destination_check';

  IF v_def IS NOT NULL AND v_def NOT ILIKE '%gohighlevel%' THEN
    ALTER TABLE public.publish_records
      DROP CONSTRAINT publish_records_destination_check;
    ALTER TABLE public.publish_records
      ADD CONSTRAINT publish_records_destination_check
      CHECK (destination IN ('gmb', 'website', 'gohighlevel',
                             'facebook', 'instagram', 'linkedin',
                             'x', 'nextdoor', 'webhook'))
      NOT VALID;
    ALTER TABLE public.publish_records
      VALIDATE CONSTRAINT publish_records_destination_check;
    RAISE NOTICE 'W0/06: publish_records destination CHECK widened to include '
                 'website and gohighlevel';
  END IF;
END $$;

-- The whole safety guarantee, in one index.
CREATE UNIQUE INDEX IF NOT EXISTS publish_records_idempotency_key
  ON public.publish_records (destination, idempotency_key);

CREATE INDEX IF NOT EXISTS publish_records_company_id_idx ON public.publish_records (company_id);
CREATE INDEX IF NOT EXISTS publish_records_job_id_idx     ON public.publish_records (job_id);
CREATE INDEX IF NOT EXISTS publish_records_post_id_idx    ON public.publish_records (post_id);
CREATE INDEX IF NOT EXISTS publish_records_retry_idx
  ON public.publish_records (next_retry_at)
  WHERE status IN ('queued', 'failed');

COMMENT ON TABLE public.publish_records IS
  'One row per outbound delivery attempt to an external platform. The unique '
  'index on (destination, idempotency_key) is what stops a flaky mobile '
  'connection from double-posting to a customer''s Google Business Profile. '
  'A publisher MUST insert the record first, then call the API, then update '
  'the row — never the other way round.';

COMMENT ON COLUMN public.publish_records.idempotency_key IS
  'Caller-supplied, deterministic. Derive it from the CONTENT, not from a '
  'random value or a timestamp, or a retry generates a fresh key and the '
  'protection is worthless. Use app.publish_idempotency_key().';

CREATE OR REPLACE FUNCTION app.publish_idempotency_key(
  p_job_id      uuid,
  p_destination text,
  p_content     text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- md5() is built into core PostgreSQL. pgcrypto's digest() would be
  -- stronger but pgcrypto lives in schema `extensions` here, not `public`,
  -- so a bare digest() call resolves or fails depending on the search_path
  -- the migration runner happens to use. Collision resistance is not the
  -- threat model for a de-duplication key.
  SELECT md5(coalesce(p_job_id::text, '') || '|' ||
             coalesce(p_destination, '')  || '|' ||
             coalesce(p_content, ''));
$$;

COMMENT ON FUNCTION app.publish_idempotency_key(uuid, text, text) IS
  'Deterministic idempotency key: same job + same destination + same content '
  '= same key, so a retry collides with the original attempt. Change the '
  'content and you legitimately get a new key and a new post.';

DROP TRIGGER IF EXISTS publish_records_touch_updated_at ON public.publish_records;
CREATE TRIGGER publish_records_touch_updated_at
  BEFORE UPDATE ON public.publish_records
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Keep jobs.publish_state (added in W0/03) in step with reality, so the job
-- list can show publish status without joining.
CREATE OR REPLACE FUNCTION app.publish_records_sync_job_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_state text;
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_state := CASE NEW.status
               WHEN 'succeeded' THEN 'published'
               WHEN 'in_flight' THEN 'publishing'
               WHEN 'queued'    THEN 'queued'
               WHEN 'failed'    THEN 'failed'
               WHEN 'abandoned' THEN 'failed'
               ELSE NULL
             END;

  IF v_state IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.jobs
     SET publish_state = v_state,
         published_at  = CASE WHEN v_state = 'published'
                              THEN coalesce(published_at, NEW.succeeded_at, now())
                              ELSE published_at END
   WHERE id = NEW.job_id
     -- Never walk a job backwards out of 'published'.
     AND (publish_state <> 'published' OR v_state = 'published');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS publish_records_sync_job_state ON public.publish_records;
CREATE TRIGGER publish_records_sync_job_state
  AFTER INSERT OR UPDATE OF status ON public.publish_records
  FOR EACH ROW EXECUTE FUNCTION app.publish_records_sync_job_state();


-- ---------------------------------------------------------------------
-- 4. Claim helper: the safe way to start a delivery attempt.
--
--    Returns the record id and whether the caller actually won the claim.
--    A caller that gets claimed = false must NOT call the external API.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_publish_attempt(
  p_job_id          uuid,
  p_destination     text,
  p_idempotency_key text,
  p_post_id         uuid DEFAULT NULL,
  p_request         jsonb DEFAULT NULL
)
RETURNS TABLE (record_id uuid, claimed boolean, current_status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company uuid;
  v_id      uuid;
  v_status  text;
BEGIN
  -- Read company_id through to_jsonb, not as a column reference: jobs.company_id
  -- does not exist until W0/08, plpgsql plans on first execution, and this
  -- function is granted to `authenticated` at creation time — so a direct
  -- column reference makes every RPC call between W0/06 and W0/08 raise 42703.
  SELECT nullif(to_jsonb(j) ->> 'company_id', '')::uuid
    INTO v_company
    FROM public.jobs j WHERE j.id = p_job_id;

  INSERT INTO public.publish_records
    (company_id, job_id, post_id, destination, idempotency_key, status,
     attempt_count, request_payload, first_attempted_at, last_attempted_at)
  VALUES
    (v_company, p_job_id, p_post_id, p_destination, p_idempotency_key,
     'in_flight', 1, p_request, now(), now())
  ON CONFLICT (destination, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, true, 'in_flight'::text;
    RETURN;
  END IF;

  -- Someone already claimed this exact content for this destination.
  SELECT r.id, r.status INTO v_id, v_status
    FROM public.publish_records r
   WHERE r.destination = p_destination
     AND r.idempotency_key = p_idempotency_key;

  RETURN QUERY SELECT v_id, false, v_status;
END $$;

COMMENT ON FUNCTION public.claim_publish_attempt(uuid, text, text, uuid, jsonb) IS
  'Atomically claims the right to publish. Returns claimed = true exactly '
  'once per (destination, idempotency_key); every retry gets false plus the '
  'status of the attempt that won. A caller that gets false MUST NOT call the '
  'external API.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_publish_attempt(uuid, text, text, uuid, jsonb) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION app.publish_idempotency_key(uuid, text, text) TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. Close these tables to `anon` the moment they exist. See W0/05 section 6
--    for why this cannot wait for W0/10: publish_records holds request and
--    response payloads, and social_media_posts holds unpublished draft content.
-- ---------------------------------------------------------------------
SELECT app.w0_revoke_anon(ARRAY[
  'job_events', 'social_media_posts', 'publish_records'
]);

INSERT INTO app.w0_series_log (step, detail)
VALUES ('06_job_events_and_publish_records',
        'job_events (actor + device/server clocks, auto status-change '
        'trigger); social_media_posts authored fresh matching publish.ts''s '
        'exact payload; publish_records with a unique (destination, '
        'idempotency_key) index and claim_publish_attempt().')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
