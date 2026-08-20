-- =====================================================================
-- W0 / 10 — Row Level Security.  ** DO NOT APPLY YET **
-- =====================================================================
--
--        ############################################################
--        #                                                          #
--        #   STOP. READ THIS BEFORE RUNNING ANYTHING IN THIS FILE.  #
--        #                                                          #
--        #   auth.users currently contains ZERO ROWS.               #
--        #   Nobody has ever signed in to this system.              #
--        #                                                          #
--        #   Every policy below grants access on the basis of an    #
--        #   ACTIVE company_members row matched to the caller's     #
--        #   auth uid. If RLS is enabled while auth.users is empty   #
--        #   and company_members is empty, EVERY POLICY EVALUATES   #
--        #   TO FALSE FOR EVERY CALLER. The result is a total       #
--        #   blackout: the mobile app, the web client and the       #
--        #   public share pages all return zero rows, and the only  #
--        #   way back in is the service_role key or a direct        #
--        #   superuser connection.                                  #
--        #                                                          #
--        #   The mobile app is operating as `anon` today, on tables  #
--        #   where RLS is off. The moment RLS is on, anon sees      #
--        #   nothing.                                               #
--        #                                                          #
--        ############################################################
--
-- WHY THIS FILE EXISTS AND WHY IT IS LAST
--   The lockdown migration 20260727000000 already made the correct call in
--   its own header: "DELIBERATELY NOT DONE HERE: enabling RLS ... Identity
--   first, then policies, then RLS." This file is the last of those three
--   steps. It must not be run before the first two are real.
--
-- PRECONDITIONS. This file ENFORCES them in section 0 and ABORTS if any
-- fails, so a mis-timed `supabase db push` cannot black out the database:
--   1. auth.users has at least one row.
--   2. public.companies has at least one row.
--   3. public.company_members has at least one ACTIVE row.
--   4. Every company_members.user_id corresponds to a real auth.users row.
--   5. No in-scope table has any row with company_id IS NULL.
--   6. W0/00 through W0/09 have all been applied.
--
-- THE MANUAL STEP
--   Before running this, sign in as a real user on a staging copy and confirm
--   you can READ your own jobs AND WRITE a job note through PostgREST. See
--   section 7 for the exact statements — and note that it now includes a
--   WRITE, because an earlier cut of this file checked only reads and every
--   read could pass on a database nobody could write to.
--
--   The JWT half of this is no longer left to a human: W0/01 section 6b sets
--   request.jwt.claims itself at apply time and asserts app.current_user_id()
--   reads it back, so the dead-GUC failure mode cannot reach production
--   unnoticed. Sign in anyway — it is the only end-to-end proof.
--
-- ROLLBACK
--   If something is wrong after applying, RLS can be turned off again from a
--   service_role or superuser connection:
--     DO $x$ DECLARE t record; BEGIN
--       FOR t IN SELECT table_name FROM app.w0_scope LOOP
--         EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',
--                        t.table_name);
--       END LOOP; END $x$;
--   Keep that snippet somewhere you can reach WITHOUT the application.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Applied before W0/08: company_id does not exist on most tables and every
--   policy fails to create with 42703 — or worse, creates against a column
--   that is entirely NULL and blacks everything out. Section 0 catches this.
-- =====================================================================


-- =====================================================================
-- SECTION 0 — THE INTERLOCK. Everything below depends on this passing.
-- =====================================================================
DO $$
DECLARE
  n_auth     bigint := 0;
  n_comp     bigint;
  n_members  bigint;
  n_orphan   bigint := 0;
  n_null     bigint := 0;
  t          record;
  n          bigint;
  missing    text[] := '{}';
