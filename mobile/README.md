# Local SEO Ranker — Mobile

The iOS/Android companion app for the Local SEO Ranker web platform, built with
[Expo](https://expo.dev) (SDK 57), React Native, TypeScript and Expo Router.

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

## Roadmap (next milestones)

1. Geotagged photo capture (camera + EXIF/GPS) uploading to Supabase Storage
2. Job creation with address autocomplete + Street View
3. Review request sending via the Express API (Twilio)
4. Real GMB audit data + profile management
5. Push notifications, business switcher, EAS build + store submission
