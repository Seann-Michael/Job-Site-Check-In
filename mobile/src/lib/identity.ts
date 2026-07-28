/**
 * Uploader identity for work that happens outside React.
 *
 * The capture pipeline and the upload queue are plain modules — the queue
 * flush runs from a background timer with no screen mounted — so neither can
 * read the auth context. This keeps a small AsyncStorage-backed snapshot of
 * whoever is signed in, refreshed from the live Supabase session whenever it
 * is asked for.
 *
 * The snapshot is taken at ENQUEUE time and frozen onto the queue item: the
 * crew member who shot the photo is frequently not the session that finally
 * syncs it (shift change, re-login on a shared tablet, a token that expired
 * overnight). Reading identity at flush time would attribute their work to
 * whoever happens to be logged in when the signal comes back.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-uploader-identity-v1';

/** Reading the session can hit the network on a token refresh — never block a capture on it. */
const SESSION_TIMEOUT_MS = 2000;

export interface UploaderIdentity {
  /** `auth.users.id` — what `job_media.uploaded_by` stores once that column exists. */
  id: string;
  email?: string;
  /** Display name from the account's user metadata, when it has one. */
  name?: string;
  /** When this snapshot was taken (ISO). */
  seen_at: string;
}

let cache: UploaderIdentity | null = null;
let loaded = false;
let loading: Promise<void> | null = null;

/**
 * The `loaded` flag is set AFTER the read resolves, and concurrent callers
 * share one promise — otherwise a capture racing app start sees "loaded" with
 * nothing in memory.
 */
function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) cache = JSON.parse(raw) as UploaderIdentity;
      } catch {
        cache = null;
      }
      loaded = true;
      loading = null;
    })();
  }
  return loading;
}

async function store(next: UploaderIdentity | null): Promise<void> {
  cache = next;
  loaded = true;
  try {
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort persistence; the in-memory copy still serves this session.
  }
}

function trimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Last known signed-in user, read from disk. Never touches the network. */
export async function getUploader(): Promise<UploaderIdentity | null> {
  await load();
  return cache;
}

/**
 * Re-read the live Supabase session and persist it. Returns null — and clears
 * the stored snapshot — when nobody is signed in, so a signed-out device stops
 * attributing uploads to the last user. Safe to call on login.
 */
export async function refreshUploader(): Promise<UploaderIdentity | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user) {
    await store(null);
    return null;
  }
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const parts = [trimmed(meta.first_name), trimmed(meta.last_name)].filter(Boolean);
  const name = trimmed(meta.name) ?? (parts.length ? parts.join(' ') : undefined);
  const next: UploaderIdentity = {
    id: user.id,
    email: user.email ?? undefined,
    name,
    seen_at: new Date().toISOString(),
  };
  await store(next);
  return next;
}

/**
 * Who to stamp on a capture, right now. Tries the live session, falls back to
 * the stored snapshot if that is slow or fails — a photo must never wait on
 * auth, and an approximate uploader beats none.
 */
export async function snapshotUploader(): Promise<UploaderIdentity | null> {
  await load();
  if (!isSupabaseConfigured) return null;
  try {
    const fresh = await Promise.race([
      refreshUploader(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), SESSION_TIMEOUT_MS)),
    ]);
    // `null` is a real answer (signed out); `undefined` means we timed out.
    if (fresh !== undefined) return fresh;
  } catch {
    // Fall through to the cached snapshot.
  }
  return cache;
}