BEGIN
  ------------------------------------------------------------------
  -- 1. Has the whole series been applied?
  ------------------------------------------------------------------
  SELECT array_agg(s)
    INTO missing
    FROM unnest(ARRAY[
      '00_baseline_notes_and_helpers',
      '01_identity_companies_membership',
      '02_clients_name_split_backfill',
      '03_jobs_status_vocabulary_and_columns',
      '04_job_tasks_rebuild_and_checklists',
      '05_field_tables_checkins_notes_state',
      '06_job_events_and_publish_records',
      '07_job_media_attribution_and_backfill',
      '08_company_scoping_composite_fks',
      '09_changes_log_and_sync_pull'
    ]) AS s
   WHERE NOT EXISTS (SELECT 1 FROM app.w0_series_log l WHERE l.step = s);

  IF missing IS NOT NULL AND array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION
      E'\n\nW0/10 ABORT — the W0 series is incomplete.\n'
      'Not yet applied: %\n'
      'Enabling RLS on a half-migrated schema is how you black out a '
      'production database. Apply the missing steps first.\n',
      array_to_string(missing, ', ');
  END IF;

  ------------------------------------------------------------------
  -- 2. Do real users exist?
  ------------------------------------------------------------------
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION
      E'\n\nW0/10 ABORT — auth.users does not exist.\n'
      'This file is written for a Supabase project with GoTrue auth.\n';
  END IF;

  EXECUTE 'SELECT count(*) FROM auth.users' INTO n_auth;

  IF n_auth = 0 THEN
    RAISE EXCEPTION
      E'\n\n'
      '################################################################\n'
      'W0/10 ABORT — auth.users is EMPTY. Nobody has ever signed in.\n'
      '\n'
      'Enabling RLS now would evaluate every company-membership policy\n'
      'to FALSE for every caller, in every client, immediately. Total\n'
      'blackout, recoverable only with the service_role key.\n'
      '\n'
      'DO THIS FIRST:\n'
      '  1. ship the sign-up / sign-in flow\n'
      '  2. create at least one real user\n'
      '  3. create a company and an ACTIVE company_members row for them\n'
      '     (see W0/01 section 8 for the exact statements)\n'
      '  4. finish the company_id backfill (re-run W0/08)\n'
      '  5. on a STAGING COPY, sign in as that user and confirm you can\n'
      '     read your own jobs through PostgREST\n'
      '  6. only then run this file\n'
      '################################################################\n';
  END IF;

  ------------------------------------------------------------------
  -- 3. Is there a tenant, and does anyone belong to it?
  ------------------------------------------------------------------
  SELECT count(*) INTO n_comp    FROM public.companies;
  SELECT count(*) INTO n_members FROM public.company_members WHERE status = 'active';

  IF n_comp = 0 THEN
    RAISE EXCEPTION E'\n\nW0/10 ABORT — public.companies is empty. '
      'There is no tenant for anyone to be a member of. See W0/01 section 8.\n';
  END IF;

  IF n_members = 0 THEN
    RAISE EXCEPTION E'\n\nW0/10 ABORT — public.company_members has no ACTIVE row.\n'
      'Every policy below requires one. With zero, nobody can read anything.\n'
      'See W0/01 section 8.\n';
  END IF;

  ------------------------------------------------------------------
  -- 4. Does every member actually correspond to a real auth user?
  --    A typo'd uuid here is a blackout for that person specifically.
  ------------------------------------------------------------------
  EXECUTE $q$
    SELECT count(*) FROM public.company_members m
     WHERE m.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
  $q$ INTO n_orphan;

  IF n_orphan > 0 THEN
    RAISE EXCEPTION
      E'\n\nW0/10 ABORT — % active company_members row(s) reference a '
      'user_id that does not exist in auth.users.\n'
      'Those people would be locked out the instant RLS is enabled.\n'
      'Find them with:\n'
      '  SELECT m.* FROM public.company_members m\n'
      '   WHERE m.status = ''active'' AND NOT EXISTS\n'
      '     (SELECT 1 FROM auth.users u WHERE u.id = m.user_id);\n',
      n_orphan;
  END IF;

  ------------------------------------------------------------------
  -- 5. Is every in-scope row assigned to a company?
  --    An unassigned row becomes invisible to everyone the moment RLS is on.
  ------------------------------------------------------------------
  FOR t IN
    SELECT table_name FROM app.w0_scope
     WHERE company_scoped AND table_name <> 'companies'
     ORDER BY table_name
  LOOP
    IF to_regclass('public.' || quote_ident(t.table_name)) IS NULL THEN
      RAISE EXCEPTION E'\n\nW0/10 ABORT — public.% is in app.w0_scope but does '
        'not exist. Apply the migration that creates it first.\n', t.table_name;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL',
                   t.table_name) INTO n;
    IF n > 0 THEN
      RAISE WARNING 'W0/10: public.% has % row(s) with company_id IS NULL',
                    t.table_name, n;
      n_null := n_null + n;
    END IF;
  END LOOP;

  IF n_null > 0 THEN
    RAISE EXCEPTION
      E'\n\nW0/10 ABORT — % row(s) across the schema still have '
      'company_id IS NULL.\n'
      'Every one of them becomes invisible to every user the moment RLS is\n'
      'enabled, including the 9 live jobs and 11 photos.\n'
      'Set businesses.company_id (W0/01 section 8) and RE-RUN W0/08, which\n'
      'is idempotent. The WARNING lines above name the tables.\n', n_null;
  END IF;

  ------------------------------------------------------------------
  -- 6. Is the JWT claim plumbing live?
  --
  --    This is the check the original interlock outsourced to a human, and
  --    the one whose absence would have been fatal: if app.current_user_id()
  --    cannot read a sub claim, public.current_company_ids() returns '{}' for
  --    every caller, every policy created below is FALSE for everyone, and
  --    the result is the total blackout the header describes. Set the GUC and
  --    assert the helper reads it back, rather than trusting that W0/01
  --    shipped the fixed version.
  ------------------------------------------------------------------
  DECLARE
    v_probe uuid := '00000000-0000-0000-0000-000000000001';
    v_got   uuid;
  BEGIN
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_probe)::text, true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    v_got := app.current_user_id();
    PERFORM set_config('request.jwt.claims', '', true);

    IF v_got IS DISTINCT FROM v_probe THEN
      RAISE EXCEPTION
        E'\n\n'
        '################################################################\n'
        'W0/10 ABORT — the JWT claim plumbing is broken.\n'
        '\n'
        'app.current_user_id() did not resolve a sub claim from\n'
        'request.jwt.claims, which is the ONLY GUC PostgREST v9+ sets.\n'
        'Expected %, got %.\n'
        '\n'
        'Enabling RLS now would evaluate every policy to FALSE for every\n'
        'signed-in user — a total read blackout, recoverable only with the\n'
        'service_role key.\n'
        '\n'
        'FIX: re-apply W0/01. Its app.current_user_id() must coalesce\n'
        'request.jwt.claim.sub with request.jwt.claims->>''sub''.\n'
        '################################################################\n',
        v_probe, coalesce(v_got::text, 'NULL');
    END IF;
  END;

  ------------------------------------------------------------------
  -- 7. Is company_id actually stamped on write?
  --
  --    The shipped client never sends company_id. Without the BEFORE INSERT
  --    trigger installed by W0/08 section 6, every INSERT policy created
  --    below rejects every write from every client with 42501 — and no read
  --    check can detect that. Verify the mechanism exists before relying on
  --    the policy that depends on it.
  ------------------------------------------------------------------
  DECLARE
    n_stamp   bigint;
    n_want    bigint;
  BEGIN
    SELECT count(*) INTO n_want
      FROM app.w0_scope
     WHERE company_scoped
       AND table_name NOT IN ('companies', 'company_members')
       AND to_regclass('public.' || quote_ident(table_name)) IS NOT NULL;

    SELECT count(*) INTO n_stamp
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND tg.tgname = 'aa_stamp_company_id'
       AND NOT tg.tgisinternal
       AND c.relname IN (SELECT table_name FROM app.w0_scope);

    IF n_stamp < n_want THEN
      RAISE EXCEPTION
        E'\n\n'
        '################################################################\n'
        'W0/10 ABORT — the company_id stamping trigger is missing on % of %\n'
        'in-scope table(s).\n'
        '\n'
        'The mobile client NEVER sends company_id (grep -rn "company_id"\n'
        'mobile/src returns nothing). Without app.stamp_company_id(), the\n'
        'INSERT policies below reject EVERY write from EVERY client with\n'
        '42501 "new row violates row-level security policy" — every photo,\n'
        'check-in, note, comment, share link and publish.\n'
        '\n'
        'FIX: re-apply W0/08, which installs it in section 6.\n'
        '################################################################\n',
        n_want - n_stamp, n_want;
    END IF;
  END;

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'W0/10 preconditions PASSED: % auth user(s), % company/ies, '
               '% active member(s), 0 unassigned rows, claim plumbing live, '
               'company_id stamping installed.', n_auth, n_comp, n_members;
  RAISE NOTICE 'Proceeding to enable RLS. Confirm a real signed-in READ AND '
               'WRITE work — see section 7.';
  RAISE NOTICE '================================================================';
