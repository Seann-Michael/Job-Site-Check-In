/**
 * Data access layer.
 *
 * When Supabase is configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY) reads go
 * to the same tables the web client uses (jobs, review_requests, job_media);
 * otherwise — and on query errors — the app falls back to demo data, matching
 * the web app's behavior in client/lib/dataService.ts.
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

const JOB_STATUSES: JobStatus[] = [
  'draft',
  'active',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
];

function mapJob(row: Row): Job {
  const status = str(row, 'status') as JobStatus;
  return {
    id: str(row, 'id', String(row.id ?? '')),
    title: str(row, 'title', 'Untitled job'),
    client_name: str(row, 'client_name', str(row, 'customer_name', 'Unknown client')),
    address: str(row, 'address'),
    city: str(row, 'city'),
    status: JOB_STATUSES.includes(status) ? status : 'active',
    service_type: (str(row, 'service_type') || 'general') as ServiceType,
    start_date: str(row, 'start_date', str(row, 'created_at')),
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
  if (error || !data?.length) return DEMO_JOBS;
  return (data as Row[]).map(mapJob);
}

export async function fetchJob(id: string): Promise<Job | undefined> {
  const jobs = await fetchJobs();
  return jobs.find((job) => job.id === id);
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
  if (error || !data?.length) return DEMO_REVIEW_REQUESTS;
  return (data as Row[]).map((row) => ({
    id: str(row, 'id', String(row.id ?? '')),
    customer_name: str(row, 'customer_name', 'Customer'),
    contact: str(row, 'contact', str(row, 'phone', str(row, 'email'))),
    channel: str(row, 'channel') === 'email' ? 'email' : 'sms',
    status: (str(row, 'status') || 'sent') as ReviewRequest['status'],
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
  if (error || !data?.length) return DEMO_MEDIA;
  return (data as Row[]).map((row) => ({
    id: str(row, 'id', String(row.id ?? '')),
    job_id: str(row, 'job_id'),
    job_title: str(row, 'job_title'),
    media_type: str(row, 'media_type') === 'video' ? 'video' : 'image',
    category: (str(row, 'category') || 'progress') as MediaItem['category'],
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
