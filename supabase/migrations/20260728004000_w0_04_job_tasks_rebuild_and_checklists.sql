-- =====================================================================
-- W0 / 04 — job_tasks rebuilt, plus checklist templates and instances
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   public.job_tasks exists, has ZERO rows, and has the wrong shape: it is the
--   `project_tasks` table from the SEO-engagement era, renamed. It has no
--   ordering column, no photo requirement, no version counter for offline
--   conflict resolution, and its assignment columns (assigned_to / assigned_by)
--   point at public.users, which is the legacy identity table rather than
--   auth.users.
--
--   Zero rows means a rebuild costs nothing, so this migration rebuilds rather
--   than accreting a dozen ALTERs onto a shape nobody wants.
--
-- ============ A TRAP THIS FILE DELIBERATELY AVOIDS ============
--   job_tasks is NOT where the mobile checklist lives. mobile/src/lib/
--   tasks-store.ts syncs a JSONB blob to `job_field_state` (created in W0/05).
--   It has never written a job_tasks row. A migration author who assumes
--   job_tasks is the mobile checklist and reshapes it to match the blob would
--   be building the wrong table.
--
--   job_tasks is the OFFICE-side, per-item, assignable task list, and the
--   checklist instances below are its structured source. Reconciling
--   job_field_state.tasks into job_tasks rows is a follow-up, not this file.
-- ==============================================================
--
-- ============ THE OTHER TRAP ============
--   The view `project_activity_summary` joins job_tasks and counts
--     FILTER (WHERE pt.status = 'completed'::text)
--   So:
--     (a) job_tasks.status MUST stay TEXT. Converting it to an enum breaks
--         that comparison (no operator text = job_task_status).
--     (b) the task vocabulary MUST keep the literal value 'completed'. Using
--         'done' instead would silently make that counter always zero.
--   Both are honoured below.
-- ========================================
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 has run (app.w0_stash_views, app.touch_updated_at, app.bump_version).
--   * W0/01 has run (public.companies exists — checklist templates reference it).
--   * job_tasks has 0 rows. If it does not, this migration ABORTS rather than
--     destroying data; see the guard in section 1.
--   * project_activity_summary depends on job_tasks and must be dropped and
--     rebuilt around the table swap. Handled dynamically.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/00 or W0/01: 42883 / 42P01 on the helpers and on companies.
--   Before W0/03: works, but project_activity_summary is then restored with
--     whatever cast state it had; run 03 first so the view is rebuilt once
--     against the text status column.
--   After W0/08: W0/08 adds job_tasks.company_id and the composite FK; if
--     this file ran afterwards the rebuild would drop them again.
--
-- SAFETY: DESTRUCTIVE by design (DROP TABLE job_tasks) but guarded on a
--   zero-row precondition. Everything else is additive.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Refuse to run if anyone started using the old table.
-- ---------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.job_tasks') IS NULL THEN
    RAISE NOTICE 'W0/04: job_tasks does not exist — it will simply be created';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.job_tasks' INTO n;

  IF n > 0 THEN
    RAISE EXCEPTION
      'W0/04 ABORT: public.job_tasks holds % row(s). This migration was '
      'written for the verified state of ZERO rows and would destroy them. '
      'Write a column-by-column ALTER migration instead, or export the rows, '
      'truncate, and re-run.', n;
  END IF;

  RAISE NOTICE 'W0/04: job_tasks confirmed empty — safe to rebuild';
END $$;


-- ---------------------------------------------------------------------
-- 2. Checklist templates. These come first: job_tasks references them.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  service_type text,
  version      integer NOT NULL DEFAULT 1,
  is_active    boolean NOT NULL DEFAULT true,
  is_default   boolean NOT NULL DEFAULT false,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS company_id   uuid;
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS version      integer NOT NULL DEFAULT 1;
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS is_default   boolean NOT NULL DEFAULT false;
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS created_by   uuid;

