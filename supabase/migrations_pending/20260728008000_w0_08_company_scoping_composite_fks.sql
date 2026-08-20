-- =====================================================================
-- W0 / 08 — Multi-tenancy: company_id everywhere, and composite foreign keys
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   RLS on its own is not tenant isolation. A policy that says
--     USING (company_id = ANY (app.current_company_ids()))
--   stops you READING another company's rows. It does not stop you WRITING a
--   row that claims to belong to your company while pointing at another
--   company's job:
--
--     INSERT INTO job_media (job_id, company_id)
--     VALUES ('<their job>', '<my company>');   -- passes a WITH CHECK on company_id
--
--   The photo is now attached to their job. Their gallery shows it. A simple
--   FK on job_id does not help either — the job exists, so it passes.
--
--   The fix is a COMPOSITE foreign key:
--     FOREIGN KEY (job_id, company_id) REFERENCES jobs (id, company_id)
--   which requires the pair to match. Attaching to another company's job is
--   then physically impossible, regardless of what RLS says, and regardless
--   of a bug in a policy. That is what this migration builds.
--
-- ============ WHY THE NULLS ARE FINE (AND NECESSARY) ============
--   Every company_id starts NULL. A composite FK uses MATCH SIMPLE by
--   default, which is satisfied whenever ANY referencing column is NULL. So
--   every one of these constraints is added, validated, and inert until the
--   backfill assigns companies — and it stays inert for any row that is still
--   unassigned. That is exactly the property needed to add real integrity to
--   a live database without a maintenance window.
--
--   The trade-off is stated plainly: until W0/10 refuses to enable RLS while
--   any company_id is NULL, these constraints protect nothing. They are the
--   mechanism; the backfill and W0/10's precondition check are the enforcement.
-- ================================================================
--
-- ============ CONSTRAINT NAMES DO NOT MATCH TABLE NAMES ============
--   The tables were renamed from project*/projects to job*/jobs but the
--   constraints were NOT. The real names are projects_business_id_fkey,
--   projects_client_id_fkey, project_media_project_id_fkey,
--   project_documents_project_id_fkey, project_photos_project_id_fkey,
--   project_tasks_project_id_fkey, and so on. A migration written as
--     ALTER TABLE jobs DROP CONSTRAINT jobs_client_id_fkey
--   fails with 42704. This file never guesses a constraint name: it queries
--   pg_constraint by column and referenced table. It also does not drop any
--   of the existing single-column FKs — they are harmless and dropping them
--   is a separate, reviewable decision.
-- ===================================================================
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 through W0/07 have all run. Every table named in app.w0_scope
--     that this file touches must already exist; ones that do not are skipped
--     with a NOTICE rather than failing.
--   * Every company_id is currently NULL, so nothing existing can violate
--     a new constraint.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Before W0/05 or W0/06: the tables created there are silently skipped and
--     end up with no company_id, and W0/10's precondition check will then
--     fail. Re-run this file after them; it is idempotent.
--   After W0/10: pointless — RLS would already be live against columns this
--     file had not yet created. W0/10 checks for that and refuses.
--
-- SAFETY: additive only. Adds nullable columns, unique indexes on
--   (id, company_id) pairs that are already unique by virtue of the primary
--   key, and NOT VALID -> VALIDATE foreign keys that no current row violates.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Add company_id to every table in scope that lacks it.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t record;
  n_added   integer := 0;
  n_skipped integer := 0;
BEGIN
  FOR t IN
    SELECT table_name FROM app.w0_scope
     WHERE company_scoped AND table_name <> 'companies'
     ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      RAISE NOTICE 'W0/08: public.% does not exist — SKIPPED. Apply the '
                   'migration that creates it, then re-run this file.',
                   t.table_name;
      n_skipped := n_skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid',
      t.table_name);

    -- Every company_id points at the tenant root.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid  = ('public.' || quote_ident(t.table_name))::regclass
         AND c.contype   = 'f'
         AND c.confrelid = 'public.companies'::regclass
         AND array_length(c.conkey, 1) = 1
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I '
        'FOREIGN KEY (company_id) REFERENCES public.companies (id) '
        'ON DELETE RESTRICT NOT VALID',
        t.table_name, t.table_name || '_company_id_fkey');
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
                     t.table_name, t.table_name || '_company_id_fkey');
    END IF;

    -- Requirement: a btree index on EVERY company_id. Every RLS policy in
    -- W0/10 filters on this column, so without the index every policy check
    -- is a sequential scan.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)',
      t.table_name || '_company_id_idx', t.table_name);

    n_added := n_added + 1;
  END LOOP;

  RAISE NOTICE 'W0/08: company_id ensured on % table(s), % skipped as missing',
               n_added, n_skipped;
END $$;


-- ---------------------------------------------------------------------
-- 2. Parent-side unique constraints.
--
--    A composite FK needs a UNIQUE constraint on the referenced pair. These
--    are trivially satisfied — id is already the primary key, so (id, X) is
--    unique for any X — but PostgreSQL requires the constraint to exist
--    before it will accept the reference.
--
--    Must be a table CONSTRAINT, not just a unique INDEX: a foreign key can
--    reference a unique index in modern PostgreSQL, but declaring it as a
--    constraint keeps pg_dump output and error messages legible.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  parents text[] := ARRAY['jobs', 'clients', 'businesses',
                          'job_media', 'checklist_templates', 'job_checklists',
                          'social_media_posts', 'companies'];
  p text;
