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
      await supabase
        .from('job_field_state')
        .upsert({ job_id: jobId, meta, updated_at: new Date().toISOString() });
    } catch {
      // Best-effort.
    }
  })();
}

const hydratedJobs = new Set<string>();

/** First time a device sees a job: pull synced meta from the server. */
async function hydrateMeta(jobId: string): Promise<void> {
  if (!isSupabaseConfigured || !jobId || hydratedJobs.has(jobId)) return;
  hydratedJobs.add(jobId);
  const map = await load();
  if (map[jobId]) return; // Local state wins; write-through keeps server fresh.
  try {
    const { data } = await supabase
      .from('job_field_state')
      .select('meta')
      .eq('job_id', jobId)
      .single();
    if (data?.meta && typeof data.meta === 'object') {
      cache = { ...(await load()), [jobId]: data.meta as JobMeta };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
      emit();
    }
  } catch {
    // Offline or table missing.
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
