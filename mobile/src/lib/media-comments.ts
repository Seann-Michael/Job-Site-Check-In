/**
 * Per-photo comment threads with @mentions, CompanyCam-style.
 * Stored on-device (AsyncStorage); server sync arrives with a later
 * milestone alongside check-ins/notes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobInWorkspace } from '@/lib/job-meta';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-media-comments-v1';

export interface MediaComment {
  id: string;
  text: string;
  author: string;
  created_at: string;
  /** Names captured from @mentions at post time. */
  mentions: string[];
  /** Row id in media_comments once synced. */
  server_id?: string;
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

// Throttled merge of teammates' comments from the server.
const lastHydrated: Record<string, number> = {};

// Deleted server rows never come back via hydrate, even if the server-side
// delete failed.
const deletedCommentIds = new Set<string>();

/**
 * The job a photo hangs off, or null when this client cannot establish one.
 *
 * media_comments carries no business column, and neither does job_media — the
 * photo's job is the only route to a tenant. Ids that were never uploaded
 * (device captures, queued uploads, demo seeds) are not uuids, so the
 * comparison errors and they answer null: correct, since they have no server
 * comments to read either way.
 */
async function jobForMedia(mediaId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('job_media')
      .select('job_id')
      .eq('id', mediaId)
      .maybeSingle();
    if (error || !data?.job_id) return null;
    return String(data.job_id);
  } catch {
    return null;
  }
}

async function hydrateFromServer(mediaId: string): Promise<void> {
  if (!isSupabaseConfigured || !mediaId) return;
  const now = Date.now();
  if (now - (lastHydrated[mediaId] ?? 0) < 15_000) return;
  lastHydrated[mediaId] = now;
  // A media id reaches this store from a route/deep-link param the same way a
  // job id does, so the photo's owner is established before its thread is read:
  // comments carry teammates' names and whatever they wrote about a site. If
  // the job cannot be resolved, or is not this workspace's, nothing is read and
  // the comments already on this device are left alone.
  const jobId = await jobForMedia(mediaId);
  if (!jobId || !(await jobInWorkspace(jobId))) return;
  try {
    const { data, error } = await supabase
      .from('media_comments')
      .select('id, author_name, comment, mentions, created_at')
      .eq('media_id', mediaId)
      .order('created_at', { ascending: true });
    if (error || !data) return;
    const map = await load();
    const fromServer: MediaComment[] = data
      .filter((row) => !deletedCommentIds.has(String(row.id)))
      .map((row) => ({
        id: `srv-${row.id}`,
        server_id: String(row.id),
        text: String(row.comment ?? ''),
        author: String(row.author_name ?? 'Team member'),
        created_at: String(row.created_at),
        mentions: Array.isArray(row.mentions) ? (row.mentions as string[]) : [],
      }));
    // Keep unsynced local comments unless the server already has that exact
    // comment (insert landed but the server_id write-back hasn't yet).
    const serverTexts = new Set(fromServer.map((comment) => `${comment.author}::${comment.text}`));
    const localOnly = (map[mediaId] ?? []).filter(
      (comment) => !comment.server_id && !serverTexts.has(`${comment.author}::${comment.text}`),
    );
    await persist({ ...map, [mediaId]: [...fromServer, ...localOnly] });
  } catch {
    // Offline.
  }
}

export const mediaComments = {
  async get(mediaId: string): Promise<MediaComment[]> {
    const map = await load();
    void hydrateFromServer(mediaId);
    return map[mediaId] ?? [];
  },

  /** Synchronous count from cache for badges; 0 before first load. */
  countSync(mediaId: string): number {
    return cache?.[mediaId]?.length ?? 0;
  },

  async add(mediaId: string, text: string, author: string, knownNames: string[]): Promise<void> {
    const map = await load();
    const localId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const comment: MediaComment = {
      id: localId,
      text: text.trim(),
      author,
      created_at: new Date().toISOString(),
      mentions: extractMentions(text, knownNames),
    };
    await persist({ ...map, [mediaId]: [...(map[mediaId] ?? []), comment] });
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('media_comments')
          .insert({
            media_id: mediaId,
            author_name: author,
            comment: comment.text,
            mentions: comment.mentions,
          })
          .select('id')
          .single();
        if (data?.id) {
          const current = await load();
          await persist({
            ...current,
            [mediaId]: (current[mediaId] ?? []).map((entry) =>
              entry.id === localId ? { ...entry, server_id: String(data.id) } : entry,
            ),
          });
        }
      } catch {
        // Stays local.
      }
    }
  },

  async remove(mediaId: string, commentId: string): Promise<void> {
    const map = await load();
    const target = (map[mediaId] ?? []).find((comment) => comment.id === commentId);
    if (target?.server_id) deletedCommentIds.add(target.server_id);
    await persist({
      ...map,
      [mediaId]: (map[mediaId] ?? []).filter((comment) => comment.id !== commentId),
    });
    if (isSupabaseConfigured && target?.server_id) {
      try {
        await supabase.from('media_comments').delete().eq('id', target.server_id);
      } catch {
        // Best-effort.
      }
    }
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