-- Names are unique per tenant, not globally. NULL company_id (pre-cutover
-- rows and platform-supplied templates) is excluded from the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS checklist_templates_company_name_key
  ON public.checklist_templates (company_id, lower(btrim(name)))
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS checklist_templates_company_id_idx
  ON public.checklist_templates (company_id);
CREATE INDEX IF NOT EXISTS checklist_templates_service_type_idx
  ON public.checklist_templates (service_type) WHERE is_active;

COMMENT ON TABLE public.checklist_templates IS
  'Reusable job checklists ("Driveway pour", "Roof tear-off"). Instantiated '
  'onto a job as a job_checklists row plus one job_tasks row per template '
  'item. Editing a template does NOT retroactively change jobs already '
  'instantiated — job_checklists records the template_version it was cut '
  'from.';

CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           uuid NOT NULL
                          REFERENCES public.checklist_templates (id) ON DELETE CASCADE,
  company_id            uuid,
  position              integer NOT NULL DEFAULT 0,
  title                 text NOT NULL,
  description           text,
  requires_photo        boolean NOT NULL DEFAULT false,
  is_required           boolean NOT NULL DEFAULT true,
  default_assignee_role text,
  estimated_minutes     integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_template_items ADD COLUMN IF NOT EXISTS company_id            uuid;
ALTER TABLE public.checklist_template_items ADD COLUMN IF NOT EXISTS requires_photo        boolean NOT NULL DEFAULT false;
ALTER TABLE public.checklist_template_items ADD COLUMN IF NOT EXISTS is_required           boolean NOT NULL DEFAULT true;
ALTER TABLE public.checklist_template_items ADD COLUMN IF NOT EXISTS default_assignee_role text;
ALTER TABLE public.checklist_template_items ADD COLUMN IF NOT EXISTS estimated_minutes     integer;

CREATE INDEX IF NOT EXISTS checklist_template_items_template_idx
  ON public.checklist_template_items (template_id, position);
CREATE INDEX IF NOT EXISTS checklist_template_items_company_id_idx
  ON public.checklist_template_items (company_id);

-- Ordering index only. NOT unique: reordering a list of items is a swap, and
-- a unique constraint would force every reorder through a deferred
-- transaction or a temporary out-of-range position.
COMMENT ON COLUMN public.checklist_template_items.position IS
  'Sort key. Sparse integers (10, 20, 30) are recommended so an insert '
  'between two items does not require renumbering. Not unique on purpose.';


