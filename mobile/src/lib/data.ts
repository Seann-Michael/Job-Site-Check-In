/**
 * Data access layer.
 *
 * When Supabase is configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY) reads go
 * to the same tables the web client uses (jobs, review_requests, job_media).
 * The jobs table is shaped like the web app's Project interface
 * (client/lib/dataService.ts): name, client_contact json, started_at, etc.
 *
 * Reads that can return another tenant's rows are scoped to the current
 * business (workspace.getCurrent), through the single `currentScope()` helper
 * below. The rule is the same everywhere and has no exception: when the current
 * business cannot be established, the read returns NOTHING and records why.
 * There is no unscoped fallback — jobs carry client names, phones, emails and
 * street addresses, review_requests carry customer names and phone numbers, and
 * job_media carries public file URLs and GPS. An empty list with a reason on it
 * is a small problem; another tenant's rows on this device is not.
 *
 * jobs and review_requests filter on their own business_id column. job_media
 * has no business column, so it is filtered through this workspace's job ids —
 * the same join the Activity and Feed screens do at render time, moved to the
 * server so the rows never reach the phone.
 *
 * Demo data is used only when Supabase isn't configured. A real query that
 * errors returns an empty result and records the reason in `dataErrors` —
 * never fabricated rows — and an empty result from a real workspace stays
 * empty.
 *
 * Columns that a pending migration will add (jobs.keywords,
 * job_media.uploaded_by / captured_at / uploaded_at) are never named in a
 * select: every read here is a select('*'), which returns whatever the table
 * actually has, so a database without them answers normally and the mappers
 * simply see undefined. Writes are the only place a missing column can fail,
 * so updateJob probes once and falls back — see `jobsKeywordsColumn`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_JOBS, DEMO_MEDIA, DEMO_REVIEW_REQUESTS } from '@/lib/demo-data';
import { jobsStore } from '@/lib/jobs-store';
import { getMediaTagOverrides } from '@/lib/media-tags';
import { mediaStore } from '@/lib/media-store';
import { shareLinks } from '@/lib/share-links';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { uploadQueue } from '@/lib/upload-queue';
import { workspace } from '@/lib/workspace';
import type { Job, JobStatus, MediaItem, ReviewRequest, ServiceType } from '@/lib/types';

type Row = Record<string, unknown>;

const strArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((entry): entry is string => typeof entry === 'string');
  return items.length ? items : undefined;
};

/**
 * Postgres's answer to "that column isn't there": 42703 (undefined_column)
 * straight from Postgres, PGRST204 from PostgREST's schema cache on a write.
 * Used to tell a genuinely missing column apart from a real failure, so a
 * write aimed at a not-yet-migrated column can retry without it.
 */
function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  column: string,
): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes(column) &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find'))
  );
}

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

/**
 * The tenant filter every connected read below goes through.
 *
 *   'business' — a real business is selected; its id is the filter.
 *   'sample'   — the demo placeholder workspace.getBusinesses() stands in when
 *                the businesses table comes back empty. It owns no id of its
 *                own, so reads stay exactly as broad as the jobs list has
 *                always been for it, and no broader (see workspace.ts).
 *   'unknown'  — workspace.getCurrent() returned null, which it does when the
 *                businesses query itself failed. That is a normal-operation
 *                path, not a theoretical one, and it is the dangerous one:
 *                dropping the filter here is what puts one tenant's rows in
 *                front of another. Callers must read nothing at all and record
 *                the reason through `dataErrors` so the screen shows its error
 *                state instead of a silently empty list.
 */
type Scope =
  | { kind: 'business'; businessId: string }
  | { kind: 'sample' }
  | { kind: 'unknown' };

async function currentScope(): Promise<Scope> {
  const business = await workspace.getCurrent();
  if (!business) return { kind: 'unknown' };
  // Demo ids are prefixed `demo` by workspace.ts; they match no business_id.
  if (business.id.startsWith('demo')) return { kind: 'sample' };
  return { kind: 'business', businessId: business.id };
}

