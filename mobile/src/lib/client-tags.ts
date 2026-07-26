/**
 * Tags on customers, stored on-device (same pattern as media tags).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lsr-client-tags-v1';

let cache: Record<string, string[]> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Record<string, string[]>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export const clientTags = {
  async get(clientId: string): Promise<string[]> {
    const map = await load();
    return map[clientId] ?? [];
  },

  async set(clientId: string, tags: string[]): Promise<void> {
    const map = await load();
    cache = { ...map, [clientId]: tags };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