END $$;


-- =====================================================================
-- SECTION 1 — Clear the permissive policies that are already there.
--
--   26 tables already have RLS enabled with USING (TRUE) / WITH CHECK (TRUE)
--   policies — clients, job_media, and the repo's mobile-field tables among
--   them. POLICIES ARE OR'D TOGETHER. Leaving a single USING (TRUE) policy in
--   place makes every restrictive policy added below completely pointless,
--   and it would do so silently: the tests pass, the data is exposed.
--
--   So: drop every existing policy on every in-scope table first.
-- =====================================================================
DO $$
DECLARE
  p record;
  n integer := 0;
BEGIN
  FOR p IN
    SELECT pol.polname, c.relname
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND c.relname IN (SELECT table_name FROM app.w0_scope)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.polname, p.relname);
    RAISE NOTICE 'W0/10: dropped pre-existing policy % on %', p.polname, p.relname;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'W0/10: % pre-existing policy/ies removed', n;
END $$;


-- =====================================================================
-- SECTION 2 — Grants.
--
--   RLS narrows what a role can see; it does not grant access. 20260727000000
--   revoked anon's write grants and most of its read grants, which is
--   correct. `authenticated` needs table-level privileges for the policies
--   below to have anything to filter.
-- =====================================================================
DO $$
DECLARE t record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE 'W0/10: no `authenticated` role — skipping grants';
    RETURN;
  END IF;

  FOR t IN SELECT table_name FROM app.w0_scope ORDER BY table_name LOOP
    IF t.table_name = 'job_events' THEN
      -- Append-only by design: an activity log you can edit is not evidence.
      EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t.table_name);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
                     t.table_name);
    END IF;
  END LOOP;