/** What to tell the user when the scope could not be established at all. */
const NO_SCOPE_REASON = "Your business hasn't loaded yet";

/**
 * How many of the workspace's jobs can act as a scope for job_media.
 *
 * Deliberately larger than the 50 fetchJobs() lists — the ids are only used as
 * a filter, so a photo on a job that has scrolled off the jobs tab still shows
 * up — but bounded, because these ids travel in the request URL as
 * `job_id=in.(…)`: 150 uuids is about 5.5KB of query string, comfortably inside
 * the 8KB request line PostgREST's proxy accepts, where an unbounded list
 * eventually would not be.
 *
 * The residual gap, stated plainly: a photo attached to a job older than this
 * workspace's newest 150 is not listed by fetchMedia. It is not hidden — the
 * job's own screen still shows it, since fetchJobMedia checks that one job
 * directly rather than against this list.
 */
const JOB_SCOPE_LIMIT = 150;

/**
 * Ids of the jobs this workspace owns — the tenant filter for job_media, which
 * carries no business column of its own.
 *
 * `ids: null` means the scope could not be established and the caller must not
 * fall back to an unfiltered read: `queryError` says the scoping query failed,
 * its absence says there is no current business to scope by.
 */
async function workspaceJobIds(): Promise<{ ids: string[] | null; queryError?: string }> {
  const scope = await currentScope();
  if (scope.kind === 'unknown') return { ids: null };
  let query = supabase.from('jobs').select('id');
  if (scope.kind === 'business') query = query.eq('business_id', scope.businessId);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(JOB_SCOPE_LIMIT);
  // A failed scope query is not an empty workspace.
  if (error) return { ids: null, queryError: error.message };
  return { ids: ((data ?? []) as Row[]).map((row) => String(row.id)) };
}

/**
 * Is this job one of the current workspace's? Asked of the database rather than
 * of the (capped) job list, so a job older than JOB_SCOPE_LIMIT still opens.
 *
 * Three ways to say no, and the caller phrases each differently: `scopeUnknown`
 * (no current business), `queryError` (the check itself failed), or neither —
 * the job exists but isn't ours, or doesn't exist at all. Those last two are
 * deliberately indistinguishable to this client.
 */
async function jobInScope(
  jobId: string,
): Promise<{ ok: boolean; queryError?: string; scopeUnknown?: boolean }> {
  const scope = await currentScope();
  if (scope.kind === 'unknown') return { ok: false, scopeUnknown: true };
  if (scope.kind === 'sample') return { ok: true };
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('business_id', scope.businessId)
    .maybeSingle();
  if (error) return { ok: false, queryError: error.message };
  return { ok: Boolean(data) };
}

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
    // The jobs.keywords text[] column is still a pending migration, so the
    // metadata blob is where writes land today. Prefer the column once it
    // exists — select('*') simply omits it until then.
    keywords: strArray(row.keywords) ?? strArray(metadata.keywords),
  };
}

