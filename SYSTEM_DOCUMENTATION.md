# Local SEO Ranker - Complete System Documentation

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Module Documentation](#module-documentation)
4. [API Reference](#api-reference)
5. [Database Models](#database-models)
6. [Deployment Guide](#deployment-guide)
7. [External Integrations](#external-integrations)
8. [Security Implementation](#security-implementation)
9. [Development Guide](#development-guide)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 System Overview

Local SEO Ranker is a comprehensive SEO management platform designed to help businesses and agencies improve their local search visibility and manage their online presence effectively.

### Core Features

- **SEO Project Management**: Complete project lifecycle management
- **Local Search Optimization**: Google My Business integration and local ranking tracking
- **Review Management**: Multi-platform review monitoring and response automation
- **Analytics & Reporting**: Comprehensive performance tracking and reporting
- **Communication Tools**: Automated SMS and email campaigns via Twilio
- **Agency Management**: Multi-client agency portal with role-based access
- **Webhook Integration**: Real-time data synchronization with external systems
- **RSS Feed Processing**: Industry news and content aggregation

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL) + Netlify Functions
- **Authentication**: Supabase Auth with 2FA support
- **Hosting**: Netlify CDN with global distribution
- **External APIs**: Google Maps, Twilio, SendGrid
- **Real-time**: Supabase Realtime for live updates

### Domain Architecture

- **Marketing Site**: `mylocalseoranker.com` (WordPress)
- **Web Application**: `app.mylocalseoranker.com` (React SPA)
- **API Endpoints**: `app.mylocalseoranker.com/api/*`

---

## 🏗️ Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                Marketing Website                         │
│              mylocalseoranker.com                       │
│                  (WordPress)                           │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────��──────────────┐
│                Web Application                          │
│            app.mylocalseoranker.com                     │
│              (React + Netlify)                         │
├─────────────────────────────────────────────────────────┤
│  Frontend: React 18 + TypeScript + Tailwind           │
│  UI: shadcn/ui + Radix UI Components                   │
│  State: React Query + Context API                      │
│  Routing: React Router v6                              │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Backend Services                         │
├─────────────────────────────────────────────────────────┤
│  API: Netlify Functions (Serverless)                   │
│  Database: Supabase PostgreSQL                         │
│  Auth: Supabase Auth + 2FA (TOTP)                     │
│  Storage: Supabase Storage                             │
│  Real-time: Supabase Realtime                         │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              External Integrations                      │
├─────────────────────────────────────────────────────────┤
│  Maps: Google Maps API + Places API                    │
│  Communications: Twilio (SMS + Email)                  │
│  Webhooks: Bidirectional webhook system                │
│  RSS: Feed parsing and content analysis                │
└───────────────────────────────��─────────────────────────┘
```

### Data Flow Architecture

```
User Input → Client Validation → API Request → Business Logic → Database → External APIs → Real-time Updates
```

---

## 📁 Module Documentation

### Frontend Modules

#### 1. Application Core (`client/App.tsx`)

**Purpose**: Main application entry point and routing configuration

**Key Features**:

- React Router v6 configuration with protected routes
- Error boundary implementation for graceful error handling
- Theme provider setup with dark/light mode support
- React Query client configuration for server state management
- Service worker registration for PWA capabilities

**Route Structure**:

```typescript
// Public Routes
/signin, /signup, /forgot-password

// Protected Routes (Business Owner)
/admin/projects, /admin/gallery, /admin/settings, /admin/reports

// Agency Routes
/agency/admin/dashboard, /agency/admin/clients, /agency/admin/projects

// Super Admin Routes
/super-admin/businesses, /super-admin/analytics, /super-admin/settings
```

#### 2. Layout Components

##### AppLayout (`client/components/AppLayout.tsx`)

**Purpose**: Main application layout with responsive sidebar and header

**Features**:

- Responsive sidebar with collapsible navigation
- Role-based navigation menu items
- Business switcher dropdown for multi-business users
- Quick action buttons and search functionality
- Mobile-optimized bottom navigation
- Breadcrumb navigation and contextual headers

**Key State Management**:

```typescript
interface LayoutState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  currentBusiness: Business | null;
  currentUser: User | null;
}
```

##### AgencyLayout (`client/components/AgencyLayout.tsx`)

**Purpose**: Specialized layout for agency admin interface

**Features**:

- Agency-specific navigation and branding
- Client management shortcuts
- Commission tracking dashboard
- Multi-client project overview

##### SuperAdminLayout (`client/components/SuperAdminLayout.tsx`)

**Purpose**: Platform administration interface layout

**Features**:

- System-wide analytics dashboard
- User and business management tools
- Platform configuration controls
- Security monitoring interface

#### 3. Core Components

##### Authentication Components

- **ProtectedRoute** (`client/components/ProtectedRoute.tsx`): Route protection based on user roles
- **SignIn/SignUp** (`client/pages/SignIn.tsx`, `client/pages/Signup.tsx`): Authentication forms with 2FA support

##### Business Management Components

- **ProjectCard** (`client/components/ProjectCard.tsx`): Project display and quick actions
- **BusinessDetail** (`client/pages/BusinessDetail.tsx`): Comprehensive business information management
- **ProjectDetail** (`client/pages/ProjectDetail.tsx`): Detailed project view with timeline and tasks

##### Media Management Components

- **SmartMediaUploader** (`client/components/SmartMediaUploader.tsx`): Advanced file upload with metadata enhancement
- **MediaViewer** (`client/components/MediaViewer.tsx`): Media gallery with optimization and filtering
- **PhotoCapture** (`client/components/PhotoCapture.tsx`): Camera integration for mobile devices

##### Search & Navigation Components

- **SmartSearch** (`client/components/SmartSearch.tsx`): Intelligent search with auto-suggestions
- **AdvancedSearch** (`client/components/AdvancedSearch.tsx`): Complex filtering and search functionality
- **Breadcrumbs** (`client/components/Breadcrumbs.tsx`): Navigation breadcrumb trail

#### 4. Utility Libraries (`client/lib/`)

##### Authentication (`client/lib/auth.ts`)

**Purpose**: User authentication and session management

**Key Functions**:

```typescript
class AuthService {
  async signIn(email: string, password: string): Promise<AuthResult>;
  async signUp(userData: SignUpData): Promise<User>;
  async enable2FA(userId: string): Promise<TwoFactorSetup>;
  async verify2FA(token: string): Promise<boolean>;
  async refreshToken(): Promise<string>;
  async signOut(): Promise<void>;
}
```

##### Google Maps Integration (`client/lib/googleMaps.ts`)

**Purpose**: Google Maps API integration for location services

**Key Functions**:

```typescript
class GoogleMapsService {
  async initializeMap(element: HTMLElement): Promise<google.maps.Map>;
  async searchPlaces(query: string, location: LatLng): Promise<PlaceResult[]>;
  async getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  async validateAddress(address: Address): Promise<ValidationResult>;
  async calculateDistance(origin: LatLng, destination: LatLng): Promise<number>;
}
```

##### Analytics (`client/lib/analytics.ts`)

**Purpose**: Performance tracking and user behavior analytics

**Key Functions**:

```typescript
class AnalyticsService {
  trackPageView(page: string): void;
  trackEvent(event: string, properties: EventProperties): void;
  trackError(error: Error, context: ErrorContext): void;
  trackPerformance(metric: PerformanceMetric): void;
  identifyUser(user: User): void;
}
```

##### File Optimization (`client/lib/fileOptimization.ts`)

**Purpose**: Client-side file compression and optimization

**Key Functions**:

```typescript
class FileOptimizationService {
  async optimizeImage(file: File): Promise<OptimizedFile>;
  async compressVideo(file: File): Promise<OptimizedFile>;
  async generateThumbnail(file: File): Promise<string>;
  async extractMetadata(file: File): Promise<FileMetadata>;
}
```

##### Media Metadata (`client/lib/mediaMetadata.ts`)

**Purpose**: Enhanced metadata extraction and enhancement for uploaded media

**Key Functions**:

```typescript
class MediaMetadataService {
  async enhanceImageMetadata(
    file: File,
    businessInfo: BusinessInfo,
  ): Promise<EnhancedMetadata>;
  async extractExifData(file: File): Promise<ExifData>;
  async generateStructuredData(metadata: FileMetadata): Promise<StructuredData>;
  async addGeoLocation(file: File, location: LatLng): Promise<GeoTaggedFile>;
}
```

##### Security (`client/lib/security.ts`)

**Purpose**: Client-side security utilities and input validation

**Key Functions**:

```typescript
class SecurityService {
  sanitizeInput(input: string): string;
  validateCSRFToken(token: string): boolean;
  encryptSensitiveData(data: string): string;
  validatePasswordStrength(password: string): PasswordStrengthResult;
  detectXSSAttempts(input: string): boolean;
}
```

##### Error Handling (`client/lib/errorHandling.ts`)

**Purpose**: Comprehensive error handling and reporting

**Key Functions**:

```typescript
class ErrorHandlingService {
  handleAPIError(error: APIError): UserFriendlyError;
  reportError(error: Error, context: ErrorContext): void;
  retryFailedRequest(request: FailedRequest): Promise<any>;
  showUserNotification(error: UserFriendlyError): void;
}
```

#### 5. Custom Hooks (`client/hooks/`)

##### useAuth (`client/hooks/useAuth.ts`)

**Purpose**: Authentication state management and user session handling

```typescript
const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn: (email: string, password: string) => Promise<void>,
    signOut: () => Promise<void>,
    updateUser: (userData: Partial<User>) => Promise<void>,
  };
};
```

##### useGoogleMaps (`client/hooks/useGoogleMaps.ts`)

**Purpose**: Google Maps integration with React hooks

```typescript
const useGoogleMaps = (apiKey: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  return {
    isLoaded,
    error,
    searchPlaces: (query: string) => Promise<PlaceResult[]>,
    getPlaceDetails: (placeId: string) => Promise<PlaceDetails>,
  };
};
```

##### usePerformance (`client/hooks/usePerformance.ts`)

**Purpose**: Performance monitoring and optimization

```typescript
const usePerformance = () => {
  return {
    measureRenderTime: (componentName: string) => void,
    trackMemoryUsage: () => MemoryUsage,
    optimizeRerender: (dependencies: any[]) => boolean
  }
}
```

### Backend Modules

#### 1. API Functions (`netlify/functions/api.ts`)

**Purpose**: Serverless API endpoints using Netlify Functions

**Structure**:

```typescript
// Route handlers
app.use("/auth", authRoutes); // Authentication endpoints
app.use("/businesses", businessRoutes); // Business management
app.use("/projects", projectRoutes); // Project management
app.use("/reviews", reviewRoutes); // Review management
app.use("/analytics", analyticsRoutes); // Analytics and reporting
app.use("/communications", commRoutes); // SMS/Email communications
app.use("/webhooks", webhookRoutes); // Webhook management
app.use("/integrations", integRoutes); // External service integrations
```

#### 2. Database Routes (`server/routes/`)

##### Demo Route (`server/routes/demo.ts`)

**Purpose**: Demo data and testing endpoints

##### Media Route (`server/routes/media.ts`)

**Purpose**: File upload and media processing endpoints

**Key Functions**:

- File upload handling with validation
- Image optimization and thumbnail generation
- Video processing and compression
- Metadata extraction and enhancement

#### 3. Shared Utilities (`shared/api.ts`)

**Purpose**: Shared types and utilities between client and server

**Key Exports**:

```typescript
interface DemoResponse {
  message: string;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: string;
}
```

### UI Component Library (`client/components/ui/`)

The system uses shadcn/ui components built on Radix UI primitives:

#### Core UI Components

- **Button** (`button.tsx`): Primary, secondary, destructive, ghost, and link variants
- **Input** (`input.tsx`): Text inputs with validation states
- **Card** (`card.tsx`): Content containers with header, content, and footer sections
- **Dialog** (`dialog.tsx`): Modal dialogs with overlay and focus management
- **Table** (`table.tsx`): Data tables with sorting and pagination
- **Form** (`form.tsx`): Form components with React Hook Form integration

#### Specialized UI Components

- **PhoneInput** (`phone-input.tsx`): International phone number input with country selection
- **StateSelect** (`state-select.tsx`): US state selection dropdown
- **Chart** (`chart.tsx`): Data visualization components using Recharts
- **Calendar** (`calendar.tsx`): Date picker with range selection support

#### Navigation Components

- **Navigation Menu** (`navigation-menu.tsx`): Multi-level navigation menus
- **Breadcrumb** (`breadcrumb.tsx`): Navigation breadcrumb trail
- **Pagination** (`pagination.tsx`): Page navigation controls

#### Feedback Components

- **Toast** (`toast.tsx`, `sonner.tsx`): Notification system
- **Alert** (`alert.tsx`): Status messages and warnings
- **Progress** (`progress.tsx`): Progress indicators and loading states

---

## 🔗 API Reference

### Base Configuration

- **Production URL**: `https://app.mylocalseoranker.com/api`
- **Authentication**: Bearer JWT tokens
- **Rate Limiting**: 1000-10000 requests/hour based on plan
- **Response Format**: JSON with consistent error handling

### Authentication Endpoints

#### POST /api/auth/login

Authenticate user and receive JWT token.

**Request**:

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "remember_me": false
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "refresh_token_here",
    "expires_in": 3600,
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "business_owner"
    }
  }
}
```

#### POST /api/auth/2fa/verify

Verify 2FA code during login.

**Request**:

```json
{
  "login_token": "temporary_login_token",
  "code": "123456"
}
```

### Business Management Endpoints

#### GET /api/businesses

List all businesses for authenticated user.

**Query Parameters**:

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search term
- `category` (string): Business category filter

#### POST /api/businesses

Create new business.

**Request**:

```json
{
  "name": "Local Restaurant",
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zip": "12345"
  },
  "phone": "+1234567890",
  "email": "info@restaurant.com",
  "category": "restaurant"
}
```

### SEO Analysis Endpoints

#### POST /api/seo/analyze

Perform comprehensive SEO analysis.

**Request**:

```json
{
  "business_id": "business-uuid",
  "url": "https://business.com",
  "keywords": ["local restaurant", "fine dining"],
  "location": {
    "city": "Anytown",
    "state": "CA"
  }
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "overall_score": 78,
    "analysis": {
      "on_page": { "score": 85, "issues": [], "recommendations": [] },
      "local_seo": { "score": 72, "google_my_business": {} },
      "technical": { "score": 90, "page_speed": 85 }
    }
  }
}
```

### Communication Endpoints

#### POST /api/communications/sms/send

Send SMS message via Twilio.

**Request**:

```json
{
  "to": "+1234567890",
  "message": "Your review request link: https://...",
  "business_id": "business-uuid"
}
```

#### POST /api/communications/email/send

Send email via SendGrid.

**Request**:

```json
{
  "to": "customer@example.com",
  "subject": "Thank you for your visit",
  "template": "review_request",
  "variables": {
    "business_name": "Local Restaurant",
    "customer_name": "John Doe"
  }
}
```

### Webhook Management

#### POST /api/webhooks/register

Register webhook endpoint.

**Request**:

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["review.created", "business.updated"],
  "secret": "webhook_secret_key"
}
```

