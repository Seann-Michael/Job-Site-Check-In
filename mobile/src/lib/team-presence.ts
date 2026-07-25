/**
 * Who's on which job site right now — built on the check-in data.
 * Your own presence comes from jobExtras check-ins on this device; in demo
 * mode a couple of teammates are simulated so the feature is visible.
 * Real-time teammate presence syncs via Supabase in a later milestone.
 */

import React from 'react';

import { jobExtras } from '@/lib/job-extras';
import { isSupabaseConfigured } from '@/lib/supabase';

export const TEAM_NAMES = ['Alex Morgan', 'Jordan Reyes', 'Casey Nguyen'];

export interface Presence {
  jobId: string;
  name: string;
  /** ISO timestamp the person went on site. */
  since: string;
  isYou: boolean;
}

// Demo teammates "on site" today (stable within the app session).
const sessionStart = Date.now();
const DEMO_PRESENCE: Omit<Presence, 'since'>[] = [
  { jobId: 'job-2', name: 'Jordan Reyes', isYou: false },
  { jobId: 'job-4', name: 'Casey Nguyen', isYou: false },
];

function demoPresence(): Presence[] {
  if (isSupabaseConfigured) return [];
  return DEMO_PRESENCE.map((entry, index) => ({
    ...entry,
    since: new Date(sessionStart - (47 + index * 63) * 60_000).toISOString(),
  }));
}

/** Everyone currently checked in, you first. */
export async function fetchPresence(userName: string): Promise<Presence[]> {
  const mine: Presence[] = [];
  const map = await jobExtras.getAll();
  for (const [jobId, extras] of Object.entries(map)) {
    const active = extras.checkins.find((visit) => !visit.checked_out_at);
    if (active) {
      mine.push({ jobId, name: userName, since: active.checked_in_at, isYou: true });
    }
  }
  return [...mine, ...demoPresence()];
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