export async function fetchJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    const [created, deletedIds] = await Promise.all([
      jobsStore.getCreated(),
      jobsStore.getDeletedIds(),
    ]);
    const createdIds = new Set(created.map((job) => job.id));
    // Local copies (created or edited demo jobs) win over the demo seeds, and
    // a deleted job stays deleted even though the seeds are a static array.
    return [
      ...created.filter((job) => !deletedIds.has(job.id)),
      ...DEMO_JOBS.filter((job) => !createdIds.has(job.id) && !deletedIds.has(job.id)),
    ];
  }
  // Scope to the active business, like the web workspaceService does. Every row
  // here carries a client's name, phone, email and street address, so an
  // unscoped read is a privacy breach, not a wider list — and it spreads:
  // several screens (Activity, Feed) and lib/team-presence.ts use this list AS
  // their tenant filter, so an unscoped one turns those filters into no-ops
  // too. When the scope is unknown the answer is nothing, with the reason.
  const scope = await currentScope();
  if (scope.kind === 'unknown') {
    setReadError('jobs', `${NO_SCOPE_REASON}, so jobs can't be shown yet.`);
    return [];
  }
  let query = supabase.from('jobs').select('*');
  if (scope.kind === 'business') {
    query = query.eq('business_id', scope.businessId);
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
    const [created, deletedIds] = await Promise.all([
      jobsStore.getCreated(),
      jobsStore.getDeletedIds(),
    ]);
    if (deletedIds.has(id)) return undefined;
    return [...created, ...DEMO_JOBS].find((job) => job.id === id);
  }
  // Scoped like the list it came from: a job id arrives here from a route
  // param, so "fetch by id" is not on its own a guarantee that the row is ours.
  const scope = await currentScope();
  if (scope.kind === 'unknown') {
    setReadError('job', `${NO_SCOPE_REASON}, so this job can't be shown yet.`);
    return undefined;
  }
  let query = supabase.from('jobs').select('*').eq('id', id);
  if (scope.kind === 'business') {
    query = query.eq('business_id', scope.businessId);
  }
  const { data, error } = await query.maybeSingle();
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
  /** Free-text scope of work — the jobs.description column. */
  description?: string;
  /**
   * Local-SEO keywords for the job. Targets the pending jobs.keywords text[]
   * column; see updateJob for how it is stored until that column exists.
   */
  keywords?: string[];
}

/**
 * Has the jobs.keywords column turned up yet?
 *   null  — no write has told us either way
 *   false — a write came back "no such column"; stop asking for this session
 *   true  — a write with keywords succeeded
 *
 * Only writes probe it. Reads use select('*'), which never errors on a column
 * that isn't there, so there is nothing to feature-detect on the read side.
 */
let jobsKeywordsColumn: boolean | null = null;

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
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === 'completed') update.completed_at = new Date().toISOString();
  }

  // metadata carries address/tags/keywords on the web side, and client_contact
  // carries email and phone alongside the name — both have to be read before
  // they are written or a partial save silently drops the rest.
  const rebuildsMetadata =
    patch.address !== undefined ||
    patch.city !== undefined ||
    patch.tags !== undefined ||
    patch.keywords !== undefined ||
    patch.service_type !== undefined;

  if (patch.client_name !== undefined || rebuildsMetadata) {
    const { data: existing } = await supabase
      .from('jobs')
      .select('client_contact, metadata')
      .eq('id', job.id)
      .single();
    const contact = (existing?.client_contact ?? {}) as Row;
    const metadata = (existing?.metadata ?? {}) as Row;
    if (patch.client_name !== undefined) {
      update.client_contact = { ...contact, name: patch.client_name };
    }
    if (rebuildsMetadata) {
      const existingAddress: Row =
        typeof metadata.address === 'object' && metadata.address !== null
          ? (metadata.address as Row)
          : {};
      update.metadata = {
        // Spread first: state, zipCode, notes and street_view_available are
        // written by createJob and by the web app, and are not ours to drop.
        ...metadata,
        address: {
          ...existingAddress,
          street: next.address,
          city: next.city,
          coordinates:
            typeof next.latitude === 'number' && typeof next.longitude === 'number'
              ? { lat: next.latitude, lng: next.longitude }
              : existingAddress.coordinates,
        },
        service_type: next.service_type,
        tags: next.tags ?? [],
        // Keywords live here whether or not the column exists, so the column
        // write below is an upgrade rather than the only copy.
        ...(next.keywords !== undefined ? { keywords: next.keywords } : {}),
        // Don't relabel a job the web app created just because we edited it.
        source: str(metadata, 'source') || 'mobile',
      };
    }
  }

  // Try the real column when it might be there; fall back to metadata alone.
  const triesKeywordsColumn = patch.keywords !== undefined && jobsKeywordsColumn !== false;
  if (triesKeywordsColumn) update.keywords = patch.keywords;

  let { error } = await supabase.from('jobs').update(update).eq('id', job.id);
  if (error && triesKeywordsColumn && isMissingColumnError(error, 'keywords')) {
    // Pre-migration database: keywords is already in metadata, so retrying
    // without it loses nothing and the save still succeeds.
    jobsKeywordsColumn = false;
    delete update.keywords;
    ({ error } = await supabase.from('jobs').update(update).eq('id', job.id));
  } else if (!error && triesKeywordsColumn) {
    jobsKeywordsColumn = true;
  }

  if (error) return { error: error.message };
  jobsStore.notifyChanged();
  return {};
}

