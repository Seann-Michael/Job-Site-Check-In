/**
 * Current-business selection and profile, the mobile counterpart of the web
 * app's CompanySelector + workspaceService. Businesses come from the
 * `businesses` table when Supabase is configured; the selection persists
 * on-device.
 *
 * Edits follow the clientsStore pattern (lib/clients-store.ts): a best-effort
 * write-through to Supabase plus a local overrides layer that every read
 * applies, so profile edits stick offline and in demo mode. Unlike clients,
 * `businesses` rows are mostly owned by the web app, so an override is only
 * kept while the server has NOT accepted the value — see updateBusiness.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Business, BusinessAddress } from '@/lib/types';

const STORAGE_KEY = 'lsr-current-business-v1';
const EDITS_KEY = 'lsr-business-edits-v1';

const DEMO_BUSINESSES: Business[] = [
  {
    id: 'demo-business',
    name: 'Westside Home Services',
    description: 'Gutter, drainage, and exterior repair crews across the west side.',
    phone: '(440) 555-0142',
    email: 'hello@westsidehomeservices.com',
    website: 'https://westsidehomeservices.com',
    address: {
      street: '214 Maple Ave',
      city: 'Westlake',
      state: 'OH',
      zip: '44145',
      country: 'United States',
    },
  },
  {
    id: 'demo-business-2',
    name: 'Eastside Renovations',
    description: 'Interior and exterior renovation work, residential and light commercial.',
    phone: '(216) 555-0188',
    email: 'team@eastsiderenovations.com',
    website: 'https://eastsiderenovations.com',
    address: {
      street: '1180 Euclid Ave',
      city: 'Cleveland',
      state: 'OH',
      zip: '44115',
      country: 'United States',
    },
  },
];

/** Fields a profile screen may edit. Mirrors ClientPatch in lib/clients-store.ts. */
export interface BusinessPatch {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: BusinessAddress;
}

/**
 * Local edits by business id, applied over every read. Only holds values the
 * server has not confirmed: a successful write drops the fields it accepted.
 */
type BusinessEdits = Record<string, BusinessPatch>;

/** What actually happened to a profile edit, so screens can say so honestly. */
export interface BusinessSaveResult {
  /** True only when Supabase accepted the write. */
  synced: boolean;
  /**
   * Why it was not synced. `local` — demo business or Supabase not configured,
   * so no server write was ever attempted. `failed` — the write was attempted
   * and rejected or unreachable; `message` carries the reason.
   */
  reason?: 'local' | 'failed';
  message?: string;
}

interface BusinessRow {
  id: unknown;
  name: unknown;
  description: unknown;
  phone: unknown;
  email: unknown;
  website: unknown;
  address: unknown;
  metadata: unknown;
}

const COLUMNS = 'id, name, description, phone, email, website, address, metadata';

let current: Business | null = null;
let lastError: string | null = null;
let edits: BusinessEdits | null = null;
/**
 * Result of the last `getBusinesses()` *before* overrides are merged, so
 * `peek()` can re-derive the list on every notification without another
 * network round-trip. Null until the first load; `[]` after a failed one.
 */
let cachedList: Business[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setError(next: string | null) {
  if (lastError === next) return;
  lastError = next;
  emit();
}

async function loadEdits(): Promise<BusinessEdits> {
  if (edits) return edits;
  try {
    const raw = await AsyncStorage.getItem(EDITS_KEY);
    edits = raw ? (JSON.parse(raw) as BusinessEdits) : {};
  } catch {
    edits = {};
  }
  return edits;
}

async function persistEdits(next: BusinessEdits): Promise<void> {
  edits = next;
  await AsyncStorage.setItem(EDITS_KEY, JSON.stringify(next)).catch(() => undefined);
  emit();
}

function merge(business: Business, patch: BusinessPatch | undefined): Business {
  return patch ? { ...business, ...patch } : business;
}

/** Trimmed string, or undefined for null/blank/non-string JSONB values. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toAddress(value: unknown): BusinessAddress | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const address: BusinessAddress = {
    street: text(raw.street),
    city: text(raw.city),
    state: text(raw.state),
    // The web app writes `zip`; some seeded rows spell it `zipCode`.
    zip: text(raw.zip) ?? text(raw.zipCode),
    country: text(raw.country),
  };
  return Object.values(address).some((part) => part !== undefined) ? address : undefined;
}

/**
 * Plan comes from the row's own metadata — the only real source in this
 * project (the web admin screens read the same keys). No plan in metadata
 * means no plan to show.
 */
function toPlan(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const raw = metadata as Record<string, unknown>;
  return text(raw.plan) ?? text(raw.subscription_plan);
}

/**
 * Fold a confirmed patch into a cached copy, normalising the way a fetch does:
 * a field cleared to '' comes back from Supabase as null, i.e. undefined here.
 */
function applyPatch(business: Business, patch: BusinessPatch): Business {
  return {
    ...business,
    ...(patch.name !== undefined ? { name: text(patch.name) ?? business.name } : {}),
    ...(patch.description !== undefined ? { description: text(patch.description) } : {}),
    ...(patch.phone !== undefined ? { phone: text(patch.phone) } : {}),
    ...(patch.email !== undefined ? { email: text(patch.email) } : {}),
    ...(patch.website !== undefined ? { website: text(patch.website) } : {}),
    ...(patch.address !== undefined ? { address: toAddress(patch.address) } : {}),
  };
}

/**
 * Migrate the persisted selection blob on read. Builds up to (v0.1.0) wrote
 * `{ id, name, plan: 'Pro Plan' }` — a tier nothing ever set — and older blobs
 * may carry any shape at all. Rebuilding it field by field drops the invented
 * `plan` and anything else unrecognised; the real plan comes from the row's
 * metadata on the next fetch. Null means the blob is unusable.
 */
function fromStored(value: unknown): Business | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    name: text(raw.name) ?? 'Business',
    description: text(raw.description),
    phone: text(raw.phone),
    email: text(raw.email),
    website: text(raw.website),
    address: toAddress(raw.address),
  };
}

