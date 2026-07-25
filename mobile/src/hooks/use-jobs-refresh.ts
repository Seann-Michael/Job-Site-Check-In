import { useEffect } from 'react';

import { jobsStore } from '@/lib/jobs-store';

/** Re-runs `refresh` whenever a job is created on this device. */
export function useJobsRefresh(refresh: () => void) {
  useEffect(() => jobsStore.subscribe(refresh), [refresh]);
}
