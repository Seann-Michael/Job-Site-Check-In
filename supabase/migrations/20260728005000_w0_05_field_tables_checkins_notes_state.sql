-- =====================================================================
-- W0 / 05 — The tables the mobile app writes to that do not exist
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   Five tables referenced by a `.from(...)` call in mobile/src are absent
--   from the live database. Verified with to_regclass() — all five return
--   NULL:
--
--     job_checkins      job-extras.ts:128/248/113, team-presence.ts:44
--     job_notes         job-extras.ts:133/309/339
--     shared_galleries  share-links.ts:65/86  (backs the logged-out /g/:token page)
--     job_field_state   tasks-store.ts:82/108/124, job-meta.ts:75/83/103
--     media_comments    media-comments.ts:73/127/161
--
--   The repo carries migrations for all five (20260726000000 and
--   20260726010000) but neither has ever been applied. This file creates them
--   with IF NOT EXISTS so it is correct whether or not those two ran first,
--   and adds the columns W0 needs on top via ADD COLUMN IF NOT EXISTS —
--   because CREATE TABLE IF NOT EXISTS on an existing table is a SILENT
--   NO-OP, and every statement after it would then be operating on a shape
--   nobody verified. (001_create_audit_logs.sql is the cautionary example:
--   audit_logs exists with a completely different column set and that file's
--   indexes fail on columns the no-op CREATE never added.)
--
-- COLUMN TYPES THAT LOOK WRONG AND ARE NOT
--   job_field_state.job_id is TEXT, and it is the PRIMARY KEY.
--   media_comments.media_id is TEXT.
--     The mobile client passes non-uuid local identifiers alongside real
--     uuids: 'demo-*' job ids in demo mode, 'local-*' and 'm-*' media ids for
--     photos captured on-device but not yet uploaded. Typing either column as
--     uuid produces 22P02 invalid-input-syntax and kills checklist sync and
--     photo comments. Do not "clean this up".
--
--   job_field_state.job_id MUST be a primary key (or carry a unique
--   constraint). tasks-store.ts:108 and job-meta.ts:83 both call
--   .upsert({ job_id, ... }) with NO onConflict argument. Without a unique
--   constraint PostgREST returns 42P10 "no unique or exclusion constraint
--   matching the ON CONFLICT specification" and every sync silently fails.
--
--   job_field_state.tasks and .meta are both NULLABLE, and must stay that
--   way. The two modules upsert the SAME row from different code paths —
--   tasks-store writes {job_id, tasks, updated_at}, job-meta writes
--   {job_id, meta, updated_at}. A PostgREST upsert is INSERT ... ON CONFLICT
--   DO UPDATE over only the supplied columns, so they do not clobber each
--   other. Adding NOT NULL to either column breaks whichever module inserts
--   the row first.
--
-- CLOCKS
--   job_checkins records BOTH the device clock and the server clock, plus the
--   skew between them, because a phone that has been offline in a basement
--   for three hours routinely reports a wrong time and "when did the crew
--   arrive" is a billing question.
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 has run (app.touch_updated_at, app.w0_series_log).
--   * jobs exists. No FK to it is created here — the composite
--     (job_id, company_id) -> jobs(id, company_id) FKs land in W0/08, and a
--     single-column FK added now would only have to be dropped there.
--     A single-column FK would ALSO reject the demo job ids the client passes
--     in demo mode (business.id.startsWith('demo') guards in data.ts).
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/00: 42883 on app.touch_updated_at.
--   After W0/08: W0/08 iterates app.w0_scope and adds company_id to whichever
--     of these tables exist. Running 05 afterwards is harmless (all guards
--     are IF NOT EXISTS) but the company_id columns would be missing until
--     W0/08 is re-run.
--
-- SAFETY: purely additive. Creates tables and adds nullable columns. No RLS
--   is enabled here — see W0/10.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. job_checkins — site arrival/departure, and "who is on site right now".
--
--    Insert shape the client actually sends (job-extras.ts:248):
--      { job_id, user_name, checked_in_at, latitude, longitude }
--    Update shape (job-extras.ts:113):
--      { checked_out_at } WHERE id = serverId
--    Select shapes:
--      job-extras.ts:128   id, user_name, checked_in_at, checked_out_at, latitude, longitude
--      team-presence.ts:44 job_id, user_name, checked_in_at WHERE checked_out_at IS NULL
--    Every one of those columns is present and keeps its original name.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_checkins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL,
  company_id          uuid,

  user_id             uuid,
  user_name           text NOT NULL DEFAULT 'Team member',

  -- DEVICE CLOCK. Supplied by the client. Untrusted.
  checked_in_at       timestamptz NOT NULL DEFAULT now(),
  checked_out_at      timestamptz,

  -- SERVER CLOCK. Set by the database, never by the client.
  server_checked_in_at  timestamptz NOT NULL DEFAULT now(),
  server_checked_out_at timestamptz,

  latitude            double precision,
  longitude           double precision,
  accuracy_meters     double precision,
  checkout_latitude   double precision,
  checkout_longitude  double precision,

  source              text NOT NULL DEFAULT 'mobile',
  client_generated_id text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS company_id            uuid;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS user_id               uuid;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS server_checked_in_at  timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS server_checked_out_at timestamptz;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS accuracy_meters       double precision;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS checkout_latitude     double precision;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS checkout_longitude    double precision;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS source                text NOT NULL DEFAULT 'mobile';
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS client_generated_id   text;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS notes                 text;
ALTER TABLE public.job_checkins ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now();