---

## 🗄️ Database Models

### Core Database Schema

#### Users Table

```sql
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
```

#### Businesses Table

```sql
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
```

#### Projects Table

```sql
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
```

### TypeScript Interface Models

#### User Model

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "agency_admin" | "business_owner" | "staff";
  is_2fa_enabled: boolean;
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}
```

#### Business Model

```typescript
interface Business {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  address: Address;
  phone: string;
  email: string;
  website?: string;
  category: BusinessCategory;
  google_place_id?: string;
  business_hours: BusinessHours;
  created_at: string;
  updated_at: string;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: number;
  longitude?: number;
}
```

#### Project Model

```typescript
interface Project {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  type: ProjectType;
  status: ProjectStatus;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
}

enum ProjectType {
  LOCAL_OPTIMIZATION = "local_optimization",
  CONTENT_MARKETING = "content_marketing",
  REPUTATION_MANAGEMENT = "reputation_management",
}
```

---

## 🚀 Deployment Guide

### Prerequisites

- Node.js 18+
- Netlify account
- Supabase account
- Google Maps API key
- Twilio account

### Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google APIs
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
SENDGRID_API_KEY=your-sendgrid-key

# Application URLs
VITE_APP_URL=https://app.mylocalseoranker.com
VITE_API_URL=https://app.mylocalseoranker.com/api
```

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build:client"
  functions = "netlify/functions"
  publish = "dist/spa"

