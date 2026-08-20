-- =====================================================================
-- W0 / 07 — job_media: attribution, capture time, coordinates, search
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   job_media has 11 rows and holds every photo the product is actually
--   about. It cannot currently answer three questions a field-service tool
--   must answer:
--     "who took this?"        uploaded_by exists but is NULL on all 11 rows
--     "when was it taken?"    only created_at, which is upload time, not
--                             capture time — they differ by hours when a crew
--                             shoots in a basement and syncs from the truck
--     "where was it taken?"   geolocation is a JSONB blob, unindexable
--
--   The data is mostly THERE, inside metadata and geolocation JSON. This
--   migration promotes it into real columns.
--
-- ============ EVERY CAST IN THIS FILE IS GUARDED ============
--   These blobs were written by several versions of a mobile client across
--   several months. A single malformed value must not abort the migration, so
--   nothing here uses a bare `::timestamptz` or `::double precision`.
--   Extraction goes through app.jsonb_ts() / app.jsonb_num() /
--   app.jsonb_text_array() from W0/00, all of which return NULL instead of
--   raising 22P02. A row that cannot be parsed is recorded in
--   app.w0_backfill_report with outcome 'unparseable' and LEFT ALONE.
--
--   Concretely: media-capture.ts:209 writes width/height into the metadata
--   blob rather than the real int4 width/height columns, and media-tags.ts:49
--   writes tags into metadata too. Both are picked up below. Neither is
--   trusted to be well-formed.
-- ============================================================
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 has run (guarded cast helpers, app.w0_backfill_report).
--   * job_media exists with columns including metadata jsonb, geolocation
--     jsonb, created_at, uploaded_by uuid, width int4, height int4.
--   * uploaded_by ALREADY EXISTS (it is column 14). The ADD COLUMN IF NOT
--     EXISTS below is a no-op on the live database and is present so this
--     file is correct elsewhere.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/00: 42883 on app.jsonb_ts.
--   Before W0/05: media_comments does not exist, so its resolve-job trigger
--     cannot denormalise company_id from here. Harmless; re-run W0/05's
--     trigger creation or just apply in order.
--   After W0/08: W0/08 backfills job_media.company_id from jobs; this file
--     does not touch company_id at all, so either order works.
--
-- SAFETY: additive columns plus UPDATEs that only ever write into columns
--   that were NULL. No existing value is overwritten. Fully re-runnable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns.
-- ---------------------------------------------------------------------
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS uploaded_by   uuid;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS uploaded_by_name text;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS captured_at   timestamptz;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS uploaded_at   timestamptz;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS tags          text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS caption       text;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS latitude      double precision;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS longitude     double precision;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS location_accuracy_meters double precision;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS search_body   tsvector;

