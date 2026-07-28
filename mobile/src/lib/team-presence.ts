/**
 * Who's on which job site right now — built on the check-in data.
 * Your own presence comes from jobExtras check-ins on this device; in demo
 * mode a couple of teammates are simulated so the feature is visible.
 * Real-time teammate presence syncs via Supabase in a later milestone.
 *
 * TENANT SCOPING: `job_checkins` carries no business_id (see job-extras.ts,
 * which inserts job_id / user_name / checked_in_at / lat / lng and nothing
 * else), so presence cannot be filtered by business directly. The only link
 * that exists today is the job: a check-in belongs to whoever owns its job.
 * So the check-in query is restricted to the ids of the jobs in the current
 * workspace, scoped exactly the way fetchJobs() in lib/data.ts scopes the jobs
 * list. Without that filter this card listed people checked in at OTHER
 * companies as your team. See `workspaceJobIds` for the residual gaps.
 *
 * When that scope cannot be established — no current business, or the scope
 * query failed — the answer is NOTHING, never everything: the server list is
 * skipped entirely and only this device's own check-ins remain. So that the
 * card can say so instead of looking mysteriously empty, the reason is
 * published on `presenceErrors`.
 */

import React from 'react';

import { jobExtras } from '@/lib/job-extras';
import { jobsStore } from '@/lib/jobs-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { DEMO_TEAM } from '@/lib/team';
import { workspace } from '@/lib/workspace';

export interface Presence {
  jobId: string;
  name: string;
  /** ISO timestamp the person went on site. */
  since: string;
  isYou: boolean;
}

/**
 * Why the team list is empty, when it is empty for a reason.
 *
 * "Nobody is checked in" and "we could not work out whose team to ask about"
 * both come back as an empty list — the second must never come back as
 * everyone's list — so without this channel the card looks identically calm in
 * both cases. Same idiom as `dataErrors` in lib/data.ts and
 * `workspace.lastError()`: a screen reads `presenceErrors.get()` and
 * re-renders from `presenceErrors.subscribe(...)`.
 *
 * Written only by fetchPresence, and only when Supabase is configured: demo
 * mode never queries anything, so it can never raise a phantom failure here.
 * Every connected read either records a reason or clears it, so a stale
 * message cannot outlive a working refetch. A caller that ignores this still
 * behaves — it just shows an empty list with no reason attached.
 */
let presenceError: string | null = null;
const errorListeners = new Set<() => void>();

function setPresenceError(next: string | null): void {
  if (presenceError === next) return;
  presenceError = next;
  errorListeners.forEach((listener) => listener());
}

export const presenceErrors = {
  /** Why the last presence read showed nobody, or null when it succeeded. */
  get(): string | null {
    return presenceError;
  },

  /** Called whenever that reason appears or clears. Returns unsubscribe. */
  subscribe(listener: () => void): () => void {
    errorListeners.add(listener);
    return () => {
      errorListeners.delete(listener);
    };
  },
};

// Demo teammates "on site" today (stable within the app session). The people
// come from the shared sample roster in lib/team.ts — this file only decides
// which of them is standing on which job.
const sessionStart = Date.now();
const DEMO_ON_SITE: { jobId: string; memberId: string }[] = [
  { jobId: 'job-2', memberId: 'demo-member-2' },
  { jobId: 'job-4', memberId: 'demo-member-3' },
];

async function demoPresence(): Promise<Presence[]> {
  if (isSupabaseConfigured) return [];
  // A deleted demo job is gone everywhere else (fetchJobs, fetchMedia), so a
  // teammate must not still be standing on it. The seeds are a static array,
  // so the tombstone list is the only record that the job was removed.
  const deletedIds = await jobsStore.getDeletedIds();
  return DEMO_ON_SITE.flatMap(({ jobId, memberId }, index) => {
    if (deletedIds.has(jobId)) return [];
    const member = DEMO_TEAM.find((entry) => entry.id === memberId);
    // Roster changed out from under us: show nobody rather than a placeholder.
    if (!member) return [];
    return [
      {
        jobId,
        name: member.name,
        since: new Date(sessionStart - (47 + index * 63) * 60_000).toISOString(),
        isYou: false,
      },
    ];
  });
}

/**
 * How many of the workspace's jobs presence can cover. Deliberately larger
 * than the 50 fetchJobs() lists: a crew can be standing on a job that has
 * scrolled off the jobs tab, and the ids are only used as a filter.
 */
const JOB_SCOPE_LIMIT = 200;

/**
 * The tenant filter for presence: either the ids of the jobs in the current
 * workspace, or the reason there is no such list.
 *
 * A plain `string[]` cannot express this safely — an empty array and "we don't
 * know" look the same, and every past version of this bug was some caller
 * treating the second as permission to read everything. The union makes that
 * unrepresentable: `jobIds` only exists on the success branch, so a caller must
 * pass through `ok` to get a filter at all, and the failure branch carries a
 * sentence the screen can show instead of an unexplained empty card.
 */
type JobScope = { ok: true; jobIds: string[] } | { ok: false; reason: string };

/**
 * Ids of the jobs in the current workspace — the tenant filter for presence.
 *
 * Scoped the same way fetchJobs() in lib/data.ts scopes the jobs list: by
 * `business_id` when a real business is selected, unfiltered for a demo-
 * prefixed business (which has no rows of its own).
 *
 * Two ways this refuses, both of which must produce NOTHING rather than
 * everything:
 *  - No current business. `workspace.getCurrent()` returns null when the
 *    businesses list itself could not be read (getBusinesses() answers [] on a
 *    failed load), not when the account is empty. Leaving the filter off in
 *    that case — which is what "business && …" used to do — asks the server
 *    for every tenant's job ids, and the card then lists people checked in at
 *    OTHER COMPANIES as your team. Same refusal fetchClients() makes.
 *  - The scope query failed. A failed query is not an empty workspace.
 *
 * Residual gaps, stated honestly:
 *  - A check-in on a job outside the newest JOB_SCOPE_LIMIT jobs is not shown.
 *  - When the selected business is the demo placeholder, this is as scoped as
 *    the jobs list itself is — i.e. only as far as the database's own row
 *    security goes. Presence is never broader than what the jobs tab shows.
 */