/**
 * Delete a job, the way the web app does (dataService.deleteProject:
 * `supabase.from('jobs').delete().eq('id', id)`), plus the on-device cleanup
 * the web app has no equivalent of.
 *
 * Child rows (job_media, job_notes, …) are left to the database's foreign
 * keys, exactly as on the web — if a constraint refuses the delete, that error
 * is returned rather than swallowed.
 */
export async function deleteJob(job: Job): Promise<{ error?: string }> {
  // Collected before the row goes, while the media ids are still reachable.
  const mediaIds = await jobMediaIds(job.id);

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('jobs').delete().eq('id', job.id);
    if (error) return { error: error.message };
  }

  await purgeJobLocalData(job.id, mediaIds);
  // Last, and it emits: subscribers re-read a store with nothing left behind.
  await jobsStore.remove(job.id);
  return {};
}

/** Every media id attached to a job that this device can see. */
async function jobMediaIds(jobId: string): Promise<string[]> {
  const ids = new Set<string>();
  const [captured, queued] = await Promise.all([mediaStore.getCaptured(), uploadQueue.getAll()]);
  for (const item of captured) if (item.job_id === jobId) ids.add(item.id);
  for (const item of queued) if (item.job_id === jobId) ids.add(item.id);
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('job_media').select('id').eq('job_id', jobId);
      for (const row of (data ?? []) as Row[]) ids.add(String(row.id));
    } catch {
      // Best effort: an override for a row we couldn't list just lingers.
    }
  }
  return [...ids];
}

/** AsyncStorage maps keyed by job id, and the module that owns each one. */
const JOB_KEYED_MAPS = [
  'lsr-job-meta-v1', // job-meta.ts — starred/archived/group/value/assignees
  'lsr-job-extras-v1', // job-extras.ts — check-ins, notes, documents, voice notes
  'lsr-job-tasks-v1', // tasks-store.ts — checklist
];

/** AsyncStorage maps keyed by media id. */
const MEDIA_KEYED_MAPS = [
  'lsr-media-tags-v1', // media-tags.ts
  'lsr-media-comments-v1', // media-comments.ts
];

async function dropMapKeys(storageKey: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, unknown>;
    let changed = false;
    for (const key of keys) {
      if (key in map) {
        delete map[key];
        changed = true;
      }
    }
    if (changed) await AsyncStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Cleanup is best-effort; the job is gone either way.
  }
}

async function dropListEntries(storageKey: string, matches: (row: Row) => boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return;
    const list = JSON.parse(raw) as Row[];
    if (!Array.isArray(list)) return;
    const kept = list.filter((row) => !matches(row));
    if (kept.length !== list.length) await AsyncStorage.setItem(storageKey, JSON.stringify(kept));
  } catch {
    // Best-effort.
  }
}

/**
 * Erase everything this device stored about a job.
 *
 * Modules that expose a removal call get to run it, so their in-memory copy
 * (and any server-side record) goes too. The rest are plain AsyncStorage maps
 * whose owners have no removal API, so their entries are dropped from storage
 * directly — correct on disk immediately and after a relaunch. A module that
 * already had its map cached in memory this session can rewrite that stale
 * entry on its next save; see notDone for the removeJob() hooks that would
 * close that window.
 */
