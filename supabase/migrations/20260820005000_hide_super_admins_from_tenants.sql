-- ---------------------------------------------------------------------
-- Hide super admins from tenants.
--
-- Super admins have full access to every account (see is_super_admin() in
-- every table policy) but are not members of any business's team. Tighten
-- users_select so non-super-admin callers can only see:
--   * themselves (always), and
--   * users assigned to jobs in businesses they own, provided that user is
--     not a super_admin.
-- Super admins continue to see every row.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "users_select" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR id = auth.uid()
    OR (
      role <> 'super_admin'
      AND id IN (
        SELECT j.assigned_to
        FROM public.jobs j
        WHERE public.owns_business(j.business_id)
          AND j.assigned_to IS NOT NULL
      )
    )
  );
