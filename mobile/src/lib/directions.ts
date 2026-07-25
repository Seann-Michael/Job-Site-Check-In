import { Linking, Platform } from 'react-native';

import type { Job } from '@/lib/types';

/** Open turn-by-turn directions to a job in the platform's maps app. */
export function openDirections(job: Job): void {
  const hasCoords = typeof job.latitude === 'number' && typeof job.longitude === 'number';
  const destination = hasCoords
    ? `${job.latitude},${job.longitude}`
    : encodeURIComponent([job.address, job.city].filter(Boolean).join(', '));

  let url: string;
  if (Platform.OS === 'ios') {
    url = `maps:?daddr=${destination}`;
  } else if (Platform.OS === 'android') {
    url = `google.navigation:q=${destination}`;
  } else {
    url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }

  void Linking.openURL(url).catch(() => {
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
  });
}
