import { useCallback, useEffect, useState } from 'react';

import { workspace } from '@/lib/workspace';
import type { Business } from '@/lib/types';

/** Current business + switcher, shared across screens. */
export function useWorkspace() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const load = useCallback(async () => {
    const [currentBusiness, all] = await Promise.all([
      workspace.getCurrent(),
      workspace.getBusinesses(),
    ]);
    setBusiness(currentBusiness);
    setBusinesses(all);
  }, []);

  useEffect(() => {
    void load();
    return workspace.subscribe(() => {
      void workspace.getCurrent().then(setBusiness);
    });
  }, [load]);

  const select = useCallback(async (next: Business) => {
    await workspace.setCurrent(next);
  }, []);

  return { business, businesses, select };
}
