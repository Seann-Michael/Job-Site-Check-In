/**
 * Data access layer.
 *
 * When Supabase is configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY) reads go
 * to the same tables the web client uses (jobs, review_requests, job_media).
 * The jobs table is shaped like the web app's Project interface
 * (client/lib/dataService.ts): name, client_contact json, started_at, etc.
 *
 * Demo data is used only when Supabase isn't configured. A real query that
 * errors returns an empty result and records the reason in `dataErrors` —
 * never fabricated rows — and an empty result from a real workspace stays
 * empty.
 */

import { DEMO_JOBS, DEMO_MEDIA, DEMO_REVIEW_REQUESTS } from '@/lib/demo-data';
import { jobsStore } from '@/lib/jobs-store';
import { getMediaTagOverrides } from '@/lib/media-tags';
import { mediaStore } from '@/lib/media-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { uploadQueue } from '@/lib/upload-queue';
import { workspace } from '@/lib/workspace';
import type { Job, JobStatus, MediaItem, ReviewRequest, ServiceType } from '@/lib/types';

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

/**
 * Read-failure channel, so a screen can tell "nothing here yet" apart from
 * "the request failed".
 *
 * One slot per data domain, each written by exactly one fetch below:
 *   'jobs'     → fetchJobs()
 *   'job'      → fetchJob()
 *   'reviews'  → fetchReviewRequests()
 *   'media'    → fetchMedia()
 *   'jobMedia' → fetchJobMedia()
 *
 * Every connected read either fails (recording why) or succeeds (clearing its
 * slot), so a stale message never outlives a working refetch. Demo mode never
 * touches these slots. Reads keep their array/undefined return shape, so a
 * caller that ignores this still behaves — it just shows an empty list with no
 * reason attached.
 *
 * Screens read `dataErrors.get(domain)` and re-render from
 * `dataErrors.subscribe(...)`, the same idiom as jobsStore/jobMeta.
 */
export type DataDomain = 'jobs' | 'job' | 'reviews' | 'media' | 'jobMedia';

const readErrors: Record<DataDomain, string | null> = {
  jobs: null,
  job: null,
  reviews: null,
  media: null,
  jobMedia: null,
};
const errorListeners = new Set<() => void>();

function setReadError(domain: DataDomain, message: string | null): void {
  if (readErrors[domain] === message) return;
  readErrors[domain] = message;
  errorListeners.forEach((listener) => listener());
}

export const dataErrors = {
  /** Why the last read of `domain` failed, or null when it succeeded. */
  get(domain: DataDomain): string | null {
    return readErrors[domain];
  },

  /** Called whenever any domain's error appears or clears. Returns unsubscribe. */
  subscribe(listener: () => void): () => void {
    errorListeners.add(listener);
    return () => {
      errorListeners.delete(listener);
    };
  },
};

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
  const state = metaAddress ? str(metaAddress, 'state') : str(row, 'state');
  const zip = metaAddress
    ? str(metaAddress, 'zipCode') || str(metaAddress, 'zip')
    : str(row, 'zip');
  const coordinates =
    metaAddress && typeof metaAddress.coordinates === 'object' && metaAddress.coordinates !== null
      ? (metaAddress.coordinates as { lat?: number; lng?: number })
      : undefined;
  return {
    id: str(row, 'id', String(row.id ?? '')),
    title: str(row, 'name', str(row, 'title', 'Untitled job')),
    description: str(row, 'description') || undefined,
    client_name: str(contact, 'name', str(row, 'client_name', 'Unknown client')),
    client_phone: str(contact, 'phone') || undefined,
    client_email: str(contact, 'email') || undefined,
    address,
    city,
    state: state || undefined,
    zip: zip || undefined,
    status: oneOf(str(row, 'status'), JOB_STATUSES, 'active'),
    service_type: oneOf(
      str(row, 'service_type') || (metaAddress ? '' : str(metadata, 'service_type')),
      SERVICE_TYPES,
      'general',
    ),
    start_date: str(row, 'started_at', str(row, 'start_date', str(row, 'created_at'))),
    photo_count: num(row, 'photo_count'),
    review_requested: Boolean(row.review_requested),
    latitude: typeof coordinates?.lat === 'number' ? coordinates.lat : undefined,
    longitude: typeof coordinates?.lng === 'number' ? coordinates.lng : undefined,
    tags: Array.isArray(metadata.tags) ? (metadata.tags as string[]) : undefined,
  };
}

