-- =====================================================================
-- Mobile field tables + shared galleries (2026-09-15)
-- =====================================================================
--
-- The phone app has written to five tables that never existed on the live
-- project (every sync failed silently and the data stayed on-device only):
--
--   job_checkins      job-extras.ts / team-presence.ts   (who is on site)
--   job_notes         job-extras.ts                      (per-job notes)
--   job_field_state   tasks-store.ts / job-meta.ts       (checklist + meta blobs)
--   media_comments    media-comments.ts                  (photo comments)
--   shared_galleries  share-links.ts                     (customer gallery links)
--
-- This creates them against the CURRENT tenancy model — `business_id` +
-- can_read_business()/can_write_business() from 20260820008000 — not the
-- parked W0 `companies` series. Rows are scoped through the job they belong
-- to; a helper resolves job_id (TEXT, because the client also passes demo /
-- local ids that must simply be refused, not blow up with 22P02) to the
-- owning business.
--
-- Shared galleries store job_media ids, not URLs: the `media` bucket is
-- private, so the public page gets short-lived signed URLs from
-- GET /api/public/gallery/:token (server/routes/publicContent.ts), which
-- calls the SECURITY DEFINER gallery_by_token() below.
-- =====================================================================

-- ── Helper: business owning a job id given as text ────────────────────────
CREATE OR REPLACE FUNCTION public.job_business_id(p_job_id text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.business_id
  FROM public.jobs j
  WHERE p_job_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND j.id = p_job_id::uuid
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.job_business_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_business_id(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.media_business_id(p_media_id text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.business_id
  FROM public.job_media m
  JOIN public.jobs j ON j.id = m.job_id
  WHERE p_media_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND m.id = p_media_id::uuid
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.media_business_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_business_id(text) TO authenticated, service_role;

-- ── job_checkins ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         text NOT NULL,
  user_id        uuid DEFAULT auth.uid(),
  user_name      text NOT NULL DEFAULT 'Team member',
  checked_in_at  timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  latitude       double precision,
  longitude      double precision,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_checkins_job_idx ON public.job_checkins (job_id, checked_in_at);
CREATE INDEX IF NOT EXISTS job_checkins_open_idx ON public.job_checkins (job_id) WHERE checked_out_at IS NULL;

-- ── job_notes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      text NOT NULL,
  user_id     uuid DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT 'Team member',
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_notes_job_idx ON public.job_notes (job_id, created_at DESC);

-- ── job_field_state (one row per job; tasks + meta upserted separately) ───
-- job_id is the PRIMARY KEY because tasks-store.ts and job-meta.ts both
-- .upsert({ job_id, ... }) with no onConflict. `tasks` and `meta` stay
-- nullable because each module only ever writes its own column.
CREATE TABLE IF NOT EXISTS public.job_field_state (
  job_id     text PRIMARY KEY,
  tasks      jsonb,
  meta       jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── media_comments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id    text NOT NULL,
  user_id     uuid DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT 'Team member',
  comment     text NOT NULL,
  mentions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_comments_media_idx ON public.media_comments (media_id, created_at);

-- ── shared_galleries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_galleries (
  token         text PRIMARY KEY,
  job_id        uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_title     text,
  business_name text,
  media_ids     uuid[] NOT NULL DEFAULT '{}',
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  CONSTRAINT shared_galleries_token_format CHECK (token ~ '^[A-Za-z0-9_-]{8,64}$')
);
CREATE INDEX IF NOT EXISTS shared_galleries_job_idx ON public.shared_galleries (job_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.job_checkins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_field_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_galleries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.job_checkins, public.job_notes, public.job_field_state,
              public.media_comments, public.shared_galleries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_checkins, public.job_notes,
  public.job_field_state, public.media_comments, public.shared_galleries TO authenticated;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public'
           AND tablename IN ('job_checkins','job_notes','job_field_state','media_comments','shared_galleries') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY job_checkins_select ON public.job_checkins FOR SELECT TO authenticated
  USING (public.can_read_business(public.job_business_id(job_id)));
CREATE POLICY job_checkins_write ON public.job_checkins FOR ALL TO authenticated
  USING (public.can_write_business(public.job_business_id(job_id)))
  WITH CHECK (public.can_write_business(public.job_business_id(job_id)));

CREATE POLICY job_notes_select ON public.job_notes FOR SELECT TO authenticated
  USING (public.can_read_business(public.job_business_id(job_id)));
CREATE POLICY job_notes_write ON public.job_notes FOR ALL TO authenticated
  USING (public.can_write_business(public.job_business_id(job_id)))
  WITH CHECK (public.can_write_business(public.job_business_id(job_id)));

CREATE POLICY job_field_state_select ON public.job_field_state FOR SELECT TO authenticated
  USING (public.can_read_business(public.job_business_id(job_id)));
CREATE POLICY job_field_state_write ON public.job_field_state FOR ALL TO authenticated
  USING (public.can_write_business(public.job_business_id(job_id)))
  WITH CHECK (public.can_write_business(public.job_business_id(job_id)));

CREATE POLICY media_comments_select ON public.media_comments FOR SELECT TO authenticated
  USING (public.can_read_business(public.media_business_id(media_id)));
CREATE POLICY media_comments_write ON public.media_comments FOR ALL TO authenticated
  USING (public.can_write_business(public.media_business_id(media_id)))
  WITH CHECK (public.can_write_business(public.media_business_id(media_id)));

CREATE POLICY shared_galleries_select ON public.shared_galleries FOR SELECT TO authenticated
  USING (public.can_read_business(business_id));
CREATE POLICY shared_galleries_write ON public.shared_galleries FOR ALL TO authenticated
  USING (public.can_write_business(business_id))
  WITH CHECK (public.can_write_business(business_id) AND business_id = public.job_business_id(job_id::text));

-- ── Public gallery lookup (token-scoped; anon never reads the table) ──────
-- Returns the gallery's metadata plus the object keys of the selected
-- photos. The server signs the keys; the page never sees the bucket.
CREATE OR REPLACE FUNCTION public.gallery_by_token(p_token text)
RETURNS TABLE (
  token text, job_id uuid, job_title text, business_name text,
  created_at timestamptz, expires_at timestamptz, photo_paths text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.token, g.job_id, g.job_title, g.business_name, g.created_at, g.expires_at,
         COALESCE(ARRAY(
           SELECT m.file_path FROM public.job_media m
           WHERE m.id = ANY (g.media_ids) AND m.media_type = 'image'
           ORDER BY array_position(g.media_ids, m.id)
         ), '{}')
  FROM public.shared_galleries g
  WHERE g.token = p_token
    AND (g.expires_at IS NULL OR g.expires_at > now());
$$;
REVOKE ALL ON FUNCTION public.gallery_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gallery_by_token(text) TO service_role;
