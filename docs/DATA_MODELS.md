# Local SEO Ranker - Data Models & Variables

## 📊 Database Schema Overview

The Local SEO Ranker system uses a PostgreSQL database hosted on Supabase with comprehensive data models designed for scalability and performance.

## 👤 User Management

### User Model

```typescript
interface User {
  id: string; // UUID primary key
  email: string; // Unique email address
  name: string; // Full name
  role: UserRole; // User role (enum)
  is_2fa_enabled: boolean; // Two-factor authentication status
  avatar_url?: string; // Profile picture URL
  phone?: string; // Phone number (E.164 format)
  metadata: UserMetadata; // Additional user data
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  last_login?: string; // Last login timestamp
  email_verified: boolean; // Email verification status
  phone_verified: boolean; // Phone verification status
}

enum UserRole {
  SUPER_ADMIN = "super_admin",
  AGENCY_ADMIN = "agency_admin",
  BUSINESS_OWNER = "business_owner",
  STAFF = "staff",
  VIEWER = "viewer",
}

interface UserMetadata {
  preferences: UserPreferences;
  onboarding_completed: boolean;
  subscription_plan: string;
  billing_address?: Address;
  timezone: string;
  language: string;
}

interface UserPreferences {
  notifications: NotificationSettings;
  dashboard_layout: "compact" | "detailed";
  theme: "light" | "dark" | "system";
  date_format: "US" | "EU" | "ISO";
  currency: string;
}
```

### User Sessions

```typescript
interface UserSession {
  id: string;
  user_id: string;
  device_info: DeviceInfo;
  ip_address: string;
  user_agent: string;
  location?: GeoLocation;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  last_activity: string;
}

interface DeviceInfo {
  platform: string;
  browser: string;
  os: string;
  is_mobile: boolean;
  device_id: string;
}
```

## 🏢 Business Management

### Business Model

```typescript
interface Business {
  id: string; // UUID primary key
  owner_id: string; // Foreign key to users table
  name: string; // Business name
  description?: string; // Business description
  address: Address; // Business address
  phone: string; // Primary phone number
  email: string; // Business email
  website?: string; // Business website URL
  category: BusinessCategory; // Business category
  subcategory?: string; // Business subcategory
  google_place_id?: string; // Google Places ID
  google_my_business?: GMBData; // Google My Business data
  business_hours: BusinessHours; // Operating hours
  social_media: SocialMedia; // Social media profiles
  metadata: BusinessMetadata; // Additional business data
  status: BusinessStatus; // Business status
  created_at: string;
  updated_at: string;
  verified_at?: string; // Verification timestamp
}

interface Address {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formatted_address: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
}

enum BusinessCategory {
  RESTAURANT = "restaurant",
  RETAIL = "retail",
  HEALTHCARE = "healthcare",
  AUTOMOTIVE = "automotive",
  REAL_ESTATE = "real_estate",
  PROFESSIONAL_SERVICES = "professional_services",
  HOME_SERVICES = "home_services",
  BEAUTY_WELLNESS = "beauty_wellness",
  FITNESS = "fitness",
  EDUCATION = "education",
  ENTERTAINMENT = "entertainment",
  OTHER = "other",
}

enum BusinessStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING_VERIFICATION = "pending_verification",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  timezone: string;
}

interface DayHours {
  is_open: boolean;
  open_time?: string; // Format: "09:00"
  close_time?: string; // Format: "17:00"
  is_24_hours?: boolean;
}

interface SocialMedia {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  google_my_business?: string;
}

interface BusinessMetadata {
  employee_count?: number;
  year_established?: number;
  annual_revenue?: number;
  service_areas: string[];
  specialties: string[];
  certifications: string[];
  languages_spoken: string[];
}
```

### Google My Business Integration

```typescript
interface GMBData {
  account_id: string;
  location_id: string;
  name: string;
  store_code?: string;
  phone_numbers: PhoneNumber[];
  categories: GMBCategory[];
  website_url?: string;
  regular_hours: BusinessHours;
  special_hours: SpecialHours[];
  location_state: LocationState;
  attributes: GMBAttribute[];
  photos: GMBPhoto[];
  reviews_summary: ReviewsSummary;
  last_synced: string;
}

interface GMBCategory {
  name: string;
  category_id: string;
  is_primary: boolean;
}

interface LocationState {
  is_verified: boolean;
  is_published: boolean;
  is_suspended: boolean;
  is_duplicate_location: boolean;
  needs_reverification: boolean;
}
```

## 📊 SEO Projects & Campaigns

### Project Model

