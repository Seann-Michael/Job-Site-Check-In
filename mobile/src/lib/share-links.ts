/**
 * Public gallery links for a job's photos. Each share creates a token; the
 * link points at the web app's public gallery when EXPO_PUBLIC_APP_URL is
 * configured. Records are kept on-device so past shares are visible.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lsr-share-links-v1';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

export interface ShareLink {
  token: string;
  job_id: string;
  photo_ids: string[];
  created_at: string;
}

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

export function galleryUrl(link: ShareLink): string {
  const base = APP_URL ? APP_URL.replace(/\/$/, '') : 'https://localseoranker.app';
  return `${base}/g/${link.token}`;
}

export const shareLinks = {
  async forJob(jobId: string): Promise<ShareLink[]> {
    const all = await load();
    return all.filter((link) => link.job_id === jobId);
  },

  async create(jobId: string, photoIds: string[]): Promise<ShareLink> {
    const all = await load();
    const token = `${jobId.slice(0, 6)}${Date.now().toString(36)}`.replace(/[^a-z0-9]/gi, '');
    const link: ShareLink = {
      token,
      job_id: jobId,
      photo_ids: photoIds,
      created_at: new Date().toISOString(),
    };
    cache = [link, ...all];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
    listeners.forEach((listener) => listener());
    return link;
  },

  async remove(token: string): Promise<void> {
    const all = await load();
    cache = all.filter((link) => link.token !== token);
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
