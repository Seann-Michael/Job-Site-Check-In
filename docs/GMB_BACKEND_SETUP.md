# GMB Lead Management Backend Setup Guide

This guide covers the complete setup and deployment of the Google My Business (GMB) lead management backend system.

## Overview

The backend system provides:
- **Database Schema**: Comprehensive Supabase database with RLS policies
- **API Endpoints**: RESTful APIs for lead management, credit system, and geo scanning
- **Google Integration**: Google My Business and Places API integration
- **Credit System**: Complete credit purchase, usage, and tracking system
- **Authentication**: Role-based access control with middleware
- **Data Processing**: GMB profile analysis and scoring algorithms
- **Webhooks**: Real-time event handling for payments and updates

## Prerequisites

1. **Supabase Project**: Create a new project at [supabase.com](https://supabase.com)
2. **Google Cloud Account**: Set up Google Maps Platform with Places API enabled
3. **Stripe Account**: For credit purchase functionality (optional)
4. **Netlify Account**: For serverless function deployment

## Environment Setup

### 1. Copy Environment Variables

```bash
cp .env.example .env
```

### 2. Configure Required Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Webhook Secrets
GOOGLE_WEBHOOK_SECRET=your_random_secret
INTERNAL_WEBHOOK_SECRET=your_random_secret
```

## Database Setup

### 1. Apply Migration

Run the Supabase migration to create all required tables and policies:

```sql
-- Run the migration file: supabase/migrations/20241220000001_create_gmb_leads_schema.sql
-- This can be done through the Supabase dashboard SQL editor
```

### 2. Verify Database Structure

The migration creates the following tables:
- `gmb_leads` - Core business profile data
- `user_credits` - Credit balance tracking
- `credit_transactions` - Credit usage history
- `lead_unlocks` - Track unlocked leads per user
- `geo_grid_scans` - Geo scanning operations
- `agency_client_assignments` - Agency-client relationships
- `user_profiles` - Extended user information with roles

### 3. Enable Row Level Security

All tables have RLS policies configured for:
- **Super Admin**: Full access to all data
- **Admin**: Read access to leads, full access to own data
- **Agency**: Read access to leads, manage client assignments

## API Endpoints

### Lead Management API (`/api/gmb-leads-api`)

```
GET    /api/gmb-leads              # List leads with filtering
POST   /api/gmb-leads              # Create new lead (super admin only)
PUT    /api/gmb-leads/:id          # Update lead (super admin only)
DELETE /api/gmb-leads/:id          # Delete lead (super admin only)
POST   /api/gmb-leads/:id/unlock   # Unlock lead with credits
POST   /api/gmb-leads/bulk-import  # Bulk import leads
```

### GMB Integration API (`/api/gmb-integration`)

```
POST   /api/gmb-integration/search        # Search GMB profiles
POST   /api/gmb-integration/import        # Import GMB profiles to database
GET    /api/gmb-integration/place/:id     # Get detailed place information
POST   /api/gmb-integration/validate-api-key # Validate Google API key
```

### Geo Grid Scanner API (`/api/geo-grid-scanner`)

```
POST   /api/geo-grid-scanner/start           # Start geo grid scan
POST   /api/geo-grid-scanner/process/:id     # Process scan with Google API
GET    /api/geo-grid-scanner/scans           # Get user's scans
GET    /api/geo-grid-scanner/scan/:id        # Get scan details
```

### Credit System API (`/api/credit-system`)

```
GET    /api/credit-system/balance       # Get user credit balance
GET    /api/credit-system/packages      # Get available credit packages
POST   /api/credit-system/purchase      # Purchase credit package
POST   /api/credit-system/transfer      # Transfer credits (admin only)
POST   /api/credit-system/allocate      # Allocate monthly credits (admin only)
GET    /api/credit-system/transactions  # Get credit transaction history
GET    /api/credit-system/analytics     # Get credit usage analytics (admin only)
```

### Data Processing API (`/api/gmb-data-processor`)

```
POST   /api/gmb-data-processor/analyze        # Analyze single GMB profile
POST   /api/gmb-data-processor/batch-analyze  # Batch analyze multiple profiles
GET    /api/gmb-data-processor/analytics      # Get analysis aggregates (admin only)
```

### Webhook Handlers (`/api/webhook-handlers`)

```
POST   /api/webhook-handlers/stripe    # Stripe payment webhooks
POST   /api/webhook-handlers/google    # Google My Business webhooks
POST   /api/webhook-handlers/internal  # Internal system webhooks
```

## Google API Setup

### 1. Enable Required APIs

In Google Cloud Console, enable:
- Google Places API
- Google My Business API (for webhooks)
- Geocoding API (optional)

### 2. Create API Key

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create API Key
3. Restrict the key to your required APIs
4. Add the key to your environment variables

### 3. Configure Quotas

Monitor your API usage and configure appropriate quotas:
- Places API: ~1000 requests per geo scan
- Recommended: Start with 10,000 requests/day quota

## Stripe Setup (Optional)

### 1. Create Stripe Account

1. Sign up at [stripe.com](https://stripe.com)
2. Get your secret keys from the Dashboard
3. Set up webhook endpoints

### 2. Configure Webhooks

Add webhook endpoint: `https://your-domain.com/api/webhook-handlers/stripe`

Required events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Authentication & Authorization

### User Roles

The system supports three user roles:

1. **Super Admin**
   - Full access to all data and functionality
   - Can manage users, credits, and system settings
   - Can import/export leads without restrictions

2. **Admin**
   - Can view and unlock leads using credits
   - Manage their own data and credits
   - Limited bulk operations

3. **Agency**
   - Can assign leads to clients
   - Manage client relationships
   - Monthly credit allocations

### Middleware Usage

```typescript
import { authMiddleware } from './auth-middleware';

// Require authentication
const user = await authMiddleware.requireAuth(event.headers.authorization);

// Require specific role
const superAdmin = await authMiddleware.requireSuperAdmin(event.headers.authorization);

// Apply rate limiting
const allowed = authMiddleware.applyRateLimit(user);
```

## Data Processing & Analysis

### Lead Scoring Algorithm

The system analyzes GMB profiles and calculates:

1. **Business Quality Score** (0-100)
   - Rating weight: 30%
   - Review count: 20%
   - Verification status: 20%
   - Photos: 10%
   - Hours information: 10%
   - Website presence: 10%

2. **Lead Potential Score** (0-100)
   - Business type potential: 40%
   - Contact information: 30%
   - Competition level: 20%
   - Business activity: 10%

3. **Additional Metrics**
   - Contact completeness percentage
   - Business verification score
   - Engagement score
   - Competition level assessment

### Usage Example

```typescript
// Analyze a single lead
const analysis = await analyzeGMBProfile(leadData);

// Batch analyze multiple leads
const analyses = await batchAnalyzeProfiles(leadIds);
```

## Deployment

### 1. Netlify Functions

The backend uses Netlify Functions for serverless deployment:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy functions
netlify deploy --functions=netlify/functions
```

### 2. Environment Variables in Netlify

Add all environment variables in Netlify Dashboard:
- Site Settings > Environment Variables
- Add each variable from your `.env` file

### 3. Function Routing

Configure `netlify.toml` for proper routing:

```toml
[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

## Testing & Validation

### 1. Test API Endpoints

```bash
# Test authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-domain.com/api/gmb-leads

# Test Google API integration
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"location":{"lat":40.7128,"lng":-74.0060},"radius":5000}' \
     https://your-domain.com/api/gmb-integration/search
```

### 2. Verify Database Policies

Test RLS policies by creating users with different roles and verifying access permissions.

### 3. Test Credit System

1. Create test credit packages
2. Simulate payment webhook events
3. Verify credit allocation and usage

## Monitoring & Logging

### 1. Webhook Logs

Monitor webhook events in the `webhook_logs` table:

```sql
SELECT * FROM webhook_logs 
WHERE status = 'failed' 
ORDER BY processed_at DESC;
```

### 2. Credit Analytics

Monitor credit usage patterns:

```sql
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(ABS(credits_amount)) as total_credits
FROM credit_transactions 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY transaction_type;
```

### 3. API Performance

Track API response times and error rates through Netlify Functions analytics.

## Security Considerations

### 1. API Key Protection

- Store API keys securely in environment variables
- Use restricted API keys when possible
- Monitor API usage and set alerts

### 2. Webhook Security

- Verify webhook signatures for all external webhooks
- Use HTTPS for all webhook endpoints
- Implement rate limiting

### 3. Data Privacy

- Implement proper data masking for non-unlocked leads
- Follow GDPR/CCPA compliance requirements
- Regular security audits

## Troubleshooting

### Common Issues

1. **Google API Quota Exceeded**
   - Solution: Increase quotas in Google Cloud Console
   - Implement exponential backoff

2. **Supabase RLS Errors**
   - Solution: Verify user roles and policy configurations
   - Check authentication token validity

3. **Webhook Failures**
   - Solution: Check webhook signatures and endpoint URLs
   - Monitor webhook logs for error details

### Support

For technical support or questions:
1. Check the webhook logs table for error details
2. Monitor Netlify Functions logs
3. Verify environment variable configuration
4. Test API endpoints with proper authentication

## Next Steps

After successful deployment:

1. **User Management**: Set up initial super admin users
2. **Credit Packages**: Configure credit packages and pricing
3. **Google Webhooks**: Set up Google My Business webhook notifications
4. **Monitoring**: Implement comprehensive logging and monitoring
5. **Testing**: Perform end-to-end testing with real data

## API Reference

For detailed API documentation, see the individual function files:
- `gmb-leads-api.ts` - Lead management endpoints
- `gmb-integration.ts` - Google API integration
- `geo-grid-scanner.ts` - Geo scanning functionality
- `credit-system.ts` - Credit management
- `gmb-data-processor.ts` - Data analysis functions
- `webhook-handlers.ts` - Event handling
- `auth-middleware.ts` - Authentication utilities
