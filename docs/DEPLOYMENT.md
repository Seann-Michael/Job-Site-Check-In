# Local SEO Ranker - Deployment Guide

## 🏗️ Infrastructure Architecture

### Production Environment

- **Frontend Hosting**: Digital Ocean App Platform (Static Site)
- **Backend API**: Digital Ocean App Platform (Functions/Service)
- **Backend Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Domain Management**: Digital Ocean DNS
- **SSL Certificates**: Automatic via Digital Ocean

### Domain Configuration

```
mylocalseoranker.com          → WordPress Marketing Site
app.mylocalseoranker.com      → React Web Application (Digital Ocean)
api.mylocalseoranker.com      → API Gateway (Digital Ocean Functions)
```

## 🚀 Digital Ocean App Platform Deployment

### App Configuration (.do/app.yaml)

The application is configured in `.do/app.yaml` with two components:

1. **Static Site** (Frontend)
   - Build command: `npm run build:client`
   - Output directory: `dist`
   - Routes: `/` (all frontend routes)

2. **Service** (API Functions)
   - Source directory: `/api`
   - Routes: `/api/*`
   - Runtime: Node.js 20+

### Environment Variables (Digital Ocean)

Configure these in the Digital Ocean App Platform dashboard under Settings → Environment Variables:

#### Build-Time Variables (Frontend)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
VITE_APP_URL=https://app.mylocalseoranker.com
VITE_API_URL=https://app.mylocalseoranker.com/api
```

#### Runtime Variables (API Service)
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=media

# Payment Processors
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_PLAN_ID=...
PAYPAL_WEBHOOK_ID=...
COINBASE_COMMERCE_API_KEY=...
COINBASE_COMMERCE_SHARED_SECRET=...

# Communications
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_URL=https://app.mylocalseoranker.com/api/twilio/webhook
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=mg.localcontractorleads.com
FROM_EMAIL=noreply@localcontractorleads.com

# OAuth & Social
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
META_APP_ID=...
META_APP_SECRET=...

# Third-Party Services
DATAFORSEO_API_LOGIN=...
DATAFORSEO_API_PASSWORD=...
DATAFORSEO_API_KEY=...
DATAFORSEO_USERNAME=...
DATAFORSEO_PASSWORD=...
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_API_KEY=...

# General
SITE_NAME=Local SEO Ranker
NODE_ENV=production
PORT=8080
```

### Deployment via doctl CLI

```bash
# Install doctl CLI
brew install doctl  # macOS
# or download from https://docs.digitalocean.com/reference/doctl/

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# Get app ID
doctl apps list

# Deploy updates
doctl apps update YOUR_APP_ID --spec .do/app.yaml

# View deployment logs
doctl apps logs YOUR_APP_ID --follow
```

### Deployment via GitHub Integration

1. Connect your GitHub repository in Digital Ocean dashboard
2. Select branch: `main`
3. Digital Ocean will automatically deploy on push
4. Configure environment variables in the dashboard
5. Deployments are automatic on every commit to main

### Manual Deployment

```bash
# Build the application
npm run build:client

# Deploy using doctl
doctl apps create-deployment YOUR_APP_ID
```

## 🗄️ Supabase Configuration

### Database Setup

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'business_owner',
  is_2fa_enabled BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  category TEXT,
  google_place_id TEXT,
  address JSONB,
  business_hours JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES users(id)
);

-- Add indexes for performance
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_projects_business_id ON projects(business_id);
CREATE INDEX idx_projects_status ON projects(status);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Business policies
CREATE POLICY "Business owners can manage their businesses" ON businesses
  FOR ALL USING (auth.uid() = owner_id);

-- Project policies
CREATE POLICY "Project access through business ownership" ON projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = projects.business_id
      AND businesses.owner_id = auth.uid()
    )
  );
```

### Storage Buckets

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('business-media', 'business-media', true),
  ('project-files', 'project-files', false),
  ('user-avatars', 'user-avatars', true);

-- Storage policies
CREATE POLICY "Business media access" ON storage.objects
  FOR ALL USING (bucket_id = 'business-media');

CREATE POLICY "Project files access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'project-files' AND
    auth.role() = 'authenticated'
  );
```

### Database Functions

```sql
-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 🔧 Local Development

### Prerequisites

- Node.js 20+
- npm or yarn
- Git
- VS Code (recommended)

### Setup Steps

```bash
# 1. Clone repository
git clone https://github.com/your-org/local-seo-ranker.git
cd local-seo-ranker

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local

# 4. Configure environment variables
# Edit .env.local with your API keys

# 5. Start development server
npm run dev

# 6. Open browser
open http://localhost:5173
```

### Development Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-maps-key
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:5173/api

# For testing Twilio (optional)
TWILIO_ACCOUNT_SID=your-test-sid
TWILIO_AUTH_TOKEN=your-test-token
```

## 🧪 Testing & Quality Assurance

### Testing Setup

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format
```

### Pre-deployment Checklist

- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] No ESLint errors
- [ ] Environment variables configured in Digital Ocean
- [ ] Database migrations applied to Supabase
- [ ] SSL certificate valid
- [ ] Performance benchmarks met
- [ ] Security scan passed

## 📊 Monitoring & Logging

### Application Monitoring

```javascript
// Error tracking setup
import { initSentry } from "./lib/monitoring";

initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Performance monitoring
import { trackPerformance } from "./lib/analytics";

trackPerformance({
  route: window.location.pathname,
  loadTime:
    performance.timing.loadEventEnd - performance.timing.navigationStart,
});
```

### Log Aggregation

```bash
# Digital Ocean App logs
doctl apps logs YOUR_APP_ID --type=BUILD
doctl apps logs YOUR_APP_ID --type=RUN --follow

# Supabase logs
# Access via Supabase Dashboard > Logs
```

### Health Checks

```javascript
// Health check endpoint
export const handler = async (event, context) => {
  try {
    // Check database connection
    const { data, error } = await supabase.from("users").select("id").limit(1);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "up",
          storage: "up",
          auth: "up",
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        status: "unhealthy",
        error: error.message,
      }),
    };
  }
};
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run test
      - run: npm run typecheck
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run build

      - name: Deploy to Digital Ocean
        uses: digitalocean/app_action@v1.1.5
        with:
          app_name: local-seo-ranker
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
```

## 🔐 Security Configuration

### Supabase Security

```sql
-- Enable audit logging
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (table_name, operation, user_id, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### Backup Strategy

```bash
# Database backups (automated via Supabase)
# Point-in-time recovery available
# Daily automated backups retained for 7 days

# Code backups
# Git repository with multiple remotes
# GitHub (primary) + GitLab (mirror)

# File storage backups
# Supabase Storage with automatic replication
# Cross-region backup strategy
```

## 📞 Support & Troubleshooting

### Common Issues

**Build Failures**

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
rm -rf dist
npm run build
```

**Database Connection Issues**

```bash
# Check Supabase status
curl https://status.supabase.com

# Verify environment variables
doctl apps list-envs YOUR_APP_ID
```

**Performance Issues**

```bash
# Analyze bundle size
npm run build:analyze

# Check lighthouse scores
lighthouse https://app.mylocalseoranker.com
```

### Emergency Procedures

1. **Service Down**: Check Digital Ocean status page
2. **Database Issues**: Contact Supabase support
3. **CDN Issues**: Contact Digital Ocean support
4. **Security Incident**: security@mylocalseoranker.com

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Platform**: Digital Ocean App Platform
**Maintained By**: DevOps Team