-- Clock skew, in seconds, positive when the device is AHEAD of the server.
-- Safe as a GENERATED column: timestamptz subtraction yields interval and
-- date_part('epoch', interval) is IMMUTABLE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.job_checkins'::regclass
       AND attname = 'clock_skew_seconds' AND NOT attisdropped
  ) THEN
    ALTER TABLE public.job_checkins
      ADD COLUMN clock_skew_seconds double precision
      GENERATED ALWAYS AS (
        date_part('epoch', checked_in_at - server_checked_in_at)
      ) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.job_checkins.checked_in_at IS
  'DEVICE clock, as reported by the phone. This is what the crew sees and '
  'what the client sends. It is not trustworthy: phones drift, and a device '
  'that was offline may replay a check-in hours later.';

COMMENT ON COLUMN public.job_checkins.server_checked_in_at IS
  'SERVER clock at the moment the row was accepted. Authoritative. Use this '
  'for anything that becomes money.';

COMMENT ON COLUMN public.job_checkins.clock_skew_seconds IS
  'checked_in_at - server_checked_in_at, in seconds. Positive means the '
  'device is running fast. Large magnitudes flag either a misconfigured '
  'phone or a delayed offline sync; either way the two timestamps disagree '
  'and somebody should be told which one the invoice used.';

