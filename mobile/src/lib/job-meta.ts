/**
 * Per-job workflow metadata, CompanyCam-style: starred, archived, project
 * group, job value (sales), and assigned teammates. On-device for now;
 * server sync lands with the Supabase connection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-job-meta-v1';

export interface JobMeta {
  starred?: boolean;
  archived?: boolean;
  /** Shown on the Portfolio showcase. */
  featured?: boolean;
  group?: string;
  /** Job value in dollars (the Sales number). */
  value?: number;
  assignees?: string[];
}

type MetaMap = Record<string, JobMeta>;

let cache: MetaMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<MetaMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as MetaMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function pushMeta(jobId: string, meta: JobMeta): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      // Read-merge-write: a device that never saw fields another device set
      // (group, assignees, …) must not wipe them with its partial copy.
      let merged = meta;
      const { data } = await supabase
        .from('job_field_state')
        .select('meta')
        .eq('job_id', jobId)
        .single();
      if (data?.meta && typeof data.meta === 'object') {
        merged = { ...(data.meta as JobMeta), ...meta };
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
      cache = { ...current, [jobId]: data.meta as JobMeta };
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

  async toggle(jobId: string, key: 'starred' | 'archived' | 'featured'): Promise<boolean> {
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
