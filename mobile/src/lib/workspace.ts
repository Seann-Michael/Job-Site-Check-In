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
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const workspace = {
  async getBusinesses(): Promise<Business[]> {
    if (!isSupabaseConfigured) return DEMO_BUSINESSES;
    const { data, error } = await supabase.from('businesses').select('id, name').limit(25);
    if (error || !data?.length) return DEMO_BUSINESSES;
    return (data as { id: unknown; name: unknown }[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? 'Business'),
      plan: 'Pro Plan',
    }));
  },

  async getCurrent(): Promise<Business> {
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
    current = businesses[0];
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