async function purgeJobLocalData(jobId: string, mediaIds: string[]): Promise<void> {
  // Queued uploads first: left alone they would retry forever against a job
  // that no longer exists.
  const queued = await uploadQueue.getAll();
  for (const item of queued.filter((upload) => upload.job_id === jobId)) {
    await uploadQueue.remove(item.id);
  }
  // Public galleries pointing at the deleted job — also removes the server row.
  for (const link of await shareLinks.forJob(jobId)) {
    await shareLinks.remove(link.token);
  }
  await Promise.all([
    ...JOB_KEYED_MAPS.map((key) => dropMapKeys(key, [jobId])),
    ...MEDIA_KEYED_MAPS.map((key) => dropMapKeys(key, mediaIds)),
    // publish.ts — the "Published" record on the job screen.
    dropListEntries('lsr-published-jobs-v1', (row) => row.job_id === jobId),
    // media-store.ts — photos captured on this device in demo mode.
    dropListEntries('lsr-captured-media-v1', (row) => row.job_id === jobId),
  ]);
  mediaStore.notifyChanged();
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
  /**
   * Scope of work — the jobs.description column, shown on the job screen.
   * A separate fact from `notes`: this is what the job is, not a reminder
   * about it. When absent the notes stand in, which is what the single-field
   * version of the form used to send.
   */
  description?: string;
  /** Internal reminders. Stored in metadata.notes on the connected side. */
  notes?: string;
  /**
   * Local-SEO keywords. Targets the pending jobs.keywords text[] column and
   * falls back to metadata.keywords exactly as updateJob does.
   */
  keywords?: string[];
}