BEGIN
  FOREACH p IN ARRAY parents LOOP
    IF to_regclass('public.' || quote_ident(p)) IS NULL THEN
      RAISE NOTICE 'W0/08: parent public.% missing — skipped', p;
      CONTINUE;
    END IF;

    -- companies is its own tenant; (id, id) makes no sense.
    IF p = 'companies' THEN CONTINUE; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = ('public.' || quote_ident(p))::regclass
         AND conname  = p || '_id_company_id_key'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, company_id)',
        p, p || '_id_company_id_key');
      RAISE NOTICE 'W0/08: added UNIQUE (id, company_id) on public.%', p;
    END IF;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 3. The composite foreign keys. This is the actual isolation guarantee.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t        record;
  fk_name  text;
  n_added  integer := 0;
BEGIN
  FOR t IN
    SELECT table_name, job_key
      FROM app.w0_scope
     WHERE company_scoped
       AND job_key IS NOT NULL
       AND job_key_is_uuid          -- job_field_state is TEXT; excluded by design
       AND table_name <> 'jobs'
     ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      RAISE NOTICE 'W0/08: public.% missing — composite FK skipped', t.table_name;
      CONTINUE;
    END IF;

    fk_name := t.table_name || '_job_company_fkey';

    IF EXISTS (SELECT 1 FROM pg_constraint
                WHERE conrelid = ('public.' || quote_ident(t.table_name))::regclass
                  AND conname = fk_name) THEN
      CONTINUE;
    END IF;

    -- ON DELETE CASCADE matches the existing single-column FKs on these
    -- tables (project_media_project_id_fkey et al are all CASCADE), so
    -- deleting a job still cleans up its children exactly as it does today.
    --
    -- ON UPDATE CASCADE is required, not decorative. The referenced key is
    -- (jobs.id, jobs.company_id), and company_id is a MUTABLE column: any
    -- operation that re-homes a job to another tenant — the W0/08 backfill
    -- itself, a correction, a future merge — is an UPDATE of the parent key.
    -- With the default NO ACTION, that UPDATE is rejected the moment the job
    -- has any child row, and the failure surfaces as a bare 23503 pointing at
    -- a constraint the operator did not know was involved.
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I '
      'FOREIGN KEY (%I, company_id) REFERENCES public.jobs (id, company_id) '
      'ON UPDATE CASCADE ON DELETE CASCADE NOT VALID',
      t.table_name, fk_name, t.job_key);

    -- Validation succeeds today because every company_id is NULL and
    -- MATCH SIMPLE treats a partially-NULL key as satisfied.
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
                   t.table_name, fk_name);

    RAISE NOTICE 'W0/08: added composite FK %(%, company_id) -> jobs(id, company_id)',
                 t.table_name, t.job_key;
    n_added := n_added + 1;
  END LOOP;

  RAISE NOTICE 'W0/08: % composite job FK(s) added', n_added;
END $$;