```typescript
interface Project {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: ProjectPriority;
  assigned_to?: string; // User ID
  client_contact?: ContactInfo;
  objectives: string[];
  deliverables: string[];
  timeline: ProjectTimeline;
  budget?: ProjectBudget;
  seo_targets: SEOTargets;
  keywords: Keyword[];
  competitors: Competitor[];
  progress: ProjectProgress;
  metadata: ProjectMetadata;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
}

enum ProjectType {
  LOCAL_OPTIMIZATION = "local_optimization",
  CONTENT_MARKETING = "content_marketing",
  REPUTATION_MANAGEMENT = "reputation_management",
  TECHNICAL_SEO = "technical_seo",
  LINK_BUILDING = "link_building",
  ONGOING_OPTIMIZATION = "ongoing_optimization",
}

enum ProjectStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  IN_PROGRESS = "in_progress",
  PAUSED = "paused",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

enum ProjectPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

interface ProjectTimeline {
  estimated_duration: number; // Days
  phases: ProjectPhase[];
  milestones: Milestone[];
}

interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  tasks: Task[];
  status: PhaseStatus;
}

interface SEOTargets {
  target_keywords: string[];
  target_locations: string[];
  current_rankings: KeywordRanking[];
  target_rankings: KeywordRanking[];
  organic_traffic_goal: number;
  conversion_goal: number;
}
```

### Keywords & Rankings

```typescript
interface Keyword {
  id: string;
  project_id: string;
  keyword: string;
  search_volume: number;
  competition: CompetitionLevel;
  difficulty_score: number;
  intent: SearchIntent;
  location: string;
  device: DeviceType;
  rankings: KeywordRanking[];
  created_at: string;
  updated_at: string;
}

enum CompetitionLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

enum SearchIntent {
  INFORMATIONAL = "informational",
  NAVIGATIONAL = "navigational",
  COMMERCIAL = "commercial",
  TRANSACTIONAL = "transactional",
  LOCAL = "local",
}

enum DeviceType {
  DESKTOP = "desktop",
  MOBILE = "mobile",
  TABLET = "tablet",
}

interface KeywordRanking {
  id: string;
  keyword_id: string;
  position: number;
  url: string;
  search_engine: SearchEngine;
  location: string;
  device: DeviceType;
  tracked_at: string;
  change_from_previous: number;
  best_position: number;
  worst_position: number;
}

enum SearchEngine {
  GOOGLE = "google",
  BING = "bing",
  YAHOO = "yahoo",
}
```

## ⭐ Reviews & Reputation

### Review Model

```typescript
interface Review {
  id: string;
  business_id: string;
  platform: ReviewPlatform;
  platform_review_id: string;
  rating: number; // 1-5 scale
  title?: string;
  text: string;
  author: ReviewAuthor;
  date: string;
  response?: ReviewResponse;
  sentiment: SentimentAnalysis;
  keywords_mentioned: string[];
  photos?: ReviewPhoto[];
  is_verified: boolean;
  is_featured: boolean;
  metadata: ReviewMetadata;
  created_at: string;
  updated_at: string;
}

enum ReviewPlatform {
  GOOGLE = "google",
  YELP = "yelp",
  FACEBOOK = "facebook",
  TRIPADVISOR = "tripadvisor",
  BBB = "better_business_bureau",
  GLASSDOOR = "glassdoor",
  CUSTOM = "custom",
}

interface ReviewAuthor {
  name: string;
  profile_photo?: string;
  review_count?: number;
  is_local_guide?: boolean;
  profile_url?: string;
}

interface ReviewResponse {
  text: string;
  author: string;
  date: string;
  is_business_owner: boolean;
}

interface SentimentAnalysis {
  score: number; // -1 to 1 scale
  magnitude: number; // 0 to 1 scale
  sentiment: "positive" | "neutral" | "negative";
  confidence: number; // 0 to 1 scale
  aspects: AspectSentiment[];
}

interface AspectSentiment {
  aspect: string; // service, food, price, etc.
  sentiment: number;
  mentions: number;
}
```

### Review Analytics

```typescript
interface ReviewAnalytics {
  business_id: string;
  period: AnalyticsPeriod;
  total_reviews: number;
  average_rating: number;
  rating_distribution: RatingDistribution;
  review_velocity: number; // Reviews per month
  response_rate: number; // Percentage
  average_response_time: number; // Hours
  sentiment_trends: SentimentTrend[];
  top_keywords: KeywordMention[];
  platform_breakdown: PlatformStats[];
  geographic_distribution: GeographicStats[];
  computed_at: string;
}

interface RatingDistribution {
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

interface SentimentTrend {
  date: string;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  average_sentiment: number;
}
```

## 📍 Location & Maps Data

### Location Model

