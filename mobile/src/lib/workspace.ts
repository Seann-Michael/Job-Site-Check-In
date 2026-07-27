/**
 * Current-business selection, the mobile counterpart of the web app's
 * CompanySelector + workspaceService. Businesses come from the `businesses`
 * table when Supabase is configured; the selection persists on-device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Business } from '@/lib/types';

const STORAGE_KEY = 'lsr-current-business-v1';

const DEMO_BUSINESSES: Business[] = [
  { id: 'demo-business', name: 'Westside Home Services', plan: 'Pro Plan' },
  { id: 'demo-business-2', name: 'Eastside Renovations', plan: 'Pro Plan' },
];

let current: Business | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setError(next: string | null) {
  if (lastError === next) return;
  lastError = next;
  emit();
}

export const workspace = {
  /**
   * Two different "no rows" cases, deliberately handled differently:
   *
   * - Query failed → no businesses, with the reason on `lastError()`. Standing
   *   in a demo company there would file real work under a fake business.
   * - Query succeeded but the table is empty (Supabase not configured at all,
   *   or a project with no `businesses` row yet) → the demo list. Everything
   *   downstream assumes a current business exists: without one the settings
   *   logo picker does nothing and photo stamping silently drops the business
   *   name and logo while the settings UI still shows them switched on.
   *
   * Demo ids are prefixed `demo`, and callers that scope queries by business
   * skip that filter for them (see fetchJobs/createJob in data.ts).
   */
  async getBusinesses(): Promise<Business[]> {
    if (!isSupabaseConfigured) return DEMO_BUSINESSES;
    const { data, error } = await supabase.from('businesses').select('id, name').limit(25);
    if (error) {
      setError(`Couldn't load businesses: ${error.message}`);
      return [];
    }
    setError(null);
    const rows = (data ?? []) as { id: unknown; name: unknown }[];
    if (!rows.length) return DEMO_BUSINESSES;
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? 'Business'),
      plan: 'Pro Plan',
    }));
  },

  /**
   * Message from the most recent failed business load, else null. Cleared by
   * the next successful load; `subscribe` fires on both. Non-null means the
   * switcher list is unavailable, not that the workspace is empty.
   */
  lastError(): string | null {
    return lastError;
  },

  /** Null when the businesses list is unavailable — callers must handle it. */
  async getCurrent(): Promise<Business | null> {
    if (current) return current;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        current = JSON.parse(raw) as Business;
        return current;
      }
    } catch {
      // fall through to default
    }
    const businesses = await workspace.getBusinesses();
    // Leave `current` unset on failure so the next call retries.
    current = businesses[0] ?? null;
    return current;
  },

  async setCurrent(business: Business): Promise<void> {
    current = business;
    emit();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(business));
    } catch {
      // Best-effort persistence.
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
