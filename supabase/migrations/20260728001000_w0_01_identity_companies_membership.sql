-- =====================================================================
-- W0 / 01 — Identity: companies, membership, and the current-user helpers
-- =====================================================================
--
-- WHY THIS FILE EXISTS
--   Every later step depends on being able to answer one question: "which
--   companies is the caller a member of?" Multi-tenancy (W0/08), the change
--   log (W0/09) and RLS (W0/10) are all built on that answer. It has to exist
--   before any of them, and it has to be a real table, not a claim in a JWT.
--
--   Right now there is NO tenant concept at all. `businesses` is the closest
--   thing (3 rows, owner_id -> users) but a business is a Google Business
--   Profile location, not a billing/security boundary — a contractor can own
--   several. So companies sits ABOVE businesses.
--
-- WHAT IT ASSUMES ABOUT CURRENT STATE
--   * W0/00 has run (needs app.touch_updated_at, app.w0_series_log).
--   * public.users exists with 1 row (id uuid PK, email, name, role user_role).
--   * public.businesses exists with 3 rows and an owner_id -> users FK.
--   * auth.users exists and is EMPTY. Nobody has ever signed in.
--
-- THE auth.users PROBLEM, STATED PLAINLY
--   auth.users has zero rows. public.users has one row and there is NO foreign
--   key between them. This migration therefore:
--     - does NOT add a NOT NULL FK from company_members.user_id to auth.users
--       (that would make the table unwritable until someone signs up), and
--     - does NOT enable RLS on anything (see W0/10).
--   company_members.user_id is a plain uuid intended to hold an auth.users.id.
--   The FK to auth.users is written here as NOT VALID and DEFERRED — see the
--   clearly marked block at the end, which is intentionally commented out.
--
-- WHAT BREAKS IF APPLIED OUT OF ORDER
--   Applied before W0/00: fails, app.touch_updated_at does not exist.
--   Applied after W0/08: W0/08 adds composite FKs against companies(id) and
--   will fail with 42P01. Applied after W0/10: RLS policies reference
--   app.current_company_ids(), which is defined here.
--
-- SAFETY: creates new tables; adds nullable columns to businesses and users.
--   No existing column is altered or dropped. No rows are modified except the
--   opt-in bootstrap block, which is guarded and idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Companies — the tenant boundary.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text,
  owner_user_id uuid,
  status        text NOT NULL DEFAULT 'active',
  timezone      text NOT NULL DEFAULT 'UTC',
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Belt and braces for the case where the table already existed in some form.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug          text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'active';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS timezone      text NOT NULL DEFAULT 'UTC';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS settings      jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.companies'::regclass AND conname = 'companies_status_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_status_check
      CHECK (status IN ('active', 'suspended', 'cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_key
  ON public.companies (lower(slug)) WHERE slug IS NOT NULL;

COMMENT ON TABLE public.companies IS
  'Tenant root. One contractor business entity. A company owns many '
  '`businesses` (Google Business Profile locations), many jobs, and many '
  'members. This is the boundary RLS enforces in W0/10.';


-- ---------------------------------------------------------------------
-- 2. Membership — the thing RLS actually reads.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  app_user_id   uuid,          -- optional link to the legacy public.users row
  role          text NOT NULL DEFAULT 'member',
  status        text NOT NULL DEFAULT 'active',
  display_name  text,
  invited_by    uuid,
  invited_at    timestamptz,
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS app_user_id  uuid;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS invited_by   uuid;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS invited_at   timestamptz;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS accepted_at  timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.company_members'::regclass
       AND conname = 'company_members_role_check'
  ) THEN
    ALTER TABLE public.company_members
      ADD CONSTRAINT company_members_role_check
      CHECK (role IN ('owner', 'admin', 'dispatcher', 'member', 'viewer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.company_members'::regclass
       AND conname = 'company_members_status_check'
  ) THEN
    ALTER TABLE public.company_members
      ADD CONSTRAINT company_members_status_check
      CHECK (status IN ('active', 'invited', 'suspended', 'removed'));
  END IF;
END $$;

-- One membership row per (company, user). This is what makes
-- app.current_company_ids() cheap and unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS company_members_company_user_key
  ON public.company_members (company_id, user_id);

CREATE INDEX IF NOT EXISTS company_members_user_id_idx
  ON public.company_members (user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS company_members_company_id_idx
  ON public.company_members (company_id);

COMMENT ON TABLE public.company_members IS
  'Authoritative membership. user_id holds an auth.users.id. There is '
  'deliberately NO foreign key to auth.users yet: auth.users is empty, and a '
  'NOT NULL FK to an empty table makes this table unwritable. See the '
  'commented-out block at the foot of this migration for the FK to add once '
  'real signups exist.';

COMMENT ON COLUMN public.company_members.app_user_id IS
  'Optional pointer at the legacy public.users row for the same human. '
  'public.users predates Supabase Auth here and has 1 row.';

DROP TRIGGER IF EXISTS companies_touch_updated_at ON public.companies;
CREATE TRIGGER companies_touch_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS company_members_touch_updated_at ON public.company_members;
CREATE TRIGGER company_members_touch_updated_at
  BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();


-- ---------------------------------------------------------------------
-- 3. Link legacy identity rows to auth without disturbing them.
-- ---------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key
  ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.users.auth_user_id IS
  'Bridge to auth.users.id. Nullable and unenforced on purpose: auth.users is '
  'empty today, and public.users.id is already referenced by six FKs so it '
  'cannot be repointed.';


-- ---------------------------------------------------------------------
-- 4. businesses.logo_url — the missing column behind a silent mobile failure.
--
--    mobile/src/lib/logo.ts:119 does
--      supabase.from('businesses').update({ logo_url: publicUrl })
--    and logo.ts:42 selects it. Neither works today, and the code swallows the
--    error ("Column may not exist yet — local-only is fine"), so the logo
--    silently never syncs between devices.
-- ---------------------------------------------------------------------
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url text;
COMMENT ON COLUMN public.businesses.logo_url IS
  'Public URL of the company logo. Written by mobile/src/lib/logo.ts after '
  'uploading to the `avatars` storage bucket (created below).';


-- ---------------------------------------------------------------------
-- 5. The `avatars` storage bucket — the OTHER half of the same failure.
--
--    logo.ts:113 uploads to storage.from(''avatars''). storage.buckets holds
--    exactly one row: `media`. The upload fails and the function returns
--    BEFORE it ever reaches the logo_url update, so adding the column alone
--    fixes nothing. Both changes are needed together.
--
--    Bucket creation is normally a storage-API call; inserting the row
--    directly is the supported SQL equivalent on Supabase. Guarded so this
--    file still runs on a plain PostgreSQL instance with no storage schema.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage.buckets not present — skipping avatars bucket creation';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'avatars bucket ensured (public read; write policies in W0/10)';
END $$;

-- NOTE: object-level policies for `avatars` are deliberately NOT created here.
-- storage.objects already has RLS enabled, and 20260727000000 restricts writes
-- to `authenticated`. Until real users exist, an authenticated-only write
-- policy on avatars would be unusable anyway. It is created in W0/10 alongside
-- every other policy, so the whole security posture lands in one reviewable
-- place.


-- ---------------------------------------------------------------------
-- 6. Current-user helpers.
--
--    SECURITY DEFINER is load-bearing. In W0/10 these functions are called
--    FROM the RLS policy on company_members itself. A SECURITY INVOKER
--    function would re-enter that policy and recurse forever (42P17). Owned
--    by the migration role, which owns company_members, and table owners are
--    exempt from RLS unless FORCE ROW LEVEL SECURITY is set — which W0/10
--    deliberately does not set on company_members.
--
-- ============ READ THE CLAIM THE WAY POSTGREST ACTUALLY SETS IT ============
--    An earlier cut of this file read ONLY
--        nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
--    That GUC is DEAD. PostgREST removed the per-claim `request.jwt.claim.*`
--    settings in v9.0.0 and replaced them with the single JSON GUC
--    `request.jwt.claims`. This project runs PostgreSQL 17.4, so it is on
--    PostgREST v12+, and that expression returns NULL for every real caller.
--
--    The proof is in this project's own catalog. Supabase's auth.uid() is:
--        select coalesce(
--          nullif(current_setting('request.jwt.claim.sub', true), ''),
--          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
--        )::uuid
--    The coalesce exists precisely because the first branch no longer fires.
--    Copying only the first half would have made app.current_company_ids()
--    return '{}' for every authenticated user, so every policy W0/10 creates
--    would evaluate to FALSE and every table would return zero rows: the exact
--    total blackout the header of W0/10 is built to prevent, and one its
--    interlock structurally CANNOT catch, because the interlock runs as the
--    migration role where neither GUC is set.
--
--    So: read both, oldest-first, exactly as Supabase does. The expression
--    lives in app.current_user_id() and nowhere else; every other helper calls
--    it. One definition, one place to get it wrong.
-- ==========================================================================
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
           -- Legacy PostgREST (< v9) and anything that sets the GUC by hand.
           nullif(current_setting('request.jwt.claim.sub', true), ''),
           -- Modern PostgREST (>= v9): one JSON blob holding every claim.
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
         )::uuid;
$$;

COMMENT ON FUNCTION app.current_user_id() IS
  'auth.uid() equivalent, byte-for-byte the same claim resolution Supabase '
  'ships, but without a hard dependency on the auth schema so this series can '
  'also be applied to a plain PostgreSQL instance for testing. Reads BOTH '
  'request.jwt.claim.sub (legacy PostgREST) and request.jwt.claims->>''sub'' '
  '(PostgREST v9+, which is what actually fires here). Returns NULL for anon '
  'and for the service_role. DO NOT drop either branch of the coalesce.';

CREATE OR REPLACE FUNCTION app.current_company_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(m.company_id), '{}'::uuid[])
    FROM public.company_members m
   WHERE m.status = 'active'
     AND m.user_id = app.current_user_id();
$$;

REVOKE ALL ON FUNCTION app.current_company_ids() FROM PUBLIC;

COMMENT ON FUNCTION app.current_company_ids() IS
  'The companies the calling JWT is an ACTIVE member of. Returns an empty '
  'array (never NULL) so policies can use "company_id = ANY(...)" without a '
  'NULL guard. SECURITY DEFINER to avoid RLS recursion on company_members. '
  'NOT directly callable by `authenticated`: schema app has no USAGE grant. '
  'Use the public.current_company_ids() wrapper below.';


-- The public wrapper. This is what RLS policies and operators use.
--
-- WHY IT EXISTS: W0/00 does REVOKE ALL ON SCHEMA app FROM authenticated, and
-- that revoke is correct — the app schema is internal plumbing. But calling a
-- function by qualified name requires USAGE on its schema, so
--     SELECT app.current_company_ids();
-- fails for `authenticated` with 42501 "permission denied for schema app"
-- even when everything else is right. That made the one post-apply
-- verification step in W0/10 §7 that distinguishes "RLS is working" from "my
-- JWT is not carrying sub" itself unrunnable, and an operator hitting 42501
-- there is likely to read it as a broken deployment and start disabling RLS.
--
-- Routing the policies through a public-schema wrapper also removes any
-- question about whether a stored policy expression re-checks schema USAGE at
-- execution time. It costs one function call and buys certainty.
CREATE OR REPLACE FUNCTION public.current_company_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT app.current_company_ids();
$$;

COMMENT ON FUNCTION public.current_company_ids() IS
  'Public-schema wrapper for app.current_company_ids(). The companies the '
  'calling JWT is an ACTIVE member of, as a uuid[] that is empty rather than '
  'NULL so "company_id = ANY (...)" fails closed. Every RLS policy in W0/10 '
  'calls THIS, not the app-schema original, because `authenticated` has no '
  'USAGE on schema app.';

CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NOT NULL
     AND EXISTS (
           SELECT 1 FROM public.company_members m
            WHERE m.company_id = p_company_id
              AND m.status = 'active'
              AND m.user_id = app.current_user_id()
         );
$$;

COMMENT ON FUNCTION public.is_company_member(uuid) IS
  'Single-company membership test. NULL company_id returns FALSE, not NULL — '
  'so a row that has not been assigned a company is invisible under RLS '
  'rather than accidentally visible.';

CREATE OR REPLACE FUNCTION public.has_company_role(p_company_id uuid, VARIADIC p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NOT NULL
     AND EXISTS (
           SELECT 1 FROM public.company_members m
            WHERE m.company_id = p_company_id
              AND m.status = 'active'
              AND m.role = ANY (p_roles)
              AND m.user_id = app.current_user_id()
         );
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, text[]) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_company_ids() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION app.current_company_ids() TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_company_ids() TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION app.current_company_ids() TO service_role';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 6b. Prove the claim plumbing works, at apply time, in this database.
--
--     This is the check that would have caught the dead-GUC bug described
--     above, and it is the one precondition W0/10's interlock cannot test for
--     itself (it runs as the migration role, where no JWT GUC is set). Here we
--     SET the GUC ourselves and assert the helper reads it back.
--
--     SET LOCAL inside a DO block is scoped to the surrounding transaction and
--     is undone by the ROLLBACK TO SAVEPOINT, so it cannot leak into anything
--     the rest of the migration does.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_probe uuid := '00000000-0000-0000-0000-000000000001';
  v_legacy uuid;
  v_modern uuid;
BEGIN
  -- Modern PostgREST: the single JSON GUC. This is the branch that must work.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_probe)::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_modern := app.current_user_id();

  -- Legacy PostgREST: the per-claim GUC. Kept working for plain-PostgreSQL
  -- testing and for anything that sets the GUC by hand.
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', v_probe::text, true);
  v_legacy := app.current_user_id();

  -- Leave both GUCs clear again.
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_modern IS DISTINCT FROM v_probe THEN
    RAISE EXCEPTION
      E'\n\nW0/01 ABORT — app.current_user_id() did NOT resolve a sub claim '
      'from request.jwt.claims.\n'
      'That is the GUC PostgREST v9+ actually sets. With this broken, every '
      'RLS policy\n'
      'W0/10 creates evaluates to FALSE for every signed-in user — a total '
      'read blackout.\n'
      'Expected %, got %.\n', v_probe, coalesce(v_modern::text, 'NULL');
  END IF;

  IF v_legacy IS DISTINCT FROM v_probe THEN
    RAISE EXCEPTION
      E'\n\nW0/01 ABORT — app.current_user_id() did not resolve the legacy '
      'request.jwt.claim.sub GUC. Expected %, got %.\n',
      v_probe, coalesce(v_legacy::text, 'NULL');
  END IF;

  RAISE NOTICE 'W0/01: claim plumbing verified — app.current_user_id() reads '
               'both request.jwt.claims->>''sub'' and request.jwt.claim.sub.';
