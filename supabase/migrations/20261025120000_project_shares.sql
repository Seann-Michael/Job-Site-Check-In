-- ============================================================================
-- project_shares: one row per "share this project" request.
--
-- A share bundles a job's photos and a caption and sends them to one or more
-- destinations (Google Business Profile, Facebook Page, Instagram, website).
-- The API server creates rows and the in-process worker (server/lib/worker.ts)
-- delivers queued ones, recording a per-destination result so the apps can
-- show queued / live / failed-with-reason without guessing.
--
-- Written ONLY by the API server (service role). Members of the business may
-- read their own business's rows through RLS; nothing is writable from a
-- client, so delivery status can never be forged.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_shares (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id        uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_by    uuid,
  -- Which photos go out, in order. Each must belong to job_id.
  media_ids     uuid[] NOT NULL DEFAULT '{}',
  -- Requested destinations: gbp | facebook | instagram | website
  destinations  text[] NOT NULL DEFAULT '{}',
  -- One post, fitted per destination: {"title","gbp","facebook","instagram","website","hashtags":[...]}
  caption       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Settings snapshot the worker needs (e.g. website workflow id, CTA).
  options       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- queued -> processing -> done | partial | failed. draft = saved, not sent.
  status        text NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  -- {"gbp":{"status":"live","detail":"…","external_id":"…","url":"…","at":"…"}, …}
  results       jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_shares_pkey' AND conrelid = 'public.project_shares'::regclass) THEN
    ALTER TABLE public.project_shares ADD CONSTRAINT project_shares_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_shares_status_check' AND conrelid = 'public.project_shares'::regclass) THEN
    ALTER TABLE public.project_shares ADD CONSTRAINT project_shares_status_check
      CHECK (status IN ('draft', 'queued', 'processing', 'done', 'partial', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_shares_business_status_idx ON public.project_shares (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS project_shares_job_idx ON public.project_shares (job_id);
CREATE INDEX IF NOT EXISTS project_shares_queue_idx ON public.project_shares (status, scheduled_for) WHERE status = 'queued';

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_shares_select" ON public.project_shares;
CREATE POLICY "project_shares_select" ON public.project_shares
  FOR SELECT TO authenticated
  USING (public.can_read_business(business_id));

REVOKE INSERT, UPDATE, DELETE ON public.project_shares FROM authenticated;
REVOKE ALL ON public.project_shares FROM anon;
GRANT SELECT ON public.project_shares TO authenticated;

-- Per-business sharing settings the apps read and the owner edits via the API.
-- Kept on businesses so a workspace has exactly one source of truth.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS share_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
-- share_settings shape (all optional):
--   {"destinations":{"gbp":true,"facebook":false,"instagram":false,"website":true},
--    "after_capture":"ask"|"auto"|"queue",
--    "website_workflow_id":"<uuid>",
--    "max_photos":6, "hashtags":true,
--    "caption":{"tone":"plain","always_mention":"…","never_say":["…"]}}