```typescript
interface Location {
  id: string;
  business_id: string;
  name: string;
  address: Address;
  primary_phone: string;
  location_type: LocationType;
  google_place_id?: string;
  service_areas: ServiceArea[];
  local_rankings: LocalRanking[];
  citations: Citation[];
  photos: LocationPhoto[];
  amenities: string[];
  accessibility_features: string[];
  parking_info?: ParkingInfo;
  public_transport?: string[];
  is_primary: boolean;
  status: LocationStatus;
  created_at: string;
  updated_at: string;
}

enum LocationType {
  STOREFRONT = "storefront",
  SERVICE_AREA = "service_area",
  HYBRID = "hybrid",
}

enum LocationStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING_VERIFICATION = "pending_verification",
}

interface ServiceArea {
  id: string;
  name: string;
  radius: number; // Miles or kilometers
  center_point: GeoPoint;
  boundary_points?: GeoPoint[];
  population: number;
  market_potential: MarketPotential;
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface LocalRanking {
  id: string;
  keyword: string;
  position: number;
  pack_position?: number; // Local pack position (1-3)
  search_location: string;
  device: DeviceType;
  date: string;
  change_from_previous: number;
}

interface Citation {
  id: string;
  location_id: string;
  source: string;
  url: string;
  business_name: string;
  address: Address;
  phone: string;
  website?: string;
  is_accurate: boolean;
  issues: CitationIssue[];
  last_checked: string;
  status: CitationStatus;
}

enum CitationStatus {
  ACCURATE = "accurate",
  INACCURATE = "inaccurate",
  PENDING = "pending",
  NOT_FOUND = "not_found",
}

interface CitationIssue {
  field: string;
  expected_value: string;
  actual_value: string;
  severity: "low" | "medium" | "high";
}
```

## 📞 Communications & Twilio Integration

### Communication Model

```typescript
interface Communication {
  id: string;
  business_id: string;
  type: CommunicationType;
  channel: CommunicationChannel;
  recipient: ContactInfo;
  sender: ContactInfo;
  subject?: string;
  content: string;
  template_id?: string;
  template_variables?: Record<string, any>;
  status: CommunicationStatus;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  error_message?: string;
  twilio_sid?: string;
  campaign_id?: string;
  metadata: CommunicationMetadata;
  created_at: string;
  updated_at: string;
}

enum CommunicationType {
  REVIEW_REQUEST = "review_request",
  REVIEW_RESPONSE = "review_response",
  NOTIFICATION = "notification",
  MARKETING = "marketing",
  REMINDER = "reminder",
  ALERT = "alert",
}

enum CommunicationChannel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WEBHOOK = "webhook",
}

enum CommunicationStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  SENDING = "sending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  user_id?: string;
}

interface CommunicationMetadata {
  device_info?: DeviceInfo;
  location?: string;
  source: string;
  tracking_enabled: boolean;
  personalization_data?: Record<string, any>;
}
```

### Message Templates

```typescript
interface MessageTemplate {
  id: string;
  name: string;
  description: string;
  type: CommunicationType;
  channel: CommunicationChannel;
  subject?: string;
  content: string;
  variables: TemplateVariable[];
  is_active: boolean;
  created_by: string;
  usage_count: number;
  last_used: string;
  created_at: string;
  updated_at: string;
}

interface TemplateVariable {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  required: boolean;
  default_value?: any;
  description: string;
}
```

## 🔗 Webhooks & Integrations

### Webhook Model

```typescript
interface Webhook {
  id: string;
  business_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  is_active: boolean;
  retry_policy: RetryPolicy;
  headers?: Record<string, string>;
  authentication?: WebhookAuth;
  last_triggered?: string;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

enum WebhookEvent {
  REVIEW_CREATED = "review.created",
  REVIEW_UPDATED = "review.updated",
  REVIEW_RESPONDED = "review.responded",
  BUSINESS_UPDATED = "business.updated",
  PROJECT_COMPLETED = "project.completed",
  RANKING_CHANGED = "ranking.changed",
  CITATION_FOUND = "citation.found",
  ALERT_TRIGGERED = "alert.triggered",
}

interface RetryPolicy {
  max_retries: number;
  retry_delay: number; // Seconds
  backoff_multiplier: number;
  max_delay: number; // Seconds
}

interface WebhookAuth {
  type: "bearer" | "basic" | "api_key";
  credentials: Record<string, string>;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  response_status?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  attempt_count: number;
  delivered_at?: string;
  next_retry_at?: string;
  created_at: string;
}
```

### RSS Feed Integration