export async function fetchJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    const created = await jobsStore.getCreated();
    const createdIds = new Set(created.map((job) => job.id));
    // Local copies (created or edited demo jobs) win over the demo seeds.
    return [...created, ...DEMO_JOBS.filter((job) => !createdIds.has(job.id))];
  }
  // Scope to the active business, like the web workspaceService does.
  const business = await workspace.getCurrent();
  let query = supabase.from('jobs').select('*');
  if (business && !business.id.startsWith('demo')) {
    query = query.eq('business_id', business.id);
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
  if (error) {
    // A failed query is not an empty workspace — never stand in demo jobs here.
    setReadError('jobs', `Couldn't load jobs: ${error.message}`);
    return [];
  }
  setReadError('jobs', null);
  return ((data ?? []) as Row[]).map(mapJob);
}

export async function fetchJob(id: string): Promise<Job | undefined> {
  if (!isSupabaseConfigured) {
    const created = await jobsStore.getCreated();
    return [...created, ...DEMO_JOBS].find((job) => job.id === id);
  }
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) {
    setReadError('job', `Couldn't load that job: ${error.message}`);
    return undefined;
  }
  setReadError('job', null);
  return data ? mapJob(data as Row) : undefined;
}

/**
 * Move every one of a client's jobs onto their new name.
 *
 * Jobs reference their client by NAME STRING — `client_contact.name`, falling
 * back to the `client_name` column — and fetchClientJobs matches on it
 * case-insensitively. So renaming a client without this cascade silently
 * detaches all of their work: the client screen shows zero jobs, jobs_count
 * drops to 0, and in demo mode a duplicate client reappears under the old name
 * still holding everything.
 *
 * Returns how many jobs moved so the caller can tell the user.
 */
export async function renameClientAcrossJobs(
  oldName: string,
  newName: string,
): Promise<{ updated: number; error?: string }> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return { updated: 0 };

  const jobs = await fetchJobs();
  const matches = jobs.filter((job) => job.client_name.toLowerCase() === from.toLowerCase());
  if (!matches.length) return { updated: 0 };

  if (!isSupabaseConfigured) {
    // Seed jobs are immutable, but jobsStore.upsert shadows them and fetchJobs
    // prefers the local copy — so this works for seeded and created jobs alike.
    for (const job of matches) {
      await jobsStore.upsert({ ...job, client_name: to });
    }
    return { updated: matches.length };
  }

  const ids = matches.map((job) => job.id);
  // Read the existing blobs first: client_contact also carries email and phone,
  // and writing { name } alone would drop them.
  const { data, error: readError } = await supabase
    .from('jobs')
    .select('id, client_contact')
    .in('id', ids);
  if (readError) return { updated: 0, error: readError.message };

  const contactById = new Map<string, Row>(
    ((data ?? []) as Row[]).map((row) => [String(row.id), (row.client_contact ?? {}) as Row]),
  );

  let updated = 0;
  for (const id of ids) {
    const contact = contactById.get(id) ?? {};
    const { error } = await supabase
      .from('jobs')
      .update({ client_contact: { ...contact, name: to } })
      .eq('id', id);
    // Report the partial result rather than claiming a clean rename: some jobs
    // have already moved and the caller needs to know the split happened.
    if (error) return { updated, error: error.message };
    updated += 1;
  }

  jobsStore.notifyChanged();
  return { updated };
}

export interface JobPatch {
  title?: string;
  service_type?: ServiceType;
  client_name?: string;
  address?: string;
  city?: string;
  status?: JobStatus;
  tags?: string[];
}