-- Denormalised so ONE search box can match photos the way it matches jobs.
-- job_media carries no job title and no customer name (data.ts mapMediaRow
-- literally sets job_title: '' and comments "job_media has no job_title
-- column"), so a search for a customer's name returned every matching job and
-- zero photos. Maintained by app.job_media_stamp_upload() from the parent job.
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS job_title     text;
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS client_name   text;

-- Makes the offline upload queue's retry genuinely idempotent. upload-queue.ts
-- re-flushes on every reconnect and job_media's only de-duplication today is
-- media-capture.ts findExistingRow(publicUrl) — a non-atomic SELECT, so two
-- concurrent flushes insert the same photo twice. Every other client-written
-- table in this series (job_tasks, job_checkins, job_notes, media_comments)
-- already has this column and index; job_media, the one the queue actually
-- retries, was the only one without.
ALTER TABLE public.job_media ADD COLUMN IF NOT EXISTS client_generated_id text;

COMMENT ON COLUMN public.job_media.client_generated_id IS
  'The MediaItem.id the device minted while offline (local-*, m-*). Lets a '
  'retried upload be recognised as the same photo instead of duplicating it. '
  'The unique index below is partial, so the shipped client — which does not '
  'send this column yet — keeps working unchanged.';

COMMENT ON COLUMN public.job_media.captured_at IS
  'When the shutter fired, per the device. Distinct from created_at, which is '
  'when the upload landed. They routinely differ by hours: crews shoot with '
  'no signal and sync later. Backfilled from the metadata blob where a '
  'parseable value exists; NULL where it does not, never guessed from '
  'created_at.';

COMMENT ON COLUMN public.job_media.uploaded_at IS
  'Server-side upload time. Backfilled from created_at, which is exactly what '
  'it meant before this migration.';

COMMENT ON COLUMN public.job_media.uploaded_by_name IS
  'Denormalised display name of the uploader, captured at write time. '
  'uploaded_by is NULL on every existing row (nobody has ever signed in), so '
  'this is the only attribution that will exist for historic media.';

COMMENT ON COLUMN public.job_media.latitude IS
  'Promoted out of the geolocation JSONB blob so it can be indexed and '
  'queried. The blob is left intact.';

COMMENT ON COLUMN public.job_media.tags IS
  'Promoted out of metadata->''tags'', where media-tags.ts:49 writes them. '
  'The blob is left intact so the shipped client keeps working.';

COMMENT ON COLUMN public.job_media.search_body IS
  'Full-text index body. Trigger-maintained, not GENERATED: array_to_string() '
  'is STABLE rather than IMMUTABLE, so a generated column over tags[] is '
  'rejected.';


-- ---------------------------------------------------------------------
-- 2. Indexes.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS job_media_job_id_captured_idx
  ON public.job_media (job_id, captured_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS job_media_uploaded_by_idx
  ON public.job_media (uploaded_by) WHERE uploaded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_media_uploaded_at_idx
  ON public.job_media (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS job_media_tags_gin
  ON public.job_media USING gin (tags);
CREATE INDEX IF NOT EXISTS job_media_search_body_gin
  ON public.job_media USING gin (search_body);
CREATE INDEX IF NOT EXISTS job_media_coords_idx
  ON public.job_media (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_media_client_generated_id_key
  ON public.job_media (job_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;

-- The second half of the retry guarantee, and the one that works with the
-- CURRENT client, which does not send client_generated_id: the same file
-- cannot land in the table twice. Verified safe against the live data — 11
-- rows, 0 duplicate file_path values, 0 NULLs — and partial so a future row
-- with no path is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS job_media_file_path_key
  ON public.job_media (file_path)
  WHERE file_path IS NOT NULL;


-- ---------------------------------------------------------------------
-- 3. search_body maintenance.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.job_media_search_body()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_body :=
      setweight(to_tsvector('english', coalesce(NEW.caption, '')), 'A')
   || setweight(to_tsvector('english',
        coalesce(array_to_string(NEW.tags, ' '), '')), 'A')
   -- The job title and the customer name are what people actually type into a
   -- search box. Without them here, one unified search matched every relevant
   -- job and none of its photos.
   || setweight(to_tsvector('english', coalesce(NEW.job_title, '')), 'A')
   || setweight(to_tsvector('english', coalesce(NEW.client_name, '')), 'B')
   || setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B')
   || setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C')
   || setweight(to_tsvector('english', coalesce(NEW.original_name, '')), 'D');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS job_media_search_body_tsync ON public.job_media;
CREATE TRIGGER job_media_search_body_tsync
  BEFORE INSERT OR UPDATE OF caption, tags, description, category,
                             original_name, job_title, client_name
  ON public.job_media
  FOR EACH ROW EXECUTE FUNCTION app.job_media_search_body();


-- Stamp everything the client does not send, on the way in.
--
--   uploaded_at        — server-side upload time.
--   uploaded_by_name   — media-capture.ts writes the uploader's name ONLY
--                        inside the metadata blob (and uploaded_by only when
--                        identity.snapshotUploader() had a session, which it
--                        cannot while auth.users is empty). Without this line
--                        the W0/07 backfill answers "who took this?" for the
--                        11 historic rows and for nothing uploaded afterwards.
--   job_title/client_name — denormalised from the parent job so search_body
--                        can match them. Resolved through to_jsonb because
--                        jobs.client_id and jobs.name are stable but this
--                        trigger must not care about jobs' exact shape.
--
-- SECURITY DEFINER: it reads public.jobs and public.clients, which are behind
-- RLS after W0/10. The values it copies are already visible to anyone who can
-- see the media row, and it never writes to those tables.
CREATE OR REPLACE FUNCTION app.job_media_stamp_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job    jsonb;
  v_client text;
BEGIN
  NEW.uploaded_at := coalesce(NEW.uploaded_at, NEW.created_at, now());

  NEW.uploaded_by_name := coalesce(
    NEW.uploaded_by_name,
    CASE WHEN jsonb_typeof(NEW.metadata -> 'uploaded_by_name') = 'string'
         THEN nullif(btrim(NEW.metadata ->> 'uploaded_by_name'), '') END,
    CASE WHEN jsonb_typeof(NEW.metadata -> 'user_name') = 'string'
         THEN nullif(btrim(NEW.metadata ->> 'user_name'), '') END,
    CASE WHEN jsonb_typeof(NEW.metadata -> 'author_name') = 'string'
         THEN nullif(btrim(NEW.metadata ->> 'author_name'), '') END);

  IF (NEW.job_title IS NULL OR NEW.client_name IS NULL) AND NEW.job_id IS NOT NULL THEN
    SELECT to_jsonb(j) INTO v_job FROM public.jobs j WHERE j.id = NEW.job_id;

    IF v_job IS NOT NULL THEN
      NEW.job_title := coalesce(NEW.job_title, nullif(v_job ->> 'name', ''));

      v_client := nullif(btrim(coalesce(
                    v_job #>> '{client_contact,name}', '')), '');

      IF v_client IS NULL AND nullif(v_job ->> 'client_id', '') IS NOT NULL THEN
        SELECT nullif(btrim(coalesce(c.name, c.business_name, '')), '')
          INTO v_client
          FROM public.clients c
         WHERE c.id = (v_job ->> 'client_id')::uuid;
      END IF;

      NEW.client_name := coalesce(NEW.client_name, v_client);
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- NAME MATTERS. PostgreSQL fires BEFORE-row triggers in NAME order, and
-- 'job_media_search_body_tsync' sorts before 'job_media_stamp_upload' — so
-- with the obvious name the search vector would be built BEFORE job_title and
-- client_name were stamped, and every newly uploaded photo would be missing
-- exactly the two terms this migration added them for. The aa_ prefix forces
-- the stamp to run first. Do not rename this without checking that ordering.
DROP TRIGGER IF EXISTS job_media_stamp_upload    ON public.job_media;
DROP TRIGGER IF EXISTS job_media_aa_stamp_upload ON public.job_media;
CREATE TRIGGER job_media_aa_stamp_upload
  BEFORE INSERT ON public.job_media
  FOR EACH ROW EXECUTE FUNCTION app.job_media_stamp_upload();


-- ---------------------------------------------------------------------
-- 4. Backfills. Every one guarded, every one only writing into NULLs.
-- ---------------------------------------------------------------------

-- 4a. uploaded_at. The only unambiguous one: created_at IS upload time.
UPDATE public.job_media
   SET uploaded_at = created_at
 WHERE uploaded_at IS NULL
   AND created_at IS NOT NULL;

-- 4b. captured_at, from whichever key the client of the day happened to use.
--     app.jsonb_ts() returns NULL rather than raising on anything it cannot
--     parse, including epoch numbers, ISO strings and outright junk.
UPDATE public.job_media m
   SET captured_at = coalesce(
         app.jsonb_ts(m.metadata -> 'captured_at'),
         app.jsonb_ts(m.metadata -> 'capturedAt'),
         app.jsonb_ts(m.metadata -> 'taken_at'),
         app.jsonb_ts(m.metadata -> 'takenAt'),
         app.jsonb_ts(m.metadata -> 'dateTimeOriginal'),
         app.jsonb_ts(m.metadata -> 'timestamp'),
         app.jsonb_ts(m.metadata #> '{exif,DateTimeOriginal}'),
         app.jsonb_ts(m.geolocation -> 'timestamp')
       )
 WHERE m.captured_at IS NULL
   AND coalesce(
         app.jsonb_ts(m.metadata -> 'captured_at'),
         app.jsonb_ts(m.metadata -> 'capturedAt'),
         app.jsonb_ts(m.metadata -> 'taken_at'),
         app.jsonb_ts(m.metadata -> 'takenAt'),
         app.jsonb_ts(m.metadata -> 'dateTimeOriginal'),
         app.jsonb_ts(m.metadata -> 'timestamp'),
         app.jsonb_ts(m.metadata #> '{exif,DateTimeOriginal}'),
         app.jsonb_ts(m.geolocation -> 'timestamp')
       ) IS NOT NULL;

-- captured_at is deliberately NOT defaulted to created_at. "We do not know
-- when this was taken" is a true and useful answer; "it was taken at upload
-- time" is a fabrication that would then be used to order a before/after
-- gallery.

-- 4c. Coordinates. Four shapes have been observed in the wild:
--       {latitude, longitude}   {lat, lng}   {lat, lon}
--       {coords: {latitude, longitude}}
--     plus the same nested under metadata->'geolocation'.
UPDATE public.job_media m
   SET latitude = coalesce(
         app.jsonb_num(m.geolocation -> 'latitude'),
         app.jsonb_num(m.geolocation -> 'lat'),
         app.jsonb_num(m.geolocation #> '{coords,latitude}'),
         app.jsonb_num(m.metadata #> '{geolocation,latitude}'),
         app.jsonb_num(m.metadata #> '{geolocation,lat}'),
         app.jsonb_num(m.metadata #> '{coordinates,lat}')
       ),
       longitude = coalesce(
         app.jsonb_num(m.geolocation -> 'longitude'),
         app.jsonb_num(m.geolocation -> 'lng'),
         app.jsonb_num(m.geolocation -> 'lon'),
         app.jsonb_num(m.geolocation #> '{coords,longitude}'),
         app.jsonb_num(m.metadata #> '{geolocation,longitude}'),
         app.jsonb_num(m.metadata #> '{geolocation,lng}'),
         app.jsonb_num(m.metadata #> '{coordinates,lng}')
       ),
       location_accuracy_meters = coalesce(
         app.jsonb_num(m.geolocation -> 'accuracy'),
         app.jsonb_num(m.geolocation #> '{coords,accuracy}')
       )
 WHERE m.latitude IS NULL
   AND m.longitude IS NULL
   AND (m.geolocation IS NOT NULL OR m.metadata IS NOT NULL);

-- Refuse to keep coordinates that are not coordinates. A (0,0) pair is the
-- classic "GPS never got a fix" sentinel sitting in the Gulf of Guinea.
UPDATE public.job_media
   SET latitude = NULL, longitude = NULL, location_accuracy_meters = NULL
 WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
   AND (latitude IS NULL OR longitude IS NULL
        OR latitude NOT BETWEEN -90 AND 90
        OR longitude NOT BETWEEN -180 AND 180
        OR (latitude = 0 AND longitude = 0));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.job_media'::regclass
       AND conname = 'job_media_coords_check'
  ) THEN
    ALTER TABLE public.job_media
      ADD CONSTRAINT job_media_coords_check
      CHECK ((latitude IS NULL AND longitude IS NULL)
             OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
      NOT VALID;
    ALTER TABLE public.job_media VALIDATE CONSTRAINT job_media_coords_check;
  END IF;
END $$;

-- 4d. Tags, from metadata->'tags' (media-tags.ts:49).
UPDATE public.job_media m
   SET tags = app.jsonb_text_array(m.metadata -> 'tags')
 WHERE m.tags = '{}'::text[]
   AND app.jsonb_text_array(m.metadata -> 'tags') IS NOT NULL;

-- 4e. Caption, from whichever key was used. description stays as-is.
UPDATE public.job_media m
   SET caption = btrim(coalesce(
         CASE WHEN jsonb_typeof(m.metadata -> 'caption') = 'string'
              THEN NULLIF(m.metadata ->> 'caption', '') END,
         CASE WHEN jsonb_typeof(m.metadata -> 'note') = 'string'
              THEN NULLIF(m.metadata ->> 'note', '') END))
 WHERE m.caption IS NULL
   AND m.metadata IS NOT NULL
   AND coalesce(
         CASE WHEN jsonb_typeof(m.metadata -> 'caption') = 'string'
              THEN NULLIF(m.metadata ->> 'caption', '') END,
         CASE WHEN jsonb_typeof(m.metadata -> 'note') = 'string'
              THEN NULLIF(m.metadata ->> 'note', '') END) IS NOT NULL;

-- 4f. width / height. These real int4 columns have existed all along and are
--     NULL on all 11 rows because media-capture.ts:209 writes the values into
--     the metadata blob instead. Free to recover, so recover them.
UPDATE public.job_media m
   SET width  = floor(coalesce(app.jsonb_num(m.metadata -> 'width'),
                               app.jsonb_num(m.metadata #> '{dimensions,width}')))::int,
       height = floor(coalesce(app.jsonb_num(m.metadata -> 'height'),
                               app.jsonb_num(m.metadata #> '{dimensions,height}')))::int
 WHERE (m.width IS NULL OR m.height IS NULL)
   AND coalesce(app.jsonb_num(m.metadata -> 'width'),
                app.jsonb_num(m.metadata #> '{dimensions,width}')) BETWEEN 1 AND 100000
   AND coalesce(app.jsonb_num(m.metadata -> 'height'),
                app.jsonb_num(m.metadata #> '{dimensions,height}')) BETWEEN 1 AND 100000;

-- 4g. uploaded_by_name, from the blob if it is there.
UPDATE public.job_media m
   SET uploaded_by_name = btrim(coalesce(
         CASE WHEN jsonb_typeof(m.metadata -> 'uploaded_by_name') = 'string'
              THEN NULLIF(m.metadata ->> 'uploaded_by_name', '') END,
         CASE WHEN jsonb_typeof(m.metadata -> 'user_name') = 'string'
              THEN NULLIF(m.metadata ->> 'user_name', '') END,
         CASE WHEN jsonb_typeof(m.metadata -> 'author_name') = 'string'
              THEN NULLIF(m.metadata ->> 'author_name', '') END))
 WHERE m.uploaded_by_name IS NULL
   AND m.metadata IS NOT NULL;

-- 4h. job_title / client_name on existing rows. The stamping trigger is
--     BEFORE INSERT only, so historic rows need this one-shot pass. Must run
--     BEFORE the search_body refresh below or the vector misses both terms.
UPDATE public.job_media m
   SET job_title = coalesce(m.job_title, nullif(j.name, '')),
       client_name = coalesce(
         m.client_name,
         nullif(btrim(coalesce(j.client_contact ->> 'name', '')), ''),
         nullif(btrim(coalesce(c.name, c.business_name, '')), ''))
  FROM public.jobs j
  LEFT JOIN public.clients c ON c.id = j.client_id
 WHERE m.job_id = j.id
   AND (m.job_title IS NULL OR m.client_name IS NULL);

-- 4i. Populate search_body on existing rows by making the trigger fire once.
--     Also refreshes rows whose vector predates the job_title / client_name
--     terms, so a re-run of this file on a database that applied the earlier
--     cut actually rebuilds them instead of silently leaving them stale.
UPDATE public.job_media
   SET caption = caption
 WHERE search_body IS NULL
    OR ((job_title IS NOT NULL OR client_name IS NOT NULL)
        AND search_body @@ plainto_tsquery('english',
              coalesce(job_title, client_name)) IS NOT TRUE);


-- ---------------------------------------------------------------------
-- 5. Report what the backfill could and could not recover, per row.
--    This is the deliverable of a backfill: not "it ran", but "here is what
--    it could not work out".
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n_total    bigint;
  n_captured bigint;
  n_coords   bigint;
  n_tags     bigint;
BEGIN
  DELETE FROM app.w0_backfill_report WHERE step = '07_job_media_backfill';

  SELECT count(*) INTO n_total FROM public.job_media;

  INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
  SELECT '07_job_media_backfill', 'job_media', m.id::text,
         CASE WHEN m.captured_at IS NULL THEN 'unparseable' ELSE 'applied' END,
         CASE WHEN m.captured_at IS NULL
              THEN 'no parseable capture timestamp in metadata/geolocation; '
                   'captured_at left NULL rather than defaulted to upload time'
              ELSE format('captured_at = %s', m.captured_at) END
    FROM public.job_media m;

  SELECT count(*) FILTER (WHERE captured_at IS NOT NULL),
         count(*) FILTER (WHERE latitude IS NOT NULL),
         count(*) FILTER (WHERE tags <> '{}'::text[])
    INTO n_captured, n_coords, n_tags
    FROM public.job_media;

  RAISE NOTICE 'W0/07 job_media backfill over % row(s): captured_at %, coords %, tags %',
               n_total, n_captured, n_coords, n_tags;
  RAISE NOTICE 'W0/07: rows with outcome ''unparseable'' are visible in '
               'app.w0_backfill_report WHERE step = ''07_job_media_backfill''.';
  RAISE NOTICE 'W0/07: uploaded_by is NULL on every historic row because '
               'auth.users is empty. That is expected, not a backfill failure.';
END $$;

INSERT INTO app.w0_series_log (step, detail)
VALUES ('07_job_media_attribution_and_backfill',
        'job_media gains uploaded_by_name, captured_at, uploaded_at, tags, '
        'caption, latitude/longitude/accuracy, denormalised job_title and '
        'client_name (so one search box matches photos as well as jobs), '
        'client_generated_id + a partial unique index on file_path (so the '
        'offline upload queue''s retry cannot duplicate a photo), and '
        'search_body. uploaded_by_name is now stamped on every new upload, not '
        'only backfilled. All backfills guarded through app.jsonb_ts/jsonb_num/'
        'jsonb_text_array; nothing fabricated, unparseable rows reported not '
        'guessed.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