[functions]
  external_node_modules = ["express", "@supabase/supabase-js"]
  node_bundler = "esbuild"

[[redirects]]
  force = true
  from = "/api/*"
  status = 200
  to = "/.netlify/functions/api/:splat"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

### Deployment Steps

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Configure Environment**:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Build Application**:

   ```bash
   npm run build
   ```

4. **Deploy to Netlify**:
   ```bash
   netlify deploy --prod
   ```

### Database Setup (Supabase)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create core tables (see Database Models section)
-- Set up Row Level Security policies
-- Configure storage buckets
```

---

## 🔗 External Integrations

### Google Maps API Integration

#### Configuration

```javascript
const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.VITE_GOOGLE_MAPS_API_KEY,
  libraries: ["places", "geometry"],
  version: "3.55",
};
```

#### Usage Examples

```typescript
// Search for places
const places = await googleMapsService.searchPlaces("restaurants", {
  lat: 37.7749,
  lng: -122.4194,
});

// Get place details
const details = await googleMapsService.getPlaceDetails("ChIJXXXXXXXX");

// Validate address
const validation = await googleMapsService.validateAddress({
  street: "123 Main St",
  city: "San Francisco",
  state: "CA",
});
```

### Twilio Integration

#### SMS Service

```typescript
const twilioSMS = new TwilioSMSService();

