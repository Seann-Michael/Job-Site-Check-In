/**
 * Public gallery links for a job's photos. Each share creates a token; the
 * link points at the web app's public gallery when EXPO_PUBLIC_APP_URL is
 * configured. Records are kept on-device so past shares are visible.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-share-links-v1';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

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
  | { ok: false; reason: 'server-unavailable' };

let cache: ShareLink[] | null = null;
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
    const token = `${jobId.slice(0, 6)}${Date.now().toString(36)}`.replace(/[^a-z0-9]/gi, '');
    const link: ShareLink = {
      token,
      job_id: jobId,
      photo_ids: photoIds,
      created_at: new Date().toISOString(),
    };
    // The server row is the only thing that makes the /g/:token page live, so
    // it goes in FIRST — a link is only recorded (and returned) once the row
    // exists. Note supabase-js resolves with { error } rather than throwing,
    // so the error must be read off the response; the try/catch only covers
    // transport-level failures.
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('shared_galleries').insert({
          token,
          job_id: jobId,
          job_title: details?.jobTitle ?? null,
          business_name: details?.businessName ?? null,
          photo_urls: (details?.photoUrls ?? []).filter((url) => url.startsWith('http')),
        });
        if (error) return { ok: false, reason: 'server-unavailable' };
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
