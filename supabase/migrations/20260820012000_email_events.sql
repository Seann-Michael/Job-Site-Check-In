-- ============================================================================
-- email_events: one row per outbound email attempt (campaign sends + tests).
--
-- Written ONLY by the API server (service role) from server/lib/email.ts and
-- server/routes/email.ts. The `authenticated` (PostgREST) role gets SELECT
-- only, gated to super admins by the existing is_super_admin() helper; there
-- are no client write policies (writes revoked), so events cannot be forged.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, guarded constraint, DROP POLICY IF
-- EXISTS before CREATE POLICY.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_events (
  id          uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  provider_id uuid,
  to_email    text,
  status      text NOT NULL,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_events_pkey' AND conrelid = 'public.email_events'::regclass) THEN
    ALTER TABLE public.email_events ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_events_status_check' AND conrelid = 'public.email_events'::regclass) THEN
    ALTER TABLE public.email_events ADD CONSTRAINT email_events_status_check
      CHECK (status IN ('sent', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_events_campaign_id_idx ON public.email_events (campaign_id);
CREATE INDEX IF NOT EXISTS email_events_created_at_idx  ON public.email_events (created_at);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- SELECT for super admins only; NO client writes (service role bypasses RLS).
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_events_select" ON public.email_events;
CREATE POLICY "email_events_select" ON public.email_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- No INSERT/UPDATE/DELETE policy: only the service role (server) may write.
REVOKE INSERT, UPDATE, DELETE ON public.email_events FROM authenticated;
REVOKE ALL ON public.email_events FROM anon;
GRANT SELECT ON public.email_events TO authenticated;
