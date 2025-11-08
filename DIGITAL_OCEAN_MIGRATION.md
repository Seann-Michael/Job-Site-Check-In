# Digital Ocean Migration Guide

## ✅ Completed Migrations

The codebase has been migrated from Netlify to Digital Ocean App Platform. Here's what was updated:

### 1. Configuration Files
- ✅ Created `.do/app.yaml` - Digital Ocean App Platform configuration
- ✅ Deprecated `netlify.toml` (marked as legacy)
- ✅ Updated `package.json` scripts (removed `netlify dev`, updated to use `vite` directly)

### 2. Frontend API Endpoints
All client-side API calls updated from `/.netlify/functions/` to `/api/`:

- ✅ `client/lib/paymentService.ts` - Payment checkout endpoints
- ✅ `client/pages/OnboardingWizard.tsx` - Onboarding API calls
- ✅ `client/pages/AdminWordPressSites.tsx` - WordPress connection APIs
- ✅ `public/sw.js` - Service worker API detection

### 3. Development Configuration
- ✅ `vite.config.ts` - Updated to support both `/api/` and legacy `/.netlify/functions/` paths
  - Checks `api/` directory first
  - Falls back to `netlify/functions/` for backward compatibility
  - Supports local development for both path structures

### 4. Testing
- ✅ `test-api-functions.js` - Updated test endpoints to use `/api/`
- ✅ Updated help text and documentation

### 5. Documentation
- ✅ `README.md` - Updated architecture and deployment references
- ✅ `docs/DEPLOYMENT.md` - Complete Digital Ocean deployment guide
- ✅ `SETUP.md` - Removed Netlify references

---

## 🔄 Manual Steps Required

### Step 1: Move Function Files (Required)

You need to manually move your serverless functions from `netlify/functions/` to `api/`:

```bash
# Option 1: Move all files (recommended)
mv netlify/functions api

# Option 2: Copy files (keeps backup)
cp -r netlify/functions api
```

**Files to move:**
- All `.ts` and `.js` files in `netlify/functions/`
- Approximately 40+ function files including:
  - Payment handlers (create-checkout-*, webhook-*)
  - OAuth flows
  - Onboarding API
  - Media storage
  - Email/SMS services
  - And more...

### Step 2: Update Function Type Imports

After moving files to `api/`, update the import statements in each function file:

**Before:**
```typescript
import { Handler } from "@netlify/functions";
```

**After:**
```typescript
// Digital Ocean uses standard serverless types
export interface HandlerEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
  isBase64Encoded: boolean;
}

export interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export type Handler = (event: HandlerEvent, context: any) => Promise<HandlerResponse>;
```

**Or install a compatible types package:**
```bash
npm install @types/aws-lambda
```

Then use:
```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
```

### Step 3: Remove Netlify CLI (Optional)

Since you're no longer using Netlify:

```bash
npm uninstall netlify-cli
```

Update `package.json` to remove the dependency from devDependencies.

### Step 4: Configure Digital Ocean Environment Variables

In the Digital Ocean App Platform dashboard:

1. Go to your app settings
2. Navigate to "Environment Variables"
3. Add all variables from `.do/app.yaml` or use the env list provided earlier
4. Mark sensitive variables as "SECRET"

### Step 5: Deploy to Digital Ocean

```bash
# Install doctl CLI
brew install doctl  # macOS
# or download from https://docs.digitalocean.com/reference/doctl/

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# Or update existing app
doctl apps update YOUR_APP_ID --spec .do/app.yaml
```

**Or use GitHub integration:**
1. Connect repository in Digital Ocean dashboard
2. Select branch: `main`
3. Auto-deploys on every push

---

## 🔍 Files Still Referencing Netlify (Update if needed)

These documentation files contain Netlify references that may need updating based on your needs:

### API Documentation
- `docs/api/payments-expanded.openapi.yaml` - OpenAPI paths
- `docs/api/payments.openapi.yaml` - Payment endpoints
- `docs/api/onboarding.openapi.yaml` - Onboarding endpoints
- `docs/api/webhooks.openapi.yaml` - Webhook documentation
- `docs/api/examples/curl_examples.md` - cURL examples
- `docs/api/postman_collection.json` - Postman collection

**Action:** Update all `/.netlify/functions/` paths to `/api/` in OpenAPI specs and examples

### General Documentation
- `docs/SUPABASE_PRODUCTION_SETUP.md` - Setup guide
- `docs/PAYMENTS_ENV.md` - Payment environment variables
- `docs/BACKEND_MODULES.md` - Backend module references
- `docs/INTEGRATIONS.md` - Integration examples
- `docs/runbooks/ONCALL_RUNBOOK.md` - Operations runbook
- `IMPLEMENTATION_SUMMARY.md` - Implementation notes
- `CHANGELOG.md` - Changelog examples
- `SYSTEM_DOCUMENTATION.md` - System docs

**Action:** Search and replace `netlify` references with Digital Ocean equivalents

---

## 🧪 Testing Your Migration

### Local Development

```bash
# 1. Start development server
npm run dev

# 2. Test API endpoints
# The vite config supports both /api/ and /.netlify/functions/ during development

# 3. Run test script
node test-api-functions.js --local
```

### Verification Checklist

- [ ] Functions moved from `netlify/functions/` to `api/`
- [ ] Function type imports updated
- [ ] Local dev server starts without errors (`npm run dev`)
- [ ] API endpoints respond correctly (test with `test-api-functions.js`)
- [ ] Frontend can fetch data from `/api/*` endpoints
- [ ] Environment variables configured in Digital Ocean
- [ ] Deployed to Digital Ocean successfully
- [ ] Production API endpoints working
- [ ] Webhook URLs updated in third-party services (Stripe, PayPal, etc.)

---

## 🔗 Webhook URL Updates

Update webhook URLs in third-party service dashboards:

**Before (Netlify):**
```
https://your-site.netlify.app/.netlify/functions/webhook-stripe
https://your-site.netlify.app/.netlify/functions/webhook-paypal
https://your-site.netlify.app/.netlify/functions/webhook-coinbase
```

**After (Digital Ocean):**
```
https://your-app.ondigitalocean.app/api/webhook-stripe
https://your-app.ondigitalocean.app/api/webhook-paypal
https://your-app.ondigitalocean.app/api/webhook-coinbase
```

**Services to update:**
1. Stripe Dashboard → Developers → Webhooks
2. PayPal Developer Dashboard → Webhooks
3. Coinbase Commerce → Settings → Webhook URL
4. Google OAuth Console → Redirect URIs
5. Meta Developer → App Settings → OAuth Redirect URIs

---

## 📞 Support

**Digital Ocean Resources:**
- [App Platform Documentation](https://docs.digitalocean.com/products/app-platform/)
- [Deploy from GitHub](https://docs.digitalocean.com/products/app-platform/how-to/deploy-from-github/)
- [Environment Variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)
- [doctl CLI Reference](https://docs.digitalocean.com/reference/doctl/)

**Common Issues:**
- Build failures: Check Node version in `.do/app.yaml` (should be 20+)
- API 404 errors: Verify functions are in `api/` directory
- Environment variable issues: Check Digital Ocean dashboard settings

---

## 🎉 Migration Complete!

Once you've completed the manual steps above, your application will be fully migrated to Digital Ocean App Platform with:

- ✅ Static site hosting
- ✅ Serverless API functions
- ✅ Automatic SSL
- ✅ GitHub auto-deployment
- ✅ Environment variable management
- ✅ Custom domain support

**Last Updated:** January 2025
**Migration Status:** Code Complete - Manual File Move Required