CREATE INDEX IF NOT EXISTS job_checkins_job_id_idx
  ON public.job_checkins (job_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS job_checkins_company_id_idx
  ON public.job_checkins (company_id);

-- Backs team-presence.ts:44 (.is('checked_out_at', null)). Partial, so it
-- only indexes the handful of people currently on site.
CREATE INDEX IF NOT EXISTS job_checkins_active_idx
  ON public.job_checkins (job_id, checked_in_at)
  WHERE checked_out_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_checkins_client_generated_id_key
  ON public.job_checkins (job_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.job_checkins'::regclass
       AND conname = 'job_checkins_interval_check'
  ) THEN
    -- A checkout before its checkin is a bug, not data. Compare on the
    -- DEVICE clock, because that is the pair the client controls.
    ALTER TABLE public.job_checkins
      ADD CONSTRAINT job_checkins_interval_check
      CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
      NOT VALID;
    ALTER TABLE public.job_checkins VALIDATE CONSTRAINT job_checkins_interval_check;
  END IF;
END $$;

-- Stamp the server-side checkout clock when the device reports a checkout.
CREATE OR REPLACE FUNCTION app.job_checkins_stamp_server_clock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.server_checked_in_at := now();
    IF NEW.checked_out_at IS NOT NULL THEN
      NEW.server_checked_out_at := now();
    END IF;
  ELSE
    -- Never let a client rewrite the server clock.
    NEW.server_checked_in_at := OLD.server_checked_in_at;
    IF NEW.checked_out_at IS NOT NULL AND OLD.checked_out_at IS NULL THEN
      NEW.server_checked_out_at := now();
    ELSIF NEW.checked_out_at IS NULL THEN
      NEW.server_checked_out_at := NULL;
    ELSE
      NEW.server_checked_out_at := OLD.server_checked_out_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS job_checkins_server_clock ON public.job_checkins;
CREATE TRIGGER job_checkins_server_clock
  BEFORE INSERT OR UPDATE ON public.job_checkins
  FOR EACH ROW EXECUTE FUNCTION app.job_checkins_stamp_server_clock();

DROP TRIGGER IF EXISTS job_checkins_touch_updated_at ON public.job_checkins;
CREATE TRIGGER job_checkins_touch_updated_at
  BEFORE UPDATE ON public.job_checkins
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();


-- ---------------------------------------------------------------------
-- 2. job_notes — the per-job note feed.
--
--    Insert shape (job-extras.ts:309): { job_id, author_name, note }
--    Select shape (job-extras.ts:133):  id, author_name, note, created_at
--    Delete    (job-extras.ts:339):     .eq('id', server_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL,
  company_id          uuid,
  author_user_id      uuid,
  author_name         text NOT NULL DEFAULT 'Team member',
  note                text NOT NULL,
  is_internal         boolean NOT NULL DEFAULT true,
  pinned              boolean NOT NULL DEFAULT false,
  client_generated_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_notes ADD COLUMN IF NOT EXISTS company_id          uuid;
ALTER TABLE public.job_notes ADD COLUMN IF NOT EXISTS author_user_id      uuid;
ALTER TABLE public.job_notes ADD COLUMN IF NOT EXISTS is_internal         boolean NOT NULL DEFAULT true;
ALTER TABLE public.job_notes ADD COLUMN IF NOT EXISTS pinned              boolean NOT NULL DEFAULT false;
ALTER TABLE public.job_notes ADD COLUMN IF NOT EXISTS client_generated_id text;
ALTER TABLE public.job_notes ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS job_notes_job_id_idx
  ON public.job_notes (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_notes_company_id_idx
  ON public.job_notes (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS job_notes_client_generated_id_key
  ON public.job_notes (job_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;

COMMENT ON COLUMN public.job_notes.is_internal IS
  'TRUE means crew-only. Defaults to TRUE so a note written before anyone '
  'thought about client visibility is never accidentally shown to a customer.';

DROP TRIGGER IF EXISTS job_notes_touch_updated_at ON public.job_notes;
CREATE TRIGGER job_notes_touch_updated_at
  BEFORE UPDATE ON public.job_notes
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();


-- ---------------------------------------------------------------------
-- 3. job_field_state — the mobile checklist and workflow blob.
--
--    See the header for why job_id is TEXT and why it must be the PK.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_field_state (
  job_id     text PRIMARY KEY,
  company_id uuid,
  tasks      jsonb,
  meta       jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_field_state ADD COLUMN IF NOT EXISTS company_id uuid;

-- If an older run created this table without a PK on job_id, the PostgREST
-- upsert is broken. Detect it loudly rather than shipping a silent failure.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.job_field_state'::regclass
       AND c.contype IN ('p', 'u')
       AND a.attname = 'job_id'
       AND array_length(c.conkey, 1) = 1
  ) THEN
    RAISE EXCEPTION
      'W0/05 ABORT: public.job_field_state.job_id has no single-column PRIMARY '
      'KEY or UNIQUE constraint. mobile tasks-store.ts and job-meta.ts both '
      'call .upsert({job_id,...}) with no onConflict, which needs one. '
      'Without it PostgREST returns 42P10 and every checklist sync fails.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_field_state_company_id_idx
  ON public.job_field_state (company_id);
CREATE INDEX IF NOT EXISTS job_field_state_updated_at_idx
  ON public.job_field_state (updated_at DESC);

COMMENT ON TABLE public.job_field_state IS
  'One row per job holding the mobile checklist (tasks) and workflow metadata '
  '(meta) as JSONB. Written by two independent modules that upsert the same '
  'row: tasks-store.ts supplies {job_id, tasks, updated_at} and job-meta.ts '
  'supplies {job_id, meta, updated_at}.';

COMMENT ON COLUMN public.job_field_state.job_id IS
  'TEXT, not uuid, and PRIMARY KEY. TEXT because the client passes local demo '
  'ids (demo-*) as well as real uuids; a uuid column raises 22P02 on those. '
  'PRIMARY KEY because PostgREST upserts with no onConflict need a unique '
  'constraint or they fail with 42P10. Also: no FK to jobs is possible for '
  'the same type reason.';

COMMENT ON COLUMN public.job_field_state.tasks IS
  'NULLABLE ON PURPOSE. job-meta.ts inserts this row without supplying tasks. '
  'Adding NOT NULL here breaks the meta sync path.';

COMMENT ON COLUMN public.job_field_state.meta IS
  'NULLABLE ON PURPOSE. tasks-store.ts inserts this row without supplying '
  'meta. Adding NOT NULL here breaks the checklist sync path.';

-- updated_at is supplied by the client on every upsert, so no trigger: a
-- trigger would overwrite the device timestamp the sync logic compares
-- against.


-- ---------------------------------------------------------------------
-- 4. media_comments — photo/video comment threads with @mentions.
--
--    Insert shape (media-comments.ts:127):
--      { media_id, author_name, comment, mentions }   mentions is a string[]
--    Select shape (media-comments.ts:73):
--      id, author_name, comment, mentions, created_at
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id            text NOT NULL,
  company_id          uuid,
  job_id              uuid,
  author_user_id      uuid,
  author_name         text NOT NULL DEFAULT 'Team member',
  comment             text NOT NULL,
  mentions            jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_generated_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_comments ADD COLUMN IF NOT EXISTS company_id          uuid;
ALTER TABLE public.media_comments ADD COLUMN IF NOT EXISTS job_id              uuid;
ALTER TABLE public.media_comments ADD COLUMN IF NOT EXISTS author_user_id      uuid;
ALTER TABLE public.media_comments ADD COLUMN IF NOT EXISTS client_generated_id text;
ALTER TABLE public.media_comments ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS media_comments_media_id_idx
  ON public.media_comments (media_id, created_at);
CREATE INDEX IF NOT EXISTS media_comments_company_id_idx
  ON public.media_comments (company_id);
CREATE INDEX IF NOT EXISTS media_comments_job_id_idx
  ON public.media_comments (job_id) WHERE job_id IS NOT NULL;

COMMENT ON COLUMN public.media_comments.media_id IS
  'TEXT, not uuid. The client passes MediaItem.id, which is a job_media uuid '
  'for uploaded photos but a local string (local-*, m-*) for photos captured '
  'on-device or supplied by the demo seed. A uuid column raises 22P02 on '
  'those and kills the comment feature on exactly the photos people comment '
  'on most — the ones just taken.';

COMMENT ON COLUMN public.media_comments.mentions IS
  'JSONB array of @-mentioned names, as written by media-comments.ts. Kept as '
  'jsonb rather than text[] because that is the shape the client sends.';

COMMENT ON COLUMN public.media_comments.job_id IS
  'Denormalised from job_media for company scoping and for "all comments on '
  'this job". NULL for comments on local-only media. Populated by the trigger '
  'below when the media_id happens to be a real job_media uuid.';

-- Resolve job_id (and, once W0/08 has run, company_id) from job_media when
-- media_id is a real uuid. Guarded: a local id must not raise.
--
-- ============ THREE BUGS THIS VERSION FIXES ============
--   1. It used `SELECT m.job_id, m.company_id INTO NEW.job_id, NEW.company_id`.
--      In PL/pgSQL a SELECT ... INTO that matches NO row assigns NULL to every
--      target. So a comment on media the caller cannot see — or on a uuid with
--      no job_media row — had its caller-supplied company_id WIPED to NULL and
--      was then bounced by the WITH CHECK. It now writes only when FOUND, and
--      only via coalesce, so it can never clobber a value already set.
--   2. It referenced m.company_id directly. That column does not exist until
--      W0/08, and plpgsql plans on first execution, so every media_comments
--      insert applied between W0/05 and W0/08 raised 42703. It now reads the
--      parent through to_jsonb, which is shape-agnostic.
--   3. It was SECURITY INVOKER, so once W0/10 enables RLS on job_media the
--      lookup was filtered by the caller's own policy — meaning a comment on
--      a photo the caller had legitimately just captured could fail to
--      resolve. SECURITY DEFINER makes the resolution reflect the real parent
--      row. That adds no privilege: media_comments' own WITH CHECK still
--      verifies the resulting company_id against the caller's memberships, so
--      resolving a parent in another tenant produces a rejected insert, not a
--      leak.
-- ======================================================
CREATE OR REPLACE FUNCTION app.media_comments_resolve_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uuid   uuid;
  v_parent jsonb;
BEGIN
  IF NEW.job_id IS NOT NULL AND NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_uuid := NEW.media_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;   -- local id such as 'local-17..' — nothing to resolve
  END;

  SELECT to_jsonb(m) INTO v_parent
    FROM public.job_media m
   WHERE m.id = v_uuid;

  -- No matching media row: leave NEW exactly as the caller sent it.
  IF NOT FOUND OR v_parent IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.job_id     := coalesce(NEW.job_id,
                             nullif(v_parent ->> 'job_id', '')::uuid);
  NEW.company_id := coalesce(NEW.company_id,
                             nullif(v_parent ->> 'company_id', '')::uuid);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS media_comments_resolve_job ON public.media_comments;
CREATE TRIGGER media_comments_resolve_job
  BEFORE INSERT ON public.media_comments
  FOR EACH ROW EXECUTE FUNCTION app.media_comments_resolve_job();

DROP TRIGGER IF EXISTS media_comments_touch_updated_at ON public.media_comments;
CREATE TRIGGER media_comments_touch_updated_at
  BEFORE UPDATE ON public.media_comments
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();


-- ---------------------------------------------------------------------
-- 5. shared_galleries — the public /g/:token client gallery.
--
--    Insert shape (share-links.ts:65):
--      { token, job_id, job_title, business_name, photo_urls }
--    Delete (share-links.ts:86): .eq('token', token)
--    The client keys on TOKEN, not on id, so token is the primary key.
--
--    This is the one table in the W0 surface that genuinely needs anonymous
--    SELECT: the whole point is a link a customer opens without logging in.
--    W0/10 gives it an anon read policy; every other table gets none.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_galleries (
  token         text PRIMARY KEY,
  job_id        uuid NOT NULL,
  company_id    uuid,
  job_title     text,
  business_name text,
  photo_urls    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by    uuid,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  view_count    integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS company_id     uuid;
ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS created_by     uuid;
ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS expires_at     timestamptz;
ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS revoked_at     timestamptz;
ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS view_count     integer NOT NULL DEFAULT 0;
ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;
ALTER TABLE public.shared_galleries ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS shared_galleries_job_id_idx     ON public.shared_galleries (job_id);
CREATE INDEX IF NOT EXISTS shared_galleries_company_id_idx ON public.shared_galleries (company_id);

COMMENT ON COLUMN public.shared_galleries.expires_at IS
  'NULL means the link never expires, which is the behaviour the shipped '
  'client produces today. New links should set it. public.gallery_by_token() '
  '(W0/10 §5) honours both expires_at and revoked_at, so setting them starts '
  'working the moment the client sends them — no further migration needed.';

COMMENT ON TABLE public.shared_galleries IS
  'Backs the logged-out /g/:token customer gallery. The table is NOT readable '
  'by anon: reads go through public.gallery_by_token(p_token), which requires '
  'the token as an argument. An anon SELECT policy would not — PostgREST does '
  'not require a filter, so GET /rest/v1/shared_galleries?select=* with the '
  'anon key that ships inside the app bundle would return every token, '
  'job_id, job_title, business_name and photo_urls of every tenant in one '
  'request. See W0/10 section 5.';

DROP TRIGGER IF EXISTS shared_galleries_touch_updated_at ON public.shared_galleries;
CREATE TRIGGER shared_galleries_touch_updated_at
  BEFORE UPDATE ON public.shared_galleries
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------
-- 6. Close these tables to `anon` the moment they exist.
--
--    THIS IS NOT OPTIONAL AND IT IS NOT A FOLLOW-UP. Without it, and for the
--    entire unbounded duration of the manual gate in front of W0/10, the anon
--    key bundled in the mobile app can read:
--      job_checkins   — crew names and GPS coordinates
--      job_notes      — is_internal crew-only notes, defaulted to TRUE
--                       precisely so they are never shown to a customer
--      media_comments — comment threads
--      shared_galleries — every token, for every tenant
--    The lockdown migration 20260727000000 does not cover these: its
--    per-table REVOKE loop only iterates tables that existed when it ran, and
--    its default-privilege revoke omits SELECT. W0/00 now fixes the default;
--    this is the per-table belt to that braces.
-- ---------------------------------------------------------------------
SELECT app.w0_revoke_anon(ARRAY[
  'job_checkins', 'job_notes', 'job_field_state',
  'media_comments', 'shared_galleries'
]);

INSERT INTO app.w0_series_log (step, detail)
VALUES ('05_field_tables_checkins_notes_state',
        'job_checkins (device + server clock + generated skew), job_notes, '
        'job_field_state (job_id TEXT PK — verified), media_comments '
        '(media_id TEXT — verified) and shared_galleries created. No FKs to '
        'jobs yet; those are composite and land in W0/08.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
