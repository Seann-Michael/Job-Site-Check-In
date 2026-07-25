/**
 * Offline upload queue. When a capture can't reach Supabase (no signal on a
 * job site), the processed photo is kept on-device and queued here; the queue
 * flushes automatically on app start, on a background interval, and via the
 * retry banner. The flush handler is injected by the media pipeline to avoid
 * a circular import.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaCategory } from '@/lib/types';

const STORAGE_KEY = 'lsr-upload-queue-v1';

export interface QueuedUpload {
  id: string;
  job_id: string;
  job_title: string;
  category: MediaCategory;
  uri: string;
  width: number;
  height: number;
  taken_at: string;
  latitude?: number;
  longitude?: number;
}

type FlushHandler = (item: QueuedUpload) => Promise<boolean>;

let items: QueuedUpload[] = [];
let loaded = false;
let flushing = false;
let handler: FlushHandler | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) items = JSON.parse(raw) as QueuedUpload[];
  } catch {
    items = [];
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort persistence.
  }
}

export const uploadQueue = {
  setFlushHandler(next: FlushHandler): void {
    handler = next;
  },

  async enqueue(item: QueuedUpload): Promise<void> {
    await load();
    items = [...items, item];
    await persist();
    emit();
  },

  async getAll(): Promise<QueuedUpload[]> {
    await load();
    return items;
  },

  /** Synchronous count of what's already loaded (0 before first load). */
  countSync(): number {
    return items.length;
  },

  async flush(): Promise<void> {
    if (flushing || !handler) return;
    await load();
    if (items.length === 0) return;
    flushing = true;
    try {
      for (const item of [...items]) {
        const ok = await handler(item);
        if (!ok) break; // Still offline — stop and try again later.
        items = items.filter((queued) => queued.id !== item.id);
        await persist();
        emit();
      }
    } finally {
      flushing = false;
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
