/**
 * Camera & media preferences, read by the capture pipeline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaCategory } from '@/lib/types';

const STORAGE_KEY = 'lsr-media-prefs-v1';

export type PhotoQuality = 'standard' | 'high' | 'original';

export interface MediaPrefs {
  /** standard = 2048px, high = 3072px, original = no downscale. */
  quality: PhotoQuality;
  /** Attach a GPS fix to captured photos (the local-SEO signal). */
  attachGps: boolean;
  /** Skip the category sheet and use this category, or ask every time. */
  defaultCategory: MediaCategory | 'ask';
  /** Burn the capture date/time onto the photo. */
  stampTimestamp: boolean;
  /** Burn the GPS coordinates onto the photo. */
  stampGps: boolean;
  /** Burn the business name onto the photo. */
  stampBusiness: boolean;
}

export const DEFAULT_MEDIA_PREFS: MediaPrefs = {
  quality: 'standard',
  attachGps: true,
  defaultCategory: 'ask',
  stampTimestamp: true,
  stampGps: true,
  stampBusiness: true,
};

export const QUALITY_DIMENSIONS: Record<PhotoQuality, number | null> = {
  standard: 2048,
  high: 3072,
  original: null,
};

export async function getMediaPrefs(): Promise<MediaPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEDIA_PREFS;
    return { ...DEFAULT_MEDIA_PREFS, ...(JSON.parse(raw) as Partial<MediaPrefs>) };
  } catch {
    return DEFAULT_MEDIA_PREFS;
  }
}

export async function setMediaPrefs(patch: Partial<MediaPrefs>): Promise<MediaPrefs> {
  const current = await getMediaPrefs();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}
