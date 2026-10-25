-- Tenant-scoped automation
--
-- `event_triggers` is the good automation engine in this codebase: it has
-- conditions, row claiming through a cursor, and a `trigger_runs` log. It was
-- also platform-global and super-admin-only, so the people who would pay for
-- automation could not reach it — while the Workflow Builder they *can* reach
-- offers ~18 step types of which one is implemented.
--
-- Giving a trigger an owning business is what makes it safe to open up:
--
--   business_id IS NULL  -> platform-wide, super admin only (unchanged)
--   business_id = <id>   -> belongs to that business; its row scans and its
--                           notifications are confined to that business
--
-- The worker enforces the scope when it evaluates a trigger; this migration
-- enforces it at the row level so a tenant cannot read or write another
-- tenant's automation even by talking to PostgREST directly.

ALTER TABLE public.event_triggers
  ADD COLUMN IF NOT EXISTS business_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_triggers_business_id_fkey'
      AND conrelid = 'public.event_triggers'::regclass
  ) THEN
    ALTER TABLE public.event_triggers
      ADD CONSTRAINT event_triggers_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS event_triggers_business_active_idx
  ON public.event_triggers (business_id, is_active);

-- ── RLS ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'event_triggers'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.event_triggers', r.policyname);
  END LOOP;
END $$;

-- A platform trigger (business_id IS NULL) stays super-admin-only, exactly as
-- before. A business's own triggers follow the same can_read/can_write split as
-- every other business-scoped table.
CREATE POLICY "event_triggers_select" ON public.event_triggers
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (business_id IS NOT NULL AND public.can_read_business(business_id))
  );

CREATE POLICY "event_triggers_write" ON public.event_triggers
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (business_id IS NOT NULL AND public.can_write_business(business_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (business_id IS NOT NULL AND public.can_write_business(business_id))
  );

-- ── trigger_runs: readable with the trigger it belongs to ──────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'trigger_runs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.trigger_runs', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "trigger_runs_select" ON public.trigger_runs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_triggers t
      WHERE t.id = trigger_runs.trigger_id
        AND t.business_id IS NOT NULL
        AND public.can_read_business(t.business_id)
    )
  );

-- Runs are written by the worker (service role) only. A tenant that could
-- forge or delete its own run log would make the log worthless as a record.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trigger_runs FROM authenticated, anon;
GRANT SELECT ON public.trigger_runs TO authenticated;
