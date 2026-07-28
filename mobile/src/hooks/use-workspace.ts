import { useCallback, useEffect, useState } from 'react';

import { workspace, type BusinessPatch, type BusinessSaveResult } from '@/lib/workspace';
import type { Business } from '@/lib/types';

/** Current business + switcher + profile editing, shared across screens. */
export function useWorkspace() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const apply = useCallback((currentBusiness: Business | null, all: Business[]) => {
    // The stored selection is a cached blob; the freshly fetched row wins when
    // the list loaded (it carries the real plan and any server-side edits).
    // On a failed load `all` is empty, so the cached copy still stands in.
    setBusiness(
      currentBusiness
        ? (all.find((item) => item.id === currentBusiness.id) ?? currentBusiness)
        : null,
    );
    setBusinesses(all);
  }, []);

  /** Full load, including the network fetch of the businesses list. */
  const load = useCallback(async () => {
    const [currentBusiness, all] = await Promise.all([
      workspace.getCurrent(),
      workspace.getBusinesses(),
    ]);
    apply(currentBusiness, all);
  }, [apply]);

  useEffect(() => {
    void load();
    // Notifications re-derive from the store's cache instead of re-querying:
    // an emit means the selection or a local edit changed, never that the rows
    // on the server did, and a fetch per emit per mounted hook would also let
    // the failure path (which emits from inside the fetch) feed itself. `peek`
    // touches no network and never sets the error, so it cannot re-emit. The
    // fallback covers the first emit arriving before any list has loaded.
    return workspace.subscribe(() => {
      void workspace.peek().then((snapshot) => {
        if (snapshot) apply(snapshot.current, snapshot.businesses);
        else void load();
      });
    });
  }, [apply, load]);

  const select = useCallback(async (next: Business) => {
    await workspace.setCurrent(next);
  }, []);

  /**
   * Save profile edits to the current business. Pass only the fields the user
   * changed — anything included overwrites the server copy. The result says
   * whether Supabase actually accepted it; callers must not claim otherwise.
   * Nothing is written until the business has loaded, and that reports as a
   * failure rather than a save.
   */
  const update = useCallback(
    async (patch: BusinessPatch): Promise<BusinessSaveResult> => {
      if (!business) {
        return { synced: false, reason: 'failed', message: 'No business loaded yet.' };
      }
      return workspace.updateBusiness(business.id, patch);
    },
    [business],
  );

  return { business, businesses, select, update };
}
