/**
 * Local store for photos captured in demo mode (no Supabase configured).
 * Persists to AsyncStorage and notifies subscribers so screens refresh.
 * With Supabase configured, captured photos live server-side and this store
 * is bypassed — screens refetch after upload instead.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaItem } from '@/lib/types';

const STORAGE_KEY = 'lsr-captured-media-v1';

/**
 * Items here carry `thumb_uri` (the on-device 384px copy the capture pipeline
 * writes beside the original) as well as `uri`, so the demo-mode grids render
 * thumbnails instead of decoding 200 full-resolution files.
 */
let captured: MediaItem[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/**
 * `loaded` flips only once the stored items are in memory, and concurrent
 * callers share the one read — otherwise a capture racing app start writes its
 * single item over everything already on disk.
 */
function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as MediaItem[]) : [];
        if (Array.isArray(parsed)) captured = parsed;
      } catch {
        captured = [];
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

export const mediaStore = {
  async getCaptured(): Promise<MediaItem[]> {
    await load();
    return captured;
  },

  async add(item: MediaItem): Promise<void> {
    await load();
    captured = [item, ...captured];
    emit();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
    } catch {
      // Persistence is best-effort; the in-memory copy still works.
    }
  },

  /** Wake subscribers without touching the demo store (e.g. after an upload). */
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
