-- Suspension enforcement + grant hygiene (2026-09-07 audit, P1 #7 / P2).
--
-- 1. Business suspension was enforced ONLY in the browser
--    (client/lib/workspaceService.ts filters status='active';
--    ProtectedRoute shows an "Account suspended" screen). Neither RLS nor the
--    Express middleware referenced businesses.status, so a suspended tenant
--    kept a valid session and full read/write via PostgREST with the anon key
--    and via every /api/* route. Suspension was cosmetic.
--
-- 2. Worse, businesses_update is `owner_id = auth.uid()`, so a suspended owner
--    could simply UPDATE their own row and set status back to 'active'. Only
--    /super-admin/businesses is supposed to change status.
--
-- 3. TRUNCATE was granted to `authenticated` on every public table. TRUNCATE
--    bypasses RLS entirely. Not reachable through PostgREST (it never emits
--    TRUNCATE) and `authenticated` is not a login role, so this was latent —
--    but there is no reason to hold the grant.
--
-- 4. Four views carried full write grants to `anon`. They are
--    security_invoker=on so the grants are inert today, but they are a trap for
--    the next SECURITY DEFINER view someone adds.
--
-- 5. Three tables had a privilege granted with no matching policy, so the
--    operation failed silently instead of being either possible or cleanly
--    revoked (nobody, not even a super admin, could delete a support ticket).

-- ── 1. Writes require an active business ────────────────────────────────────
-- Reads are deliberately NOT gated on status: a suspended tenant must still be
-- able to see their data and reach billing to reactivate. Only writes stop.
CREATE OR REPLACE FUNCTION public.can_write_business(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_super_admin()
      OR (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = bid AND b.status = 'active')
        AND (
          public.owns_business(bid)
          OR EXISTS (
            SELECT 1 FROM public.business_members m
            WHERE m.business_id = bid AND m.user_id = auth.uid() AND m.role = 'staff'
          )
        )
      );
$$;

-- ── 2. Only super admins may change a business's privileged columns ─────────
CREATE OR REPLACE FUNCTION public.guard_business_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE caller_is_admin boolean;
BEGIN
  -- Service role / trusted server paths have no auth.uid().
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    INTO caller_is_admin;
  IF caller_is_admin THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    RAISE EXCEPTION 'not allowed to change privileged business fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_business_privileged_columns ON public.businesses;
CREATE TRIGGER trg_guard_business_privileged_columns
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_privileged_columns();

-- ── 3. TRUNCATE is never needed by a client role ────────────────────────────
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM authenticated, anon;

-- ── 4. Views are read-only ──────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.projects,
  public.user_dashboard_summary,
  public.business_performance_summary,
  public.project_activity_summary
FROM anon, authenticated;

-- ── 5. Close the grant/policy gaps (super-admin moderation) ─────────────────
DROP POLICY IF EXISTS support_tickets_admin_delete ON public.support_tickets;
CREATE POLICY support_tickets_admin_delete ON public.support_tickets
  FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS ticket_responses_admin_update ON public.ticket_responses;
CREATE POLICY ticket_responses_admin_update ON public.ticket_responses
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ticket_responses_admin_delete ON public.ticket_responses;
CREATE POLICY ticket_responses_admin_delete ON public.ticket_responses
  FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS idea_comments_admin_update ON public.idea_comments;
CREATE POLICY idea_comments_admin_update ON public.idea_comments
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
