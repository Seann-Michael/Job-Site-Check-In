/**
 * Domain types for the mobile app.
 *
 * Field names are snake_case to mirror the Supabase rows the web client uses
 * (see client/lib/dataService.ts in the web app).
 */

export type JobStatus =
  | 'draft'
  | 'active'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ServiceType =
  | 'gutters'
  | 'drainage'
  | 'plumbing'
  | 'roofing'
  | 'landscaping'
  | 'painting'
  | 'snow_removal'
  | 'general';

export interface Job {
  id: string;
  title: string;
  /** Free-text scope of work (the jobs table's `description` column). */
  description?: string;
  client_name: string;
  address: string;
  city: string;
  status: JobStatus;
  service_type: ServiceType;
  start_date: string;
  photo_count: number;
  review_requested: boolean;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  client_phone?: string;
  client_email?: string;
  state?: string;
  zip?: string;
}

export type ReviewRequestStatus = 'sent' | 'viewed' | 'completed' | 'expired' | 'scheduled';

export interface ReviewRequest {
  id: string;
  customer_name: string;
  contact: string;
  channel: 'sms' | 'email';
  status: ReviewRequestStatus;
  sent_at: string;
  job_title: string;
  rating?: number;
}

export type MediaCategory = 'before' | 'after' | 'progress' | 'final';

export interface MediaItem {
  id: string;
  job_id: string;
  job_title: string;
  media_type: 'image' | 'video';
  category: MediaCategory;
  taken_at: string;
  /** Public URL (Supabase Storage) or local file URI for captured photos. */
  uri?: string;
  latitude?: number;
  longitude?: number;
  /** Waiting in the offline upload queue. */
  pending?: boolean;
  tags?: string[];
}

export type AuditStatus = 'pass' | 'warn' | 'fail';

export interface GmbAuditItem {
  id: string;
  label: string;
  detail: string;
  status: AuditStatus;
}

export interface GmbProfile {
  name: string;
  category: string;
  score: number;
  rating: number;
  review_count: number;
  photo_count: number;
}

/**
 * The `businesses.address` JSONB blob. Shaped exactly as the web app writes it
 * (the `addressBlob` in client/pages/Settings.tsx handleSave) and reads it back
 * (same file, plus client/pages/BusinessDetail.tsx). Every part is optional
 * because rows written by other paths only fill some of it.
 */
export interface BusinessAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface Business {
  id: string;
  name: string;
  /**
   * Subscription tier, read from the row's `metadata` blob — the same source
   * the web admin screens use (`metadata.plan`, falling back to
   * `metadata.subscription_plan`; see client/pages/BusinessManagement.tsx and
   * SuperAdminWorkspaces.tsx). Undefined when the row names no plan: there is
   * no default worth guessing, so render it conditionally.
   */
  plan?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: BusinessAddress;
}

export interface ClientRecord {
  id: string;
  /**
   * Compatibility surface: every screen reads this, and it is the key that
   * links jobs to clients (matched against Job.client_name). Always populated.
   */
  name: string;
  /** Person's given name, when the `clients` row splits it out. */
  first_name?: string;
  /** Person's family name, when the `clients` row splits it out. */
  last_name?: string;
  /** Company this client is billed under — a company, not a person. */
  business_name?: string;
  phone: string;
  email: string;
  jobs_count: number;
  last_job_at: string;
}

export interface JobTask {
  id: string;
  label: string;
  done: boolean;
  /** Stamped when checked off. */
  done_at?: string;
  done_by?: string;
}
