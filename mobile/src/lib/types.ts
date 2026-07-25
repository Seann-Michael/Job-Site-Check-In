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
  client_name: string;
  address: string;
  city: string;
  status: JobStatus;
  service_type: ServiceType;
  start_date: string;
  photo_count: number;
  review_requested: boolean;
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

export interface Business {
  id: string;
  name: string;
  plan: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  jobs_count: number;
  last_job_at: string;
}

export interface JobTask {
  id: string;
  label: string;
  done: boolean;
}
