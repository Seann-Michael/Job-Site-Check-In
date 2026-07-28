/**
 * Per-job workflow metadata, CompanyCam-style: starred, archived, project
 * group, job value (sales), and assigned teammates. On-device for now;
 * server sync lands with the Supabase connection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';

const STORAGE_KEY = 'lsr-job-meta-v1';

/**
 * Jobs this business has been confirmed to own, keyed `businessId::jobId`.
 *
 * Only positives are remembered. A "no" can be a business list that hasn't
 * loaded yet or a check that failed, and caching that would keep a job the user
 * really does own dark for the rest of the session; re-asking costs one
 * single-column query. Keying on the business means switching workspaces does
 * not inherit the previous one's answers.
 */
const confirmedJobs = new Set<string>();

/**
 * Does this job belong to the business the user is currently in?
 *
 * The tenant guard for every per-job store — job-extras, tasks-store,
 * media-comments and this file all ask it before they read anything keyed by a
 * job id. It lives here because all four need exactly the same answer and this
 * module is the cheapest of them to import (AsyncStorage and supabase, nothing
 * native); lib/data.ts holds the same check as its module-private `jobInScope`,
 * and the rule is deliberately identical, sample workspace included.
 *
 * Why it exists: a job id reaches these stores from a route param, and a deep
 * link can carry any uuid at all. "Read the rows for this job id" is therefore
 * not on its own a read of our own data — without this check, opening a link to
 * another tenant's job pulls their check-ins (crew names and GPS), notes,
 * documents and checklist onto this device.
 *
 * It fails closed in every direction: an unconfigured Supabase, a business that
 * could not be established, a check that errored, a job that is not ours and a
 * job with no server row all answer false. Callers must then read nothing and
 * leave their device-local state exactly as they found it.
 */
export async function jobInWorkspace(jobId: string): Promise<boolean> {
  // No server, nothing to authorise: demo mode never reaches a server read.
  if (!isSupabaseConfigured || !jobId) return false;
  const business = await workspace.getCurrent().catch(() => null);
  // null means the businesses query itself failed, so the current business is
  // unknown — which is exactly when an unchecked read hands over someone else's
  // job. Unknown scope reads nothing.
  if (!business) return false;
  // The sample workspace stands in when the businesses table comes back empty
  // (see workspace.getBusinesses). It owns no business_id of its own, so reads
  // stay exactly as broad as the jobs list already is for it, and no broader.
  if (business.id.startsWith('demo')) return true;
  const key = `${business.id}::${jobId}`;
  if (confirmedJobs.has(key)) return true;
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('business_id', business.id)
      .maybeSingle();
    // A failed check is not a permission. Device-local ids (`local-job-*`,
    // `demo-*`) land here too: they are not uuids, so the comparison errors and
    // the job is treated as having nothing on the server — which it hasn't.
    if (error || !data) return false;
    confirmedJobs.add(key);
    return true;
  } catch {
    return false;
  }
}

export interface JobMeta {
  starred?: boolean;
  archived?: boolean;
  group?: string;
  /** Job value in dollars (the Sales number). */
  value?: number;
  assignees?: string[];
}

type MetaMap = Record<string, JobMeta>;

/**
 * Keys from removed features. `featured` fed the Portfolio showcase, which no
 * longer exists — devices that set it are carrying a value nothing can reach,
 * so strip it from anything we load and from anything we write back.
 */
const LEGACY_KEYS = ['featured'];

function hasLegacy(meta: JobMeta): boolean {
  return LEGACY_KEYS.some((key) => key in (meta as Record<string, unknown>));
}

function stripLegacy(meta: JobMeta): JobMeta {
  if (!hasLegacy(meta)) return meta;
  const next: JobMeta = { ...meta };
  for (const key of LEGACY_KEYS) delete (next as Record<string, unknown>)[key];
  return next;
}