export async function createJob(
  input: NewJobInput,
): Promise<{ job?: Job; error?: string }> {
  const startedAt = new Date().toISOString();

  if (!isSupabaseConfigured) {
    // Every field the form collects has to land on the record. This branch used
    // to hand-build a Job from a handful of them, so a demo job came back with
    // no phone, no email, no state and no ZIP — the client card was blank and
    // the address printed short, even though the user had typed all four.
    const job: Job = {
      id: `local-job-${Date.now()}`,
      title: input.title,
      // Same field the connected insert writes to the `description` column, so
      // the job detail screen's scope-of-work block works in demo mode too.
      // Left empty when neither was entered — the connected insert has to fall
      // back to the title because the web client rejects a blank description,
      // and the detail screen drops a scope block that only repeats the title.
      description: input.description || input.notes || undefined,
      client_name: input.client_name || 'Unknown client',
      client_phone: input.client_phone || undefined,
      client_email: input.client_email || undefined,
      address: input.street,
      city: input.city,
      state: input.state || undefined,
      zip: input.zip || undefined,
      status: 'active',
      service_type: input.service_type,
      start_date: startedAt,
      photo_count: 0,
      review_requested: false,
      latitude: input.latitude,
      longitude: input.longitude,
      keywords: input.keywords?.length ? input.keywords : undefined,
    };
    await jobsStore.add(job);
    return { job };
  }

  // Same payload shape the web app's AdminAddProject sends to createProject.
  const business = await workspace.getCurrent();
  const payload: Record<string, unknown> = {
    ...(business && !business.id.startsWith('demo') ? { business_id: business.id } : {}),
    name: input.title,
    // The web client rejects a blank description, so the title stands in when
    // neither a scope nor notes were entered.
    description: input.description || input.notes || input.title,
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
      // Keywords land here whether or not the column exists — the column write
      // below is an upgrade, never the only copy. mapJob prefers the column and
      // falls back to this, so the job reads back the same either way.
      ...(input.keywords?.length ? { keywords: input.keywords } : {}),
      source: 'mobile',
    },
    started_at: startedAt,
  };

  // Same probe-and-retry updateJob uses: try the real column while it might be
  // there, drop it for the rest of the session once Postgres says it isn't.
  const triesKeywordsColumn = Boolean(input.keywords?.length) && jobsKeywordsColumn !== false;
  if (triesKeywordsColumn) payload.keywords = input.keywords;

  let { data, error } = await supabase.from('jobs').insert(payload).select().single();
  if (error && triesKeywordsColumn && isMissingColumnError(error, 'keywords')) {
    jobsKeywordsColumn = false;
    delete payload.keywords;
    ({ data, error } = await supabase.from('jobs').insert(payload).select().single());
  } else if (!error && triesKeywordsColumn) {
    jobsKeywordsColumn = true;
  }

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
  // Every row here carries a customer's NAME and PHONE NUMBER, so this read is
  // scoped to the active business and never silently falls back to an unscoped
  // one. An unfiltered select returns other tenants' customers — their PII
  // rendered inside this user's Reviews tab. When the scope cannot be
  // established, the honest answer is nothing at all with the reason attached:
  // an empty list is a small problem, someone else's customer list is not.
  const scope = await currentScope();
  if (scope.kind === 'unknown') {
    setReadError('reviews', `${NO_SCOPE_REASON}, so review requests can't be shown yet.`);
    return [];
  }
  if (scope.kind === 'sample') {
    // The sample workspace stands in whenever the businesses table comes back
    // empty (see workspace.getBusinesses). It owns no real rows, and
    // review-requests.ts refuses to file against it for the same reason.
    setReadError(
      'reviews',
      "You're in the sample workspace, so there are no review requests to show.",
    );
    return [];
  }
  const { data, error } = await supabase
    .from('review_requests')
    .select('*')
    .eq('business_id', scope.businessId)
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) {
    // Includes the pre-migration case where business_id isn't on the table at
    // all: there is then no way to tell this business's customers from anyone
    // else's, so retrying without the filter would be the leak itself. The
    // rows still exist — the web dashboard can show them — this client can't.
    setReadError(
      'reviews',
      isMissingColumnError(error, 'business_id')
        ? "This database doesn't link review requests to a business yet, so they can't be shown here safely. They're still on the web dashboard."
        : `Couldn't load review requests: ${error.message}`,
    );
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
  // Read defensively instead of naming the new columns in the select: this is
  // a select('*'), which returns whatever the table actually has, so a
  // pre-migration database yields undefined here instead of erroring the whole
  // query the way `select('uploaded_by, …')` would.
  //
  // Capture time is recoverable today: media-capture.ts already writes
  // metadata.captured_at on every upload, so offline photos keep their real
  // date before the column exists.
  const capturedAt = str(row, 'captured_at') || str(metadata, 'captured_at') || str(row, 'taken_at');
  const uploadedAt = str(row, 'uploaded_at') || str(row, 'created_at');
  const uploadedBy = str(row, 'uploaded_by') || str(metadata, 'uploaded_by');
  return {
    id: str(row, 'id', String(row.id ?? '')),
    job_id: str(row, 'job_id'),
    job_title: '',
    media_type: str(row, 'media_type') === 'video' ? 'video' : 'image',
    // Web uploads default to 'general' and also use reference/walkthrough/
    // demonstration — anything outside our four buckets lands in 'progress'.
    category: oneOf(str(row, 'category'), MEDIA_CATEGORIES, 'progress'),
    // Best available date for the existing screens: the capture time when the
    // row states one, otherwise the upload time — which is all we know.
    taken_at: capturedAt || uploadedAt,
    captured_at: capturedAt || undefined,
    uploaded_at: uploadedAt || undefined,
    uploaded_by: uploadedBy || undefined,
    uri: str(row, 'file_path') || undefined,
    // The capture pipeline uploads a 384px copy beside the original and records
    // its public URL here (media-capture.ts insertMediaRow). Rows from the web
    // client and from before that pipeline have none, and the grid falls back
    // to the full-size file.
    thumb_uri: str(metadata, 'thumbnail_path') || undefined,
    latitude: coord('latitude'),
    longitude: coord('longitude'),
    tags: Array.isArray(metadata.tags) ? (metadata.tags as string[]) : undefined,
  };
}