// Send review request
await twilioSMS.sendReviewRequest({
  phoneNumber: "+1234567890",
  customerName: "John Doe",
  businessName: "Local Restaurant",
  reviewLink: "https://review-link.com",
});

// Send 2FA code
await twilioSMS.send2FACode("+1234567890", "123456");
```

#### Email Service (SendGrid)

```typescript
const sendGrid = new SendGridEmailService();

// Send templated email
await sendGrid.sendEmail({
  to: "customer@example.com",
  templateId: "d-review-template",
  templateData: {
    business_name: "Local Restaurant",
    review_link: "https://review-link.com",
  },
});
```

### Webhook System

#### Registering Webhooks

```typescript
await webhookService.registerWebhook({
  url: "https://your-app.com/webhook",
  events: ["review.created", "business.updated"],
  secret: "your-secret-key",
});
```

#### Webhook Event Types

- `review.created` - New review received
- `review.updated` - Review response added
- `business.updated` - Business information changed
- `ranking.changed` - Keyword ranking updated
- `project.completed` - SEO project finished

### RSS Feed Integration

#### Feed Subscription

```typescript
await rssService.subscribeFeed({
  url: "https://example.com/feed.xml",
  category: "seo_news",
  businessId: "business-uuid",
});
```

#### Content Processing

```typescript
// Process feed updates
await rssService.processFeedUpdates();

