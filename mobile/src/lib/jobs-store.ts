/**
 * Local store for jobs created in demo mode (no Supabase configured).
 * Persists to AsyncStorage and notifies subscribers so the Jobs tab refreshes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Job } from '@/lib/types';

const STORAGE_KEY = 'lsr-created-jobs-v1';

let created: Job[] = [];
let loaded = false;
const listeners = new Set<() => void>();

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) created = JSON.parse(raw) as Job[];
  } catch {
    created = [];
  }
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

  async updateStatus(id: string, status: Job['status']): Promise<void> {
    await load();
    created = created.map((job) => (job.id === id ? { ...job, status } : job));
    emit();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    } catch {
      // Best-effort persistence.
    }
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