END $$;


-- =====================================================================
-- SECTION 3 — The company-membership policies.
--
--   One pattern, applied uniformly:
--     USING      (company_id = ANY (public.current_company_ids()))
--     WITH CHECK (company_id = ANY (public.current_company_ids()))
--
--   The WITH CHECK half is what stops a member of company A from INSERTing a
--   row stamped with company B. Combined with the composite foreign keys from
--   W0/08 — (job_id, company_id) -> jobs(id, company_id) — a member of A also
--   cannot attach a row to B's job even if this policy were somehow bypassed.
--   Two independent mechanisms, because tenant isolation is the one thing
--   that must not rest on a single correct line of SQL.
--
--   public.current_company_ids() returns an empty array (never NULL) for anon,
--   so `= ANY ('{}')` is FALSE rather than NULL. Fail closed.
-- =====================================================================
DO $$
DECLARE
  t          record;
  n          integer := 0;
  read_only  text[] := ARRAY['job_events'];
BEGIN
  FOR t IN
    SELECT table_name, public_read FROM app.w0_scope
     WHERE company_scoped AND table_name <> 'company_members'
     ORDER BY table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      'USING (company_id = ANY (public.current_company_ids()))',
      t.table_name || '_member_select', t.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
      'WITH CHECK (company_id = ANY (public.current_company_ids()))',
      t.table_name || '_member_insert', t.table_name);

    IF NOT (t.table_name = ANY (read_only)) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
        'USING (company_id = ANY (public.current_company_ids())) '
        'WITH CHECK (company_id = ANY (public.current_company_ids()))',
        t.table_name || '_member_update', t.table_name);

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated '
        'USING (company_id = ANY (public.current_company_ids()))',
        t.table_name || '_member_delete', t.table_name);
    END IF;

    n := n + 1;
  END LOOP;

  RAISE NOTICE 'W0/10: membership policies applied to % table(s)', n;
END $$;


-- =====================================================================
-- SECTION 4 — companies and company_members.
--
--   company_members needs care: its own policy must NOT call a function that
--   reads company_members under RLS, or PostgreSQL raises 42P17 (infinite
--   recursion in policy). public.current_company_ids() is SECURITY DEFINER and
--   owned by the table owner, and FORCE ROW LEVEL SECURITY is deliberately
--   NOT set on company_members, so the function's own read bypasses RLS and
--   the recursion never happens. Do not "tidy" either of those away.
-- =====================================================================
ALTER TABLE public.companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_member_select ON public.companies
  FOR SELECT TO authenticated
  USING (id = ANY (public.current_company_ids()));