// Analyze content
const analysis = await rssAnalyzer.analyzeFeedItem(feedItem);
```

---

## 🔐 Security Implementation

### Authentication & Authorization

#### Two-Factor Authentication (2FA)

```typescript
// Enable 2FA for user
const setup = await twoFactorService.generateSecret(userId, email);

// Verify TOTP token
const isValid = await twoFactorService.verifyToken(userId, token);

// Use backup code
const backupValid = await twoFactorService.verifyBackupCode(userId, code);
```

#### Session Management

- JWT tokens with 1-hour expiration
- Refresh token rotation every 7 days
- Automatic logout on suspicious activity
- Session monitoring and tracking

### Data Protection

#### Input Validation

```typescript
// Sanitize user input
const cleanInput = securityService.sanitizeInput(userInput);

// Validate against XSS
const isSafe = securityService.detectXSSAttempts(input);

// Password strength validation
const strength = securityService.validatePasswordStrength(password);
```

#### Encryption

- Data at rest: Supabase encryption
- Data in transit: TLS 1.3
- Sensitive localStorage: AES encryption
- API tokens: Secure generation and rotation

### Security Monitoring

#### Audit Logging

```typescript
interface AuditLog {
  user_id?: string;
  action: AuditAction;
  resource_type: string;
  details: AuditDetails;
  ip_address: string;
  risk_score: number;
  created_at: string;
}
```

#### Threat Detection

- Failed login monitoring (5 attempts = lockout)
- Suspicious activity pattern recognition
- Real-time security event alerts
- Automatic incident response

---

## 🛠️ Development Guide

### Setup for Local Development

1. **Clone Repository**:

   ```bash
   git clone https://github.com/your-org/local-seo-ranker.git
   cd local-seo-ranker
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Environment Setup**:

   ```bash
   cp .env.example .env.local
   # Configure your API keys and URLs
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

### Code Quality Standards

#### TypeScript Configuration

- Strict type checking enabled
- No implicit any types
- Comprehensive interface definitions
- Proper error handling types

#### ESLint Rules

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

#### Testing Strategy

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Type checking
npm run typecheck
```

