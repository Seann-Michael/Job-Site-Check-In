import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

import type { Job } from '@/lib/types';

const STORAGE_KEY = 'lsr-nav-app-v1';

export type NavApp = 'system' | 'apple' | 'google' | 'waze';

export const NAV_APP_LABELS: Record<NavApp, string> = {
  system: 'System default',
  apple: 'Apple Maps',
  google: 'Google Maps',
  waze: 'Waze',
};

export async function getNavApp(): Promise<NavApp> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'apple' || raw === 'google' || raw === 'waze' || raw === 'system') return raw;
  } catch {
    // fall through
  }
  return 'system';
}

export async function setNavApp(app: NavApp): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, app).catch(() => undefined);
}

function destinationOf(job: Job): { coords: string | null; query: string } {
  const hasCoords = typeof job.latitude === 'number' && typeof job.longitude === 'number';
  return {
    coords: hasCoords ? `${job.latitude},${job.longitude}` : null,
    query: encodeURIComponent([job.address, job.city].filter(Boolean).join(', ')),
  };
}

/** Open turn-by-turn directions to a job in the user's preferred maps app. */
export async function openDirections(job: Job): Promise<void> {
  const app = await getNavApp();
  const { coords, query } = destinationOf(job);
  const destination = coords ?? query;

  let url: string;
  switch (app) {
    case 'apple':
      url = `http://maps.apple.com/?daddr=${destination}`;
      break;
    case 'google':
      url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      break;
    case 'waze':
      url = coords
        ? `https://waze.com/ul?ll=${coords}&navigate=yes`
        : `https://waze.com/ul?q=${query}&navigate=yes`;
      break;
    default:
      if (Platform.OS === 'ios') url = `maps:?daddr=${destination}`;
      else if (Platform.OS === 'android') url = `google.navigation:q=${destination}`;
      else url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }

  await Linking.openURL(url).catch(() => {
    // Chosen app missing — fall back to a link every device can open.
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
  });
}