/** Update a job — Supabase row when configured, local copy in demo. */
export async function updateJob(job: Job, patch: JobPatch): Promise<{ error?: string }> {
  const next: Job = { ...job, ...patch };

  if (!isSupabaseConfigured) {
    await jobsStore.upsert(next);
    return {};
  }

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.name = patch.title;
  if (patch.service_type !== undefined) update.type = patch.service_type;
  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === 'completed') update.completed_at = new Date().toISOString();
  }
  if (patch.client_name !== undefined) {
    // Merge, don't replace: client_contact also holds email and phone, and
    // writing { name } alone silently discarded both on every save.
    const { data: existing } = await supabase
      .from('jobs')
      .select('client_contact')
      .eq('id', job.id)
      .single();
    const contact = (existing?.client_contact ?? {}) as Row;
    update.client_contact = { ...contact, name: patch.client_name };
  }
  if (
    patch.address !== undefined ||
    patch.city !== undefined ||
    patch.tags !== undefined ||
    patch.service_type !== undefined
  ) {
    // metadata carries address/tags on the web side — rebuild it from the
    // merged job so we don't clobber unknown keys with partial data.
    update.metadata = {
      address: {
        street: next.address,
        city: next.city,
        coordinates:
          typeof next.latitude === 'number' && typeof next.longitude === 'number'
            ? { lat: next.latitude, lng: next.longitude }
            : undefined,
      },
      service_type: next.service_type,
      tags: next.tags ?? [],
      source: 'mobile',
    };
  }

  const { error } = await supabase.from('jobs').update(update).eq('id', job.id);
  if (error) return { error: error.message };
  jobsStore.notifyChanged();
  return {};
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
      // Same field the connected insert writes to the `description` column, so
      // the job detail screen's scope-of-work block works in demo mode too.
      // Left empty when there are no notes — the connected insert has to fall
      // back to the title because the web client rejects a blank description,
      // and the detail screen drops a scope block that only repeats the title.
      description: input.notes || undefined,
      client_name: input.client_name || 'Unknown client',
      address: input.street,
      city: input.city,
      status: 'active',
      service_type: input.service_type,
      start_date: startedAt,
      photo_count: 0,
      review_requested: false,
      latitude: input.latitude,
      longitude: input.longitude,
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


export async function fetchReviewRequests(): Promise<ReviewRequest[]> {
  if (!isSupabaseConfigured) {
    // Requests sent from this phone appear ahead of the demo seeds.
    const { getLocalReviewRequests } = await import('@/lib/review-requests');
    const local = await getLocalReviewRequests();
    return [...local, ...DEMO_REVIEW_REQUESTS];
  }
  const { data, error } = await supabase
    .from('review_requests')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) {
    setReadError('reviews', `Couldn't load review requests: ${error.message}`);
    return [];
  }
  setReadError('reviews', null);
  // Live columns are customer_phone / project_name (see web AdminReviews).
  return ((data ?? []) as Row[]).map((row) => ({
    id: str(row, 'id', String(row.id ?? '')),
    customer_name: str(row, 'customer_name', 'Customer'),
    contact: str(row, 'customer_phone', str(row, 'contact', str(row, 'email'))),
    channel: str(row, 'channel') === 'email' ? 'email' : 'sms',
    status: oneOf(str(row, 'status'), REVIEW_STATUSES, 'sent'),
    sent_at: str(row, 'sent_at', str(row, 'created_at')),
    job_title: str(row, 'project_name', str(row, 'job_title')),
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
    tags: Array.isArray(metadata.tags) ? (metadata.tags as string[]) : undefined,
  };
}

async function applyTagOverrides(items: MediaItem[]): Promise<MediaItem[]> {
  const overrides = await getMediaTagOverrides();
  return items.map((item) => (overrides[item.id] ? { ...item, tags: overrides[item.id] } : item));
}

/** Photos waiting in the offline upload queue, shown with a pending badge. */
async function pendingMedia(jobId?: string): Promise<MediaItem[]> {
  const queued = await uploadQueue.getAll();
  return queued
    .filter((item) => !jobId || item.job_id === jobId)
    .map((item) => ({
      id: item.id,
      job_id: item.job_id,
      job_title: item.job_title,
      media_type: 'image' as const,
      category: item.category,
      taken_at: item.taken_at,
      uri: item.uri,
      latitude: item.latitude,
      longitude: item.longitude,
      pending: true,
    }));
}

export async function fetchMedia(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) {
    // Demo mode: photos captured on this device, then the sample set.
    const captured = await mediaStore.getCaptured();
    return applyTagOverrides([...captured, ...DEMO_MEDIA]);
  }
  const pending = await pendingMedia();
  const { data, error } = await supabase
    .from('job_media')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    // Queued photos are this device's own uploads, so they still belong here.
    setReadError('media', `Couldn't load photos: ${error.message}`);
    return applyTagOverrides(pending);
  }
  setReadError('media', null);
  return applyTagOverrides([...pending, ...((data ?? []) as Row[]).map(mapMediaRow)]);
}

export async function fetchJobMedia(jobId: string): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) {
    const all = await fetchMedia();
    return all.filter((item) => item.job_id === jobId);
  }
  const pending = await pendingMedia(jobId);
  const { data, error } = await supabase
    .from('job_media')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) {
    setReadError('jobMedia', `Couldn't load photos for this job: ${error.message}`);
    return applyTagOverrides(pending);
  }
  setReadError('jobMedia', null);
  return applyTagOverrides([...pending, ...((data ?? []) as Row[]).map(mapMediaRow)]);
}