-- ---------------------------------------------------------------------
-- 3. Per-job checklist instances.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_checklists (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL,
  company_id       uuid,
  template_id      uuid REFERENCES public.checklist_templates (id) ON DELETE SET NULL,
  template_version integer,
  name             text NOT NULL,
  status           text NOT NULL DEFAULT 'open',
  position         integer NOT NULL DEFAULT 0,
  created_by       uuid,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_checklists ADD COLUMN IF NOT EXISTS company_id       uuid;
ALTER TABLE public.job_checklists ADD COLUMN IF NOT EXISTS template_version integer;
ALTER TABLE public.job_checklists ADD COLUMN IF NOT EXISTS position         integer NOT NULL DEFAULT 0;
ALTER TABLE public.job_checklists ADD COLUMN IF NOT EXISTS created_by       uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.job_checklists'::regclass
       AND conname = 'job_checklists_status_check'
  ) THEN
    ALTER TABLE public.job_checklists
      ADD CONSTRAINT job_checklists_status_check
      CHECK (status IN ('open', 'completed', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_checklists_job_id_idx     ON public.job_checklists (job_id);
CREATE INDEX IF NOT EXISTS job_checklists_company_id_idx ON public.job_checklists (company_id);
CREATE INDEX IF NOT EXISTS job_checklists_template_idx   ON public.job_checklists (template_id);

COMMENT ON COLUMN public.job_checklists.template_version IS
  'The checklist_templates.version this instance was cut from. Lets you tell '
  'a job that ran the old checklist from one that ran the new one, which is '
  'the whole point of instantiating rather than joining live.';

-- No FK on job_id here; the composite (job_id, company_id) -> jobs(id,
-- company_id) foreign key is added in W0/08 once company_id exists on both
-- sides. Adding a single-column FK now would have to be dropped there.


-- ---------------------------------------------------------------------
-- 4. Rebuild job_tasks.
--
--    project_activity_summary depends on it, so stash it, swap the table,
--    and put it back. app.w0_stash_views walks pg_depend rather than trusting
--    a hard-coded list.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n_dropped integer := 0;
  n_rebuilt integer := 0;
  needs_rebuild boolean := false;
BEGIN
  -- Only rebuild if the new shape is not already in place, so the file is
  -- re-runnable.
  IF to_regclass('public.job_tasks') IS NULL THEN
    needs_rebuild := true;
  ELSIF NOT EXISTS (
      SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.job_tasks'::regclass
         AND attname = 'requires_photo'
         AND NOT attisdropped
  ) THEN
    needs_rebuild := true;
  END IF;

  IF NOT needs_rebuild THEN
    RAISE NOTICE 'W0/04: job_tasks already rebuilt — skipping';
    RETURN;
  END IF;

  IF to_regclass('public.job_tasks') IS NOT NULL THEN
    n_dropped := app.w0_stash_views('public.job_tasks'::regclass);
    RAISE NOTICE 'W0/04: stashed % view(s) depending on job_tasks', n_dropped;
    EXECUTE 'DROP TABLE public.job_tasks';
  END IF;

  EXECUTE $ddl$
    CREATE TABLE public.job_tasks (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

      -- The single-column FK is KEPT, not deferred to W0/08.
      --
      -- DROP TABLE above destroys project_tasks_project_id_fkey, which is
      -- FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE (verified
      -- against pg_constraint on the live database). W0/08's replacement is
      -- the composite (job_id, company_id) -> jobs(id, company_id), and that
      -- is MATCH SIMPLE: it is satisfied by ANY row whose company_id is NULL.
      -- So between this file and a fully completed company backfill —
      -- which may be a long time, or never — job_id would have no referential
      -- integrity at all and deleting a job would stop removing its tasks.
      -- That is a regression against today's behaviour, not a neutral
      -- deferral. The two constraints coexist fine and W0/08 does not need to
      -- drop this one.
      job_id              uuid NOT NULL
                            REFERENCES public.jobs (id) ON DELETE CASCADE,
      company_id          uuid,
      checklist_id        uuid REFERENCES public.job_checklists (id) ON DELETE CASCADE,
      template_item_id    uuid,

      title               text NOT NULL,
      description         text,

      -- TEXT, and the vocabulary keeps the literal 'completed'.
      -- project_activity_summary counts FILTER (WHERE pt.status = 'completed').
      status              text NOT NULL DEFAULT 'todo',
      priority            text NOT NULL DEFAULT 'medium',

      position            integer NOT NULL DEFAULT 0,
      requires_photo      boolean NOT NULL DEFAULT false,
      is_required         boolean NOT NULL DEFAULT true,

      assignee_user_id    uuid,
      assigned_by         uuid,
      assigned_at         timestamptz,
      -- Legacy alias retained so anything still selecting assigned_to keeps
      -- working; the canonical column is assignee_user_id.
      assigned_to         uuid,

      due_at              timestamptz,
      started_at          timestamptz,
      completed_at        timestamptz,
      completed_by        uuid,

      estimated_minutes   integer,
      actual_minutes      integer,
      progress_percentage integer NOT NULL DEFAULT 0,

      photo_media_ids     text[] NOT NULL DEFAULT '{}'::text[],
      labels              text[] NOT NULL DEFAULT '{}'::text[],
      dependencies        jsonb,
      metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,

      -- Offline conflict handling. See app.bump_version().
      version             integer NOT NULL DEFAULT 1,
      client_generated_id text,

      created_by          uuid,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT job_tasks_status_check
        CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed', 'skipped')),
      CONSTRAINT job_tasks_priority_check
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      CONSTRAINT job_tasks_progress_check
        CHECK (progress_percentage BETWEEN 0 AND 100),
      -- A task that requires a photo cannot be completed without one.
      --
      -- cardinality(), NOT array_length(x, 1). photo_media_ids defaults to
      -- '{}'::text[] and array_length('{}'::text[], 1) returns NULL, not 0.
      -- For the exact case this constraint exists to block — completed,
      -- requires_photo, no photos — the old expression evaluated to
      -- FALSE OR FALSE OR NULL = NULL, and a CHECK that evaluates to NULL is
      -- SATISFIED. The constraint never once fired. cardinality('{}') is 0.
      CONSTRAINT job_tasks_photo_required_check
        CHECK (status <> 'completed'
               OR NOT requires_photo
               OR cardinality(photo_media_ids) >= 1)
    )
  $ddl$;

  IF n_dropped > 0 THEN
    n_rebuilt := app.w0_restore_views('{}'::jsonb);
    RAISE NOTICE 'W0/04: rebuilt % view(s)', n_rebuilt;
    IF n_dropped <> n_rebuilt THEN
      RAISE EXCEPTION 'W0/04: dropped % views but rebuilt % — aborting',
                      n_dropped, n_rebuilt;
    END IF;
  END IF;
END $$;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM app.w0_view_stash;
  IF n > 0 THEN
    RAISE EXCEPTION 'W0/04: % view(s) still un-restored in app.w0_view_stash', n;
  END IF;
END $$;

-- Repair path for a database that already applied an earlier cut of this file.
-- The rebuild above is skipped once `requires_photo` exists, so the two defects
-- fixed inside the CREATE TABLE (the NULL-valued photo CHECK and the missing
-- job_id FK) would otherwise survive on any database that ran the old version.
DO $$
DECLARE v_def text;
BEGIN
  IF to_regclass('public.job_tasks') IS NULL THEN RETURN; END IF;

  -- 1. The photo CHECK. Replace it if it still uses array_length().
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.job_tasks'::regclass
     AND conname  = 'job_tasks_photo_required_check';

  IF v_def IS NOT NULL AND v_def ILIKE '%array_length%' THEN
    ALTER TABLE public.job_tasks DROP CONSTRAINT job_tasks_photo_required_check;
    v_def := NULL;
  END IF;

  IF v_def IS NULL THEN
    ALTER TABLE public.job_tasks
      ADD CONSTRAINT job_tasks_photo_required_check
      CHECK (status <> 'completed'
             OR NOT requires_photo
             OR cardinality(photo_media_ids) >= 1)
      NOT VALID;
    -- Zero rows today, so validation is instant; do it explicitly so the
    -- constraint is not left in "not valid" limbo.
    ALTER TABLE public.job_tasks VALIDATE CONSTRAINT job_tasks_photo_required_check;
    RAISE NOTICE 'W0/04: job_tasks_photo_required_check rebuilt with cardinality()';
  END IF;

  -- 2. The single-column job FK.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.conrelid  = 'public.job_tasks'::regclass
       AND c.contype   = 'f'
       AND c.confrelid = 'public.jobs'::regclass
       AND a.attname   = 'job_id'
       AND array_length(c.conkey, 1) = 1
  ) THEN
    ALTER TABLE public.job_tasks
      ADD CONSTRAINT job_tasks_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs (id) ON DELETE CASCADE
      NOT VALID;
    ALTER TABLE public.job_tasks VALIDATE CONSTRAINT job_tasks_job_id_fkey;
    RAISE NOTICE 'W0/04: restored the single-column job_tasks -> jobs FK';
  END IF;
END $$;

COMMENT ON TABLE public.job_tasks IS
  'Office-side, per-item, assignable task list for a job. NOT the mobile '
  'checklist blob — that is job_field_state.tasks, written by '
  'mobile/src/lib/tasks-store.ts. Reconciling the two is a follow-up.';

COMMENT ON COLUMN public.job_tasks.status IS
  'TEXT, and MUST remain text containing the literal ''completed'': the view '
  'project_activity_summary counts FILTER (WHERE pt.status = ''completed''). '
  'Converting this to an enum, or renaming ''completed'' to ''done'', '
  'silently zeroes that counter.';

COMMENT ON COLUMN public.job_tasks.assignee_user_id IS
  'Canonical assignee — an auth.users id. The old `assigned_to` column is '
  'kept as an unenforced alias for anything still reading it; new code writes '
  'assignee_user_id only.';

COMMENT ON COLUMN public.job_tasks.version IS
  'Optimistic lock for offline devices. The trigger job_tasks_bump_version '
  'raises 40001 (serialization_failure) if a client writes back a version '
  'older than the stored one. Clients that omit the column are unaffected.';

COMMENT ON COLUMN public.job_tasks.photo_media_ids IS
  'TEXT[], not uuid[]: the mobile client identifies photos by MediaItem.id, '
  'which is a job_media uuid for synced photos but a local string '
  '(local-*, m-*) for photos captured but not yet uploaded.';

COMMENT ON COLUMN public.job_tasks.client_generated_id IS
  'The id the device minted while offline. Lets a retry of an upload that '
  'already succeeded be recognised instead of duplicating the task.';

CREATE INDEX IF NOT EXISTS job_tasks_job_id_idx        ON public.job_tasks (job_id, position);
CREATE INDEX IF NOT EXISTS job_tasks_company_id_idx    ON public.job_tasks (company_id);
CREATE INDEX IF NOT EXISTS job_tasks_checklist_id_idx  ON public.job_tasks (checklist_id, position);
CREATE INDEX IF NOT EXISTS job_tasks_assignee_idx      ON public.job_tasks (assignee_user_id)
  WHERE assignee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_tasks_status_idx        ON public.job_tasks (status);
CREATE INDEX IF NOT EXISTS job_tasks_due_at_idx        ON public.job_tasks (due_at)
  WHERE due_at IS NOT NULL AND status <> 'completed';

CREATE UNIQUE INDEX IF NOT EXISTS job_tasks_client_generated_id_key
  ON public.job_tasks (job_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 5. Triggers.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS job_tasks_touch_updated_at ON public.job_tasks;
CREATE TRIGGER job_tasks_touch_updated_at
  BEFORE UPDATE ON public.job_tasks
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS job_tasks_bump_version ON public.job_tasks;
CREATE TRIGGER job_tasks_bump_version
  BEFORE UPDATE ON public.job_tasks
  FOR EACH ROW EXECUTE FUNCTION app.bump_version();

-- Keep the completion timestamp honest without making the client remember it.
CREATE OR REPLACE FUNCTION app.job_tasks_stamp_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND coalesce(OLD.status, '') <> 'completed' THEN
    NEW.completed_at := coalesce(NEW.completed_at, now());
    NEW.progress_percentage := 100;
  ELSIF NEW.status <> 'completed' AND coalesce(OLD.status, '') = 'completed' THEN
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;

  IF NEW.assignee_user_id IS DISTINCT FROM coalesce(OLD.assignee_user_id, NULL)
     AND NEW.assignee_user_id IS NOT NULL THEN
    NEW.assigned_at := coalesce(NEW.assigned_at, now());
  END IF;

  -- Keep the legacy alias in step for anything still reading assigned_to.
  IF NEW.assignee_user_id IS NOT NULL THEN
    NEW.assigned_to := NEW.assignee_user_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS job_tasks_stamp_completion ON public.job_tasks;
CREATE TRIGGER job_tasks_stamp_completion
  BEFORE INSERT OR UPDATE ON public.job_tasks
  FOR EACH ROW EXECUTE FUNCTION app.job_tasks_stamp_completion();

DROP TRIGGER IF EXISTS checklist_templates_touch_updated_at ON public.checklist_templates;
CREATE TRIGGER checklist_templates_touch_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS checklist_template_items_touch_updated_at ON public.checklist_template_items;
CREATE TRIGGER checklist_template_items_touch_updated_at
  BEFORE UPDATE ON public.checklist_template_items
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS job_checklists_touch_updated_at ON public.job_checklists;
CREATE TRIGGER job_checklists_touch_updated_at
  BEFORE UPDATE ON public.job_checklists
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();


-- ---------------------------------------------------------------------
-- 6. Instantiate a template onto a job.
--
--    In SQL rather than the client so the whole thing is one transaction: a
--    half-applied checklist is worse than none.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_checklist_template(
  p_job_id      uuid,
  p_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tpl        record;
  v_company    uuid;
  v_checklist  uuid;
BEGIN
  SELECT * INTO v_tpl FROM public.checklist_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checklist template % not found', p_template_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Read company_id through to_jsonb, not as a column reference.
  --
  -- jobs.company_id does not exist until W0/08, and plpgsql plans a statement
  -- on first execution — so a direct `SELECT j.company_id` would make every
  -- call to this RPC raise 42703 "column j.company_id does not exist" in the
  -- window between applying W0/04 and applying W0/08. The function is granted
  -- to `authenticated` at creation time, so it is callable as a PostgREST RPC
  -- immediately. app.jobs_log_status_change() already reads it this way.
  SELECT nullif(to_jsonb(j) ->> 'company_id', '')::uuid
    INTO v_company
    FROM public.jobs j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.job_checklists
    (job_id, company_id, template_id, template_version, name, status)
  VALUES
    (p_job_id, v_company, p_template_id, v_tpl.version, v_tpl.name, 'open')
  RETURNING id INTO v_checklist;

  INSERT INTO public.job_tasks
    (job_id, company_id, checklist_id, template_item_id,
     title, description, position, requires_photo, is_required, estimated_minutes)
  SELECT p_job_id, v_company, v_checklist, i.id,
         i.title, i.description, i.position, i.requires_photo, i.is_required,
         i.estimated_minutes
    FROM public.checklist_template_items i
   WHERE i.template_id = p_template_id
   ORDER BY i.position, i.created_at;

  RETURN v_checklist;
END $$;

COMMENT ON FUNCTION public.apply_checklist_template(uuid, uuid) IS
  'Creates a job_checklists instance plus one job_tasks row per template '
  'item, in a single transaction. Returns the new checklist id. '
  'SECURITY INVOKER: the caller''s RLS applies, so a member of one company '
  'cannot instantiate onto another company''s job.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.apply_checklist_template(uuid, uuid) TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7. Close these tables to `anon` the moment they exist.
--
--    Supabase's default privileges grant anon arwdDxtm on every new table in
--    schema public, and the lockdown migration 20260727000000 revokes only
--    the WRITE half — SELECT survives (verified in pg_default_acl). W0/00 now
--    revokes the default too, but that only helps if W0/00's ALTER DEFAULT
--    PRIVILEGES succeeded for the role that actually creates these tables.
--    This is the belt to that migration's braces: after it, a checklist
--    template is not readable with the anon key that ships in the app bundle,
--    regardless of when W0/10 finally lands.
-- ---------------------------------------------------------------------
SELECT app.w0_revoke_anon(ARRAY[
  'checklist_templates', 'checklist_template_items', 'job_checklists', 'job_tasks'
]);

INSERT INTO app.w0_series_log (step, detail)
VALUES ('04_job_tasks_rebuild_and_checklists',
        'job_tasks rebuilt (assignee_user_id, position, requires_photo, '
        'version, photo_media_ids; status kept TEXT with the literal '
        '''completed'' for project_activity_summary); checklist_templates, '
        'checklist_template_items and job_checklists created; '
        'apply_checklist_template() installed.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
