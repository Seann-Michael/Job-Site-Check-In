/**
 * Camera & media preferences, read by the capture pipeline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaCategory } from '@/lib/types';

const STORAGE_KEY = 'lsr-media-prefs-v1';

export type PhotoQuality = 'standard' | 'high' | 'original';

/** Where the logo watermark sits on the photo — `${vertical}-${horizontal}`. */
export type StampPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const STAMP_POSITIONS: StampPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const STAMP_POSITION_LABELS: Record<StampPosition, string> = {
  'top-left': 'Top left',
  'top-center': 'Top centre',
  'top-right': 'Top right',
  'middle-left': 'Middle left',
  'middle-center': 'Centre',
  'middle-right': 'Middle right',
  'bottom-left': 'Bottom left',
  'bottom-center': 'Bottom centre',
  'bottom-right': 'Bottom right',
};

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
  /** Place the business logo on captured photos, at `stampPosition`. */
  stampLogo: boolean;
  /** Which of the nine grid cells the logo watermark is placed in. */
  stampPosition: StampPosition;
}

export const DEFAULT_MEDIA_PREFS: MediaPrefs = {
  quality: 'standard',
  attachGps: true,
  defaultCategory: 'ask',
  stampTimestamp: true,
  stampGps: true,
  stampBusiness: true,
  stampLogo: false,
  stampPosition: 'bottom-right',
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
