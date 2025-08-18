// GMB Leads Management System Types

export interface GMBLead {
  id: string;
  
  // Google Business identifiers
  google_cid: string;
  google_place_id?: string;
  
  // Business Basic Info (hidden until unlocked)
  business_name: string;
  phone?: string;
  email?: string;
  website?: string;
  
  // Address components
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  
  // Google My Business specific data
  gmb_rating?: number;
  gmb_reviews_count: number;
  gmb_category?: string;
  gmb_subcategory?: string;
  gmb_status?: string;
  gmb_verified: boolean;
  
  // Business details
  description?: string;
  hours_monday?: string;
  hours_tuesday?: string;
  hours_wednesday?: string;
  hours_thursday?: string;
  hours_friday?: string;
  hours_saturday?: string;
  hours_sunday?: string;
  
  // Additional business data points
  price_range?: string;
  accepts_credit_cards?: boolean;
  wheelchair_accessible?: boolean;
  has_parking?: boolean;
  has_wifi?: boolean;
  
  // Social media & online presence
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  yelp_url?: string;
  
  // Lead management
  lead_score: number;
  lead_quality: 'hot' | 'warm' | 'cold' | 'unscored';
  
  // Source tracking
  scan_id?: string;
  scan_location?: string;
  found_position?: number;
  
  // Privacy & unlocking system
  is_unlocked: boolean;
  unlocked_by?: string;
  unlocked_at?: string;
  unlock_credits_cost: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Data quality flags
  data_completeness_score: number;
  needs_verification: boolean;
  last_verified_at?: string;
}

export interface LeadUnlockTransaction {
  id: string;
  user_id: string;
  lead_id: string;
  credits_spent: number;
  transaction_type: 'unlock' | 'refund';
  created_at: string;
  notes?: string;
}

// Display version with privacy controls
export interface GMBLeadDisplay {
  id: string;
  google_cid: string;
  
  // Conditionally shown based on unlock status
  business_name: string | '***';
  phone: string | '***';
  email: string | '***';
  website: string | '***';
  street_address: string | '***';
  
  // Always visible
  city?: string;
  state?: string;
  zip_code?: string;
  gmb_rating?: number;
  gmb_reviews_count: number;
  gmb_category?: string;
  gmb_verified: boolean;
  price_range?: string;
  lead_score: number;
  lead_quality: string;
  data_completeness_score: number;
  
  // Privacy & unlocking
  is_unlocked: boolean;
  unlock_credits_cost: number;
  
  // Metadata
  created_at: string;
  scan_location?: string;
  found_position?: number;
}

// Filters for lead browsing
export interface LeadFilters {
  city?: string;
  state?: string;
  gmb_category?: string;
  gmb_rating_min?: number;
  gmb_rating_max?: number;
  reviews_count_min?: number;
  reviews_count_max?: number;
  lead_quality?: string[];
  price_range?: string[];
  gmb_verified?: boolean;
  has_phone?: boolean;
  has_email?: boolean;
  has_website?: boolean;
  data_completeness_min?: number;
  created_after?: string;
  created_before?: string;
  unlocked_status?: 'all' | 'unlocked' | 'locked';
  search_term?: string;
}

// Sort options
export interface LeadSortOptions {
  field: 'business_name' | 'gmb_rating' | 'gmb_reviews_count' | 'lead_score' | 'data_completeness_score' | 'created_at';
  direction: 'asc' | 'desc';
}

// API response types
export interface LeadsResponse {
  leads: GMBLeadDisplay[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
  filters_applied: LeadFilters;
}

export interface LeadStats {
  total_leads: number;
  unlocked_leads: number;
  leads_by_quality: {
    hot: number;
    warm: number;
    cold: number;
    unscored: number;
  };
  leads_by_category: Array<{
    category: string;
    count: number;
  }>;
  average_rating: number;
  leads_with_phone: number;
  leads_with_email: number;
  leads_with_website: number;
}

// Bulk operations
export interface BulkUnlockRequest {
  lead_ids: string[];
  total_credits_required: number;
}

export interface BulkUnlockResponse {
  successful_unlocks: string[];
  failed_unlocks: Array<{
    lead_id: string;
    error: string;
  }>;
  total_credits_spent: number;
  remaining_credits: number;
}

// Constants
export const LEAD_QUALITY_OPTIONS = [
  { value: 'hot', label: 'Hot', color: 'red' },
  { value: 'warm', label: 'Warm', color: 'yellow' },
  { value: 'cold', label: 'Cold', color: 'blue' },
  { value: 'unscored', label: 'Unscored', color: 'gray' },
] as const;

export const PRICE_RANGE_OPTIONS = [
  { value: '$', label: '$' },
  { value: '$$', label: '$$' },
  { value: '$$$', label: '$$$' },
  { value: '$$$$', label: '$$$$' },
] as const;

export const GMB_CATEGORIES = [
  'Restaurant',
  'Auto Repair',
  'Real Estate',
  'Dentist',
  'Hair Salon',
  'Lawyer',
  'Doctor',
  'Plumber',
  'Electrician',
  'Construction',
  'Insurance',
  'Accounting',
  'Fitness',
  'Retail',
  'Services',
  'Healthcare',
  'Beauty',
  'Entertainment',
  'Education',
  'Other'
] as const;