-- jobs -> clients, same trick: a job cannot be attached to another company's
-- customer.
--
-- ============ WHY THE COLUMN LIST AFTER SET NULL IS LOAD-BEARING ============
--   `ON DELETE SET NULL` on a MULTI-COLUMN foreign key sets EVERY referencing
--   column to NULL, not just the one you meant. Written without a column list,
--   deleting a client would set jobs.company_id = NULL on all of that client's
--   jobs, which is a two-headed disaster:
--     (a) if those jobs have children (job_media, job_notes, job_tasks,
--         job_events...), the implied UPDATE of jobs.company_id is a change to
--         the parent key of every composite child FK, and
--         DELETE FROM clients aborts with 23503;
--     (b) if a job has no children, its company_id silently becomes NULL, it
--         disappears from every RLS-filtered query, and it violates the
--         no-NULL-company invariant W0/10 depends on.
--   PostgreSQL 15+ accepts a column list (this database is 17.4). Name the one
--   column that should actually be nulled.
-- ===========================================================================
DO $$
DECLARE v_def text;
BEGIN
  -- Repair path: an earlier cut of this file created these without the column
  -- list, so an already-migrated database must have them replaced, not skipped.
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.jobs'::regclass AND conname = 'jobs_client_company_fkey';
  IF v_def IS NOT NULL AND v_def NOT ILIKE '%SET NULL (client_id)%' THEN
    ALTER TABLE public.jobs DROP CONSTRAINT jobs_client_company_fkey;
    RAISE NOTICE 'W0/08: replacing jobs_client_company_fkey — its ON DELETE '
                 'SET NULL had no column list and would have nulled company_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.jobs'::regclass
                    AND conname = 'jobs_client_company_fkey') THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_client_company_fkey
      FOREIGN KEY (client_id, company_id)
      REFERENCES public.clients (id, company_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL (client_id) NOT VALID;
    ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_client_company_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.jobs'::regclass
                    AND conname = 'jobs_business_company_fkey') THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_business_company_fkey
      FOREIGN KEY (business_id, company_id)
      REFERENCES public.businesses (id, company_id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT NOT VALID;
    ALTER TABLE public.jobs VALIDATE CONSTRAINT jobs_business_company_fkey;
  END IF;
END $$;

-- checklist items -> their template, scoped.
DO $$
DECLARE v_def text;
BEGIN
  IF to_regclass('public.checklist_template_items') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conrelid = 'public.checklist_template_items'::regclass
                        AND conname = 'checklist_template_items_template_company_fkey') THEN
    ALTER TABLE public.checklist_template_items
      ADD CONSTRAINT checklist_template_items_template_company_fkey
      FOREIGN KEY (template_id, company_id)
      REFERENCES public.checklist_templates (id, company_id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.checklist_template_items
      VALIDATE CONSTRAINT checklist_template_items_template_company_fkey;
  END IF;

  IF to_regclass('public.job_tasks') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                      WHERE conrelid = 'public.job_tasks'::regclass
                        AND conname = 'job_tasks_checklist_company_fkey') THEN
    ALTER TABLE public.job_tasks
      ADD CONSTRAINT job_tasks_checklist_company_fkey
      FOREIGN KEY (checklist_id, company_id)
      REFERENCES public.job_checklists (id, company_id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.job_tasks
      VALIDATE CONSTRAINT job_tasks_checklist_company_fkey;
  END IF;

  -- Same SET NULL column-list issue as jobs_client_company_fkey above: without
  -- the list, deleting a social_media_posts row would null out
  -- publish_records.company_id as well as post_id, stripping the tenant from
  -- the delivery record.
  IF to_regclass('public.publish_records') IS NOT NULL THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
      FROM pg_constraint
     WHERE conrelid = 'public.publish_records'::regclass
       AND conname  = 'publish_records_post_company_fkey';
    IF v_def IS NOT NULL AND v_def NOT ILIKE '%SET NULL (post_id)%' THEN
      ALTER TABLE public.publish_records
        DROP CONSTRAINT publish_records_post_company_fkey;
      RAISE NOTICE 'W0/08: replacing publish_records_post_company_fkey — its '
                   'ON DELETE SET NULL had no column list';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.publish_records'::regclass
                      AND conname = 'publish_records_post_company_fkey') THEN
      ALTER TABLE public.publish_records
        ADD CONSTRAINT publish_records_post_company_fkey
        FOREIGN KEY (post_id, company_id)
        REFERENCES public.social_media_posts (id, company_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL (post_id) NOT VALID;
      ALTER TABLE public.publish_records
        VALIDATE CONSTRAINT publish_records_post_company_fkey;
    END IF;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 4. Backfill, in dependency order, from the one place tenancy is known:
--    businesses.company_id, which a human sets by hand per W0/01 §8.
--
--    If nobody has done that yet, every step below is a no-op and the file
--    still succeeds — it just tells you what is left to do.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n_biz      bigint;
  n          bigint;
  total      bigint := 0;
BEGIN
  SELECT count(*) INTO n_biz FROM public.businesses WHERE company_id IS NOT NULL;

  IF n_biz = 0 THEN
    RAISE NOTICE '===============================================================';
    RAISE NOTICE 'W0/08: NO businesses row has a company_id, so nothing can be';
    RAISE NOTICE '       backfilled. This is not an error — it means the tenant';
    RAISE NOTICE '       bootstrap in W0/01 section 8 has not been run yet.';
    RAISE NOTICE '       Create a company, set businesses.company_id, then';
    RAISE NOTICE '       RE-RUN THIS FILE. It is idempotent.';
    RAISE NOTICE '       W0/10 will refuse to enable RLS until this is done.';
    RAISE NOTICE '===============================================================';
    RETURN;
  END IF;

  -- PARENTS BEFORE CHILDREN. This order is not cosmetic.
  --
  -- Section 3 above added and VALIDATEd jobs_client_company_fkey
  --   (client_id, company_id) -> clients (id, company_id)
  -- If jobs were stamped first, any job with a client_id would become
  -- (client_id = X, company_id = C) while clients.company_id was still NULL.
  -- MATCH SIMPLE then requires a clients row with that exact PAIR, none
  -- exists, and the UPDATE aborts the whole DO block with 23503. It does not
  -- fire on today's data only by luck: all 9 live jobs have client_id NULL.
  -- The moment the app links a job to a client, re-running W0/08 would break.
  -- So: clients first, then review_requests, then jobs, then job children.

  -- clients from their business
  UPDATE public.clients c SET company_id = b.company_id
    FROM public.businesses b
   WHERE c.business_id = b.id AND c.company_id IS NULL AND b.company_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
  RAISE NOTICE 'W0/08: clients backfilled: %', n;

  -- review_requests from their business
  UPDATE public.review_requests r SET company_id = b.company_id
    FROM public.businesses b
   WHERE r.business_id = b.id AND r.company_id IS NULL AND b.company_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
  RAISE NOTICE 'W0/08: review_requests backfilled: %', n;

  -- jobs from their business (AFTER clients, see above)
  UPDATE public.jobs j SET company_id = b.company_id
    FROM public.businesses b
   WHERE j.business_id = b.id AND j.company_id IS NULL AND b.company_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
  RAISE NOTICE 'W0/08: jobs backfilled: %', n;

  -- jobs that carry no business but do carry a client, from the client
  UPDATE public.jobs j SET company_id = c.company_id
    FROM public.clients c
   WHERE j.client_id = c.id AND j.company_id IS NULL AND c.company_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
  IF n > 0 THEN RAISE NOTICE 'W0/08: jobs backfilled via client: %', n; END IF;

  -- Everything hanging off a job, from the job. Nested block so the loop
  -- variable is scoped to it.
  DECLARE t record;
  BEGIN
    FOR t IN
      SELECT table_name, job_key FROM app.w0_scope
       WHERE company_scoped AND job_key IS NOT NULL AND job_key_is_uuid
         AND table_name <> 'jobs'
       ORDER BY table_name
    LOOP
      IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
        CONTINUE;
      END IF;
      EXECUTE format(
        'UPDATE public.%I c SET company_id = j.company_id '
        '  FROM public.jobs j '
        ' WHERE c.%I = j.id AND c.company_id IS NULL AND j.company_id IS NOT NULL',
        t.table_name, t.job_key);
      GET DIAGNOSTICS n = ROW_COUNT;
      total := total + n;
      IF n > 0 THEN
        RAISE NOTICE 'W0/08: % backfilled: %', t.table_name, n;
      END IF;
    END LOOP;
  END;

  -- job_field_state: job_id is TEXT, so cast the JOB side to text rather than
  -- the state side to uuid. Casting 'demo-123'::uuid raises 22P02.
  IF to_regclass('public.job_field_state') IS NOT NULL THEN
    UPDATE public.job_field_state s SET company_id = j.company_id
      FROM public.jobs j
     WHERE s.job_id = j.id::text
       AND s.company_id IS NULL AND j.company_id IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    RAISE NOTICE 'W0/08: job_field_state backfilled: %', n;
  END IF;

  -- media_comments: media_id is TEXT; only rows whose media_id is a real
  -- job_media uuid can be resolved. Join via the denormalised job_id the
  -- W0/05 trigger populates, and fall back to a guarded uuid comparison that
  -- filters on the text form so no cast is ever attempted on a local id.
  IF to_regclass('public.media_comments') IS NOT NULL THEN
    UPDATE public.media_comments mc SET company_id = m.company_id, job_id = m.job_id
      FROM public.job_media m
     WHERE mc.media_id = m.id::text
       AND mc.company_id IS NULL AND m.company_id IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    RAISE NOTICE 'W0/08: media_comments backfilled: %', n;
  END IF;

  -- company_members already carries company_id by construction.

  RAISE NOTICE 'W0/08: % row(s) assigned to a company in total', total;
END $$;


-- ---------------------------------------------------------------------
-- 4b. THE ORPHAN PASS. Without this, W0/10 is unreachable forever.
--
--   The joins above can only assign a row that has a resolvable parent. Some
--   live rows do not, and no number of re-runs will change that. Verified
--   against the live database:
--     * public.clients has 1 row and its business_id IS NULL
--     * public.job_documents has 2 rows and 1 of them has job_id IS NULL
--   Neither can ever match its join, so both keep company_id NULL, and W0/10
--   section 0 step 5 then raises "N row(s) still have company_id IS NULL"
--   forever. The remediation W0/10 prints ("set businesses.company_id and
--   re-run W0/08") does not fix either row. The interlock is correct; the
--   migration simply left no path past it.
--
--   Two further permanent sources of unresolvable rows, by design:
--     * job_field_state.job_id is TEXT and tasks-store.ts pushTasks() upserts
--       with NO uuid guard, so demo-* ids reach the table
--     * media_comments.media_id is TEXT and holds local-*/m-* ids
--
--   So: when there is EXACTLY ONE company, there is no ambiguity about who
--   owns an orphan, and it is stamped. When there is more than one, nothing is
--   guessed — every orphan is written to app.w0_backfill_report with outcome
--   'ambiguous' AND the exact UPDATE statement an operator must run, named row
--   by row rather than as a table-level count.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t          record;
  n_comp     bigint;
  v_company  uuid;
  n          bigint;
  total      bigint := 0;
  n_ambig    bigint := 0;
  v_pk       text;
BEGIN
  DELETE FROM app.w0_backfill_report WHERE step = '08_orphan_company_assignment';

  SELECT count(*) INTO n_comp FROM public.companies;
  IF n_comp = 0 THEN
    RAISE NOTICE 'W0/08 §4b: no company exists yet — orphan pass skipped.';
    RETURN;
  END IF;

  IF n_comp = 1 THEN
    SELECT id INTO v_company FROM public.companies;
  END IF;

  -- PARENTS BEFORE CHILDREN, again, and for the same reason as section 4.
  -- Plain alphabetical order would stamp job_media (company C) while
  -- jobs.company_id was still NULL, and the composite FK
  --   job_media (job_id, company_id) -> jobs (id, company_id)
  -- requires the PAIR to exist — so the UPDATE would abort with 23503. Note
  -- that 'job_*' sorts BEFORE 'jobs', so alphabetical is exactly backwards
  -- here. The ranks below follow app.w0_scope.parent_table.
  FOR t IN
    SELECT table_name,
           CASE table_name
             WHEN 'businesses'               THEN 0
             WHEN 'checklist_templates'      THEN 0
             WHEN 'clients'                  THEN 1
             WHEN 'review_requests'          THEN 1
             WHEN 'checklist_template_items' THEN 1
             WHEN 'jobs'                     THEN 2
             -- job children, and the parents among them
             WHEN 'job_checklists'           THEN 3
             WHEN 'social_media_posts'       THEN 3
             WHEN 'job_media'                THEN 3
             -- children of the row above
             WHEN 'job_tasks'                THEN 4
             WHEN 'publish_records'          THEN 4
             WHEN 'media_comments'           THEN 4
             ELSE 3
           END AS rank
      FROM app.w0_scope
     WHERE company_scoped AND table_name NOT IN ('companies', 'company_members')
     ORDER BY rank, table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    -- Name the row the way the table keys itself, so the report is actionable.
    SELECT a.attname INTO v_pk
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.conrelid = ('public.' || quote_ident(t.table_name))::regclass
       AND c.contype = 'p'
     LIMIT 1;
    v_pk := coalesce(v_pk, 'id');

    IF v_company IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET company_id = $1 WHERE company_id IS NULL',
                     t.table_name) USING v_company;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        total := total + n;
        INSERT INTO app.w0_backfill_report (step, table_name, row_id, outcome, detail)
        VALUES ('08_orphan_company_assignment', t.table_name, NULL, 'applied',
                format('%s row(s) had no resolvable parent and were assigned to '
                       'the only company that exists (%s).', n, v_company));
        RAISE NOTICE 'W0/08 §4b: % — % orphan row(s) assigned to the sole company',
                     t.table_name, n;
      END IF;
    ELSE
      -- More than one tenant: refuse to guess. Report each row by key.
      EXECUTE format(
        'INSERT INTO app.w0_backfill_report '
        '  (step, table_name, row_id, outcome, detail) '
        'SELECT ''08_orphan_company_assignment'', %L, x.%I::text, ''ambiguous'', '
        '       format(''No resolvable parent and %%s companies exist — NOT '
        '                guessed. Fix by hand: UPDATE public.%I SET company_id '
        '                = ''''<company uuid>'''' WHERE %I = ''''%%s'''';'', '
        '              (SELECT count(*) FROM public.companies), x.%I::text) '
        '  FROM public.%I x WHERE x.company_id IS NULL',
        t.table_name, v_pk, t.table_name, v_pk, v_pk, t.table_name);
      GET DIAGNOSTICS n = ROW_COUNT;
      n_ambig := n_ambig + n;
      IF n > 0 THEN
        RAISE WARNING 'W0/08 §4b: public.% has % unassignable row(s) and % '
                      'companies exist — NOT guessed. See '
                      'app.w0_backfill_report WHERE step = '
                      '''08_orphan_company_assignment''.',
                      t.table_name, n, n_comp;
      END IF;
    END IF;
  END LOOP;

  IF total > 0 THEN
    RAISE NOTICE 'W0/08 §4b: % orphan row(s) assigned to the sole company', total;
  END IF;

  IF n_ambig > 0 THEN
    RAISE WARNING '===============================================================';
    RAISE WARNING 'W0/08 4b: % row(s) could not be assigned automatically because', n_ambig;
    RAISE WARNING '  more than one company exists. W0/10 WILL REFUSE TO RUN until';
    RAISE WARNING '  they are resolved. Each one, with the exact UPDATE to run:';
    RAISE WARNING '    SELECT table_name, row_id, detail';
    RAISE WARNING '      FROM app.w0_backfill_report';
    RAISE WARNING '     WHERE step = ''08_orphan_company_assignment''';
    RAISE WARNING '       AND outcome = ''ambiguous'';';
    RAISE WARNING '===============================================================';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 5. Tell the operator exactly what is still unassigned.
--    W0/10 will refuse to run while any of these are non-zero.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t     record;
  n     bigint;
  total bigint := 0;
BEGIN
  FOR t IN
    SELECT table_name FROM app.w0_scope
     WHERE company_scoped AND table_name <> 'companies'
     ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL',
                   t.table_name) INTO n;
    IF n > 0 THEN
      RAISE NOTICE 'W0/08 UNASSIGNED: public.% has % row(s) with company_id IS NULL',
                   t.table_name, n;
      total := total + n;
    END IF;
  END LOOP;

  IF total = 0 THEN
    RAISE NOTICE 'W0/08: every in-scope row is assigned to a company. '
                 'W0/10 preconditions satisfied on this front.';
  ELSE
    RAISE NOTICE 'W0/08: % row(s) still unassigned. W0/10 WILL REFUSE TO RUN '
                 'until this reaches zero — that refusal is the safety net '
                 'against an RLS blackout.', total;
  END IF;
