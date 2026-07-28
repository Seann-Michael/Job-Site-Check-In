/**
 * Clients CRM — reads the same `clients` table as the web Clients page, scoped
 * to the active business the way fetchJobs is, with job counts derived from the
 * jobs list. Demo mode derives clients from the demo jobs.
 *
 * Jobs join to clients on the NAME STRING (see fetchClientJobs), so `name` is
 * read verbatim off the row and is never recomputed, normalised or substituted.
 */

import { clientsStore } from '@/lib/clients-store';
import { fetchJobs } from '@/lib/data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';
import type { ClientRecord, Job } from '@/lib/types';

type Row = Record<string, unknown>;
const str = (row: Row, key: string): string => (typeof row[key] === 'string' ? (row[key] as string) : '');

type Contact = { phone: string; email: string };

/**
 * Contact details for the demo jobs' clients. DEMO DATA ONLY — passed to
 * `deriveFromJobs` on the unconfigured path and nowhere else. A real workspace
 * that happens to have a job for a "Sarah Mitchell" must not be handed this
 * phone number: an invented contact is worse than a blank one, because the
 * blank one tells the user to go and fill it in.
 */
const DEMO_CONTACTS: Record<string, Contact> = {
  'Sarah Mitchell': { phone: '(440) 555-0142', email: 'sarah.mitchell@email.com' },
  'Tom Rivera': { phone: '(440) 555-0186', email: 'tom.rivera@email.com' },
  'Linda Okafor': { phone: '(440) 555-0168', email: 'linda.okafor@email.com' },
  'Greenfield HOA': { phone: '(216) 555-0195', email: 'board@greenfieldhoa.org' },
  'Mike Donnelly': { phone: '(440) 555-0121', email: 'mike.donnelly@email.com' },
  'Priya Shah': { phone: '(216) 555-0133', email: 'priya.shah@email.com' },
};

/**
 * When a client has no row of their own — demo mode, or a workspace whose
 * `clients` table holds nothing for this business yet — they are derived from
 * the jobs that name them, so their id is a function of the name. Renaming a
 * client therefore changes their id, which is why the rename path has to
 * navigate to the new one instead of going back to a URL that no longer
 * resolves.
 */
export function derivedClientId(name: string): string {
  return `client-${name.toLowerCase().replace(/[^a-z]/g, '-')}`;
}

/**
 * Build the client list from the jobs that name them. `contacts` is looked up
 * by name and defaults to empty: only the demo path has contact details to
 * supply, so a derived client in a real workspace comes back with blank phone
 * and email rather than a demo person's.
 */
function deriveFromJobs(jobs: Job[], contacts: Record<string, Contact> = {}): ClientRecord[] {
  const byName = new Map<string, ClientRecord>();
  for (const job of jobs) {
    const name = job.client_name;
    if (!name || name === 'Unknown client') continue;
    const existing = byName.get(name);
    if (existing) {
      existing.jobs_count += 1;
      if (job.start_date > existing.last_job_at) existing.last_job_at = job.start_date;
    } else {
      const contact = contacts[name] ?? { phone: '', email: '' };
      byName.set(name, {
        id: derivedClientId(name),
        name,
        phone: contact.phone,
        email: contact.email,
        jobs_count: 1,
        last_job_at: job.start_date,
      });
    }
  }
  return [...byName.values()].sort((a, b) => (a.last_job_at < b.last_job_at ? 1 : -1));
}

/**
 * The client list for the active business.
 *
 * Three outcomes that used to be one, kept apart here because they mean
 * completely different things to the person reading the screen — the same
 * distinction fetchJobs draws in lib/data.ts:
 *
 * - Supabase not configured, or the read succeeded and this business has no
 *   `clients` rows yet → derive the list from the jobs that name a client.
 *   That is the app's normal presentation ("Clients appear here as you create
 *   jobs for them"), and it is built from rows we really did read.
 * - The read FAILED → no server clients at all. Deriving from jobs here would
 *   show a guess that is pixel-identical to a working read: invented-looking
 *   contact fields, counts that are not the server's, and no way for the user
 *   to tell. Local creates/edits still apply, because those are records this
 *   device genuinely holds.
 *
 * (There is no `dataErrors` slot for clients — that union lives in data.ts —
 * so a failed read currently shows an empty list without a reason. Empty and
 * silent, never fabricated.)
 */
