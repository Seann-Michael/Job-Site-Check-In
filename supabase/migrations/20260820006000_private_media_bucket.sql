-- Private `media` bucket + public `public-assets` bucket.
--
-- Before: the single `media` bucket was public and bucket-wide readable by
-- anon, so every job photo, client document and avatar was fetchable by URL.
--
-- After:
--   media          private  job/client media + documents, avatars, server
--                           uploads (<account_id>/<uuid>.<ext>). Read via
--                           short-lived signed URLs (client for signed-in
--                           users, server for public share pages).
--   public-assets  public   business logos, review-gate videos, site branding.
--                           Safe to hot-link (review gate page, automations).
--
-- Path layout in BOTH buckets stays <area>/<owner-scoped-uuid>/... and is
-- enforced by public.storage_path_allowed() (branding/ = super admin only).
--
-- Companion (NOT run by this migration): scripts/migrate-public-assets.ts
-- moves the existing business-logos/, review-gate-videos/ and branding/
-- objects from `media` to `public-assets`. Run it right after applying this
-- file. See docs/MEDIA_STORAGE.md.

-- ---------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------
UPDATE storage.buckets
   SET public = false,
       file_size_limit = 52428800          -- 50 MB
 WHERE id = 'media';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets', 'public-assets', true, 26214400,   -- 25 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
        'video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. storage.objects policies
-- ---------------------------------------------------------------------
-- media: no anon read, no bucket-wide read. Authenticated users may read
-- (i.e. sign URLs for / download) only objects under a path they own.
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_read"   ON storage.objects;
CREATE POLICY "media_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.storage_path_allowed(name));

-- media writes: unchanged (re-created so this file is self-contained).
DROP POLICY IF EXISTS "media_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "media_auth_delete" ON storage.objects;
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.storage_path_allowed(name));
CREATE POLICY "media_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'media' AND public.storage_path_allowed(name))
  WITH CHECK (bucket_id = 'media' AND public.storage_path_allowed(name));
CREATE POLICY "media_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING      (bucket_id = 'media' AND public.storage_path_allowed(name));

-- public-assets: world-readable; writes tenant-scoped exactly like media.
-- (A public bucket serves objects without consulting SELECT policies, but
-- list/metadata calls from the client SDK still do, so grant it explicitly.)
DROP POLICY IF EXISTS "public_assets_read"   ON storage.objects;
DROP POLICY IF EXISTS "public_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "public_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "public_assets_delete" ON storage.objects;
CREATE POLICY "public_assets_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public-assets');
CREATE POLICY "public_assets_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-assets' AND public.storage_path_allowed(name));
CREATE POLICY "public_assets_update" ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'public-assets' AND public.storage_path_allowed(name))
  WITH CHECK (bucket_id = 'public-assets' AND public.storage_path_allowed(name));
CREATE POLICY "public_assets_delete" ON storage.objects FOR DELETE TO authenticated
  USING      (bucket_id = 'public-assets' AND public.storage_path_allowed(name));

-- ---------------------------------------------------------------------
-- 3. server_media_metadata: visibility flag used by
--    GET /api/public/media/:publicId/:filename (exists on the live schema;
--    kept idempotent for fresh environments).
-- ---------------------------------------------------------------------
ALTER TABLE public.server_media_metadata
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.server_media_metadata
  ADD COLUMN IF NOT EXISTS public_url_id text;
CREATE INDEX IF NOT EXISTS idx_server_media_public_url
  ON public.server_media_metadata USING btree (public_url_id);

-- ---------------------------------------------------------------------
-- 4. Re-point stored URLs of assets that move to `public-assets`.
--    Bytes are moved by scripts/migrate-public-assets.ts; this only
--    rewrites the persisted URL strings so the app reads from the new
--    bucket once the objects are there. Prefix-scoped so job/client media
--    URLs (which stay in `media`) are untouched.
-- ---------------------------------------------------------------------
UPDATE public.businesses
   SET settings = replace(
                    replace(settings::text,
                            '/storage/v1/object/public/media/business-logos/',
                            '/storage/v1/object/public/public-assets/business-logos/'),
                    '/storage/v1/object/public/media/review-gate-videos/',
                    '/storage/v1/object/public/public-assets/review-gate-videos/'
                  )::jsonb
 WHERE settings::text LIKE '%/storage/v1/object/public/media/business-logos/%'
    OR settings::text LIKE '%/storage/v1/object/public/media/review-gate-videos/%';

UPDATE public.system_settings
   SET value = replace(value::text,
                       '/storage/v1/object/public/media/branding/',
                       '/storage/v1/object/public/public-assets/branding/')::jsonb
 WHERE key = 'branding'
   AND value::text LIKE '%/storage/v1/object/public/media/branding/%';