END $$;

-- =====================================================================
-- 6. STAMP company_id ON WRITE. Without this, W0/10 bricks the product.
--
-- ============ THE PROBLEM, STATED PLAINLY ============
--   W0/10 section 3 creates, for every in-scope table:
--     CREATE POLICY ... FOR INSERT TO authenticated
--       WITH CHECK (company_id = ANY (public.current_company_ids()))
--
--   Nothing anywhere fills company_id in. `grep -rn "company_id\|companyId"
--   mobile/src` returns ZERO hits — the shipped client never sends the column
--   on any insert. job_checkins gets {job_id, user_name, checked_in_at,
--   latitude, longitude}; job_notes gets {job_id, author_name, note};
--   media_comments gets {media_id, author_name, comment, mentions};
--   shared_galleries gets {token, job_id, job_title, business_name,
--   photo_urls}; social_media_posts gets publish.ts's fixed payload. None
--   carries company_id. And section 1 of THIS file adds the column as a bare
--   `ADD COLUMN IF NOT EXISTS company_id uuid` — no DEFAULT, no trigger.
--
--   So company_id is NULL on every client insert, `NULL = ANY (...)` is NULL,
--   WITH CHECK treats NULL as failure, and PostgREST returns 42501 "new row
--   violates row-level security policy" for every photo, check-in, note,
--   comment, share link, publish and job the app tries to create. The entire
--   write path dies on the day RLS is enabled.
--
--   W0/10's interlock cannot see this: it runs as the migration role and only
--   counts EXISTING rows. Worse, its by-hand verification list tested only
--   reads — so an operator could pass every documented check and still ship a
--   database nobody can write to.
--
-- ============ THE SHAPE OF THE FIX ============
--   THE TRIGGER PROPOSES; THE POLICY STILL VERIFIES. This trigger only fills
--   company_id in when the caller left it NULL, and only from a parent row —
--   it never consults the caller's wishes. W0/10's WITH CHECK is left exactly
--   as it is, so a value resolved from another tenant's job is still rejected.
--   Two independent mechanisms, as everywhere else in this series.
--
--   It ALSO validates: when the caller DID supply a company_id and the parent
--   resolves to a different one, that is a cross-tenant write and it raises.
--   That closes the one hole the composite FKs cannot: job_field_state and
--   media_comments are TEXT-keyed, so W0/08 section 3 skips them, and their
--   tenant-global primary key would otherwise let a member of company A insert
--   a row for company B's job id — permanently wedging B's checklist sync,
--   because B's later upsert would hit a row B's UPDATE policy does not match.
-- =====================================================================
CREATE OR REPLACE FUNCTION app.stamp_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_table text := nullif(TG_ARGV[0], '');
  v_parent_key   text := nullif(TG_ARGV[1], '');
  v_child_col    text := nullif(TG_ARGV[2], '');
  v_child_uuid   boolean := coalesce(TG_ARGV[3], 'true') = 'true';
  v_child_val    text;
  v_parent_co    uuid;
  v_ids          uuid[];