export async function fetchClients(): Promise<ClientRecord[]> {
  const jobs = await fetchJobs();

  if (!isSupabaseConfigured) {
    return clientsStore.applyOverrides(deriveFromJobs(jobs, DEMO_CONTACTS));
  }

  // Scope to the active business, exactly as fetchJobs does. Without this the
  // list is every tenant's customers — it has only ever looked correct because
  // today's database holds a single company. `clients.business_id` exists on
  // the current schema (W0/08 backfills company_id *from* it), so this needs no
  // migration; rows that predate scoping have it NULL and are not claimed by
  // anyone's list.
  const business = await workspace.getCurrent();
  if (!business) {
    // Null means the businesses list itself failed to load, so there is no id
    // to scope to. An unscoped read is precisely the leak this filter exists to
    // prevent, and a jobs-derived stand-in would be a guess — do neither.
    // workspace.lastError() holds the reason.
    return clientsStore.applyOverrides([]);
  }

  // Demo business ids never reach the server, so they carry no filter — the
  // same exemption fetchJobs/createJob make (see workspace.ts).
  let query = supabase.from('clients').select('*');
  if (!business.id.startsWith('demo')) query = query.eq('business_id', business.id);
  const { data, error } = await query.limit(100);

  // A failed query is not an empty address book.
  if (error) return clientsStore.applyOverrides([]);
  if (!data?.length) return clientsStore.applyOverrides(deriveFromJobs(jobs));

  const mapped: ClientRecord[] = (data as Row[]).map((row) => {
    // `name` stays exactly as it was: every screen reads it and it is the key
    // that matches a client to Job.client_name. first/last/business_name are
    // extra columns on the row — carried alongside, never instead of `name`.
    const name = str(row, 'name') || str(row, 'full_name') || 'Client';
    const clientJobs = jobs.filter(
      (job) => job.client_name.toLowerCase() === name.toLowerCase(),
    );
    return {
      id: String(row.id),
      name,
      first_name: str(row, 'first_name') || undefined,
      last_name: str(row, 'last_name') || undefined,
      business_name: str(row, 'business_name') || undefined,
      phone: str(row, 'phone') || str(row, 'mobile_phone'),
      email: str(row, 'email'),
      jobs_count: clientJobs.length,
      last_job_at: clientJobs[0]?.start_date ?? str(row, 'created_at'),
    };
  });
  return clientsStore.applyOverrides(mapped);
}

/**
 * The label to show for a client, so screens stop hand-rolling it.
 *
 * Precedence: person name (`first_name last_name`) → `name` → `business_name`
 * → 'Client'. The person wins because `business_name` is a *different* fact,
 * not a better version of the same one — screens show the company on its own
 * line next to the person, and preferring it here would print the company
 * twice and hide who to actually ask for on site. `name` sits in the middle as
 * the always-populated fallback; `business_name` only surfaces as a label for
 * a company row that has nothing else.
 */
export function clientDisplayName(client: ClientRecord): string {
  const person = [client.first_name, client.last_name]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
  return person || client.name.trim() || client.business_name?.trim() || 'Client';
}

/**
 * Which of a client's names the typed text matched.
 *
 * Only `'name'` is the join key. A `'person'` or `'business'` match means the
 * typed text lines up with a *different* field on the record, so adopting that
 * client rewrites what the user typed into `client.name` — say so in the UI
 * rather than swapping it silently.
 */
export type ClientNameField = 'name' | 'person' | 'business';

export interface ClientMatch {
  client: ClientRecord;
  /**
   * `'exact'` — the typed text and the matched name are the same once case and
   * stray whitespace are ignored. `'fuzzy'` — a near miss worth offering as
   * "did you mean…?", never worth acting on without the user saying yes.
   *
   * Read it together with `field`: the only combination that can be adopted
   * without asking is `confidence === 'exact' && field === 'name'`, because
   * that is the one case where using `client.name` keeps the string the user
   * typed. An exact match on `'person'` or `'business'` still swaps the stored
   * client name for a different one, so it needs a confirmation like a fuzzy
   * hit does.
   */
  confidence: 'exact' | 'fuzzy';
  field: ClientNameField;
  /** The string on the record that matched, as stored — ready to render. */
  matched: string;
}

/**
 * The comparison key for "is this the same client?".
 *
 * Lowercased, trimmed, internal whitespace collapsed — because those are the
 * differences that actually fork clients in the field: "Bob Smith", "Bob  Smith"
 * and "bob smith" are three separate clients today, since jobs join to clients
 * on the NAME STRING (see fetchClientJobs).
 *
 * This is a comparison key ONLY. It is never stored, never rendered, and never
 * substituted for `name` — the join key stays exactly the characters the record
 * holds.
 */
function clientNameKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Fuzzy-only key: `clientNameKey` plus the punctuation people are inconsistent
 * about ("Greenfield H.O.A." / "Smith, Bob" / "O'Brien"). Deliberately never
 * used to decide an exact match — dropping characters can only ever produce a
 * suggestion the user has to accept, not a silent data change.
 */