async function workspaceJobIds(): Promise<JobScope> {
  const business = await workspace.getCurrent();
  if (!business) {
    const detail = workspace.lastError();
    return {
      ok: false,
      reason: detail
        ? `Can't tell who's on site: couldn't load your workspace (${detail}).`
        : "Can't tell who's on site until a business is selected.",
    };
  }
  let query = supabase.from('jobs').select('id');
  // Demo business ids never reach the server, so they carry no filter — the
  // same exemption fetchJobs() and fetchClients() make.
  if (!business.id.startsWith('demo')) {
    query = query.eq('business_id', business.id);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(JOB_SCOPE_LIMIT);
  // A failed scope query is not an empty workspace — refuse rather than
  // fall back to an unscoped presence read.
  if (error) {
    return { ok: false, reason: `Can't tell who's on site: ${error.message}` };
  }
  return {
    ok: true,
    jobIds: ((data ?? []) as { id: unknown }[]).map((row) => String(row.id)),
  };
}

interface CheckinRow {
  job_id: unknown;
  user_name?: string | null;
  checked_in_at: unknown;
}

/**
 * Demo mode, or a connected read that could not be scoped or failed. Every
 * entry here is this device's own visit, so it is yours to see whichever
 * workspace the job belongs to — no other company's people can reach this
 * list, which is why it is still safe to show when the scope is unknown.
 */
async function localPresence(userName: string): Promise<Presence[]> {
  const mine: Presence[] = [];
  const map = await jobExtras.getAll();
  for (const [jobId, extras] of Object.entries(map)) {
    const active = extras.checkins.find((visit) => !visit.checked_out_at);
    if (active) {
      mine.push({ jobId, name: userName, since: active.checked_in_at, isYou: true });
    }
  }
  return [...mine, ...(await demoPresence())];
}

/** Everyone currently checked in, you first. */
export async function fetchPresence(userName: string): Promise<Presence[]> {
  // Connected: real presence — every open check-in on THIS workspace's jobs.
  if (isSupabaseConfigured) {
    try {
      const scope = await workspaceJobIds();
      // No scope: nothing on the server may be shown as your team, because
      // "everyone" is the only alternative to "this workspace" and that is the
      // leak. Say why, then show this device's own check-ins and nothing else.
      if (!scope.ok) {
        setPresenceError(scope.reason);
        return await localPresence(userName);
      }
      const { jobIds } = scope;
      // A scoped workspace with no jobs has nobody on site — and an empty
      // `.in()` list would be a query with nothing to match anyway.
      let rows: CheckinRow[] = [];
      if (jobIds.length) {
        const { data, error } = await supabase
          .from('job_checkins')
          .select('job_id, user_name, checked_in_at')
          .in('job_id', jobIds)
          .is('checked_out_at', null)
          .order('checked_in_at', { ascending: true });
        if (error) {
          setPresenceError(`Couldn't load who's on site: ${error.message}`);
          return await localPresence(userName);
        }
        rows = (data ?? []) as CheckinRow[];
      }
      // Read succeeded (an empty workspace included): clear any stale reason.
      setPresenceError(null);
      const fromServer: Presence[] = rows.map((row) => ({
        jobId: String(row.job_id),
        name: String(row.user_name ?? 'Team member'),
        since: String(row.checked_in_at),
        isYou: row.user_name === userName,
      }));
      // Include your own open check-ins whose insert hasn't synced yet, so
      // the job screen and the presence list never disagree. Held to the
      // same job scope: jobExtras is keyed by job id with no notion of
      // workspace, so an unsynced visit belonging to another workspace
      // would otherwise reappear here after switching businesses.
      const inScope = new Set(jobIds);
      const map = await jobExtras.getAll();
      const seen = new Set(fromServer.map((entry) => `${entry.jobId}:${entry.since}`));
      for (const [jobId, extras] of Object.entries(map)) {
        if (!inScope.has(jobId)) continue;
        const active = extras.checkins.find((visit) => !visit.checked_out_at && !visit.server_id);
        if (active && !seen.has(`${jobId}:${active.checked_in_at}`)) {
          fromServer.push({ jobId, name: userName, since: active.checked_in_at, isYou: true });
        }
      }
      return fromServer.sort((a, b) => Number(b.isYou) - Number(a.isYou));
    } catch (error) {
      // Thrown, not returned — still a failed read, never a reason to widen.
      const detail = error instanceof Error ? error.message : 'the request failed';
      setPresenceError(`Couldn't load who's on site: ${detail}`);
    }
  }
  return await localPresence(userName);
}

/** Live "who's on site" for one job (subscribes to check-in changes). */
export function useJobPresence(jobId: string, userName: string): Presence[] {
  const [presence, setPresence] = React.useState<Presence[]>([]);
  React.useEffect(() => {
    let alive = true;
    const refresh = () => {
      void fetchPresence(userName).then((all) => {
        if (alive) setPresence(all.filter((entry) => entry.jobId === jobId));
      });
    };
    refresh();
    const unsubscribe = jobExtras.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [jobId, userName]);
  return presence;
}
