/**
 * The team roster — the one place the app answers "who works at this
 * business?".
 *
 * Before this module every caller rolled its own answer: Settings > Team ran an
 * unscoped `users` query (every user in the whole project, regardless of
 * business), while the company feed, the @-mention list and the presence
 * simulation shared a hardcoded three-name array. `fetchTeam` replaces both,
 * and the sample roster lives here exactly once (`DEMO_TEAM`).
 *
 * Scoping, honestly: this schema has no user->business link table. The only
 * relationship that exists today is `businesses.owner_id`, so that is what the
 * query leans on, plus a `metadata.business_id` tag on the user row (the
 * convention the web admin describes in client/pages/BusinessDetail.tsx) and a
 * `users.business_id` column if one ever lands. Each is feature-detected, so a
 * database without any of them degrades to the sample roster rather than
 * erroring.
 *
 * IMPORTANT: `auth.users` is empty in this project — nobody has ever signed in.
 * The real query therefore returns nothing today and every caller gets the
 * sample roster. That is why the result carries `isDemo`/`demoReason`: any UI
 * that assigns work to a person MUST say the names are samples instead of
 * implying real teammates exist.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/** Postgres "column does not exist" — how a missing column reaches the client. */
const MISSING_COLUMN = '42703';

type Row = Record<string, unknown>;

export interface TeamMember {
  id: string;
  /** Always populated: the row's name, its first/last pair, or the email prefix. */
  name: string;
  email?: string;
  /** Human label ('Owner', 'Staff') when the row carries a role, else undefined. */
  role?: string;
  /** 1–2 letters for avatar fallbacks, derived from `name`. */
  initials: string;
  /** `users.avatar_url` when set. Sample members have none. */
  avatarUrl?: string;
  /** True for the signed-in user's own entry, which sorts first. */
  isYou: boolean;
}

export type TeamSource = 'remote' | 'demo';

export interface TeamRoster {
  members: TeamMember[];
  source: TeamSource;
  /** True when `members` is the sample roster rather than real teammates. */
  isDemo: boolean;
  /** Plain-English reason the roster is sampled; null when it is real. */
  demoReason: string | null;
  /** Message from a failed roster query, else null. */
  error: string | null;
}

/**
 * The signed-in user, so their own entry is real even when the rest is sampled.
 * Shaped to accept an `AuthUser` from the auth provider directly.
 */
export interface TeamSelf {
  id: string;
  name: string;
  email?: string;
  /** True for the built-in demo account; such a user is never a real member. */
  isDemo?: boolean;
}

/**
 * The sample roster — the single copy in the app. Entry one deliberately shares
 * the demo account's id and email (see providers/auth-provider.tsx) so that the
 * signed-in demo user merges into it instead of appearing twice.
 *
 * Used directly only by lib/team-presence.ts, which names the simulated on-site
 * teammates from it. Everything else should call `fetchTeam` and read `isDemo`.
 */
export const DEMO_TEAM: readonly TeamMember[] = [
  {
    id: 'demo-user',
    name: 'Alex Morgan',
    email: 'demo@localseoranker.com',
    role: 'Owner',
    initials: 'AM',
    isYou: false,
  },
  {
    id: 'demo-member-2',
    name: 'Jordan Reyes',
    email: 'jordan@westsidehs.com',
    role: 'Field tech',
    initials: 'JR',
    isYou: false,
  },
  {
    id: 'demo-member-3',
    name: 'Casey Nguyen',
    email: 'casey@westsidehs.com',
    role: 'Office',
    initials: 'CN',
    isYou: false,
  },
];

/**
 * Turn a reference a row recorded about a person — a `job_media.uploaded_by`
 * user id, an email, or a name — into the roster entry it belongs to.
 *
 * Every screen that shows "who did this" goes through here, so they agree.
 * Two rules, both of them about not inventing people:
 *
 *   1. An id is never rendered raw. A caller that gets `undefined` shows no
 *      actor at all rather than a UUID.
 *   2. In a SAMPLED roster (`isDemo`) only the signed-in user's own entry can
 *      match. The rest of that list is fiction, and matching against fiction
 *      would credit a photo to somebody who does not exist. The `isYou` entry
 *      is real even when the rest is sampled — see `withSelf`.
 *
 * Callers format the name themselves; `member.isYou` is what tells them to.
 */
export function findTeamMember(
  reference: string | undefined,
  roster: TeamRoster | null | undefined,
): TeamMember | undefined {
  const raw = reference?.trim();
  if (!raw || !roster) return undefined;
  const eligible = roster.isDemo ? roster.members.filter((member) => member.isYou) : roster.members;
  const key = raw.toLowerCase();
  return eligible.find(
    (member) =>
      member.id === raw ||
      member.email?.toLowerCase() === key ||
      member.name.toLowerCase() === key,
  );
}

/** Trimmed string, or undefined for null/blank/non-string values. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Team lookup failed';
}

/** Same rule the Avatar component uses, so initials and avatars agree. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Admin',
  agency_admin: 'Agency admin',
  business_owner: 'Owner',
  staff: 'Staff',
  viewer: 'Viewer',
};

/** `users.role` is an enum; show a label, and pass anything unknown through. */
function roleLabel(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  return ROLE_LABELS[raw] ?? raw.replace(/_/g, ' ');
}