async function applyTagOverrides<T extends MediaItem>(items: T[]): Promise<T[]> {
  const overrides = await getMediaTagOverrides();
  return items.map((item) => (overrides[item.id] ? { ...item, tags: overrides[item.id] } : item));
}

/**
 * On-device photos: their taken_at is a real capture timestamp, and nothing
 * has been uploaded, so uploaded_at/uploaded_by stay undefined.
 */
function asCaptured(items: MediaItem[]): MediaItem[] {
  return items.map((item) => ({ ...item, captured_at: item.taken_at }));
}

/** Photos waiting in the offline upload queue, shown with a pending badge. */
async function pendingMedia(jobId?: string): Promise<MediaItem[]> {
  const [queued, deletedIds] = await Promise.all([
    uploadQueue.getAll(),
    jobsStore.getDeletedIds(),
  ]);
  return queued
    .filter((item) => !deletedIds.has(item.job_id))
    .filter((item) => !jobId || item.job_id === jobId)
    .map((item) => ({
      id: item.id,
      job_id: item.job_id,
      job_title: item.job_title,
      media_type: 'image' as const,
      category: item.category,
      taken_at: item.taken_at,
      // Queued means captured but not yet uploaded — that is the whole point
      // of keeping the two dates apart.
      captured_at: item.taken_at,
      uri: item.uri,
      // The queue keeps a durable on-device thumbnail; without this the grid
      // decodes the full-size original for every photo still waiting to sync.
      thumb_uri: item.thumb_uri,
      latitude: item.latitude,
      longitude: item.longitude,
      pending: true,
      // Frozen at enqueue so the crew member who shot it is credited, not the
      // session that eventually syncs it. `uploaded_at` stays undefined: it has
      // not reached the server yet.
      uploaded_by: item.uploaded_by,
    }));
}

export async function fetchMedia(): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) {
    // Demo mode: photos captured on this device, then the sample set —
    // minus anything belonging to a job that was deleted.
    const [captured, deletedIds] = await Promise.all([
      mediaStore.getCaptured(),
      jobsStore.getDeletedIds(),
    ]);
    const visible = [...captured, ...DEMO_MEDIA].filter((item) => !deletedIds.has(item.job_id));
    return applyTagOverrides(asCaptured(visible));
  }
  const pending = await pendingMedia();
  // job_media has no business column, so this workspace's job ids are the
  // filter. Doing it on the server is the point: a row that never leaves the
  // database cannot leak, whereas the render-time join the Feed and Activity
  // screens do still lets another tenant's file URLs and GPS reach the device.
  const { ids, queryError } = await workspaceJobIds();
  if (!ids) {
    // Queued photos are this device's own uploads, so they still belong here.
    setReadError(
      'media',
      queryError
        ? `Couldn't work out which photos are yours: ${queryError}`
        : `${NO_SCOPE_REASON}, so photos can't be shown yet.`,
    );
    return applyTagOverrides(pending);
  }
  if (!ids.length) {
    // A workspace with no jobs owns no photos — an answer, not a failure.
    setReadError('media', null);
    return applyTagOverrides(pending);
  }
  const { data, error } = await supabase
    .from('job_media')
    .select('*')
    .in('job_id', ids)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
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
  // The job id is a route param, so ownership is checked before its photos are
  // read — same rule as fetchJob, asked of one job rather than the capped list.
  const { ok, queryError, scopeUnknown } = await jobInScope(jobId);
  if (!ok) {
    setReadError(
      'jobMedia',
      queryError
        ? `Couldn't load photos for this job: ${queryError}`
        : scopeUnknown
          ? `${NO_SCOPE_REASON}, so this job's photos can't be shown yet.`
          : "This job isn't part of your workspace, so its photos aren't shown.",
    );
    return applyTagOverrides(pending);
  }
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