/**
 * Write the cached selection. `plan` is deliberately not persisted: the blob is
 * selection state, and a stale tier is worse than none. Reads take the plan
 * from the freshly fetched row (see useWorkspace, which reconciles the two).
 * (JSON.stringify drops the undefined key entirely.)
 */
async function persistCurrent(business: Business): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...business, plan: undefined }));
  } catch {
    // Best-effort persistence.
  }
}

function toBusiness(row: BusinessRow): Business {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Business'),
    plan: toPlan(row.metadata),
    description: text(row.description),
    phone: text(row.phone),
    email: text(row.email),
    website: text(row.website),
    address: toAddress(row.address),
  };
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
    const overrides = await loadEdits();
    const remember = (list: Business[]) => {
      cachedList = list;
      return list.map((business) => merge(business, overrides[business.id]));
    };
    if (!isSupabaseConfigured) return remember(DEMO_BUSINESSES);
    const { data, error } = await supabase.from('businesses').select(COLUMNS).limit(25);
    // The cache is filled before setError in both branches: setError emits, and
    // a listener whose `peek` found no cache would re-enter and query again.
    if (error) {
      cachedList = [];
      setError(`Couldn't load businesses: ${error.message}`);
      return [];
    }
    const rows = (data ?? []) as BusinessRow[];
    const merged = remember(rows.length ? rows.map(toBusiness) : DEMO_BUSINESSES);
    setError(null);
    return merged;
  },

  /**
   * Cheap snapshot for change notifications: the last loaded list and the
   * selected business, re-merged with the current local overrides. Never hits
   * the network, never calls setError, so it cannot trigger another emit.
   * Null until the first `getBusinesses()` has populated the cache.
   */
  async peek(): Promise<{ current: Business | null; businesses: Business[] } | null> {
    if (!cachedList) return null;
    const overrides = await loadEdits();
    return {
      current: current ? merge(current, overrides[current.id]) : null,
      businesses: cachedList.map((business) => merge(business, overrides[business.id])),
    };
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
    const overrides = await loadEdits();
    if (current) return merge(current, overrides[current.id]);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored = raw ? fromStored(JSON.parse(raw)) : null;
      if (stored) {
        current = stored;
        return merge(current, overrides[current.id]);
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
    await persistCurrent(business);
  },

  /**
   * Edit a business profile. Only the keys present in `patch` are touched —
   * callers must send what the user actually changed, never a whole form, or an
   * untouched field would overwrite the server copy (`'' -> null` below).
   *
   * The local override is written first so the change survives offline, in demo
   * mode, and when the remote write is rejected. Then, and only if Supabase
   * *confirms* the write, the override is dropped for exactly the keys it
   * accepted and the cached copies are moved forward instead. That is the whole
   * rule: an override exists only while the server is behind. `businesses` rows
   * are mostly edited in the web app, so a permanent override would shadow
   * every later web edit of that field — a phone changed on the web would never
   * reach mobile again.
   *
   * Demo ids and an unconfigured Supabase never hit the network, so their
   * overrides are the only copy and are kept indefinitely.
   */
  async updateBusiness(id: string, patch: BusinessPatch): Promise<BusinessSaveResult> {
    // Nothing changed: an empty `update({})` is not a save to report on.
    if (!Object.keys(patch).length) return { synced: true };

    const overrides = await loadEdits();
    await persistEdits({ ...overrides, [id]: { ...overrides[id], ...patch } });

    if (!isSupabaseConfigured || id.startsWith('demo')) {
      return { synced: false, reason: 'local' };
    }

    let message: string | null = null;
    try {
      // supabase-js resolves with `{ error }` instead of throwing, so this has
      // to be read: the catch below only covers transport-level failures.
      // `.select('id')` makes the confirmation real — an update filtered out by
      // RLS reports no error and zero rows, which must not count as accepted.
      const { data, error } = await supabase
        .from('businesses')
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description || null } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
          ...(patch.email !== undefined ? { email: patch.email || null } : {}),
          ...(patch.website !== undefined ? { website: patch.website || null } : {}),
          ...(patch.address !== undefined ? { address: patch.address } : {}),
        })
        .eq('id', id)
        .select('id');
      if (error) {
        message = error.message;
      } else if (!data?.length) {
        message =
          "The business wasn't updated — it may have been removed, or your account may not " +
          'have permission to change it.';
      }
    } catch (error) {
      message = error instanceof Error ? error.message : 'Network request failed';
    }

    // Rejected: the local override stays, and it is now the only place the
    // change exists. Say so rather than reporting a save.
    if (message) return { synced: false, reason: 'failed', message };

    // Accepted: the server holds these values now. Move the caches forward and
    // release the override so later web edits of these fields come through.
    const remaining = { ...(edits ?? {})[id] };
    for (const key of Object.keys(patch) as (keyof BusinessPatch)[]) delete remaining[key];
    const next = { ...(edits ?? {}) };
    if (Object.keys(remaining).length) next[id] = remaining;
    else delete next[id];

    if (cachedList) {
      cachedList = cachedList.map((business) =>
        business.id === id ? applyPatch(business, patch) : business,
      );
    }
    if (current?.id === id) {
      current = applyPatch(current, patch);
      await persistCurrent(current);
    }
    await persistEdits(next);
    return { synced: true };
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
