-- =====================================================================
-- Auth step 1: tie public.users to auth.users, add role helpers.
-- =====================================================================
-- Model:
--   * public.users.id === auth.users.id (Supabase Auth is the source of truth
--     for credentials; public.users holds the profile + role).
--   * A business is owned by the user in businesses.owner_id.
--   * Roles (user_role enum): super_admin | agency_admin | business_owner |
--     staff | viewer.  agency_admin is unused (agency features were removed).
--
-- This migration is safe to run before RLS: it only adds a trigger, three
-- helper functions, and backfills nothing destructive.

-- ---------------------------------------------------------------------
-- 1. New auth users get a matching public.users row automatically.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_first text;
  v_last text;
BEGIN
  v_first := NULLIF(NEW.raw_user_meta_data ->> 'first_name', '');
  v_last  := NULLIF(NEW.raw_user_meta_data ->> 'last_name', '');
  v_name  := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(trim(concat_ws(' ', v_first, v_last)), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, email, name, first_name, last_name, role, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_first,
    v_last,
    'business_owner'::user_role,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        email_verified = EXCLUDED.email_verified,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Keep email_verified in sync when a user confirms their email.
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
     SET email = NEW.email,
         email_verified = NEW.email_confirmed_at IS NOT NULL,
         last_login = COALESCE(NEW.last_sign_in_at, public.users.last_login),
         updated_at = now()
   WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
        OR OLD.email IS DISTINCT FROM NEW.email
        OR OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_auth_user_updated();

-- ---------------------------------------------------------------------
-- 2. Role/ownership helpers used by RLS policies (next migration).
--    SECURITY DEFINER so they can read public.users under RLS without the
--    policy recursing. search_path pinned; no anon/authenticated EXECUTE
--    beyond what RLS needs (these are safe read-only checks on the caller).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_business(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = bid AND owner_id = auth.uid()
  );
$$;

-- All business ids the current user may act on (owner today; membership later).
CREATE OR REPLACE FUNCTION public.current_business_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.businesses WHERE owner_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_business_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_business(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_business_ids() TO authenticated;

-- Text overload: sms_logs.business_id is text.
CREATE OR REPLACE FUNCTION public.owns_business(bid text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  BEGIN u := bid::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN EXISTS (SELECT 1 FROM public.businesses WHERE id = u AND owner_id = auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.owns_business(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_business(text) TO authenticated;

-- Trigger functions must never be RPC-callable by API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_updated() FROM anon, authenticated, public;