function toMember(row: Row): TeamMember {
  const email = text(row.email);
  const composed = [text(row.first_name), text(row.last_name)].filter(Boolean).join(' ');
  const name = text(row.name) ?? (composed || email?.split('@')[0]) ?? 'Team member';
  return {
    id: String(row.id),
    name,
    email,
    role: roleLabel(row.role),
    initials: initialsOf(name),
    avatarUrl: text(row.avatar_url),
    isYou: false,
  };
}

/**
 * Session-cached probe for a `users.business_id` column: null = not tried yet,
 * false = the column is absent (today's schema), true = scoped query works.
 * Cached so a database without the column is not re-probed on every read.
 */
let usersAreBusinessScoped: boolean | null = null;

async function fetchOwnerId(businessId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .limit(1);
    if (error || !data?.length) return null;
    return text((data[0] as Row).owner_id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Every user row that can be tied to this business, by whichever links the
 * database actually has. `error` is only reported when nothing was found —
 * one failing strategy must not hide the members another one found.
 */
async function fetchMemberRows(businessId: string): Promise<{ rows: Row[]; error: string | null }> {
  const rows = new Map<string, Row>();
  let lastError: string | null = null;

  // 1. users.business_id — not in today's schema, so a missing column (42703)
  //    disables this strategy for the rest of the session.
  if (usersAreBusinessScoped !== false) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('business_id', businessId)
        .limit(50);
      if (error) {
        if (error.code === MISSING_COLUMN) usersAreBusinessScoped = false;
        else lastError = error.message;
      } else {
        usersAreBusinessScoped = true;
        for (const row of (data ?? []) as Row[]) rows.set(String(row.id), row);
      }
    } catch (error) {
      lastError = messageOf(error);
    }
  }

  // 2. Users tagged with the business inside their `metadata` blob.
  if (usersAreBusinessScoped === false) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('metadata->>business_id', businessId)
        .limit(50);
      if (error) {
        if (error.code !== MISSING_COLUMN) lastError = error.message;
      } else {
        for (const row of (data ?? []) as Row[]) rows.set(String(row.id), row);
      }
    } catch (error) {
      lastError = messageOf(error);
    }
  }

  // 3. The owner — the one link present in every version of this schema.
  const ownerId = await fetchOwnerId(businessId);
  if (ownerId && !rows.has(ownerId)) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', ownerId).limit(1);
      if (error) lastError = error.message;
      else for (const row of (data ?? []) as Row[]) rows.set(String(row.id), row);
    } catch (error) {
      lastError = messageOf(error);
    }
  }

  return { rows: [...rows.values()], error: rows.size ? null : lastError };
}

function sameEmail(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Puts the signed-in user in the list as themselves. They are matched to an
 * existing entry by id or email so they are never listed twice, and their
 * current profile name wins over whatever the row (or the sample) says.
 */
function withSelf(members: readonly TeamMember[], self: TeamSelf | null | undefined): TeamMember[] {
  if (!self) return [...members];
  const isMe = (member: TeamMember) => member.id === self.id || sameEmail(member.email, self.email);
  const existing = members.find(isMe);
  const mine: TeamMember = {
    ...existing,
    id: self.id,
    name: self.name,
    email: self.email ?? existing?.email,
    initials: initialsOf(self.name),
    isYou: true,
  };
  return [mine, ...members.filter((member) => !isMe(member))];
}

/** You first, then alphabetical — the order every roster UI wants. */
function sortMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) => Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name),
  );
}

function demoRoster(
  demoReason: string,
  error: string | null,
  self: TeamSelf | null | undefined,
): TeamRoster {
  return {
    members: sortMembers(withSelf(DEMO_TEAM, self)),
    source: 'demo',
    isDemo: true,
    demoReason,
    error,
  };
}

/**
 * The roster for one business.
 *
 * Never rejects and never returns an empty list: when there is nothing real to
 * show it falls back to `DEMO_TEAM` with `isDemo: true` and a `demoReason` to
 * put on screen. Callers that let a user assign work to a member must surface
 * that reason — the names are samples, not colleagues who will be notified.
 *
 * @param businessId current business id (`useWorkspace().business?.id`).
 *   Missing or `demo`-prefixed ids skip the network entirely.
 * @param self the signed-in user (`useAuth().user`), so their own entry is real
 *   and marked `isYou`. A demo account is only merged into a demo roster.
 */
export async function fetchTeam(
  businessId?: string | null,
  self?: TeamSelf | null,
): Promise<TeamRoster> {
  if (!isSupabaseConfigured) {
    return demoRoster('Demo mode — connect Supabase to load your real team.', null, self);
  }
  if (!businessId || businessId.startsWith('demo')) {
    return demoRoster('This is the sample workspace, so these are sample teammates.', null, self);
  }

  const { rows, error } = await fetchMemberRows(businessId);
  if (error) {
    return demoRoster("Couldn't load your team, so these are sample teammates.", error, self);
  }
  if (!rows.length) {
    return demoRoster(
      'No one has signed in to this workspace yet, so these are sample teammates.',
      null,
      self,
    );
  }

  return {
    members: sortMembers(withSelf(rows.map(toMember), self?.isDemo ? null : self)),
    source: 'remote',
    isDemo: false,
    demoReason: null,
    error: null,
  };
}
