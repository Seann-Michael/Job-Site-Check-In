# Media storage: two buckets, private by default

Migration: `supabase/migrations/20260820006000_private_media_bucket.sql`
Companion script (run once, right after the migration): `scripts/migrate-public-assets.ts`

## Buckets

| Bucket          | Visibility | Holds                                                                                 | How it is read                                  |
| --------------- | ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `media`         | **private**| job/client photos + videos, job/client documents, avatars, server uploads              | short-lived **signed URLs** only                |
| `public-assets` | public     | business logos, review-gate videos, site branding (super admin)                       | plain public URLs (`getPublicUrl`), hot-linkable |

Limits: `media` 50 MB/object (any MIME); `public-assets` 25 MB/object, images + mp4/mov/webm only.

## Path layout (both buckets)

`<area>/<owner-scoped-uuid>/...` — enforced for INSERT/UPDATE/DELETE (and, for
`media`, SELECT) by `public.storage_path_allowed(name)`. The second segment
must be the caller's user id, a business the caller owns, a job or client of
such a business; `branding/` is super-admin only. Super admins bypass the check.

| Area                  | Bucket          | Written by                                        |
| --------------------- | --------------- | ------------------------------------------------- |
| `project-media/<jobId>/`      | media   | `dataService.uploadProjectMedia`, mobile capture   |
| `client-media/<clientId>/`    | media   | `dataService.uploadClientMedia`                    |
| `project-documents/<jobId>/`  | media   | `dataService.uploadProjectDocument`                |
| `client-documents/<clientId>/`| media   | `dataService.uploadClientDocument`                 |
| `avatars/<userId>/`           | media   | `Profile.tsx`                                      |
| `<accountId>/<uuid>.<ext>`    | media   | `server/routes/media.ts` (service role)            |
| `business-logos/<businessId>/`| public-assets | `Settings.tsx` (and mobile `logo.ts`)        |
| `review-gate-videos/<businessId>/` | public-assets | `Settings.tsx`, `ReviewGateEditor.tsx`  |
| `branding/<kind>.<ext>`       | public-assets | `systemSettingsService.uploadBrandingAsset`  |

## Storage policies (after the migration)

- `media_auth_read` — SELECT, `authenticated`, `bucket_id='media' AND storage_path_allowed(name)`.
  No anon read, no bucket-wide read. The old `media_public_read` policy is dropped.
- `media_auth_insert/update/delete` — unchanged (`authenticated`, path-gated).
- `public_assets_read` — SELECT, `anon, authenticated`, bucket-wide.
- `public_assets_insert/update/delete` — `authenticated`, path-gated.

## What is persisted in the database

`job_media.file_path`, `job_documents.file_path`, `users.avatar_url` hold the
**object key** (new web uploads, e.g. `project-media/<jobId>/x.jpg`) or the
legacy public-URL form (`https://…/storage/v1/object/public/media/<key>`,
older rows and mobile uploads). Either form is an *identifier*, not a fetchable
URL. `client/lib/mediaUrls.ts#mediaObjectKey` (and the server twin in
`server/routes/publicContent.ts`) normalise both forms back to a key.

`businesses.settings.businessLogo / logoUrl / reviewGateVideoUrl` and the
`system_settings.branding` values are real public URLs into `public-assets`
(cache-busted with `?v=`). The migration rewrites existing values from
`/object/public/media/<prefix>/` to `/object/public/public-assets/<prefix>/`.

## Signing

### Signed-in app (client)

`client/lib/mediaUrls.ts`

- `getSignedMediaUrl(path, expiresSec = 3600)` — one value. Non-`media` values
  (other hosts, `public-assets`, `blob:`/`data:`) are returned unchanged.
- `getSignedMediaUrls(paths[])` — batched via `createSignedUrls`; returns a map
  keyed by the *original* input value.
- In-memory cache keyed by object key; an entry is re-signed once less than 20%
  of its TTL remains. `clearSignedMediaUrlCache()` on sign-out.

Usage pattern: resolve once where the rows are loaded (`ProjectDetail`,
`Gallery`, `dataService.getFeaturedMediaForProjects`) or in an effect keyed on
the list (`ClientDetail`). Avatars are signed once per profile load in
`client/lib/auth.ts` with a 12 h TTL so `currentUser.avatar` stays renderable
everywhere.

Signing only succeeds for objects the caller may SELECT (path-gated), so a user
cannot mint URLs for another tenant's files.

### Public pages (server)

Anon cannot sign, so `server/routes/publicContent.ts` (mounted at
`/api/public`, no auth, 60 req / 15 min / IP, service role) does it:

- `GET /api/public/job/:id` → calls RPC `public_job`, returns
  `{ id, name, description, created_at, seo_targets, metadata, photos: [signedUrl…] }`.
  Only keys the RPC returned are signed (1 h). `PublicProject.tsx` uses this.
- `GET /api/public/review-request/:id` → RPC `review_request_public`
  passthrough. Video/logo are `public-assets` URLs and pass through; a legacy
  `media` value is signed instead. `ReviewGate.tsx` still calls the RPC
  directly (no storage involved) — the endpoint is there for automations.
- `GET /api/public/media/:publicId/:filename` → 302 to a signed URL, only for
  `server_media_metadata` rows with `is_public = true`. (The legacy
  `/public/media/...` mount still works; `/api/public/media` is canonical
  because the DO app only routes `/api/*` to the server.)

### Server uploads (`server/routes/media.ts`)

Uploads go to `media/<accountId>/<uuid>.<ext>` with the service role. Every
`url` returned by list / metadata / upload is a 1 h signed URL; `secureUrl`
(`/api/media/:id/:filename`, auth) and `publicUrl`
(`/api/public/media/:publicId/:filename`, `is_public` rows) are stable
redirectors.

## Applying

1. Apply `supabase/migrations/20260820006000_private_media_bucket.sql`.
2. Move the existing public-by-design objects (`business-logos/`,
   `review-gate-videos/`, `branding/`, including the legacy ownerless
   `review-gate-videos/1773717533399-bzaego7uvwv.MP4`) out of `media`:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-public-assets.ts --dry-run
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-public-assets.ts
   ```

   The script is idempotent (objects already present in `public-assets` are
   skipped and the `media` copy removed). Between step 1 and step 2 logos and
   review-gate videos 404, so run them back to back.

3. Deploy the app build that contains this change.

## Mobile app

`mobile/` still renders `job_media.file_path` directly and uploads logos to
`media/business-logos/`. It needs the same treatment (sign `media` keys via
`createSignedUrl`, upload logos to `public-assets`); until then, mobile photo
rendering of private media will fail. Its `mediaStorageKey` parser should also
accept bare keys, which the web app now writes.