BEGIN
  ------------------------------------------------------------------
  -- 1. Resolve the parent's company, if this table has a parent and the
  --    caller supplied the linking key.
  ------------------------------------------------------------------
  IF v_parent_table IS NOT NULL THEN
    v_child_val := to_jsonb(NEW) ->> v_child_col;

    IF nullif(btrim(coalesce(v_child_val, '')), '') IS NOT NULL THEN
      BEGIN
        IF v_child_uuid THEN
          EXECUTE format('SELECT p.company_id FROM public.%I p WHERE p.%I = $1::uuid',
                         v_parent_table, v_parent_key)
            INTO v_parent_co USING v_child_val;
        ELSE
          -- TEXT-keyed child (job_field_state.job_id, media_comments.media_id).
          -- Compare on the PARENT's text form; casting the child value to uuid
          -- would raise 22P02 on the local ids the client legitimately sends
          -- ('demo-*', 'local-*', 'm-*').
          EXECUTE format('SELECT p.company_id FROM public.%I p WHERE p.%I::text = $1',
                         v_parent_table, v_parent_key)
            INTO v_parent_co USING v_child_val;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- A malformed key must not break the write it is attached to. The
        -- WITH CHECK below is still the thing that decides.
        v_parent_co := NULL;
      END;
    END IF;
  END IF;

  ------------------------------------------------------------------
  -- 2. Caller supplied a company: verify it against the parent, never
  --    silently trust it. This is the guard for the TEXT-keyed tables that
  --    have no composite FK.
  ------------------------------------------------------------------
  IF NEW.company_id IS NOT NULL THEN
    IF v_parent_co IS NOT NULL AND v_parent_co <> NEW.company_id THEN
      RAISE EXCEPTION
        'cross-tenant write rejected on %.%: % = % belongs to company %, not %',
        TG_TABLE_SCHEMA, TG_TABLE_NAME, v_child_col, v_child_val,
        v_parent_co, NEW.company_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  ------------------------------------------------------------------
  -- 3. Caller left it NULL. Inherit from the parent.
  ------------------------------------------------------------------
  IF v_parent_co IS NOT NULL THEN
    NEW.company_id := v_parent_co;
    RETURN NEW;
  END IF;

  ------------------------------------------------------------------
  -- 4. No parent to inherit from (a new client with no business, a checklist
  --    template, a job_field_state row for a demo id). Fall back to the
  --    caller's membership — but ONLY when it is unambiguous. A user who
  --    belongs to two companies must say which one they meant; guessing would
  --    file a customer's job under the wrong tenant.
  ------------------------------------------------------------------
  v_ids := app.current_company_ids();
  IF array_length(v_ids, 1) = 1 THEN
    NEW.company_id := v_ids[1];
  END IF;

  -- Still NULL means the caller is anon, or is a member of several companies
  -- and named none. Leave it NULL: W0/10's WITH CHECK then rejects the row
  -- with a clear 42501 rather than filing it under a guess.
  RETURN NEW;
