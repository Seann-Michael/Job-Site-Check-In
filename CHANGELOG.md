# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Production hardening (2026-08)

#### Removed
- Dead client code: mock/fallback/cached API services, debug/test components
  and pages, unrouted pages (`AddProject`, `Tools`, `UserManagement`,
  `SupportTicketDetail`, `ReportGenerator`, etc.), client-account onboarding
  (`PublicOnboarding`, `components/OAuth/*`, `/onboard/*` routes),
  `SocialMediaPosting`/`ComingSoon` placeholders, `public/security.js`.
- Stale root docs and implementation notes, Netlify-era docs under `docs/`,
  `scripts/populate-sample-data.ts`, `scripts/setup-supabase.js`,
  `scripts/create-payments-tables.sql`, root test HTML/JS scratch files,
  `.cursor/deploy-app.mdc`.
- npm scripts that pointed at a removed `server_complete` package or sample
  data (`populate-data`, `setup-db`, `server:*`, `full:dev`, `start:static`,
  `prestart`, `postinstall`).

#### Changed
- `vite.config.ts`: Express API is imported lazily in dev only and only when
  Supabase env is present, so `vite build` no longer needs credentials.
  Removed the manual `.env.local` override; added vendor `manualChunks` and a
  build-id plugin for the service worker.
- `public/sw.js`: network-first navigations, cache-first hashed assets, no
  precaching of authenticated routes, per-build cache names.
- `index.html`: `noindex,nofollow`, CSP without `unsafe-eval`, removed
  ineffective `X-Frame-Options`/`X-XSS-Protection` metas, fixed icon links and
  og/twitter URLs.
- `manifest.json`: real PNG icons generated from `icon-base.svg`, removed
  non-existent screenshots, shortcuts and handlers.
- `.do/app.yaml`: repo `Seann-Michael/Local-SEO-Ranker`, SPA catch-all,
  `/health` check, env list trimmed to variables the code reads.
- `.env.example`, `.gitignore`, `.dockerignore` rewritten; engines `node >=20.19 <23`.
- ESLint config (`.eslintrc.cjs`) for TS + React hooks; `lint` no longer fails on warnings.
- `tsconfig.json`: `noFallthroughCasesInSwitch` on.
- `ErrorBoundary` forwards errors to Sentry when `VITE_SENTRY_DSN` is set.
- README, SETUP, AGENTS, docs/DEPLOYMENT rewritten to match the actual scripts
  and DigitalOcean deployment.

#### Added
- GitHub Actions CI: lint, typecheck, test, build on push/PR.
- `npm run format` (Prettier).

### Previous unreleased work

### Added
- Geo Grid Ranking Results Data Table with bulk selection functionality
- Bulk actions for Compare, Share, Download, and Archive operations
- Share dialog with SMS, Email, and public URL options
- Geo Grid Compare View with before/after analysis
- GIF creation capability for map animations
- Mailgun email service integration for system notifications
- Twilio SMS service integration for system alerts
- DataForSEO API integration for geo grid ranking data
- Supabase media storage service for file management
- Audit log system for tracking system changes
- Environment variable setup for external service integrations

### Changed
- Separated admin and client-account project creation workflows
- Fixed lazy loading issues causing "Something went wrong" errors
- Improved routing between admin and client-account sections
- Updated project types to be specific to home services vs client-account services

### Fixed
- Error boundaries showing on Settings, Gallery, and Reports pages
- Navigation issues between different project types
- Component import errors in AddProject functionality

### Security
- Added secure environment variable handling for API keys
- Implemented proper authentication for external service calls
- Added input validation for all API endpoints

## [2025-01-14] - Initial Geo Grid Enhancement

### Added
- Comprehensive geo grid ranking results table
- Bulk selection and management capabilities
- Share functionality with multiple delivery methods
- Comparison view for tracking ranking improvements over time
- Backend services for email, SMS, and API integrations

### Technical Details
- Environment variables required:
  - `MAILGUN_API_KEY` - Mailgun API key for email services
  - `TWILIO_ACCOUNT_SID` - Twilio Account SID for SMS services  
  - `TWILIO_AUTH_TOKEN` - Twilio Auth Token for SMS services
  - `DATAFORSEO_API_KEY` - DataForSEO API credentials (login:password format)
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for backend operations

### Components Added
- `GeoGridResultsTable.tsx` - Main data table with bulk actions
- `GeoGridCompareView.tsx` - Before/after comparison interface
- `netlify/functions/send-email.ts` - Email service backend
- `netlify/functions/send-sms.ts` - SMS service backend
- `netlify/functions/dataforseo-service.ts` - Ranking data API
- `netlify/functions/media-storage.ts` - File storage backend

### Database Changes
- Added `audit_logs` table for system change tracking
- Added `media_files` table for file metadata storage
- Updated project schemas to support new ranking data

---

## Previous Changes

### [2025-01-13] - Project Separation Fix
- Fixed admin vs client-account project creation routing
- Separated home services projects from client-account marketing projects
- Added proper breadcrumbs and navigation context

### [2025-01-12] - Error Boundary Resolution  
- Resolved lazy loading component issues
- Fixed "Load failed" errors across multiple pages
- Improved component import strategy
