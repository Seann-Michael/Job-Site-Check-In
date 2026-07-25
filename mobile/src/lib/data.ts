/**
 * Data access layer.
 *
 * When Supabase is configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY) reads go
 * to the same tables the web client uses (jobs, review_requests, job_media).
 * The jobs table is shaped like the web app's Project interface
 * (client/lib/dataService.ts): name, client_contact json, started_at, etc.
 *
 * Demo data is used when Supabase isn't configured or a query errors; an
 * empty result from a real workspace stays empty.
 */

import {
  DEMO_GMB_AUDIT,
  DEMO_GMB_PROFILE,
  DEMO_JOBS,
  DEMO_JOB_TASKS,
  DEMO_MEDIA,
  DEMO_REVIEW_REQUESTS,
} from '@/lib/demo-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  GmbAuditItem,
  GmbProfile,
  Job,
  JobStatus,
  JobTask,
  MediaItem,
  ReviewRequest,
  ServiceType,
} from '@/lib/types';

type Row = Record<string, unknown>;

const str = (row: Row, key: string, fallback = ''): string =>
  typeof row[key] === 'string' ? (row[key] as string) : fallback;

const num = (row: Row, key: string, fallback = 0): number =>
  typeof row[key] === 'number' ? (row[key] as number) : fallback;

const oneOf = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const JOB_STATUSES: JobStatus[] = [
  'draft',
  'active',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
];

const SERVICE_TYPES: ServiceType[] = [
  'gutters',
  'drainage',
  'plumbing',
  'roofing',
  'landscaping',
  'painting',
  'snow_removal',
  'general',
];

const MEDIA_CATEGORIES: MediaItem['category'][] = ['before', 'after', 'progress', 'final'];

const REVIEW_STATUSES: ReviewRequest['status'][] = [
  'sent',
  'viewed',
  'completed',
  'expired',
  'scheduled',
];

function mapJob(row: Row): Job {
  // Web jobs rows: name, client_contact {name,email,phone}, started_at/created_at.
  const contact = (row.client_contact ?? {}) as Row;
  const metadata = (row.metadata ?? {}) as Row;
  return {
    id: str(row, 'id', String(row.id ?? '')),
    title: str(row, 'name', str(row, 'title', 'Untitled job')),
    client_name: str(contact, 'name', str(row, 'client_name', 'Unknown client')),
    address: str(row, 'address', str(metadata, 'address')),
    city: str(row, 'city', str(metadata, 'city')),
    status: oneOf(str(row, 'status'), JOB_STATUSES, 'active'),
    service_type: oneOf(str(row, 'service_type'), SERVICE_TYPES, 'general'),
    start_date: str(row, 'started_at', str(row, 'start_date', str(row, 'created_at'))),
    photo_count: num(row, 'photo_count'),
    review_requested: Boolean(row.review_requested),
  };
}

export async function fetchJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) return DEMO_JOBS;
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return DEMO_JOBS;
  return (data as Row[]).map(mapJob);
}

export async function fetchJob(id: string): Promise<Job | undefined> {
  if (!isSupabaseConfigured) return DEMO_JOBS.find((job) => job.id === id);
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) return DEMO_JOBS.find((job) => job.id === id);
  return data ? mapJob(data as Row) : undefined;
}

export async function fetchJobTasks(_jobId: string): Promise<JobTask[]> {
  // Task checklists ship with a later milestone; demo data for now.
  return DEMO_JOB_TASKS;
}

export async function fetchReviewRequests(): Promise<ReviewRequest[]> {
  if (!isSupabaseConfigured) return DEMO_REVIEW_REQUESTS;
  const { data, error } = await supabase
    .from('review_requests')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) return DEMO_REVIEW_REQUESTS;
  return (data as Row[]).map((row) => ({
    id: str(row, 'id', String(row.id ?? '')),
    customer_name: str(row, 'customer_name', 'Customer'),
    contact: str(row, 'contact', str(row, 'phone', str(row, 'email'))),
    channel: str(row, 'channel') === 'email' ? 'email' : 'sms',
    status: oneOf(str(row, 'status'), REVIEW_STATUSES, 'sent'),
    sent_at: str(row, 'sent_at', str(row, 'created_at')),
    job_title: str(row, 'job_title'),
    rating: typeof row.rating === 'number' ? (row.rating as number) : undefined,
  }));
}

export async function fetchMedia(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) return DEMO_MEDIA;
  const { data, error } = await supabase
    .from('job_media')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return DEMO_MEDIA;
  return (data as Row[]).map((row) => ({
    id: str(row, 'id', String(row.id ?? '')),
    job_id: str(row, 'job_id'),
    job_title: str(row, 'job_title'),
    media_type: str(row, 'media_type') === 'video' ? 'video' : 'image',
    // Web uploads default to 'general' and also use reference/walkthrough/
    // demonstration — anything outside our four buckets lands in 'progress'.
    category: oneOf(str(row, 'category'), MEDIA_CATEGORIES, 'progress'),
    taken_at: str(row, 'taken_at', str(row, 'created_at')),
  }));
}

export async function fetchGmbProfile(): Promise<GmbProfile> {
  // GMB audit results come from the web app's audit pipeline; wired in a later milestone.
  return DEMO_GMB_PROFILE;
}

export async function fetchGmbAudit(): Promise<GmbAuditItem[]> {
  return DEMO_GMB_AUDIT;
}