END $$;

COMMENT ON FUNCTION app.stamp_company_id() IS
  'BEFORE INSERT trigger that fills company_id from the parent row when the '
  'caller omits it (the shipped mobile client never sends it), and REJECTS '
  'the write when a supplied company_id disagrees with the parent. Attached '
  'via app.w0_scope''s parent_table/parent_key/parent_child_col mapping. '
  'SECURITY DEFINER so the parent lookup sees the real row rather than what '
  'RLS reveals — this grants no extra reach, because W0/10''s WITH CHECK '
  'still verifies the resulting company_id against the caller''s memberships.';


DO $$
DECLARE
  t record;
  n integer := 0;
BEGIN
  FOR t IN
    SELECT table_name, parent_table, parent_key, parent_child_col, parent_child_uuid
      FROM app.w0_scope
     WHERE company_scoped
       -- company_members supplies company_id explicitly and is the root of
       -- trust for membership; it must not inherit anything.
       AND table_name NOT IN ('companies', 'company_members')
     ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      RAISE NOTICE 'W0/08 §6: public.% missing — stamp trigger skipped', t.table_name;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                   'aa_stamp_company_id', t.table_name);

    -- aa_ prefix: BEFORE-row triggers fire in NAME order and this one must run
    -- before any other BEFORE trigger that reads NEW.company_id — notably
    -- media_comments' resolve-job trigger.
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION app.stamp_company_id(%L, %L, %L, %L)',
      'aa_stamp_company_id', t.table_name,
      coalesce(t.parent_table, ''), coalesce(t.parent_key, ''),
      coalesce(t.parent_child_col, ''),
      CASE WHEN t.parent_child_uuid THEN 'true' ELSE 'false' END);

    n := n + 1;
  END LOOP;

  RAISE NOTICE 'W0/08 §6: company_id stamping trigger installed on % table(s)', n;
