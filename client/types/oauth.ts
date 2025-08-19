export type OnboardingStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "expired";
export type PlatformStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "error"
  | "revoked";
export type AccessLevel = "read_only" | "full_management";

export interface BrandingConfig {
  logo_url?: string;
  primary_color: string;
  company_name?: string;
}

export interface ConnectedPlatform {
  platform: string;
  status: PlatformStatus;
  connected_at?: string;
  account_name?: string;
  account_id?: string;
}

export interface OnboardingSession {
  id: string;
  agency_user_id: string;
  project_id?: string;
  client_name: string;
  client_email: string;
  client_company?: string;
  status: OnboardingStatus;
  access_level: AccessLevel;
  expires_at: string;
  completed_at?: string;
  branding_config: BrandingConfig;
  required_platforms: string[];
  connected_platforms: ConnectedPlatform[];
  onboarding_token: string;
  link_clicks: number;
  created_at: string;
  updated_at: string;
}

export interface ClientAccess {
  id: string;
  session_id: string;
  platform: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  account_info: {
    accountId?: string;
    accountName?: string;
    email?: string;
    [key: string]: any;
  };
  permissions: string[];
  scopes: string[];
  status: PlatformStatus;
  is_active: boolean;
  last_sync_at?: string;
  error_message?: string;
  error_code?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformConfiguration {
  id: string;
  platform: string;
  display_name: string;
  icon_url?: string;
  description?: string;
  client_id?: string;
  client_secret?: string;
  auth_url?: string;
  token_url?: string;
  scopes: string[];
  configuration: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OAuthActivityLog {
  id: string;
  session_id: string;
  platform?: string;
  event_type: string;
  event_data: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

export interface CustomPlatformField {
  id: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "url"
    | "email"
    | "number";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select fields
  description?: string;
}

export interface CustomPlatform {
  id: string;
  name: string;
  description: string;
  instructions: string;
  fields: CustomPlatformField[];
  icon_url?: string;
  created_by: string; // agency user id
  created_at: string;
  updated_at: string;
}

export interface OnboardingLinkForm {
  client_name: string;
  client_email: string;
  client_company?: string;
  selected_platforms: string[];
  selected_custom_platforms: string[];
  access_level: AccessLevel;
  branding: BrandingConfig;
}

export interface GeneratedLink {
  url: string;
  token: string;
  expires_at: string;
  qr_code?: string;
}

export interface OAuthPopupMessage {
  type: "oauth_started" | "oauth_success" | "oauth_error" | "oauth_cancelled";
  platform: string;
  data?: any;
  error?: string;
  code?: string;
}

export interface ClientAccessStats {
  total_active_connections: number;
  pending_onboarding_links: number;
  connections_this_month: number;
  average_onboarding_time: number;
}

export interface OnboardingFormErrors {
  client_name?: string;
  client_email?: string;
  selected_platforms?: string;
  branding?: string;
}

// Platform-specific interfaces
export interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  accountType: string;
}

export interface MetaAdsAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  business?: {
    id: string;
    name: string;
  };
}

export interface GoogleAnalyticsAccount {
  account: {
    name: string;
    displayName: string;
  };
  property: {
    name: string;
    displayName: string;
    createTime: string;
  };
}

// OAuth Flow States
export interface OAuthFlowState {
  platform: string;
  isLoading: boolean;
  isConnected: boolean;
  accountInfo?: any;
  error?: string;
  retryCount: number;
}

// Webhook event types
export interface WebhookEvent {
  id: string;
  platform: string;
  event_type: string;
  account_id?: string;
  payload: Record<string, any>;
  signature?: string;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  created_at: string;
}

// API Response types
export interface OnboardingSessionResponse {
  data: OnboardingSession;
  success: boolean;
  error?: string;
}

export interface OnboardingSessionsResponse {
  data: OnboardingSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: boolean;
  error?: string;
}

export interface GenerateLinkResponse {
  data: {
    session: OnboardingSession;
    link: GeneratedLink;
  };
  success: boolean;
  error?: string;
}

export interface ClientAccessResponse {
  data: ClientAccess[];
  success: boolean;
  error?: string;
}

export interface PlatformConfigurationsResponse {
  data: PlatformConfiguration[];
  success: boolean;
  error?: string;
}

export interface ClientAccessStatsResponse {
  data: ClientAccessStats;
  success: boolean;
  error?: string;
}

// Form validation schemas
export const SUPPORTED_PLATFORMS = [
  "google_ads",
  "google_analytics",
  "google_merchant_center",
  "google_search_console",
  "google_tag_manager",
  "google_my_business",
  "facebook_pages",
  "meta_ads",
  "meta_product_catalog",
  "meta_pixels",
  "instagram",
  "whatsapp_business",
  "shopify",
  "youtube_studio",
  "wordpress",
  "tiktok_ads",
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const PLATFORM_DISPLAY_NAMES: Record<SupportedPlatform, string> = {
  google_ads: "Google Ads",
  google_analytics: "Analytics",
  google_merchant_center: "Merchant Center",
  google_search_console: "Search Console",
  google_tag_manager: "Tag Manager",
  google_my_business: "Business Profile",
  facebook_pages: "Facebook Pages",
  meta_ads: "Meta Ads",
  meta_product_catalog: "Product Catalog",
  meta_pixels: "Meta Pixels",
  instagram: "Instagram",
  whatsapp_business: "WhatsApp",
  shopify: "Store Collaborator",
  youtube_studio: "YouTube Studio",
  wordpress: "WordPress",
  tiktok_ads: "TikTok Ads",
};

export const PLATFORM_DESCRIPTIONS: Record<SupportedPlatform, string> = {
  google_ads: "Manage Google Ads campaigns and view performance data",
  google_analytics: "Access website analytics and reporting data",
  google_merchant_center: "Manage product listings and shopping campaigns",
  google_search_console: "View search performance and indexing data",
  google_tag_manager: "Manage website tracking tags and analytics",
  google_my_business: "Manage business listings and customer reviews",
  facebook_pages: "Manage Facebook business pages and posts",
  meta_ads: "Manage Facebook and Instagram advertising campaigns",
  meta_product_catalog: "Manage product catalogs for Facebook and Instagram",
  meta_pixels: "Track website conversions and optimize ads",
  instagram: "Manage Instagram business account and content",
  whatsapp_business: "Manage WhatsApp Business messaging and automation",
  shopify: "Access Shopify store data and manage products",
  youtube_studio: "Manage YouTube channel content and analytics",
  wordpress: "Manage WordPress website content and plugins",
  tiktok_ads: "Manage TikTok advertising campaigns",
};

// OAuth scopes for each platform
export const PLATFORM_SCOPES: Record<SupportedPlatform, string[]> = {
  google_ads: ["https://www.googleapis.com/auth/adwords"],
  meta_ads: ["ads_management", "ads_read", "business_management"],
  google_analytics: ["https://www.googleapis.com/auth/analytics.readonly"],
  google_search_console: [
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
  google_my_business: ["https://www.googleapis.com/auth/business.manage"],
  tiktok_ads: ["user.info.basic", "advertiser.read"],
};

// OAuth URLs for each platform
export const PLATFORM_OAUTH_URLS: Record<
  SupportedPlatform,
  { auth: string; token: string }
> = {
  google_ads: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
  meta_ads: {
    auth: "https://www.facebook.com/v18.0/dialog/oauth",
    token: "https://graph.facebook.com/v18.0/oauth/access_token",
  },
  google_analytics: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
  google_search_console: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
  google_my_business: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
  tiktok_ads: {
    auth: "https://ads.tiktok.com/marketing_api/auth",
    token: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
  },
};
