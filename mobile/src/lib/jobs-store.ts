/**
 * Local store for jobs created in demo mode (no Supabase configured).
 * Persists to AsyncStorage and notifies subscribers so the Jobs tab refreshes.
 *
 * It also holds the demo-mode tombstone list. The demo jobs are a static array
 * baked into the bundle, so "deleted" has to be recorded somewhere or the job
 * reappears on the next read — see deleteJob() in lib/data.ts, which is the
 * only writer.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_JOBS } from '@/lib/demo-data';
import type { Job } from '@/lib/types';

const STORAGE_KEY = 'lsr-created-jobs-v1';
const DELETED_KEY = 'lsr-deleted-jobs-v1';

let created: Job[] = [];
let deleted: string[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/**
 * Concurrent callers share one read, and `loaded` flips only once the stored
 * state is actually in memory. The old order (flag first, then await) meant the
 * second of two reads racing app start saw an empty store — so the tombstone
 * list was silently empty on the first read after launch and a deleted demo job
 * came back.
 */
function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        const [rawCreated, rawDeleted] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(DELETED_KEY),
        ]);
        const parsedCreated = rawCreated ? (JSON.parse(rawCreated) as Job[]) : [];
        const parsedDeleted = rawDeleted ? (JSON.parse(rawDeleted) as string[]) : [];
        if (Array.isArray(parsedCreated)) created = parsedCreated;
        if (Array.isArray(parsedDeleted)) deleted = parsedDeleted;
      } catch {
        created = [];
        deleted = [];
      }
      loaded = true;
      loading = null;
    })();
  }
  return loading;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export const jobsStore = {
  async getCreated(): Promise<Job[]> {
    await load();
    return created;
  },

  async add(job: Job): Promise<void> {
    await load();
    created = [job, ...created];
    emit();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    } catch {
      // Persistence is best-effort; the in-memory copy still works.
    }
  },

  /**
   * Set a job's status.
   *
   * A demo seed is not in `created` at all, so rewriting only that array left
   * the seed untouched while the caller reported the change had landed — a
   * publish said "completed" and the job stayed open. Fall back to the bundled
   * seed and hand it to upsert(), the same shadow-copy route an edit takes, so
   * fetchJobs prefers the local copy and the new status survives a relaunch.
   *
   * A tombstoned job is left alone: it is gone, and shadowing it here would
   * only store a row that every reader filters back out.
   */
  async updateStatus(id: string, status: Job['status']): Promise<void> {
    await load();
    if (deleted.includes(id)) return;
    const current = created.find((job) => job.id === id) ?? DEMO_JOBS.find((job) => job.id === id);
    if (!current) return;
    await jobsStore.upsert({ ...current, status });
  },

  /**
   * Insert or replace a job in the local store. Editing a demo-seed job
   * copies it in here, and fetchJobs prefers this copy over the seed.
   */
  async upsert(job: Job): Promise<void> {
    await load();
    const exists = created.some((existing) => existing.id === job.id);
    created = exists
      ? created.map((existing) => (existing.id === job.id ? job : existing))
      : [job, ...created];
    emit();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    } catch {
      // Best-effort persistence.
    }
  },

  /**
   * Forget a job locally and remember that it was deleted.
   *
   * Dropping the local copy is not enough on its own: a demo seed lives in the
   * bundled DEMO_JOBS array and an edited seed lives in both places, so the
   * tombstone is what keeps it gone across reads and app launches.
   */
  async remove(id: string): Promise<void> {
    await load();
    created = created.filter((job) => job.id !== id);
    if (!deleted.includes(id)) deleted = [...deleted, id];
    emit();
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEY, JSON.stringify(created)],
        [DELETED_KEY, JSON.stringify(deleted)],
      ]);
    } catch {
      // Best-effort persistence; the in-memory tombstone still hides it now.
    }
  },

  /** Ids removed by remove(). Readers must filter these out of demo data. */
  async getDeletedIds(): Promise<Set<string>> {
    await load();
    return new Set(deleted);
  },

  notifyChanged(): void {
    emit();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