END $$;


-- =====================================================================
-- 7. Unified search across jobs, media and customers.
--
--   W0/03 and W0/07 each build a search_body tsvector and a GIN index, but
--   nothing ever queried either: the app performs no server-side search at
--   all (gallery.tsx filters client-side), so both indexes were pure cost.
--   One RPC over both, company-scoped, makes them earn their keep and gives
--   one search box a single round trip.
--
--   SECURITY INVOKER (the default): the caller's RLS applies to every table
--   this reads, so it can never return another tenant's rows. The explicit
--   company filter is belt and braces for the pre-RLS window.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_everything(
  p_query text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  kind       text,
  id         text,
  job_id     uuid,
  title      text,
  subtitle   text,
  company_id uuid,
  rank       real
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT plainto_tsquery('english', coalesce(p_query, '')) AS ts,
           public.current_company_ids() AS ids
  )
  SELECT * FROM (
    SELECT 'job'::text, j.id::text, j.id, j.name,
           coalesce(j.city, j.client_contact ->> 'name'), j.company_id,
           ts_rank(j.search_body, q.ts)
      FROM public.jobs j, q
     WHERE j.company_id = ANY (q.ids)
       AND j.search_body @@ q.ts

    UNION ALL

    SELECT 'media'::text, m.id::text, m.job_id,
           coalesce(m.caption, m.original_name, 'Photo'),
           coalesce(m.job_title, m.client_name), m.company_id,
           ts_rank(m.search_body, q.ts)
      FROM public.job_media m, q
     WHERE m.company_id = ANY (q.ids)
       AND m.search_body @@ q.ts

    UNION ALL

    SELECT 'client'::text, c.id::text, NULL::uuid,
           coalesce(c.name, c.business_name), c.business_name, c.company_id,
           1.0::real
      FROM public.clients c, q
     WHERE c.company_id = ANY (q.ids)
       AND (c.name ILIKE '%' || p_query || '%'
            OR coalesce(c.business_name, '') ILIKE '%' || p_query || '%')
  ) hits (kind, id, job_id, title, subtitle, company_id, rank)
   WHERE nullif(btrim(coalesce(p_query, '')), '') IS NOT NULL
   ORDER BY rank DESC, title
   LIMIT greatest(1, least(coalesce(p_limit, 50), 500));
$$;

COMMENT ON FUNCTION public.search_everything(text, integer) IS
  'One search box over jobs, job_media and clients, scoped to the caller''s '
  'companies. Uses the search_body GIN indexes built in W0/03 and W0/07, '
  'which nothing else queries. SECURITY INVOKER, so RLS still applies.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.search_everything(text, integer) TO authenticated';
  END IF;
END $$;


-- =====================================================================
-- 8. public.job_activity — the union view the brief asked for.
--
--   W0/06 created job_events, and the ONLY thing that ever writes to it is
--   the jobs_log_status_change trigger. No photo, check-in, note, checklist
--   completion or publish produces a row, and nothing reads it: the client
--   already assembles the timeline in JS (job-activity-tab.tsx, which says
--   "There is no event table behind this and none is invented" and merges
--   media, checkins, notes, tasks and publishRecord itself). So job_events was
--   a table, four indexes and a trigger with no consumer.
--
--   Rather than drop it — status transitions are genuinely the events people
--   ask about, and nothing else records them — make it ONE SOURCE of the
--   union that was actually requested. The activity tab can then replace six
--   round trips and a JS merge with one ordered query.
--
--   ** security_invoker = true IS THE ENTIRE SECURITY PROPERTY OF THIS VIEW. **
--   A normal view executes with the privileges of its OWNER, which is the
--   migration role — so without this option the view would read every
--   underlying table with RLS bypassed and hand any authenticated caller the
--   complete activity feed of every tenant. PostgreSQL 15+ only; this
--   database is 17.4.
-- =====================================================================
DROP VIEW IF EXISTS public.job_activity;

