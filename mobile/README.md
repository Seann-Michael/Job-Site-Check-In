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

## Roadmap (next milestones)

1. Review request sending via the Express API (Twilio) — skipped for now by request
2. Push notifications, EAS build + store submission
