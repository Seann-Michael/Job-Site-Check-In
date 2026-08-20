-- Support the Google Business Profile sync's review de-duplication.
--
-- The GBP sync (server/routes/gbp.ts → handleSync) upserts Google reviews into
-- public.reviews keyed by (business_id, platform, platform_review_id). It looks
-- up existing rows by that triple before deciding insert vs. update. This index
-- makes that lookup fast.
--
-- We also add a PARTIAL UNIQUE index to guarantee a Google review is stored at
-- most once per business, protecting against races between concurrent syncs.
-- It is partial (platform = 'google' AND platform_review_id IS NOT NULL) so it
-- never constrains manually-entered or other-platform reviews that may share a
-- null external id.
--
-- NOTE: if pre-existing data already contains duplicate Google reviews for a
-- business, creating the UNIQUE index will fail. De-duplicate first (keep the
-- most recently updated row) — the commented block below does this — then
-- create the index.

-- De-dup any pre-existing Google review duplicates (keep newest updated_at).
-- Uncomment if the CREATE UNIQUE INDEX below fails on existing data.
-- DELETE FROM public.reviews r
-- USING public.reviews r2
-- WHERE r.platform = 'google'
--   AND r2.platform = 'google'
--   AND r.business_id = r2.business_id
--   AND r.platform_review_id = r2.platform_review_id
--   AND r.platform_review_id IS NOT NULL
--   AND (r.updated_at < r2.updated_at OR (r.updated_at = r2.updated_at AND r.id < r2.id));

-- Fast lookup for the sync's existing-row probe.
CREATE INDEX IF NOT EXISTS reviews_business_platform_extid_idx
  ON public.reviews (business_id, platform, platform_review_id);

-- One Google review per (business, external id).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_google_business_extid_uidx
  ON public.reviews (business_id, platform_review_id)
  WHERE platform = 'google' AND platform_review_id IS NOT NULL;