function looseKey(value: string): string {
  return clientNameKey(value)
    .replace(/[.,'`´’‘"“”()[\]{}<>!?;:#*+\\\/|&_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenKey(value: string): string {
  return looseKey(value).split(' ').filter(Boolean).sort().join(' ');
}

/** The names a client can be recognised by, best (the join key) first. */
function nameCandidates(client: ClientRecord): { field: ClientNameField; value: string }[] {
  const out: { field: ClientNameField; value: string }[] = [];
  const seen = new Set<string>();
  const push = (field: ClientNameField, raw?: string) => {
    const value = raw?.trim();
    if (!value) return;
    const key = clientNameKey(value);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ field, value });
  };
  push('name', client.name);
  push(
    'person',
    [client.first_name, client.last_name]
      .map((part) => part?.trim() ?? '')
      .filter(Boolean)
      .join(' '),
  );
  push('business', client.business_name);
  return out;
}

/** Lower rank = closer match. -1 means no match at all. */
function rank(candidate: string, typedKey: string, typedLoose: string, typedTokens: string): number {
  const key = clientNameKey(candidate);
  if (key === typedKey) return 0;
  if (typedKey.length < 2) return -1; // one character matches half the address book
  if (!typedLoose) return -1; // typed text was punctuation only — "" is inside every name
  const loose = looseKey(candidate);
  if (loose && loose === typedLoose) return 1;
  if (typedTokens && tokenKey(candidate) === typedTokens) return 2; // "Smith, Bob" vs "Bob Smith"
  if (loose.startsWith(typedLoose)) return 3;
  if (loose.includes(typedLoose)) return 4;
  if (loose.length >= 3 && typedLoose.includes(loose)) return 5; // "Bob Smith Plumbing" typed over "Bob Smith"
  return -1;
}

const FIELD_ORDER: Record<ClientNameField, number> = { name: 0, person: 1, business: 2 };

/**
 * Existing-client detection for the new-job form: does what the user typed
 * already name a client on file?
 *
 * Pure and synchronous by design. `fetchClients` internally calls `fetchJobs`,
 * so the caller fetches the list ONCE (`useData(fetchClients)`) and runs this on
 * every keystroke against the array it already has — no query per character.
 * `clients` accepts null/undefined so `useData`'s `data` can be passed straight
 * through while it is still loading.
 *
 *   const { data: clients } = useData(fetchClients);
 *   const matches = matchClients(clients, typedName);
 *   const exact = matches.find((m) => m.confidence === 'exact')?.client;
 *   const suggestions = matches.filter((m) => m.confidence === 'fuzzy');
 *
 * Results are one per client, exact first, then closest fuzzy; ties keep the
 * incoming order, which `fetchClients` has already sorted by most recent job.
 * More than one exact is possible (two records can share a normalised name), so
 * read the first and treat the rest as duplicates to surface, not to merge.
 *
 * Nothing here changes how a job joins to a client: the string to store is
 * always `match.client.name`, untouched.
 */
export function matchClients(
  clients: ClientRecord[] | null | undefined,
  typed: string,
  limit = 5,
): ClientMatch[] {
  const typedKey = clientNameKey(typed);
  if (!typedKey || !clients?.length || limit < 1) return [];
  const typedLoose = looseKey(typed);
  const typedTokens = tokenKey(typed);

  const scored: { match: ClientMatch; rank: number }[] = [];
  for (const client of clients) {
    let best: { match: ClientMatch; rank: number } | null = null;
    for (const candidate of nameCandidates(client)) {
      const score = rank(candidate.value, typedKey, typedLoose, typedTokens);
      if (score < 0) continue;
      if (best && best.rank <= score) continue; // first candidate wins ties: `name` before person/business
      best = {
        rank: score,
        match: {
          client,
          confidence: score === 0 ? 'exact' : 'fuzzy',
          field: candidate.field,
          matched: candidate.value,
        },
      };
    }
    if (best) scored.push(best);
  }

  return scored
    .sort((a, b) => a.rank - b.rank || FIELD_ORDER[a.match.field] - FIELD_ORDER[b.match.field])
    .slice(0, limit)
    .map((entry) => entry.match);
}

export async function fetchClient(id: string): Promise<ClientRecord | undefined> {
  const clients = await fetchClients();
  return clients.find((client) => client.id === id);
}

export async function fetchClientJobs(clientName: string): Promise<Job[]> {
  const jobs = await fetchJobs();
  return jobs.filter((job) => job.client_name.toLowerCase() === clientName.toLowerCase());
}
