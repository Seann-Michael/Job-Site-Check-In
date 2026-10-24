/**
 * Public gallery links for a job's photos. Each share creates a token; the
 * link points at the web app's public gallery when EXPO_PUBLIC_APP_URL is
 * configured. Records are kept on-device so past shares are visible.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { APP_URL } from '@/lib/config';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';

const STORAGE_KEY = 'lsr-share-links-v1';

export interface ShareLink {
  token: string;
  job_id: string;
  photo_ids: string[];
  created_at: string;
}

/**
 * Outcome of creating a share link. `demo: true` means Supabase is not
 * configured: the link exists on this device only and the /g/:token page is
 * NOT live — callers must label it as demo and must not present it as a
 * working customer link. `ok: false` means the server row could not be
 * created, so no link exists at all; callers must not show a URL.
 */
export type ShareLinkResult =
  | { ok: true; link: ShareLink; demo: boolean }
  | { ok: false; reason: 'server-unavailable' | 'no-business' | 'no-photos'; detail?: string };

let cache: ShareLink[] | null = null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** 20-char URL-safe token from the platform CSPRNG (~119 bits). */
function makeToken(): string {
  const bytes = new Uint8Array(20);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}
const listeners = new Set<() => void>();

async function load(): Promise<ShareLink[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as ShareLink[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/**
 * Base URL of the deployed web app, or null when it is not configured.
 *
 * Deliberately no fallback domain — same contract as reviewBaseUrl() in
 * review-requests.ts: this URL gets texted to customers, and a guessed
 * hostname is a link to a site we do not control. Callers must treat null
 * as "cannot show a link".
 */
export function shareBaseUrl(): string | null {
  if (!APP_URL) return null;
  const trimmed = APP_URL.replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+$/i.test(trimmed) ? trimmed : null;
}

/** Public gallery URL for a share link, or null when no base URL is set. */
export function galleryUrl(link: ShareLink): string | null {
  const base = shareBaseUrl();
  return base ? `${base}/g/${link.token}` : null;
}

export const shareLinks = {
  async forJob(jobId: string): Promise<ShareLink[]> {
    const all = await load();
    return all.filter((link) => link.job_id === jobId);
  },

  async create(
    jobId: string,
    photoIds: string[],
    details?: { jobTitle?: string; businessName?: string; photoUrls?: string[] },
  ): Promise<ShareLinkResult> {
    const token = makeToken();
    // Only photos that already live on the server can appear on a public
    // page; local / pending captures have no object the server could sign.
    const mediaIds = photoIds.filter((id) => UUID_RE.test(id));
    const link: ShareLink = {
      token,
      job_id: jobId,
      photo_ids: mediaIds,
      created_at: new Date().toISOString(),
    };
    // The server row is the only thing that makes the /g/:token page live, so
    // it goes in FIRST — a link is only recorded (and returned) once the row
    // exists. Note supabase-js resolves with { error } rather than throwing,
    // so the error must be read off the response; the try/catch only covers
    // transport-level failures.
    if (isSupabaseConfigured) {
      if (mediaIds.length === 0) return { ok: false, reason: 'no-photos' };
      const business = await workspace.getCurrent().catch(() => null);
      if (!business || business.id.startsWith('demo')) return { ok: false, reason: 'no-business' };
      try {
        const { error } = await supabase.from('shared_galleries').insert({
          token,
          job_id: jobId,
          business_id: business.id,
          job_title: details?.jobTitle ?? null,
          business_name: details?.businessName ?? business.name ?? null,
          media_ids: mediaIds,
        });
        if (error) return { ok: false, reason: 'server-unavailable', detail: error.message };
      } catch {
        return { ok: false, reason: 'server-unavailable' };
      }
    }
    const all = await load();
    cache = [link, ...all];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
    listeners.forEach((listener) => listener());
    return { ok: true, link, demo: !isSupabaseConfigured };
  },

  async remove(token: string): Promise<void> {
    const all = await load();
    cache = all.filter((link) => link.token !== token);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
    listeners.forEach((listener) => listener());
    if (isSupabaseConfigured) {
      try {
        // Deliberately best-effort: a resolved { error } is ignored — the
        // local removal above is the operation the user asked for.
        await supabase.from('shared_galleries').delete().eq('token', token);
      } catch {
        // Transport failure — still best-effort.
      }
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
