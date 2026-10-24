-- Applied to the live database on 2026-09-07 (version 20260907130305).
-- Back-ported into the repo on 2026-09-07.
--
-- OUTAGE FIX. Creating a business failed for every non-super-admin with
--   42501 new row violates row-level security policy for table "businesses"
-- so no new user could complete /onboarding.
--
-- Root cause was NOT the INSERT policy — the insert itself succeeded. It was
-- the RETURNING clause: dataService.createBusiness() calls
-- .insert(...).select().single(), and the SELECT policy was
--   USING (can_read_business(id))
-- where can_read_business -> owns_business is STABLE SECURITY DEFINER and
-- re-reads public.businesses. A STABLE function runs against the snapshot
-- taken at the START of the statement, so during INSERT ... RETURNING it
-- cannot see the row being inserted. The visibility check fails and the whole
-- statement rolls back. Super admins were unaffected because is_super_admin()
-- short-circuits before the self-referential lookup.
--
-- Fix: evaluate ownership inline against the row itself — no table re-read, so
-- no snapshot problem. Membership still goes through a SECURITY DEFINER helper
-- to avoid recursive RLS on business_members. Access semantics are unchanged.
--
-- NOTE for future policies: any SELECT policy whose function re-reads its OWN
-- table has this bug. public.business_members_select is the same shape; it is
-- currently harmless only because `authenticated` has no INSERT grant on
-- business_members (writes go through /api/team with the service role).

CREATE OR REPLACE FUNCTION public.is_business_member(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members m
    WHERE m.business_id = bid AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS businesses_select ON public.businesses;

CREATE POLICY businesses_select ON public.businesses
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR owner_id = auth.uid()
  OR public.is_business_member(id)
);