let cache: MetaMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<MetaMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as MetaMap) : {};
    const entries = Object.entries(stored);
    const stale = entries.some(([, meta]) => meta && hasLegacy(meta));
    cache = stale
      ? Object.fromEntries(entries.map(([jobId, meta]) => [jobId, stripLegacy(meta ?? {})]))
      : stored;
    // Rewrite once so the dead key doesn't sit on the device forever.
    if (stale) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
  } catch {
    cache = {};
  }
  return cache;
}

function pushMeta(jobId: string, meta: JobMeta): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      // The row is keyed by job_id alone, so an upsert aimed at a job we do not
      // own does not sit beside that tenant's meta — it replaces it. Same guard
      // as the read below, for the opposite direction.
      if (!(await jobInWorkspace(jobId))) return;
      // Read-merge-write: a device that never saw fields another device set
      // (group, assignees, …) must not wipe them with its partial copy.
      let merged = meta;
      const { data } = await supabase
        .from('job_field_state')
        .select('meta')
        .eq('job_id', jobId)
        .single();
      if (data?.meta && typeof data.meta === 'object') {
        merged = stripLegacy({ ...(data.meta as JobMeta), ...meta });
      }
      await supabase
        .from('job_field_state')
        .upsert({ job_id: jobId, meta: merged, updated_at: new Date().toISOString() });
    } catch {
      // Best-effort.
    }
  })();
}

const hydratedJobs = new Set<string>();

/** First time a device sees a job: pull synced meta from the server. */
async function hydrateMeta(jobId: string): Promise<void> {
  if (!isSupabaseConfigured || !jobId || hydratedJobs.has(jobId)) return;
  const map = await load();
  if (map[jobId]) {
    hydratedJobs.add(jobId);
    return; // Local state wins; write-through keeps server fresh.
  }
  // The job id came off a route param, so ownership is checked before any of
  // this job's stored state is pulled onto the device. Deliberately not marked
  // hydrated: a "no" can be a business list that hasn't loaded yet, and a later
  // get() should be free to try again once the workspace is known.
  if (!(await jobInWorkspace(jobId))) return;
  try {
    const { data, error } = await supabase
      .from('job_field_state')
      .select('meta')
      .eq('job_id', jobId)
      .single();
    // "No row" is a definitive answer; a network failure is not — leave the
    // job un-hydrated so a later attempt can retry.
    if (!error || error.code === 'PGRST116') hydratedJobs.add(jobId);
    if (data?.meta && typeof data.meta === 'object') {
      // Re-check: the user may have edited meta while the fetch was in
      // flight — never let stale server state clobber a fresh local edit.
      const current = await load();
      if (current[jobId]) return;
      cache = { ...current, [jobId]: stripLegacy(data.meta as JobMeta) };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
      emit();
    }
  } catch {
    // Offline — retry on a later get().
  }
}

export const jobMeta = {
  async get(jobId: string): Promise<JobMeta> {
    const map = await load();
    void hydrateMeta(jobId);
    return map[jobId] ?? {};
  },

  async getAll(): Promise<MetaMap> {
    return load();
  },

  /** Synchronous read from cache (empty before first load). */
  getSync(jobId: string): JobMeta {
    return cache?.[jobId] ?? {};
  },

  async set(jobId: string, patch: Partial<JobMeta>): Promise<JobMeta> {
    const map = await load();
    const next = { ...(map[jobId] ?? {}), ...patch };
    cache = { ...map, [jobId]: next };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
    emit();
    pushMeta(jobId, next);
    return next;
  },

  async toggle(jobId: string, key: 'starred' | 'archived'): Promise<boolean> {
    const current = await jobMeta.get(jobId);
    const value = !current[key];
    await jobMeta.set(jobId, { [key]: value });
    return value;
  },

  /** All group names in use (for suggestions). */
  async groups(): Promise<string[]> {
    const map = await load();
    return [...new Set(Object.values(map).map((meta) => meta.group).filter(Boolean) as string[])];
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    void load().then(() => listener());
    return () => {
      listeners.delete(listener);
    };
  },
};

export function formatJobValue(value?: number): string {
  if (value == null || Number.isNaN(value)) return '';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