END $$;


-- ---------------------------------------------------------------------
-- 7. businesses.company_id — the one existing table that must be linked now,
--    because W0/08 backfills job.company_id THROUGH it.
-- ---------------------------------------------------------------------
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS company_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.businesses'::regclass
       AND conname = 'businesses_company_id_fkey'
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT
      NOT VALID;
    -- All 3 existing rows have company_id NULL, so validation is trivially
    -- satisfied; doing it explicitly keeps the constraint out of "not valid"
    -- limbo where later ALTERs behave surprisingly.
    ALTER TABLE public.businesses VALIDATE CONSTRAINT businesses_company_id_fkey;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS businesses_company_id_idx
  ON public.businesses (company_id);

COMMENT ON COLUMN public.businesses.company_id IS
  'Owning tenant. NULLABLE during the W0 transition — every one of the 3 live '
  'rows starts NULL. W0/08 backfills it; W0/10 refuses to run while any '
  'company-scoped row is still NULL.';


-- ---------------------------------------------------------------------
-- 8. OPT-IN BOOTSTRAP.
--
--    Creating a company and assigning the 3 existing businesses to it is a
--    PRODUCT decision, not a schema decision — it decides who owns the live
--    data. This migration will NOT make that choice silently.
--
--    Run this by hand, once, after deciding the company name:
--
--      -- 1. create the tenant
--      INSERT INTO public.companies (name, slug)
--      VALUES ('Your Company Name', 'your-company')
--      RETURNING id;
--
--      -- 2. point every existing business at it
--      UPDATE public.businesses SET company_id = '<that id>'
--       WHERE company_id IS NULL;
--
--      -- 3. after the first real signup, make that person the owner
--      INSERT INTO public.company_members (company_id, user_id, role, status, accepted_at)
--      SELECT '<that id>', u.id, 'owner', 'active', now()
--        FROM auth.users u WHERE u.email = 'you@example.com'
--      ON CONFLICT (company_id, user_id) DO NOTHING;
--
--    W0/08 has a guarded auto-backfill that fills jobs/clients/media from
--    businesses.company_id once step 2 above has been done.
--
--    Or call the helper below, which does all three in one transaction and
--    refuses rather than guessing when the inputs are wrong:
--
--      SELECT app.w0_bootstrap_tenant('Your Company Name', 'you@example.com');
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.w0_bootstrap_tenant(
  p_company_name text,
  p_owner_email  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company uuid;
  v_user    uuid;
  n_biz     bigint;
BEGIN
  IF coalesce(btrim(p_company_name), '') = '' THEN
    RAISE EXCEPTION 'app.w0_bootstrap_tenant: a company name is required';
  END IF;

  -- Re-runnable: reuse the company if one with this name already exists.
  SELECT id INTO v_company
    FROM public.companies
   WHERE lower(btrim(name)) = lower(btrim(p_company_name))
   LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO public.companies (name, slug)
    VALUES (btrim(p_company_name),
            regexp_replace(lower(btrim(p_company_name)), '[^a-z0-9]+', '-', 'g'))
    RETURNING id INTO v_company;
    RAISE NOTICE 'w0_bootstrap_tenant: created company % (%)', p_company_name, v_company;
  ELSE
    RAISE NOTICE 'w0_bootstrap_tenant: reusing existing company % (%)',
                 p_company_name, v_company;
  END IF;

  -- Point every unassigned business at it. businesses is the ONLY place
  -- tenancy is known, and W0/08 backfills everything else through it.
  UPDATE public.businesses SET company_id = v_company WHERE company_id IS NULL;
  GET DIAGNOSTICS n_biz = ROW_COUNT;
  RAISE NOTICE 'w0_bootstrap_tenant: % business(es) assigned', n_biz;

  -- The owner membership. Only possible once a real signup exists: user_id
  -- must be an auth.users id, because W0/10's interlock rejects any active
  -- member that does not resolve to one. Seeding this from public.users would
  -- pass here and then permanently block W0/10 — so it is not done.
  IF p_owner_email IS NOT NULL THEN
    IF to_regclass('auth.users') IS NULL THEN
      RAISE EXCEPTION 'app.w0_bootstrap_tenant: auth.users does not exist; '
                      'omit p_owner_email on a non-Supabase instance';
    END IF;

    EXECUTE 'SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1'
      INTO v_user USING p_owner_email;

    IF v_user IS NULL THEN
      RAISE EXCEPTION
        'app.w0_bootstrap_tenant: no auth.users row for %. Sign that person '
        'up first, then re-run. The company and business assignment above '
        'have been applied.', p_owner_email;
    END IF;

    INSERT INTO public.company_members
      (company_id, user_id, role, status, accepted_at)
    VALUES (v_company, v_user, 'owner', 'active', now())
    ON CONFLICT (company_id, user_id) DO UPDATE
      SET role = 'owner', status = 'active',
          accepted_at = coalesce(public.company_members.accepted_at, now());

    RAISE NOTICE 'w0_bootstrap_tenant: % is now owner of %', p_owner_email, v_company;
  ELSE
    RAISE NOTICE 'w0_bootstrap_tenant: no owner email supplied — create the '
                 'company_members row after the first real signup. W0/10 '
                 'refuses to enable RLS until at least one ACTIVE member '
                 'exists and resolves to a real auth.users row.';
  END IF;

  RAISE NOTICE 'w0_bootstrap_tenant: now RE-RUN W0/08 to backfill company_id '
               'across jobs, clients, media and every job-scoped table.';

  RETURN v_company;
END $$;

COMMENT ON FUNCTION app.w0_bootstrap_tenant(text, text) IS
  'One-call tenant bootstrap: creates (or reuses) the company, assigns every '
  'unassigned business to it, and makes the named auth user its owner. '
  'Idempotent. Deliberately NOT called by any migration — deciding who owns '
  'the live data is a product decision, not a schema one. Run it by hand, '
  'then re-run W0/08.';



-- ---------------------------------------------------------------------
-- 9. DO NOT UNCOMMENT UNTIL REAL USERS EXIST.
--
--    Once auth.users is non-empty AND every company_members.user_id
--    corresponds to a real auth user, add the referential guarantee:
--
--      ALTER TABLE public.company_members
--        ADD CONSTRAINT company_members_user_id_fkey
--        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
--        NOT VALID;
--      ALTER TABLE public.company_members
--        VALIDATE CONSTRAINT company_members_user_id_fkey;
--
--    Adding it today would not fail (the table is empty) but it would make
--    the table unwritable by anything except a real signup flow, which does
--    not exist yet. That is a trap for whoever seeds the first tenant.
-- ---------------------------------------------------------------------

INSERT INTO app.w0_series_log (step, detail)
VALUES ('01_identity_companies_membership',
        'companies + company_members created; businesses.company_id and '
        'businesses.logo_url added; avatars bucket ensured; membership helper '
        'functions installed, reading the sub claim from BOTH '
        'request.jwt.claims (PostgREST v9+) and request.jwt.claim.sub (legacy) '
        'and verified at apply time; public.current_company_ids() wrapper added '
        'so policies and operators need no USAGE on schema app; '
        'app.w0_bootstrap_tenant() installed. No RLS, no auth.users FK.')
ON CONFLICT (step) DO UPDATE SET applied_at = now(), applied_by = current_user;
