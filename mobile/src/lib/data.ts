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
  DEMO_JOBS,
  DEMO_JOB_TASKS,
  DEMO_MEDIA,
  DEMO_REVIEW_REQUESTS,
} from '@/lib/demo-data';
import { jobsStore } from '@/lib/jobs-store';
import { mediaStore } from '@/lib/media-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';
import type {
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
  // Web jobs rows: name, client_contact {name,email,phone}, started_at/created_at,
  // and metadata.address as an object {street, city, state, zipCode, coordinates}
  // (see AdminAddProject.tsx in the web client).
  const contact = (row.client_contact ?? {}) as Row;
  const metadata = (row.metadata ?? {}) as Row;
  const metaAddress =
    typeof metadata.address === 'object' && metadata.address !== null
      ? (metadata.address as Row)
      : undefined;
  const address =
    str(row, 'address') ||
    (metaAddress ? str(metaAddress, 'street') : str(metadata, 'address'));
  const city = str(row, 'city') || (metaAddress ? str(metaAddress, 'city') : str(metadata, 'city'));
  return {
    id: str(row, 'id', String(row.id ?? '')),
    title: str(row, 'name', str(row, 'title', 'Untitled job')),
    client_name: str(contact, 'name', str(row, 'client_name', 'Unknown client')),
    address,
    city,
    status: oneOf(str(row, 'status'), JOB_STATUSES, 'active'),
    service_type: oneOf(
      str(row, 'service_type') || (metaAddress ? '' : str(metadata, 'service_type')),
      SERVICE_TYPES,
      'general',
    ),
    start_date: str(row, 'started_at', str(row, 'start_date', str(row, 'created_at'))),
    photo_count: num(row, 'photo_count'),
    review_requested: Boolean(row.review_requested),
  };
}

export async function fetchJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    const created = await jobsStore.getCreated();
    return [...created, ...DEMO_JOBS];
  }
  // Scope to the active business, like the web workspaceService does.
  const business = await workspace.getCurrent();
  let query = supabase.from('jobs').select('*');
  if (business && !business.id.startsWith('demo')) {
    query = query.eq('business_id', business.id);
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
  if (error) return DEMO_JOBS;
  return (data as Row[]).map(mapJob);
}

export async function fetchJob(id: string): Promise<Job | undefined> {
  if (!isSupabaseConfigured) {
    const created = await jobsStore.getCreated();
    return [...created, ...DEMO_JOBS].find((job) => job.id === id);
  }
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) return DEMO_JOBS.find((job) => job.id === id);
  return data ? mapJob(data as Row) : undefined;
}

export interface NewJobInput {
  title: string;
  service_type: ServiceType;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  street: string;
  city: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  street_view_available?: boolean;
  notes?: string;
}

export async function createJob(
  input: NewJobInput,
): Promise<{ job?: Job; error?: string }> {
  const startedAt = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const job: Job = {
      id: `local-job-${Date.now()}`,
      title: input.title,
      client_name: input.client_name || 'Unknown client',
      address: input.street,
      city: input.city,
      status: 'active',
      service_type: input.service_type,
      start_date: startedAt,
      photo_count: 0,
      review_requested: false,
    };
    await jobsStore.add(job);
    return { job };
  }

  // Same payload shape the web app's AdminAddProject sends to createProject.
  const business = await workspace.getCurrent();
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      ...(business && !business.id.startsWith('demo') ? { business_id: business.id } : {}),
      name: input.title,
      description: input.notes || input.title,
      type: input.service_type,
      status: 'active',
      priority: 'medium',
      client_contact: input.client_name
        ? { name: input.client_name, email: input.client_email ?? '', phone: input.client_phone ?? '' }
        : undefined,
      metadata: {
        address: {
          street: input.street,
          city: input.city,
          state: input.state ?? '',
          zipCode: input.zip ?? '',
          country: 'United States',
          coordinates:
            typeof input.latitude === 'number' && typeof input.longitude === 'number'
              ? { lat: input.latitude, lng: input.longitude }
              : undefined,
        },
        street_view_available: Boolean(input.street_view_available),
        service_type: input.service_type,
        notes: input.notes ?? '',
        source: 'mobile',
      },
      started_at: startedAt,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  const job = mapJob((data ?? {}) as Row);
  jobsStore.notifyChanged();
  return { job };
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

function mapMediaRow(row: Row): MediaItem {
  // GPS lives in the geolocation jsonb column (mobile writes) with the
  // metadata json as a fallback. job_media has no job_title column.
  const geolocation = (row.geolocation ?? {}) as Row;
  const metadata = (row.metadata ?? {}) as Row;
  const coord = (key: 'latitude' | 'longitude'): number | undefined => {
    if (typeof geolocation[key] === 'number') return geolocation[key] as number;
    if (typeof metadata[key] === 'number') return metadata[key] as number;
    return undefined;
  };
  return {
    id: str(row, 'id', String(row.id ?? '')),
    job_id: str(row, 'job_id'),
    job_title: '',
    media_type: str(row, 'media_type') === 'video' ? 'video' : 'image',
    // Web uploads default to 'general' and also use reference/walkthrough/
    // demonstration — anything outside our four buckets lands in 'progress'.
    category: oneOf(str(row, 'category'), MEDIA_CATEGORIES, 'progress'),
    taken_at: str(row, 'taken_at', str(row, 'created_at')),
    uri: str(row, 'file_path') || undefined,
    latitude: coord('latitude'),
    longitude: coord('longitude'),
  };
}

export async function fetchMedia(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) {
    // Demo mode: photos captured on this device, then the sample set.
    const captured = await mediaStore.getCaptured();
    return [...captured, ...DEMO_MEDIA];
  }
  const { data, error } = await supabase
    .from('job_media')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return DEMO_MEDIA;
  return (data as Row[]).map(mapMediaRow);
}

export async function fetchJobMedia(jobId: string): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) {
    const all = await fetchMedia();
    return all.filter((item) => item.job_id === jobId);
  }
  const { data, error } = await supabase
    .from('job_media')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error || !data) return [];
  return (data as Row[]).map(mapMediaRow);
}