CREATE VIEW public.job_activity
WITH (security_invoker = true) AS
  SELECT e.company_id,
         e.job_id,
         'event'::text                        AS source,
         e.event_type                         AS kind,
         e.id::text                           AS source_id,
         e.occurred_at                        AS occurred_at,
         e.actor_name                         AS actor_name,
         e.actor_user_id                      AS actor_user_id,
         coalesce(e.summary, e.event_type)    AS summary,
         e.payload                            AS payload
    FROM public.job_events e

  UNION ALL

  SELECT m.company_id, m.job_id, 'media', 'media.uploaded', m.id::text,
         coalesce(m.captured_at, m.uploaded_at, m.created_at),
         coalesce(m.uploaded_by_name, 'Team member'), m.uploaded_by,
         coalesce(m.caption, m.original_name, 'Photo added'),
         jsonb_build_object('file_path', m.file_path, 'tags', m.tags)
    FROM public.job_media m

  UNION ALL

  SELECT k.company_id, k.job_id, 'checkin',
         CASE WHEN k.checked_out_at IS NULL THEN 'checkin.open'
              ELSE 'checkin.closed' END,
         k.id::text,
         k.checked_in_at, k.user_name, k.user_id,
         CASE WHEN k.checked_out_at IS NULL
              THEN k.user_name || ' checked in'
              ELSE k.user_name || ' checked in and out' END,
         jsonb_build_object('latitude', k.latitude, 'longitude', k.longitude,
                            'checked_out_at', k.checked_out_at,
                            'clock_skew_seconds', k.clock_skew_seconds)
    FROM public.job_checkins k

  UNION ALL

  SELECT n.company_id, n.job_id, 'note', 'note.added', n.id::text,
         n.created_at, n.author_name, n.author_user_id,
         n.note,
         jsonb_build_object('is_internal', n.is_internal, 'pinned', n.pinned)
    FROM public.job_notes n

  UNION ALL

  SELECT tk.company_id, tk.job_id, 'task',
         CASE WHEN tk.status = 'completed' THEN 'task.completed'
              ELSE 'task.' || tk.status END,
         tk.id::text,
         coalesce(tk.completed_at, tk.assigned_at, tk.created_at),
         'Team member', coalesce(tk.completed_by, tk.assignee_user_id),
         tk.title,
         jsonb_build_object('status', tk.status,
                            'requires_photo', tk.requires_photo,
                            'photo_media_ids', tk.photo_media_ids)
    FROM public.job_tasks tk

  UNION ALL

  SELECT r.company_id, r.job_id, 'publish',
         'publish.' || r.status, r.id::text,
         coalesce(r.succeeded_at, r.last_attempted_at, r.created_at),
         'System', r.requested_by,
         'Publish to ' || r.destination || ': ' || r.status,
         jsonb_build_object('destination', r.destination,
                            'external_url', r.external_url,
                            'error_message', r.error_message)
    FROM public.publish_records r;

COMMENT ON VIEW public.job_activity IS
  'One ordered timeline per job, unioning job_events, job_media, job_checkins, '
  'job_notes, job_tasks and publish_records. Query it as '
  '  SELECT * FROM job_activity WHERE job_id = $1 ORDER BY occurred_at DESC; '
  'and it replaces the six round trips plus JS merge in '
  'mobile/src/components/job/job-activity-tab.tsx. '
  'security_invoker = true is LOAD-BEARING: without it the view would run as '
  'its owner and bypass RLS on every table it reads, exposing every tenant''s '
  'activity to every authenticated caller. Do not remove it.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT ON public.job_activity TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON public.job_activity FROM anon';
  END IF;
END $$;


INSERT INTO app.w0_series_log (step, detail)
VALUES ('08_company_scoping_composite_fks',
        'company_id + btree index + FK to companies on every in-scope table; '
        'UNIQUE (id, company_id) on parents; composite (job_id, company_id) '
        '-> jobs(id, company_id) FKs (ON UPDATE CASCADE; SET NULL constrained '
        'to a column list so it cannot null out company_id) so a member of one '
        'company cannot attach a row to another company''s job; guarded '
        'backfill from businesses.company_id, parents before children, with an '
        'orphan pass that assigns rows no join can reach when exactly one '
        'company exists and reports them row-by-row when more than one does; '
        'app.stamp_company_id() BEFORE INSERT on every in-scope table so the '
        'shipped client — which never sends company_id — can still write once '
        'RLS is on, and so a supplied company_id that disagrees with the '
        'parent is rejected; public.search_everything() over the search_body '
        'indexes built in W0/03 and W0/07; public.job_activity, a '
        'security_invoker view unioning job_events, job_media, job_checkins, '
        'job_notes, job_tasks and publish_records into one timeline.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
