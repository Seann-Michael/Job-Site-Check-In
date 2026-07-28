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
  /**
   * Local-SEO keywords for the job — the pending `jobs.keywords` text[] column.
   *
   * Until that migration lands the value round-trips through
   * `jobs.metadata.keywords` when connected and through lib/jobs-store.ts in
   * demo mode, so it is populated either way; see mapJob/updateJob/createJob in
   * lib/data.ts, which probe the real column once and fall back.
   */
  keywords?: string[];
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
  /**
   * On-device or Storage 384px thumbnail. Grids render this and keep `uri` for
   * the full-size viewer — a 200-photo job otherwise decodes 200 originals.
   *
   * Absent on videos, on every photo taken before the thumbnailing pipeline
   * shipped, and on web uploads. Its absence is normal, not an error: callers
   * fall back to `uri`.
   */
  thumb_uri?: string;
  latitude?: number;
  longitude?: number;
  /** Waiting in the offline upload queue. */
  pending?: boolean;
  tags?: string[];

  /*
   * Attribution. `captured_at` and `uploaded_at` are different events on
   * purpose: a photo shot on a roof with no signal sits in the queue for hours
   * before it reaches the server, so collapsing them makes every offline photo
   * claim it was taken the moment it finally synced. `taken_at` above stays the
   * single best-available display date every screen already reads.
   *
   * Each is undefined when nothing on the row states it — never guessed from a
   * neighbouring field. The columns behind them are a pending migration; the
   * capture pipeline mirrors the same values into `job_media.metadata`, and
   * mapMediaRow in lib/data.ts reads either, so these are populated before and
   * after the migration lands.
   */
  /** `job_media.uploaded_by` — an auth user id, never a display name. */
  uploaded_by?: string;
  /** When the shutter fired (`job_media.captured_at`). */
  captured_at?: string;
  /** When the row reached the server (`job_media.uploaded_at`). */
  uploaded_at?: string;
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
