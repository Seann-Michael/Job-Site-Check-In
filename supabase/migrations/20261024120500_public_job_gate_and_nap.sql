-- Public job pages: a publish gate, and the NAP a search engine needs
--
-- Two problems, one function:
--
--   1. NO PUBLISH GATE. public_job() returned any job by id, including drafts.
--      That was already wrong; it becomes materially worse the moment these
--      pages are indexable, because every draft would become a public page in
--      Google. The gate is: a job is public when it is completed, or when it is
--      explicitly opted in with metadata.is_public = true. metadata.is_public =
--      false force-hides a job whatever its status.
--
--   2. NO BUSINESS IDENTITY. The page had the job's own name and photos and
--      nothing else — no name, address or phone — so it could not carry
--      LocalBusiness markup, and a completed-work page with no NAP on it is not
--      a local SEO asset at all. The function now returns the business fields
--      the page and its JSON-LD render.
--
-- Still projected narrowly: no client contact, no GPS, no internal notes. The
-- business NAP returned here is the same information the business publishes on
-- its own Google profile.

CREATE OR REPLACE FUNCTION public.public_job(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  completed_at timestamptz,
  seo_targets jsonb,
  metadata jsonb,
  photo_paths text[],
  business jsonb,
  indexable boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    j.id,
    j.name,
    j.description,
    j.created_at,
    j.completed_at,
    NULL::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'tags',     j.metadata -> 'tags',
      'keywords', j.metadata -> 'keywords',
      'service',  j.metadata -> 'service'
    )),
    COALESCE(ARRAY(SELECT m.file_path FROM public.job_media m
                   WHERE m.job_id = j.id AND m.media_type = 'image'
                   ORDER BY m.created_at), '{}'),
    -- Name, address, phone, site: what LocalBusiness markup is made of.
    jsonb_strip_nulls(jsonb_build_object(
      'name',      b.name,
      'phone',     b.phone,
      'website',   b.website,
      'street',    b.address ->> 'street',
      'city',      b.address ->> 'city',
      'state',     b.address ->> 'state',
      'postal',    COALESCE(b.address ->> 'zip', b.address ->> 'postal_code'),
      'country',   COALESCE(b.address ->> 'country', 'US'),
      'mapsUrl',   b.google_my_business ->> 'maps_url',
      'reviewUrl', b.google_my_business ->> 'review_url',
      'logoUrl',   b.settings ->> 'logoUrl'
    )),
    -- Indexable unless the job or the business opts out. Suppressing a page
    -- from search must never require deleting it.
    COALESCE((j.metadata ->> 'noindex')::boolean, false) IS NOT TRUE
      AND COALESCE((b.settings ->> 'noindexPublicPages')::boolean, false) IS NOT TRUE
  FROM public.jobs j
  LEFT JOIN public.businesses b ON b.id = j.business_id
  WHERE j.id = p_id
    -- The publish gate.
    AND COALESCE((j.metadata ->> 'is_public')::boolean, j.status = 'completed') IS TRUE
    -- A suspended or deleted tenant's pages go dark with the account.
    AND (b.id IS NULL OR b.status = 'active');
$$;

REVOKE ALL ON FUNCTION public.public_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_job(uuid) TO anon, authenticated;

-- ── Sitemap source ──────────────────────────────────────────────────────────
-- Indexable pages that no sitemap lists are pages Google has to stumble onto.
-- Returns only what the publish gate above already makes public.
CREATE OR REPLACE FUNCTION public.public_job_sitemap(p_limit int DEFAULT 5000)
RETURNS TABLE (id uuid, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, GREATEST(j.updated_at, j.created_at)
  FROM public.jobs j
  LEFT JOIN public.businesses b ON b.id = j.business_id
  WHERE COALESCE((j.metadata ->> 'is_public')::boolean, j.status = 'completed') IS TRUE
    AND COALESCE((j.metadata ->> 'noindex')::boolean, false) IS NOT TRUE
    AND (b.id IS NULL OR b.status = 'active')
    AND COALESCE((b.settings ->> 'noindexPublicPages')::boolean, false) IS NOT TRUE
  ORDER BY GREATEST(j.updated_at, j.created_at) DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 50000);
$$;

REVOKE ALL ON FUNCTION public.public_job_sitemap(int) FROM PUBLIC;
-- Service role only: the sitemap is built by the server, not fetched by a client.
