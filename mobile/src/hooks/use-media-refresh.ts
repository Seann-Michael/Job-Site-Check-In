import { useEffect } from 'react';

import { mediaStore } from '@/lib/media-store';

/** Re-runs `refresh` whenever a photo is captured in demo mode. */
export function useMediaRefresh(refresh: () => void) {
  useEffect(() => mediaStore.subscribe(refresh), [refresh]);
}
