/**
 * Client CRUD. Connected: writes through to the `clients` table
 * best-effort. Always: keeps a local overrides layer (created / edited /
 * deleted) that fetchClients applies, so changes work offline and in demo
 * mode.
 *
 * EVERY server write here is stamped with, or filtered by, the current
 * business — the same rule fetchClients reads under (lib/clients.ts) and
 * createJob writes under (lib/data.ts).
 *
 * On the write side that rule cuts two ways:
 *
 * - An INSERT with no business_id is an orphan: fetchClients filters on
 *   `business_id = <current>`, so a row without one belongs to nobody's list.
 *   The client shows up on the phone that typed it (the local override is
 *   doing that work) and nowhere else — not on the web dashboard, not on the
 *   crew's other phone, and not on this phone after a reinstall clears the
 *   override. So when there is no real business to stamp, nothing is written:
 *   the record stays in the overrides layer, which is exactly what that layer
 *   is for, and `syncPendingCreates` files it the moment a business is known.
 * - An UPDATE or DELETE addressed by id alone trusts that the id came from a
 *   scoped read. It normally did — but not in the sample workspace, where
 *   fetchClients reads `clients` unfiltered, so the id on screen can be a row
 *   this user does not own. Both carry a `business_id` predicate as well, and
 *   both decline to touch the server at all when the current business is
 *   unknown or is the sample stand-in.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';
import type { ClientRecord } from '@/lib/types';

const STORAGE_KEY = 'lsr-client-edits-v1';

export interface ClientPatch {
  /**
   * The job<->client join key. Jobs store a client NAME string, not an id
   * (see fetchClientJobs in lib/clients.ts, which matches on
   * job.client_name === client.name), so changing this on an existing client
   * detaches every job they have. Callers editing an existing client should
   * leave it undefined; only creation sets it.
   */
  name?: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
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

/**
 * The business id every server write below is stamped with or filtered by, or
 * null when there isn't one to use.
 *
 * Null covers three cases that all mean the same thing to a write — there is no
 * business this row can honestly be filed under:
 *
 *   - Supabase isn't configured (demo mode): there is no server at all.
 *   - `getCurrent()` returned null, which is what it does when the businesses
 *     query itself failed. Not a theoretical path.
 *   - The id is the `demo`-prefixed sample workspace workspace.getBusinesses()
 *     stands in with when the businesses table comes back empty. It matches no
 *     business_id, so stamping it would be a foreign key to nothing.
 *
 * The demo-prefix test is the one createJob makes in lib/data.ts. createJob
 * still inserts an unstamped job in that case; this module does not insert an
 * unstamped client, because a client row's only path back to a device is the
 * business filter (a job at least reaches its own screen by id).
 */
async function writableBusinessId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const business = await workspace.getCurrent();
  if (!business || business.id.startsWith('demo')) return null;
  return business.id;
}

/**
 * Does this id name a row on the server?
 *
 * `local-client-…` ids are minted by create() below for a record that has not
 * been inserted yet; `client-…` ids are derived from a name by
 * derivedClientId() in lib/clients.ts for clients that exist only as a name on
 * a job. Neither addresses a `clients` row, so neither may be sent to Postgres.
 */
function isServerId(id: string): boolean {
  return !id.startsWith('local-') && !id.startsWith('client-');
}

/** Move a created record (and any edits filed against it) onto its server id. */
function remapCreatedId(overrides: ClientOverrides, from: string, to: string): ClientOverrides {
  const edited = { ...overrides.edited };
  if (edited[from]) {
    edited[to] = { ...edited[to], ...edited[from] };
    delete edited[from];
  }
  return {
    created: overrides.created.map((client) =>
      client.id === from ? { ...client, id: to } : client,
    ),
    edited,
    deleted: overrides.deleted.map((id) => (id === from ? to : id)),
  };
}

/**
 * In-flight sync, so two screens mounting at once don't insert the same client
 * twice. Concurrent callers await the same pass; the next one starts clean.
 */
let syncing: Promise<void> | null = null;

/**
 * Server ids we have already tried to claim this session (see below). Bounds
 * the repair to one attempt per row per launch instead of one per read.
 */
const claimAttempted = new Set<string>();

/**
 * File the clients this device is still holding on its own.
 *
 * Two kinds, both created by this device and both invisible to every other one:
 *
 *   - PENDING: a create() that ran with no business to stamp, so it was never
 *     inserted. It still carries its `local-client-…` id. Inserted here, with
 *     any edits made since folded in, and then re-idded so the copy in
 *     `created` and the row now on the server are the same record —
 *     applyOverrides dedupes on id, so without the remap the client would list
 *     twice.
 *   - ORPHANED: a create() from before this module stamped business_id at all.
 *     The insert succeeded, so the id is real, but the row has business_id
 *     NULL and no workspace's scoped read will ever return it. Claimed with
 *     `.is('business_id', null)`, which is what keeps this a repair and not a
 *     land grab: a row that already belongs to someone is left exactly alone.
 *
 * Never throws — a failure here must not turn a client list into an error, and
 * whatever didn't go through is simply still pending on the next read.
 */
