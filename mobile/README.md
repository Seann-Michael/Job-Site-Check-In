# Local SEO Ranker — Mobile

The iOS/Android companion app for the Local SEO Ranker web platform, built with
[Expo](https://expo.dev) (SDK 54), React Native, TypeScript and Expo Router.

> Why SDK 54: the App Store build of Expo Go currently supports SDK 54 only
> (Apple has not approved newer Expo Go releases), so SDK 54 is what runs on a
> physical phone by scanning the QR code. Upgrade when Expo Go catches up, or
> when moving to EAS development builds.

## What's here (foundation)

- **Brand theme** — light + dark, mirroring the web app's palette
  (`client/global.css`): primary `#0697E0`, dark navy background `#101219`,
  0.75rem radius, system font.
- **Auth shell** — Supabase email/password sign-in (`src/providers/auth-provider.tsx`),
  with a demo mode that auto-activates when Supabase isn't configured.
- **Five tabs** — Jobs (dashboard with search, stats, filters), Gallery,
  Reviews (Current/Past/Scheduled pipeline like the web AdminReviews page),
  GMB Profile (score + audit checklist), Settings.
- **Job detail** — `/job/[id]` with media strip, checklist and action buttons.
- **Data layer** — `src/lib/data.ts` reads the same Supabase tables as the web
  client (`jobs`, `review_requests`, `job_media`) and falls back to demo data
  (`src/lib/demo-data.ts`) when unconfigured or on error.

## Run it

```bash
cd mobile
npm install
cp .env.example .env   # optional: add your Supabase keys, else demo mode
npx expo start
```

Scan the QR code with the **Expo Go** app (App Store / Play Store) to run it on
your phone, or press `w` for the browser preview.

## Milestone 2 (shipped): geotagged photo capture

From any job's detail screen: **Capture photo** → pick a category
(Before / Progress / After / Final) → camera opens → the photo is saved with a
GPS fix. With Supabase configured it uploads to the `media` storage bucket at
`project-media/{jobId}/…` and inserts a `job_media` row with the same columns
the web app writes (GPS in the `metadata` json); in demo mode photos persist
on-device. Gallery and job detail render the real photos, with a green pin on
geotagged ones.

## Milestone 3 (shipped): new-job flow

Jobs tab **+** button → `/job/new`: title, service-type chips, client contact,
and address with Google Places autocomplete + Street View preview
(`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`; manual entry without it). Jobs save in the
same payload shape as the web Add Job page; after creating, the app offers to
capture the "before" photos immediately.

## Milestone 4 (shipped): real GMB connection + data

The GMB tab reads the same tables as the web GMB Optimization page
(`gmb_profiles`, `gmb_audit_results`, plus hours/Q&A/categories/services
counts). With Supabase configured and no profile connected, it offers a
Google business search to **connect** the profile; **Scan profile** refreshes
the audit from Google Places using the exact rules and scoring the web app
uses (`src/lib/gmb.ts` mirrors `generateAuditFromPlace`). Editing
hours/Q&A/services stays on the web dashboard for now.

## Milestone 5 (shipped): GMB profile editing

`/gmb-manage` (reached from the GMB tab's quick-action cards): edit business
hours (replace-all save like the web), add/delete Q&As, services, and
categories — same tables (`gmb_hours`, `gmb_qas`, `gmb_services`,
`gmb_categories`) and write patterns as the web GMB dashboard. Demo mode edits
persist on-device.

## Milestone 6 (shipped): settings pages

Every Settings row opens a working page: **Profile** (edit name; change
password when Supabase is connected), **Notifications** (per-alert toggles,
device-persisted), **Business** (workspace switcher — jobs and job creation
follow the active business), **Team** (member list from `users`, local pending
invites), **Appearance** (System/Light/Dark override applied app-wide via
`src/providers/theme-preference.tsx`), and **Help & support** (FAQ, email
support, knowledge-base link via `EXPO_PUBLIC_APP_URL`).

## Milestone 7 (shipped): Complete & Publish

The CompanyCam-style loop closes: `/publish/[id]` (from the job screen's
**Complete & publish** button) selects photos, auto-writes a local-SEO post
(title, copy, hashtags, keywords, geo target), and queues delivery:

- **Google Business Profile** — inserts a `social_media_posts` row
  (platform `gmb`, status `scheduled`) that the web syndication pipeline posts
- **Website / GoHighLevel** — fires the web app's Automation workflow webhook
  when `EXPO_PUBLIC_API_BASE_URL` + `EXPO_PUBLIC_PUBLISH_WEBHOOK_ID` are set;
  otherwise web automations pick the completed job up
- The job is marked `completed` (with `completed_at`) and the job screen shows
  a Published card with the destinations

## Milestone 8 (shipped): publish queue + Clients CRM

- **Recent posts** on the GMB tab: the `social_media_posts` queue (or local
  publish records in demo) with status badges — publishes are visible
  end-to-end.
- **Clients** (people icon on the Jobs header): searchable client list from
  the `clients` table (derived from jobs in demo) with job counts; client
  detail has call/email quick actions, job history, and a new-job shortcut.

## Milestone 9 (shipped): field usability + more settings

- **Full-screen media viewer**: tap any photo (Gallery or job) → swipeable
  viewer with category/date/GPS caption and native share.
- **Live checklists**: per-job tasks with toggle + add, persisted on-device
  (`src/lib/tasks-store.ts`); web `job_tasks` sync comes later.
- **Share job**: share button on the job screen (public link when
  `EXPO_PUBLIC_APP_URL` is set).
- **Settings additions**: Billing (plan/invoices, jump to web dashboard),
  Diagnostics (connection checks, on-device data counts, shareable report,
  local-data reset), and Media & Camera (photo quality, GPS toggle, default
  category — all read by the capture pipeline).

## Milestone 10 (shipped): Before/After composer

`/before-after/[id]` from the job screen: pick a before and an after photo,
side-by-side or stacked, with BEFORE/AFTER labels and a branded footer.
Export at 1200px via react-native-view-shot — share through the native sheet
or save into the job as a Final photo (feeds the publish flow).

## Milestone 11 (shipped): offline capture + upload queue

When a capture can't reach Supabase (network error), the processed photo is
kept on-device and queued (`src/lib/upload-queue.ts`). The queue flushes on
app launch, every 30s in the background, and via a "Retry now" banner on the
Jobs screen. Queued photos appear immediately in the gallery and job media
with a pending-upload badge.

## Milestone 12 (shipped): media sources + photo stamps

- **Add media** on a job now offers three sources: take photo, record video
  (30s cap), or choose from the device gallery (multi-select up to 10,
  photos and videos).
- **Photo stamps** burned into images at capture time via an offscreen
  render (`src/components/stamp-host.tsx`): business name, capture
  timestamp, and GPS coordinates — each individually toggleable in
  Settings → Media & camera, alongside the geotag toggle.
- Videos upload with correct mime types and flow through the same offline
  queue as photos.

## Milestones 13–17 (shipped): map, editing, today, analytics, tags

- **Job map** (`/map`, map icon on Jobs header): react-native-maps pins for
  every job with GPS, callouts open the job; web build shows a list fallback.
  **Directions** chip on the job screen opens turn-by-turn in Apple/Google Maps.
- **Job editing & status** (`/job/edit/[id]` + ⋯ menu on the job screen):
  edit title/service/client/address, and set active / in-progress / paused /
  completed / cancelled. Demo-seed jobs become editable local copies.
- **Today + reminders**: a Today section tops the Jobs list; local
  "job starts today" notifications fire at 7:30 AM for upcoming jobs
  (Expo Go-compatible; governed by the Job updates toggle).
- **Activity dashboard** (`/activity`, stats icon on Jobs header): open/
  completed/photos/publishes tiles, photos-per-day chart, GMB score, and a
  recent-activity feed.
- **Tags** on jobs (edit screen; searchable from Jobs) and on photos/videos
  (tag button in the full-screen viewer), stored in the same metadata.tags
  field the web app uses.

## Milestone 18 (shipped): logo stickers

Each business (workspace) has its own logo, set in Settings → Media & camera:
picked from the gallery, kept locally for offline stamping, and synced to the
Supabase `avatars` bucket (+ best-effort `businesses.logo_url`) when
configured. Two ways to use it:

- **Logo sticker editor** (magic-wand button in the full-screen photo
  viewer): drag the logo anywhere on the photo, pick small/medium/large,
  add/remove it, then share or save the logo version back to the job.
- **Logo stamp on capture** toggle: auto-places the logo bottom-right on
  every new photo through the stamp pipeline.

## Milestones 19–20 (shipped): navigation choice, check-ins, notes, documents

- **Navigation app** setting (System / Apple Maps / Google Maps / Waze) used
  by the Directions button, with a browser fallback.
- **Check-ins**: Check in/out on the job screen tracks each site visit with
  GPS and duration; multi-day jobs show a Day 1/2/3 visit history.
- **Notes**: a per-job note feed (author + time, deletable).
- **Documents**: attach files via the document picker; uploads to Supabase
  Storage + a job_documents row when configured, durable local copy always.
  Check-ins/notes are on-device for now (server sync later).

## Milestone 21 (shipped): nearby jobs + navigation rework

- **Nearby jobs** rail at the top of the Jobs tab: non-completed jobs with
  GPS sorted by distance from the device (within 100 mi), with All / Open /
  Complete filters directly beneath.
- **Clients is now a bottom tab** (where Settings was); Settings moved to a
  gear icon on the Jobs header, and the Activity dashboard now lives inside
  Settings.
- **Diagnostics** shows device info only (phone type, OS + build, app build
  type) — the Supabase/API connection details were removed from the page.

## Milestone 22 (shipped): the CompanyCam field toolkit

- **Photo comments & @mentions** — comment threads on any photo in the
  full-screen viewer, with quick-tap mention chips for teammates.
- **Share gallery links** — pick a job's photos and send the client one
  public web-gallery link (goes live when the web app is connected).
- **PDF job reports** — branded report (logo, job details, site visits,
  checklist, notes, photo grid) via expo-print, straight to the share sheet.
- **Photo annotation** — draw, arrows, circles and text labels on photos
  (react-native-svg), then share or save the marked-up copy to the job.
- **Voice notes** — record audio notes on a job (expo-audio) with playback
  and per-note delete.
- **Team on site** — live presence built on check-ins: who's at which job
  and for how long, on the Activity screen and the job screen.

## Milestone 23 (shipped): in-app camera + capture-first flow

CompanyCam-style camera (`/camera`, expo-camera) replacing the native
one-shot picker for photos: stays open for rapid multi-shot capture, with
the job name in the viewfinder, Before/Progress/After/Final chips,
1x/2x/4x zoom, flash (off/on/auto) + camera flip, a rule-of-thirds grid,
and a quick-settings popover (grid + stamp Date/Time, Lat/Long, Business,
Logo toggles — same prefs as Settings → Media). A running shot counter
shows the last-photo thumbnail, an offline pill appears when shots queue,
and every shot flows through the normal pipeline (stamps, GPS,
upload/queue) saving in the background so the shutter is instantly ready
again. "Record video" and "Choose from gallery" keep the native pickers.

**Capture-first**: the camera icon on the Jobs header opens "Take photos"
— open jobs sorted by distance ("1.53 miles away", with an On site badge
under a quarter mile) — tap one and you're in the camera.

## Milestone 24 (shipped): video mode + edit-after-capture

- **PHOTO / VIDEO switch** under the shutter: video mode records in-app
  (red shutter, elapsed timer, 2-minute cap, square stop button) with
  microphone permission handling; recordings flow through the same
  upload/offline queue as photos. "Record video" on the job screen now
  opens the in-app camera in video mode. (Scan mode skipped by request.)
- **Edit after capture**: the last-shot thumbnail gets a pencil badge —
  tap it to jump straight into the annotation editor for that photo.

## Milestone 25 (shipped): the everything batch

- **Star / archive jobs** (job header + ⋯ menu) with ★ and Archived
  filters on the Jobs tab; archived jobs leave the main list.
- **Project groups + job value** on the edit screen (with group
  suggestions); both show on job cards and the job screen.
- **Assign teammates** to a job from the job screen.
- **Company feed** (`/feed`, people icon on Gallery): every photo/video
  date-grouped with author avatars, plus a Projects tab.
- **Capture picker tabs**: Nearby / Search / Map when picking a job to
  shoot.
- **Camera**: WALKTHRU guided-video mode (step prompts), aspect ratio
  (Full / 4:3 / 1:1 center-crop), and a live level indicator
  (expo-sensors) in the quick-settings popover.
- **Uploads screen** (Settings → Uploads): see, retry, or drop each
  pending offline upload.
- **Checklist template** (Settings → Checklist template): edit/reorder
  the tasks every new job starts with.
- **Portfolio** (`/portfolio`, Settings → Portfolio): feature completed
  jobs and share the showcase.

## Milestone 26 (shipped): server sync + live gallery links

When Supabase is configured (paste keys into `.env`), the field features go
multiplayer — everything still works on-device without it:

- **Check-ins and notes sync** to new `job_checkins` / `job_notes` tables
  (best-effort writes; a throttled background fetch merges teammates' site
  visits and notes into the job screen).
- **Team on site is real**: presence reads open check-ins across the whole
  team instead of simulated teammates.
- **Gallery links go live**: shares write a `shared_galleries` row, and the
  web app now serves `/g/:token` (`client/pages/PublicGallery.tsx`) — a
  clean public page with the photos, no login needed.
- Migration: `supabase/migrations/20260726000000_create_mobile_field_tables.sql`
  (apply with `supabase db push` or the dashboard SQL editor).

## Milestone 27 (shipped): review requests + full sync coverage

- **Request review is live**: the job-screen button opens
  `/review-request/[id]` — customer name/phone prefilled from the client
  record, SMS/email toggle, message preview. Connected: inserts the same
  `review_requests` row the web dashboard lists (Twilio delivery stays on
  the web pipeline). Demo: the request appears in the Reviews tab.
- **Sync coverage completed** (second migration,
  `20260726010000_create_field_state_tables.sql`): checklist tasks and job
  meta (stars/groups/value/assignees) sync via a `job_field_state` row per
  job, and photo comments sync through `media_comments` with a throttled
  teammate merge — same best-effort/off-line-first pattern as check-ins.

## Milestone 28 (shipped): hardening pass

Three adversarial code reviews over milestones 22–27; all confirmed
findings fixed:

- **Camera**: walkthru mode now actually records (CameraView was left in
  picture mode); iOS level indicator sign corrected; leaving or flipping
  the camera mid-recording stops cleanly instead of discarding footage;
  video saves run in the background so the shutter frees up immediately;
  torch works in video modes; aspect-ratio crops are EXIF-orientation
  aware; permission prompt asks once (and never on web).
- **Video memory**: uploads stream from disk as blobs — no more full-file
  base64 (a 2-minute clip could OOM-crash Expo Go), in both the direct
  and offline-queue paths.
- **Sync layer**: local checkouts can no longer be reverted by a stale
  server fetch (merge preserves + re-pushes them); check-out during an
  in-flight check-in closes the server row; deletes are tombstoned so
  failed server deletes don't resurrect notes/comments; meta pushes
  read-merge-write so devices can't wipe each other's fields; checklist
  first-sync merges instead of clobbering; presence includes unsynced
  local check-ins.
- **Screens**: comment input no longer hidden by the keyboard; feed
  groups by local day (no duplicate headers); review-request phone
  prefill race fixed; voice recorder cleans up the audio session on exit.

## Milestone 29 (shipped): stamps, merged notes, visit activity, contact info

- **Every note is stamped**: author + full date + time ("Alex Morgan ·
  Jul 26, 2026 · 2:14 PM") — same for voice notes and documents.
- **Task check-offs are stamped**: completed checklist items show who
  checked them and when.
- **Voice notes live in the Notes section** now: one feed, text and voice
  interleaved newest-first, mic button right next to the note input.
- **Tags everywhere**: jobs (edit screen), photos/videos (viewer),
  documents (tag button per row), and customers (Tags card on the client
  page, `src/lib/client-tags.ts`).
- **Customer contact on the job page**: name, full address
  (street, city, state zip), tap-to-call phone, tap-to-email — from the
  job's client_contact with the client record as fallback.
- **Site visits are tappable**: each visit row opens `/visit-detail` —
  photos/video taken, tasks completed, notes, and documents from that
  visit's time window, with the visitor's name and GPS.

## Milestone 30 (shipped): contact actions + client management

- **Contact rows** (job page + client page,
  `src/components/contact-row.tsx`): tap the phone number / email /
  address to **copy it** (expo-clipboard); round icon buttons for
  **call**, **text (SMS)**, **navigate** (directions via your chosen nav
  app), and **email**.
- **Client add / edit / delete**: person-add icon on the Clients tab,
  pencil on the client page, delete (with confirm) on the edit form.
  Local overrides layer (`src/lib/clients-store.ts`) keeps it working in
  demo/offline; connected mode writes through to the `clients` table.

## Roadmap (next milestones)

1. Remote push notifications, EAS build + store submission (needs the
   $99/yr Apple Developer account)
