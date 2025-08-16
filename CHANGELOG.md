# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Separated admin and agency project creation workflows
- Fixed lazy loading issues causing "Something went wrong" errors
- Improved routing between admin and agency sections
- Updated project types to be specific to home services vs agency services

### Fixed
- Error boundaries showing on Settings, Audits, Gallery, and Reports pages
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
- Fixed admin vs agency project creation routing
- Separated home services projects from agency marketing projects
- Added proper breadcrumbs and navigation context

### [2025-01-12] - Error Boundary Resolution  
- Resolved lazy loading component issues
- Fixed "Load failed" errors across multiple pages
- Improved component import strategy

---

## Development Notes

### Environment Setup
When setting up this project, ensure all environment variables are configured in your Netlify deployment settings:

1. **Email Service (Mailgun)**:
   - `MAILGUN_API_KEY` - Your Mailgun API key
   - `MAILGUN_DOMAIN` - Your Mailgun domain (optional, defaults to mg.yourdomain.com)
   - `FROM_EMAIL` - Default sender email address

2. **SMS Service (Twilio)**:
   - `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
   - `TWILIO_PHONE_NUMBER` - Your Twilio phone number for sending SMS

3. **Ranking Data (DataForSEO)**:
   - `DATAFORSEO_API_KEY` - DataForSEO credentials in login:password format
   - Alternative: `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` as separate variables

4. **Storage (Supabase)**:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend operations
   - `SUPABASE_STORAGE_BUCKET` - Storage bucket name (defaults to 'media')

### API Endpoints
- `/.netlify/functions/send-email` - Email sending service
- `/.netlify/functions/send-sms` - SMS sending service  
- `/.netlify/functions/dataforseo-service` - Geo ranking data
- `/.netlify/functions/media-storage` - File upload/management

### Usage Examples

#### Sending Emails
```javascript
await fetch('/.netlify/functions/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'client@example.com',
    template: 'geo-grid-share',
    templateData: {
      userName: 'John Doe',
      results: [...],
      publicUrl: 'https://...'
    }
  })
});
```

#### Sending SMS
```javascript
await fetch('/.netlify/functions/send-sms', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+1234567890',
    template: 'project-update',
    templateData: {
      projectName: 'Website Redesign',
      status: 'Completed'
    }
  })
});
```

#### Getting Ranking Data
```javascript
await fetch('/.netlify/functions/dataforseo-service', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keyword: 'pizza restaurant near me',
    location: 'Fairfield, CA',
    business_name: "Joe's Pizza",
    grid_size: 5
  })
});
```