async function syncPendingCreates(): Promise<void> {
  try {
    const overrides = await load();
    const deleted = new Set(overrides.deleted);
    // Deleted-before-it-synced: don't insert a row purely to delete it.
    const live = overrides.created.filter((client) => !deleted.has(client.id));
    const pending = live.filter((client) => !isServerId(client.id));
    const orphaned = live.filter(
      (client) => isServerId(client.id) && !claimAttempted.has(client.id),
    );
    if (!pending.length && !orphaned.length) return;

    const businessId = await writableBusinessId();
    // Still nowhere to file them. They keep waiting — that is the whole point.
    if (!businessId) return;

    for (const record of pending) {
      const current = await load();
      // Edits made while it was local-only were never sent anywhere either.
      const patch = current.edited[record.id];
      const merged = patch ? { ...record, ...patch } : record;
      const { data } = await supabase
        .from('clients')
        .insert({
          business_id: businessId,
          // `name` verbatim, as everywhere else: it is the string jobs join on.
          name: merged.name,
          first_name: merged.first_name || null,
          last_name: merged.last_name || null,
          business_name: merged.business_name || null,
          phone: merged.phone || null,
          email: merged.email || null,
        })
        .select('id')
        .single();
      if (!data?.id) continue; // Left pending; retried on the next read.
      const serverId = String(data.id);
      // We just stamped it, so the orphan pass has nothing to ask about.
      claimAttempted.add(serverId);
      await persist(remapCreatedId(await load(), record.id, serverId));
    }

    for (const record of orphaned) {
      // Marked before the attempt: a row we cannot claim is not worth asking
      // about on every list refresh for the rest of the session.
      claimAttempted.add(record.id);
      await supabase
        .from('clients')
        .update({ business_id: businessId })
        .eq('id', record.id)
        .is('business_id', null);
    }
  } catch {
    // Best effort. Anything unfinished stays in the overrides layer, which is
    // still what the screens are rendering, and is tried again on the next read.
  }
}

export const clientsStore = {
  /** Apply local creates/edits/deletes over a fetched list. */
  async applyOverrides(clients: ClientRecord[]): Promise<ClientRecord[]> {
    // Every client read in the app ends up here, which makes it the one place a
    // create that had no business to file under can notice that it now does.
    // Cheap when there is nothing waiting: syncPendingCreates reads the cached
    // overrides, finds no pending or unclaimed record, and returns without
    // touching the network. Demo mode never gets this far.
    if (isSupabaseConfigured) {
      syncing =
        syncing ??
        syncPendingCreates().finally(() => {
          syncing = null;
        });
      await syncing;
    }
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
      first_name: input.first_name?.trim() || undefined,
      last_name: input.last_name?.trim() || undefined,
      business_name: input.business_name?.trim() || undefined,
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      jobs_count: 0,
      last_job_at: '',
    };
    // Stamped with the current business, the way createJob stamps a job in
    // lib/data.ts. Without it the row is filtered out of every scoped read
    // including this device's own, so the client the user just typed exists
    // only in the overrides layer below and dies with it.
    const businessId = await writableBusinessId();
    if (businessId) {
      try {
        const { data } = await supabase
          .from('clients')
          .insert({
            business_id: businessId,
            name: record.name,
            first_name: record.first_name || null,
            last_name: record.last_name || null,
            business_name: record.business_name || null,
            phone: record.phone || null,
            email: record.email || null,
          })
          .select('id')
          .single();
        if (data?.id) {
          record.id = String(data.id);
          // Stamped on the way in, so the orphan pass never asks about it.
          claimAttempted.add(record.id);
        }
      } catch {
        // Kept locally under its local- id; syncPendingCreates retries it.
      }
    }
    // No business, or the insert didn't land: the record keeps its local- id
    // and lives in `created` until syncPendingCreates can file it. The caller
    // gets a real record either way, so the screen it navigates to resolves.
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
    // Defence in depth. The id normally arrives from a business-scoped
    // fetchClients, so it is already ours — except in the sample workspace,
    // where that read runs unfiltered and the row on screen may belong to
    // someone else entirely. The predicate makes that case a no-op instead of
    // an edit to another tenant's customer, and costs nothing in the normal one.
    const businessId = isServerId(id) ? await writableBusinessId() : null;
    if (businessId) {
      try {
        await supabase
          .from('clients')
          .update({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.first_name !== undefined ? { first_name: patch.first_name || null } : {}),
            ...(patch.last_name !== undefined ? { last_name: patch.last_name || null } : {}),
            ...(patch.business_name !== undefined
              ? { business_name: patch.business_name || null }
              : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
            ...(patch.email !== undefined ? { email: patch.email || null } : {}),
          })
          .eq('id', id)
          .eq('business_id', businessId);
      } catch {
        // Local override still applies.
      }
    }
    // Not written when the business is unknown or is the sample stand-in: the
    // override above is then the only copy, which is the same position an
    // offline edit is in and the same one the pre-fix code left every create in.
  },

  async remove(id: string): Promise<void> {
    const overrides = await load();
    await persist({ ...overrides, deleted: [...overrides.deleted, id] });
    // Scoped for the same reason update is — a delete addressed by id alone is
    // the one write where getting the wrong tenant's row is unrecoverable. The
    // client is hidden on this device by the override regardless.
    const businessId = isServerId(id) ? await writableBusinessId() : null;
    if (businessId) {
      try {
        await supabase.from('clients').delete().eq('id', id).eq('business_id', businessId);
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
