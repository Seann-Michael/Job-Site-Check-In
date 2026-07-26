/**
 * Client CRUD. Connected: writes through to the `clients` table
 * best-effort. Always: keeps a local overrides layer (created / edited /
 * deleted) that fetchClients applies, so changes work offline and in demo
 * mode.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ClientRecord } from '@/lib/types';

const STORAGE_KEY = 'lsr-client-edits-v1';

export interface ClientPatch {
  name?: string;
  phone?: string;
  email?: string;
}

interface ClientOverrides {
  created: ClientRecord[];
  edited: Record<string, ClientPatch>;
  deleted: string[];
}

const EMPTY: ClientOverrides = { created: [], edited: {}, deleted: [] };

let cache: ClientOverrides | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<ClientOverrides> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as ClientOverrides) } : { ...EMPTY };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

async function persist(next: ClientOverrides): Promise<void> {
  cache = next;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  emit();
}

export const clientsStore = {
  /** Apply local creates/edits/deletes over a fetched list. */
  async applyOverrides(clients: ClientRecord[]): Promise<ClientRecord[]> {
    const overrides = await load();
    const deleted = new Set(overrides.deleted);
    const merged = clients
      .filter((client) => !deleted.has(client.id))
      .map((client) =>
        overrides.edited[client.id] ? { ...client, ...overrides.edited[client.id] } : client,
      );
    const existingIds = new Set(merged.map((client) => client.id));
    for (const created of overrides.created) {
      if (!deleted.has(created.id) && !existingIds.has(created.id)) {
        merged.unshift(
          overrides.edited[created.id] ? { ...created, ...overrides.edited[created.id] } : created,
        );
      }
    }
    return merged;
  },

  async create(input: ClientPatch & { name: string }): Promise<ClientRecord> {
    const record: ClientRecord = {
      id: `local-client-${Date.now()}`,
      name: input.name.trim(),
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      jobs_count: 0,
      last_job_at: '',
    };
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('clients')
          .insert({ name: record.name, phone: record.phone || null, email: record.email || null })
          .select('id')
          .single();
        if (data?.id) record.id = String(data.id);
      } catch {
        // Kept locally; a later edit can sync.
      }
    }
    const overrides = await load();
    await persist({ ...overrides, created: [record, ...overrides.created] });
    return record;
  },

  async update(id: string, patch: ClientPatch): Promise<void> {
    const overrides = await load();
    await persist({
      ...overrides,
      edited: { ...overrides.edited, [id]: { ...overrides.edited[id], ...patch } },
    });
    if (isSupabaseConfigured && !id.startsWith('local-') && !id.startsWith('client-')) {
      try {
        await supabase
          .from('clients')
          .update({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
            ...(patch.email !== undefined ? { email: patch.email || null } : {}),
          })
          .eq('id', id);
      } catch {
        // Local override still applies.
      }
    }
  },

  async remove(id: string): Promise<void> {
    const overrides = await load();
    await persist({ ...overrides, deleted: [...overrides.deleted, id] });
    if (isSupabaseConfigured && !id.startsWith('local-') && !id.startsWith('client-')) {
      try {
        await supabase.from('clients').delete().eq('id', id);
      } catch {
        // Hidden locally either way.
      }
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
