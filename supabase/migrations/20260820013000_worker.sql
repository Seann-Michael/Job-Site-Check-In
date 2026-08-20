-- ============================================================================
-- Background worker support tables.
--
-- The API is deployed as a SINGLE instance on DigitalOcean, so an in-process
-- poller (server/lib/worker.ts) runs scheduled broadcasts, scheduled email
-- campaigns, and automation event triggers. These two tables persist the
-- worker's cursors and its automation execution log.
--
-- Both are written ONLY by the API server (service role, which bypasses RLS).
-- The `authenticated` (PostgREST) role gets SELECT only, gated to super admins
-- by the existing is_super_admin() helper; all client writes are revoked so
-- cursors and run logs can never be forged from the browser.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, guarded constraints, DROP POLICY IF
-- EXISTS before CREATE POLICY.
-- ============================================================================

-- ── worker_state: per-event "last scanned at" cursors ──────────────────────
CREATE TABLE IF NOT EXISTS public.worker_state (
  key        text NOT NULL,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_state_pkey' AND conrelid = 'public.worker_state'::regclass) THEN
    ALTER TABLE public.worker_state ADD CONSTRAINT worker_state_pkey PRIMARY KEY (key);
  END IF;
END $$;

ALTER TABLE public.worker_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_state_select" ON public.worker_state;
CREATE POLICY "worker_state_select" ON public.worker_state
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- No INSERT/UPDATE/DELETE policy: only the service role (server) may write.
REVOKE INSERT, UPDATE, DELETE ON public.worker_state FROM authenticated;
REVOKE ALL ON public.worker_state FROM anon;
GRANT SELECT ON public.worker_state TO authenticated;

-- ── trigger_runs: automation execution log ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trigger_runs (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  trigger_id uuid REFERENCES public.event_triggers(id) ON DELETE CASCADE,
  event      text,
  status     text NOT NULL,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trigger_runs_pkey' AND conrelid = 'public.trigger_runs'::regclass) THEN
    ALTER TABLE public.trigger_runs ADD CONSTRAINT trigger_runs_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trigger_runs_status_check' AND conrelid = 'public.trigger_runs'::regclass) THEN
    ALTER TABLE public.trigger_runs ADD CONSTRAINT trigger_runs_status_check
      CHECK (status IN ('success', 'failed', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trigger_runs_trigger_id_idx ON public.trigger_runs (trigger_id);
CREATE INDEX IF NOT EXISTS trigger_runs_created_at_idx  ON public.trigger_runs (created_at);

ALTER TABLE public.trigger_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trigger_runs_select" ON public.trigger_runs;
CREATE POLICY "trigger_runs_select" ON public.trigger_runs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- No INSERT/UPDATE/DELETE policy: only the service role (server) may write.
REVOKE INSERT, UPDATE, DELETE ON public.trigger_runs FROM authenticated;
REVOKE ALL ON public.trigger_runs FROM anon;
GRANT SELECT ON public.trigger_runs TO authenticated;