### Component Development Guidelines

#### Component Structure

```typescript
// Component template
interface ComponentProps {
  // Props definition
}

export const Component: React.FC<ComponentProps> = ({ ...props }) => {
  // Hooks and state

  // Event handlers

  // Effects

  // Render
  return (
    <div className="component-container">
      <header className="component-header">
        <h2>{props.title}</h2>
      </header>
      <main className="component-content">
        {props.children}
      </main>
      <footer className="component-footer">
        <button onClick={handleAction}>
          {isLoading ? 'Loading...' : 'Action'}
        </button>
      </footer>
    </div>
  );
};
```

#### State Management Patterns

```typescript
// React Query for server state
const { data, isLoading, error } = useQuery({
  queryKey: ["businesses"],
  queryFn: fetchBusinesses,
});

// Context for client state
const { user, updateUser } = useAuth();

// Local state for component-specific data
const [isOpen, setIsOpen] = useState(false);
```

### API Development Guidelines

#### Function Structure

```typescript
// Netlify function template
export const handler = async (event: APIEvent): Promise<APIResponse> => {
  try {
    // Authentication check
    const user = await authenticateRequest(event);

    // Input validation
    const validatedData = validateInput(event.body);

    // Business logic
    const result = await processRequest(validatedData);

    // Return response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result,
      }),
    };
  } catch (error) {
    return handleError(error);
  }
};
```

---

## 🔧 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Netlify build cache
netlify build --clear-cache
```

#### Authentication Issues

```typescript
// Check token expiration
const isExpired = jwt.decode(token).exp < Date.now() / 1000;

// Refresh token
if (isExpired) {
  await authService.refreshToken();
}
```

#### Database Connection Issues

```typescript
// Test Supabase connection
const { data, error } = await supabase.from("users").select("id").limit(1);

if (error) {
  console.error("Database connection failed:", error);
}
```

#### Performance Issues

```bash
# Analyze bundle size
npm run build:analyze

# Check lighthouse scores
lighthouse https://app.mylocalseoranker.com

# Monitor performance
npm run test:performance
```

### Error Handling Patterns

#### Client-Side Error Handling

```typescript
// Error boundary for React components
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    errorHandlingService.reportError(error, {
      component: errorInfo.componentStack,
      user: currentUser,
    });
  }
}

// API error handling
try {
  const result = await apiCall();
} catch (error) {
  const userError = errorHandlingService.handleAPIError(error);
  toast.error(userError.message);
}
```

#### Server-Side Error Handling

```typescript
// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error
  console.error("API Error:", error);

  // Return user-friendly error
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
});
```

### Support Resources

#### Documentation

- **API Reference**: Interactive API documentation
- **Component Library**: Storybook component documentation
- **Development Guide**: Comprehensive development instructions

#### Community

- **Discord Server**: Real-time developer support
- **GitHub Issues**: Bug reports and feature requests
- **Knowledge Base**: Common solutions and guides

#### Enterprise Support

- **Dedicated Support**: Priority technical support
- **Custom Integration**: Professional services team
- **Training**: Developer onboarding and training

---

**Documentation Version**: 2.0  
**Last Updated**: January 2024  
**Maintained By**: Development Team  
**Next Review**: Quarterly

---

## 📞 Contact & Support

### Technical Support

- **Email**: dev-support@mylocalseoranker.com
- **Documentation**: https://docs.mylocalseoranker.com
- **Status Page**: https://status.mylocalseoranker.com

### Development Team

- **Lead Developer**: Technical Architecture Team
- **Frontend Team**: React/TypeScript Specialists
- **Backend Team**: Node.js/PostgreSQL Experts
- **DevOps Team**: Netlify/Supabase Infrastructure

### Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### License

Proprietary - All Rights Reserved  
Copyright © 2024 Local SEO Ranker
