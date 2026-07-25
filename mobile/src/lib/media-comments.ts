/**
 * Per-photo comment threads with @mentions, CompanyCam-style.
 * Stored on-device (AsyncStorage); server sync arrives with a later
 * milestone alongside check-ins/notes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lsr-media-comments-v1';

export interface MediaComment {
  id: string;
  text: string;
  author: string;
  created_at: string;
  /** Names captured from @mentions at post time. */
  mentions: string[];
}

type CommentsMap = Record<string, MediaComment[]>;

let cache: CommentsMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<CommentsMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as CommentsMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(map: CommentsMap) {
  cache = map;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);
  emit();
}

/** "@Jordan Reyes fixed this" → ["Jordan Reyes"] (matched against known names). */
export function extractMentions(text: string, knownNames: string[]): string[] {
  const found = new Set<string>();
  for (const name of knownNames) {
    if (text.toLowerCase().includes(`@${name.toLowerCase()}`)) found.add(name);
  }
  return [...found];
}

export const mediaComments = {
  async get(mediaId: string): Promise<MediaComment[]> {
    const map = await load();
    return map[mediaId] ?? [];
  },

  /** Synchronous count from cache for badges; 0 before first load. */
  countSync(mediaId: string): number {
    return cache?.[mediaId]?.length ?? 0;
  },

  async add(mediaId: string, text: string, author: string, knownNames: string[]): Promise<void> {
    const map = await load();
    const comment: MediaComment = {
      id: `c-${Date.now()}`,
      text: text.trim(),
      author,
      created_at: new Date().toISOString(),
      mentions: extractMentions(text, knownNames),
    };
    await persist({ ...map, [mediaId]: [...(map[mediaId] ?? []), comment] });
  },

  async remove(mediaId: string, commentId: string): Promise<void> {
    const map = await load();
    await persist({
      ...map,
      [mediaId]: (map[mediaId] ?? []).filter((comment) => comment.id !== commentId),
    });
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Warm the cache so countSync works.
    void load().then(() => listener());
    return () => {
      listeners.delete(listener);
    };
  },
};
