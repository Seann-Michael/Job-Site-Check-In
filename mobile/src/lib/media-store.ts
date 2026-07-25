/**
 * Local store for photos captured in demo mode (no Supabase configured).
 * Persists to AsyncStorage and notifies subscribers so screens refresh.
 * With Supabase configured, captured photos live server-side and this store
 * is bypassed — screens refetch after upload instead.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaItem } from '@/lib/types';

const STORAGE_KEY = 'lsr-captured-media-v1';

let captured: MediaItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) captured = JSON.parse(raw) as MediaItem[];
  } catch {
    captured = [];
  }
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
