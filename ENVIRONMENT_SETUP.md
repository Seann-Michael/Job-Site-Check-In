# Environment Setup and API Configuration

This document outlines the environment variables and storage setup required for the Local SEO Ranker application.

## 🔑 Environment Variables

### Local Development (.env.local)
Copy the `.env.local` file and replace the demo values with your actual API keys:

```bash
# Copy the template
cp .env.local .env.production.local
```

### Required API Keys

#### 1. Supabase Configuration
- **Frontend**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Backend**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- **Setup**: Create project at [supabase.com/dashboard](https://supabase.com/dashboard)

#### 2. Google Maps API
- **Variable**: `VITE_GOOGLE_MAPS_API_KEY`
- **Setup**: Get key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- **Required APIs**: Maps JavaScript API, Places API, Geocoding API

#### 3. Twilio SMS
- **Variables**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **Setup**: Get credentials from [Twilio Console](https://console.twilio.com/)

#### 4. Mailgun Email
- **Variables**: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `FROM_EMAIL`
- **Setup**: Get API key from [Mailgun Dashboard](https://app.mailgun.com/app/sending/domains)

#### 5. DataForSEO API
- **Variable**: `DATAFORSEO_API_KEY` (format: `login:password`)
- **Setup**: Get credentials from [DataForSEO Dashboard](https://app.dataforseo.com/api-access)

## 🗄️ Supabase Storage Setup

### Required Storage Buckets

The application requires the following storage buckets in your Supabase project:

#### 1. Media Bucket (`media`)
- **Purpose**: General file uploads (images, videos, documents)
- **Public Access**: Yes
- **Max File Size**: 50MB
- **RLS Policies**: 
  - Allow authenticated users to upload
  - Allow public read access
  - Allow users to delete their own files

#### 2. Avatars Bucket (`avatars`)
- **Purpose**: User profile pictures
- **Public Access**: Yes  
- **Max File Size**: 2MB
- **Allowed Types**: Images only

#### 3. Project Assets Bucket (`project-assets`)
- **Purpose**: Project-specific files
- **Public Access**: No (private with signed URLs)
- **Max File Size**: 100MB

### Creating Storage Buckets

1. Go to your Supabase Dashboard
2. Navigate to **Storage** > **Buckets**
3. Click **New Bucket** and create:
   - `media` (public)
   - `avatars` (public)
   - `project-assets` (private)

### Setting Up RLS Policies

For each bucket, set up the following policies via the Supabase Dashboard:

```sql
-- Allow authenticated uploads to media bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' AND 
  auth.role() = 'authenticated'
);

-- Allow public downloads from media bucket
CREATE POLICY "Allow public downloads" ON storage.objects
FOR SELECT USING (bucket_id = 'media');
```

## 🧪 Testing API Functions

### 1. Test Email Function
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "template": "geo-grid-share",
    "templateData": {
      "userName": "Test User",
      "results": [{"businessName": "Test Business", "keyword": "test keyword", "averageRanking": "3.2"}]
    }
  }'
```

### 2. Test SMS Function
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "template": "geo-grid-share",
    "templateData": {
      "userName": "Test User",
      "businessCount": 1,
      "results": [{"businessName": "Test Business", "keyword": "test keyword"}],
      "publicUrl": "https://example.com/results"
    }
  }'
```

### 3. Test DataForSEO Function
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/dataforseo-service \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "pizza restaurant",
    "location": "New York, NY",
    "business_name": "Test Restaurant",
    "grid_size": 10
  }'
```

### 4. Test Media Storage Function
```bash
# Upload a file
curl -X POST https://your-site.netlify.app/.netlify/functions/media-storage \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.jpg",
    "fileType": "image/jpeg",
    "fileData": "base64-encoded-file-data",
    "projectId": "project-uuid",
    "category": "general"
  }'

# List files
curl -X GET "https://your-site.netlify.app/.netlify/functions/media-storage?projectId=project-uuid&limit=10"
```

## 🔄 Database Migrations

Run the following commands to set up your database:

```bash
# Initialize Supabase (after setting SUPABASE_URL and keys)
npm run setup

# Run migrations (if using Supabase CLI)
supabase db push

# Or manually run the SQL files in supabase/migrations/
```

## 🚀 Deployment

### Netlify Environment Variables

In your Netlify dashboard, set the following environment variables:

1. Go to **Site Settings** > **Environment Variables**
2. Add all the variables from your `.env.local` file
3. Deploy your site

### Build Configuration

The `netlify.toml` file is already configured with the correct build command and redirects.

## 🛠️ Troubleshooting

### Common Issues

1. **Build fails with "Missing script: build:client"**
   - ✅ Fixed: Added `build:client` script to package.json

2. **Functions return 500 errors**
   - Check environment variables are set correctly
   - Verify API keys are valid and have proper permissions

3. **Storage uploads fail**
   - Ensure storage buckets exist in Supabase
   - Check RLS policies are configured correctly
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is set

4. **Google Maps not loading**
   - Verify `VITE_GOOGLE_MAPS_API_KEY` is set
   - Enable required APIs in Google Cloud Console
   - Check API key restrictions and quotas

### Checking Function Status

Use the Netlify Functions dashboard to monitor function invocations and view logs.

## 🔒 Security Notes

- Never commit real API keys to version control
- Use environment variables for all sensitive configuration
- Regularly rotate API keys
- Monitor API usage and set up billing alerts
- Use the principle of least privilege for API permissions