CREATE POLICY companies_owner_update ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_company_role(id, 'owner', 'admin'))
  WITH CHECK (public.has_company_role(id, 'owner', 'admin'));

-- You can see who else is in your companies.
CREATE POLICY company_members_member_select ON public.company_members
  FOR SELECT TO authenticated
  USING (company_id = ANY (public.current_company_ids()));

-- Only owners and admins can change the roster. Without this any member
-- could add themselves to another company — the membership table is the root
-- of trust and must not be self-service.
CREATE POLICY company_members_admin_insert ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, 'owner', 'admin'));

CREATE POLICY company_members_admin_update ON public.company_members
  FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, 'owner', 'admin'))
  WITH CHECK (public.has_company_role(company_id, 'owner', 'admin'));

CREATE POLICY company_members_admin_delete ON public.company_members
  FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, 'owner', 'admin'));


-- =====================================================================
-- SECTION 5 — The one thing that genuinely needs anonymous read.
--
--   shared_galleries backs the logged-out /g/:token page. That is the entire
--   feature: a link a customer opens with no account. It is served by a
--   token-argument RPC, NOT by an anon SELECT policy — see the block below
--   for why that distinction is the whole security property.
--
--   Note what is NOT here: no anon policy on jobs, job_media, businesses or
--   review_requests. Those tables still carry anon SELECT grants from
--   20260727000000's allowlist, but with RLS enabled and no anon policy they
--   now return zero rows to anonymous callers.
--
--   ** THAT IS A DELIBERATE BREAKING CHANGE AND IT IS NOT FREE. **
--   The public PublicProject page and the ReviewGate page read jobs,
--   businesses and review_requests as anon and WILL GO BLANK. The correct fix
--   is a token-scoped view per public page, exactly like shared_galleries,
--   rather than blanket anonymous read on the jobs table. Build those before
--   running this file, or accept that those two pages break here.
-- =====================================================================
-- ============ WHY THIS IS AN RPC AND NOT AN anon SELECT POLICY ============
--   An earlier cut of this file wrote:
--
--     CREATE POLICY shared_galleries_public_read ON public.shared_galleries
--       FOR SELECT TO anon, authenticated
--       USING (revoked_at IS NULL
--              AND (expires_at IS NULL OR expires_at > now()));
--
--   There is no token predicate in that policy, and PostgREST DOES NOT
--   REQUIRE A FILTER. So
--       GET /rest/v1/shared_galleries?select=*
--   with the anon key — which ships inside the mobile app bundle, one
--   `strings` away from being public — returned the token, job_id, job_title,
--   business_name and photo_urls of EVERY gallery of EVERY tenant in one
--   request. Its own COMMENT claimed "a caller must already know the token"
--   and then conceded two lines later that enumeration was possible; the
--   first clause is the one a reviewer reads, and it was false.
--
--   Expiry and revocation did not mitigate it either: W0/05 documents that
--   expires_at is NULL for every link the shipped client creates, so the
--   predicate was effectively `revoked_at IS NULL` and matched everything.
--
--   Listing `authenticated` in the same policy made it worse: policies are
--   OR'd, so it also overrode the company-membership SELECT policy that
--   section 3 puts on this table, letting a member of company A read company
--   B's galleries.
--
--   A function argument cannot be omitted. That is the whole difference.
--
--   ** REQUIRED CLIENT CHANGE **  client/pages/PublicGallery.tsx must call
--   supabase.rpc('gallery_by_token', { p_token: token }) instead of
--   .from('shared_galleries').select(...).eq('token', token). Do this BEFORE
--   applying this file or the /g/:token page returns nothing.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.gallery_by_token(p_token text)
RETURNS TABLE (
  token         text,
  job_title     text,
  business_name text,
  photo_urls    jsonb,
  created_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT g.token, g.job_title, g.business_name, g.photo_urls, g.created_at
    FROM public.shared_galleries g
   WHERE g.token = p_token
     AND nullif(btrim(coalesce(p_token, '')), '') IS NOT NULL
     AND g.revoked_at IS NULL
     AND (g.expires_at IS NULL OR g.expires_at > now());
$$;

COMMENT ON FUNCTION public.gallery_by_token(text) IS
  'The only intentional anonymous read in the schema. Requires the token as '
  'an ARGUMENT, so unlike an anon SELECT policy it cannot be called without '
  'one and the table cannot be enumerated. Honours revoked_at and expires_at '
  'so a link can be withdrawn. Deliberately does NOT return job_id or '
  'company_id — a customer opening a share link has no use for either, and '
  'leaking job uuids across tenants is what made the old policy chainable '
  'into the job_field_state cross-tenant write.';

REVOKE ALL ON FUNCTION public.gallery_by_token(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gallery_by_token(text) TO anon';
    -- The table itself stays closed. Section 3 already gave authenticated
    -- members a company-scoped SELECT policy on it; anon gets the RPC only.
    EXECUTE 'REVOKE ALL ON public.shared_galleries FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gallery_by_token(text) TO authenticated';
  END IF;
END $$;

-- Belt and braces: if an earlier apply created the enumerable policy, remove
-- it. (Section 1 already drops every policy on in-scope tables, so this is
-- only reachable when this file is re-run against a database where section 1
-- has since been amended.)
DROP POLICY IF EXISTS shared_galleries_public_read ON public.shared_galleries;


-- =====================================================================
-- SECTION 5b — The tables this series does NOT model.
--
--   RLS covers the 21 tables in app.w0_scope. There are 57 tables in schema
--   public, and `authenticated` holds Supabase's default arwdDxtm on all of
--   them — verified live: pg_default_acl for schema public, objtype 'r', is
--   {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm,
--    service_role=arwdDxtm}.
--
--   So without this section, the moment W0/10 creates real sessions, a
--   signed-in member of company A can still run
--     SELECT * FROM client_notes;  UPDATE gmb_profiles SET ...;
--     DELETE FROM reviews;
--   against company B's data. The stated goal — a member of A physically
--   cannot read or write B's data — would hold for jobs, media, clients and
--   publish_records, and not for the customer notes, GMB profiles, billing
--   records and SMS logs sitting beside them.
--
--   The lockdown migration 20260727000000 only ever addressed `anon`; its
--   header says so ("`authenticated` keeps identical grants"). That was the
--   right call while nobody could sign in. This file is the moment it stops
--   being true, so this is where it gets revisited.
--
--   The cheapest CORRECT step is to revoke rather than to model: adding
--   company_id to tables nobody has audited is how you break the web client,
--   which is exactly the argument app.w0_scope's own COMMENT makes. Revoking
--   writes closes cross-tenant WRITES today and leaves the read modelling as
--   a documented follow-up. Reads are NOT closed here — doing so blind would
--   break the web admin — but every remaining table is named in a WARNING so
--   the gap is a decision, not an oversight.
-- =====================================================================
DO $$
DECLARE
  t         record;
  leftovers text[] := '{}';
  n         integer := 0;
  -- Tables that carry tenant data but are outside app.w0_scope. Writes are
  -- revoked from `authenticated`; the web admin uses the service_role.
  tenant_ish text[] := ARRAY[
    'client_notes', 'business_notes', 'reviews', 'gmb_profiles',
    'gmb_audit_results', 'gmb_hours', 'gmb_qas', 'gmb_services',
    'locations', 'analytics', 'users', 'billing_records', 'sms_logs',
    'notifications', 'workspaces', 'server_media_metadata',
    'crash_logs', 'super_admin_tasks', 'system_settings'
  ];
  tname text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE 'W0/10 §5b: no `authenticated` role — skipping';
    RETURN;
  END IF;

  FOREACH tname IN ARRAY tenant_ish LOOP
    IF to_regclass('public.' || quote_ident(tname)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I '
                   'FROM authenticated', tname);
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'W0/10 §5b: cross-tenant WRITES revoked from `authenticated` on '
               '% unmodelled table(s)', n;

  -- Name everything still open, so nothing is left open by accident.
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public'
       AND c.relkind = 'r'
       AND NOT c.relrowsecurity
       AND c.relname NOT IN (SELECT table_name FROM app.w0_scope)
     ORDER BY c.relname
  LOOP
    leftovers := leftovers || t.relname;
  END LOOP;

  IF array_length(leftovers, 1) > 0 THEN
    RAISE WARNING '===============================================================';
    RAISE WARNING 'W0/10 §5b: % public table(s) remain RLS-DISABLED and readable',
                  array_length(leftovers, 1);
    RAISE WARNING '  by every authenticated user of every tenant. Writes have been';
    RAISE WARNING '  revoked where the table is known to carry tenant data, but';
    RAISE WARNING '  READS are still open. This is a KNOWN, DOCUMENTED follow-up,';
    RAISE WARNING '  not a clean bill of health:';
    RAISE WARNING '    %', array_to_string(leftovers, ', ');
    RAISE WARNING '===============================================================';
  END IF;
END $$;


-- =====================================================================
-- SECTION 6 — Storage: the avatars bucket created in W0/01.
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'W0/10: storage.objects not present — skipping bucket policies';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Public read from avatars bucket"    ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated upload to avatars"    ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated update in avatars"    ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated delete from avatars"  ON storage.objects;

  CREATE POLICY "Public read from avatars bucket" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

  CREATE POLICY "Authenticated upload to avatars" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

  CREATE POLICY "Authenticated update in avatars" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

  CREATE POLICY "Authenticated delete from avatars" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'avatars');
END $$;


-- =====================================================================
-- SECTION 7 — Post-apply verification. Run these BY HAND, signed in as a
--             real user, before you call this done.
--
--   AN EARLIER VERSION OF THIS LIST TESTED ONLY READS. That is how a
--   database that nobody can write to passes every documented check. The
--   write test below is not optional.
--
--   -- 1. IDENTITY. If this is NULL, nothing else below means anything.
--   SELECT auth.uid();                       -- must NOT be NULL
--   SELECT public.current_company_ids();     -- must NOT be '{}'
--
--      NOTE: `SELECT app.current_company_ids()` fails with 42501 for
--      `authenticated` BY DESIGN — W0/00 revokes USAGE on schema app and that
--      revoke is correct. Use the public wrapper above. Only reach for the
--      app-schema original as postgres/service_role with request.jwt.claims
--      set by hand.
--
--   -- 2. READ.
--   SELECT count(*) FROM jobs;               -- must be > 0
--   SELECT count(*) FROM job_media;          -- must be > 0
--
--   -- 3. WRITE, WITH NO company_id SUPPLIED. This is the shape the shipped
--   --    client actually sends. It must SUCCEED, and the stored row must come
--   --    back carrying your company.
--   INSERT INTO job_notes (job_id, author_name, note)
--   VALUES ('<one of your job ids>', 'rls smoke test', 'delete me')
--   RETURNING id, company_id;                -- company_id must NOT be NULL
--
--   DELETE FROM job_notes WHERE note = 'delete me';
--
--   -- 4. CROSS-TENANT WRITE. Must FAIL — 23503 from the composite FK, or
--   --    42501 from the WITH CHECK, or the stamping trigger's own error.
--   INSERT INTO job_notes (job_id, company_id, note)
--   VALUES ('<other company job id>', '<my company id>', 'should not work');
--
--   -- 5. ISOLATION. Create a second company and user, then as that user:
--   SELECT count(*) FROM jobs;               -- must be 0
--
--   -- 6. THE PUBLIC SHARE PAGE, as anon (no JWT):
--   SELECT * FROM public.gallery_by_token('<a real token>');  -- returns 1 row
--   SELECT * FROM shared_galleries;          -- must FAIL with 42501
-- =====================================================================

INSERT INTO app.w0_series_log (step, detail)
VALUES ('10_rls_company_membership',
        'RLS enabled on every in-scope table with company-membership policies; '
        'pre-existing USING(TRUE) policies dropped first; company_members '
        'roster restricted to owner/admin; shared_galleries is served to anon '
        'by public.gallery_by_token(p_token) — a token ARGUMENT, not an '
        'enumerable anon SELECT policy — and the table itself is closed to '
        'anon; cross-tenant WRITES revoked from `authenticated` on the '
        'unmodelled tenant tables, with every remaining RLS-disabled table '
        'named in a WARNING. NOTE: anon access to jobs, businesses and '
        'review_requests is now closed — the public PublicProject and '
        'ReviewGate pages need token-scoped views or RPCs of their own.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