```typescript
interface RSSFeed {
  id: string;
  business_id?: string; // Optional for global feeds
  url: string;
  title: string;
  description: string;
  category: FeedCategory;
  is_active: boolean;
  last_fetched: string;
  fetch_frequency: number; // Hours
  item_count: number;
  error_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

enum FeedCategory {
  SEO_NEWS = "seo_news",
  INDUSTRY_NEWS = "industry_news",
  GOOGLE_UPDATES = "google_updates",
  LOCAL_SEO = "local_seo",
  MARKETING = "marketing",
  BUSINESS_NEWS = "business_news",
}

interface RSSItem {
  id: string;
  feed_id: string;
  title: string;
  description: string;
  content?: string;
  url: string;
  author?: string;
  published_at: string;
  guid: string;
  categories: string[];
  is_read: boolean;
  is_bookmarked: boolean;
  sentiment?: SentimentAnalysis;
  created_at: string;
}
```

## 📊 Analytics & Reporting

### Analytics Model

```typescript
interface AnalyticsData {
  id: string;
  business_id: string;
  metric_type: MetricType;
  metric_name: string;
  value: number;
  dimensions: Record<string, string>;
  date: string;
  hour?: number;
  data_source: DataSource;
  quality_score: number; // 0-100
  created_at: string;
}

enum MetricType {
  ORGANIC_TRAFFIC = "organic_traffic",
  KEYWORD_RANKING = "keyword_ranking",
  LOCAL_RANKING = "local_ranking",
  REVIEW_COUNT = "review_count",
  REVIEW_RATING = "review_rating",
  CITATION_COUNT = "citation_count",
  CONVERSION_RATE = "conversion_rate",
  PHONE_CALLS = "phone_calls",
  DIRECTION_REQUESTS = "direction_requests",
  WEBSITE_CLICKS = "website_clicks",
}

enum DataSource {
  GOOGLE_SEARCH_CONSOLE = "google_search_console",
  GOOGLE_ANALYTICS = "google_analytics",
  GOOGLE_MY_BUSINESS = "google_my_business",
  INTERNAL_TRACKING = "internal_tracking",
  THIRD_PARTY_API = "third_party_api",
}

interface Report {
  id: string;
  business_id: string;
  name: string;
  type: ReportType;
  schedule: ReportSchedule;
  recipients: string[];
  parameters: ReportParameters;
  last_generated: string;
  next_generation: string;
  status: ReportStatus;
  file_url?: string;
  created_at: string;
  updated_at: string;
}

enum ReportType {
  MONTHLY_SEO = "monthly_seo",
  WEEKLY_RANKINGS = "weekly_rankings",
  REVIEW_SUMMARY = "review_summary",
  COMPETITIVE_ANALYSIS = "competitive_analysis",
  LOCAL_VISIBILITY = "local_visibility",
  CUSTOM = "custom",
}

interface ReportSchedule {
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  day_of_week?: number; // 0-6 (Sunday-Saturday)
  day_of_month?: number; // 1-31
  hour: number; // 0-23
  timezone: string;
}
```

## 🔒 Security & Audit

### Audit Log Model

```typescript
interface AuditLog {
  id: string;
  user_id?: string;
  session_id?: string;
  business_id?: string;
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  details: AuditDetails;
  ip_address: string;
  user_agent: string;
  location?: GeoLocation;
  risk_score: number; // 0-100
  created_at: string;
}

enum AuditAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  EXPORT = "export",
  IMPORT = "import",
  SHARE = "share",
  PERMISSION_CHANGE = "permission_change",
}

interface AuditDetails {
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  method?: string;
  endpoint?: string;
  status_code?: number;
  error_message?: string;
}

interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  user_id?: string;
  business_id?: string;
  description: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

enum SecurityEventType {
  FAILED_LOGIN = "failed_login",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  DATA_BREACH_ATTEMPT = "data_breach_attempt",
  UNAUTHORIZED_ACCESS = "unauthorized_access",
  MALICIOUS_REQUEST = "malicious_request",
}

enum SecuritySeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}
```

## 🔄 System Configuration

### Feature Flags

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number; // 0-100
  target_users?: string[];
  target_businesses?: string[];
  environment: "development" | "staging" | "production";
  created_at: string;
  updated_at: string;
  expires_at?: string;
}
```

### System Settings

```typescript
interface SystemSettings {
  id: string;
  category: SettingCategory;
  key: string;
  value: any;
  type: "string" | "number" | "boolean" | "json";
  description: string;
  is_public: boolean;
  last_modified_by: string;
  created_at: string;
  updated_at: string;
}

enum SettingCategory {
  GENERAL = "general",
  SECURITY = "security",
  INTEGRATIONS = "integrations",
  NOTIFICATIONS = "notifications",
  BILLING = "billing",
  FEATURES = "features",
}
```

---

**Data Schema Version**: 2.0  
**Last Updated**: January 2024  
**Database**: PostgreSQL 15 (Supabase)
