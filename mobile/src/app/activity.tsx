import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Card,
  EmptyState,
  IconTile,
  StatTile,
  type IconName,
  type Tone,
} from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchJobs, fetchMedia } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { fetchGmbData } from '@/lib/gmb';
import { fetchRecentPosts } from '@/lib/publish';
import { DEMO_GMB_PROFILE } from '@/lib/demo-data';
import { jobExtras, visitDuration, type CheckIn, type JobExtras, type JobNote } from '@/lib/job-extras';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchTeam, findTeamMember, type TeamRoster } from '@/lib/team';
import { fetchPresence, presenceErrors, type Presence } from '@/lib/team-presence';
import { tasksStore } from '@/lib/tasks-store';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';
import type { JobTask, MediaCategory } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows the timeline shows at once. */
const MAX_EVENTS = 30;
/** Rows to ask the server for, per activity source. */
const SOURCE_LIMIT = 50;

/** Same labels the job screen's Activity tab prints on a photo row. */
const CATEGORY_LABELS: Record<MediaCategory, string> = {
  before: 'Before',
  after: 'After',
  progress: 'Progress',
  final: 'Final',
};

type Row = Record<string, unknown>;

const text = (row: Row, key: string): string | undefined =>
  typeof row[key] === 'string' && row[key] ? (row[key] as string) : undefined;

/** A check-in, note or task plus the job it belongs to. */
interface JobScoped<T> {
  jobId: string;
  entry: T;
}

/**
 * The three activity sources that have no cross-job fetcher of their own.
 *
 * `unavailable` names the ones the server could not answer for: job_checkins
 * and job_notes belong to a migration that has not been applied everywhere, so
 * a database without them degrades to this device's own rows — and the screen
 * says so — instead of erroring.
 *
 * `scopeError` is the different, louder failure: the tenant filter itself could
 * not be built, so the server rows were never asked for at all. It is the one
 * case where the screen shows an error rather than a quiet footnote, because
 * the only alternative to "this workspace's jobs" is "every workspace's", and
 * that is the leak.
 */
interface ActivityLog {
  checkins: JobScoped<CheckIn>[];
  notes: JobScoped<JobNote>[];
  tasks: JobScoped<JobTask>[];
  unavailable: string[];
  scopeError?: string;
}

/**
 * Completed checklist items across every job.
 *
 * tasks-store.ts has no cross-job reader, and its per-job `getTasks` seeds a
 * fresh checklist (and hits the server) for any job it has not seen — a write,
 * once per job, for what is a read-only timeline. So the map it persists is
 * read directly, the way lib/data.ts reaches into these job-keyed maps when a
 * job is deleted. See the report for the getter that would replace this.
 */
async function storedCompletedTasks(): Promise<JobScoped<JobTask>[]> {
  try {
    const raw = await AsyncStorage.getItem('lsr-job-tasks-v1');
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, JobTask[]>;
    const done: JobScoped<JobTask>[] = [];
    for (const [jobId, tasks] of Object.entries(map ?? {})) {
      if (!Array.isArray(tasks)) continue;
      // `done_at` is what makes a finished task an event. Items ticked before
      // that stamp existed carry no honest time, so they are left out.
      for (const task of tasks) {
        if (task?.done && task.done_at) done.push({ jobId, entry: task });
      }
    }
    return done;
  } catch {
    return [];
  }
}

/**
 * How many of the workspace's jobs can act as the tenant filter here.
 *
 * Deliberately larger than the 50 fetchJobs() lists — the ids are only used as
 * a filter, so a note on a job that has scrolled off the jobs tab still shows
 * up — but bounded, because these ids travel in the request URL as
 * `job_id=in.(…)`. Same number and same reasoning as JOB_SCOPE_LIMIT in
 * lib/data.ts.
 */
const JOB_SCOPE_LIMIT = 150;

/**
 * The tenant filter for job_checkins and job_notes, or the reason there isn't
 * one. A bare `string[]` cannot express this safely: an empty array and "we
 * don't know" would look the same, and treating the second as permission to
 * read everything is exactly the bug this type exists to make unrepresentable.
 */
type LogScope = { ok: true; jobIds: string[] } | { ok: false; reason: string };

/**
 * Ids of the jobs this workspace owns.
 *
 * job_checkins and job_notes carry no business column — job-extras.ts writes
 * job_id, a name and a timestamp and nothing else — so the job is the only link
 * to a tenant that exists. Scoped the way lib/data.ts scopes job_media for the
 * same reason: by `business_id` when a real business is selected, unfiltered for
 * a demo-prefixed one (which owns no server rows of its own, so this stays
 * exactly as broad as the jobs list and no broader).
 *
 * Two refusals, both of which must produce NOTHING rather than everything:
 *  - No current business. workspace.getCurrent() returns null when the
 *    businesses query itself failed, which is a normal-operation path, not a
 *    theoretical one.
 *  - The scope query failed. A failed query is not an empty workspace.
 *
 * Residual gap, stated plainly: a check-in or note on a job outside this
 * workspace's newest JOB_SCOPE_LIMIT is not listed here. It is not hidden — the
 * job's own screen still shows it.
 */
async function workspaceJobIds(): Promise<LogScope> {
  const business = await workspace.getCurrent();
  if (!business) {
    const detail = workspace.lastError();
    return {
      ok: false,
      reason: detail
        ? `Couldn't work out which jobs are yours: ${detail}`
        : "Your business hasn't loaded yet, so team check-ins and notes can't be shown.",
    };
  }
  let query = supabase.from('jobs').select('id');
  // Demo business ids never match a business_id, so they carry no filter — the
  // same exemption fetchJobs() makes.
  if (!business.id.startsWith('demo')) {
    query = query.eq('business_id', business.id);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(JOB_SCOPE_LIMIT);
  if (error) {
    return { ok: false, reason: `Couldn't work out which jobs are yours: ${error.message}` };
  }
  return { ok: true, jobIds: ((data ?? []) as Row[]).map((row) => String(row.id)) };
}

/**
 * Every team member's check-ins and notes for THIS workspace's jobs, from the
 * tables job-extras.ts writes to. Selects '*' rather than naming columns — the
 * same convention lib/data.ts follows — so a table missing the newer columns
 * still answers.
 *
 * `jobIds` is the tenant filter and is not optional: these rows carry crew
 * names and GPS latitude/longitude, so filtering them on the server is the
 * whole point. A row that never leaves the database cannot leak, whereas the
 * render-time jobsById join below would still have pulled every tenant's
 * check-in locations onto this phone first.
 */
async function fetchRemoteLog(jobIds: string[]): Promise<{
  checkins: JobScoped<CheckIn>[];
  notes: JobScoped<JobNote>[];
  unavailable: string[];
}> {
  const checkins: JobScoped<CheckIn>[] = [];
  const notes: JobScoped<JobNote>[] = [];
  const unavailable: string[] = [];

  try {
    const { data, error } = await supabase
      .from('job_checkins')
      .select('*')
      .in('job_id', jobIds)
      .order('checked_in_at', { ascending: false })
      .limit(SOURCE_LIMIT);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Row[]) {
      const jobId = text(row, 'job_id');
      const checkedInAt = text(row, 'checked_in_at');
      if (!jobId || !checkedInAt) continue;
      checkins.push({
        jobId,
        entry: {
          id: `srv-${String(row.id)}`,
          server_id: String(row.id),
          checked_in_at: checkedInAt,
          checked_out_at: text(row, 'checked_out_at'),
          latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
          longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
          user_name: text(row, 'user_name'),
        },
      });
    }
  } catch {
    // No job_checkins table yet (or the query failed): this device's own
    // visits still show, and the feed footnote says the rest is missing.
    unavailable.push('check-ins');
  }

  try {
    const { data, error } = await supabase
      .from('job_notes')
      .select('*')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })
      .limit(SOURCE_LIMIT);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Row[]) {
      const jobId = text(row, 'job_id');
      const createdAt = text(row, 'created_at');
      if (!jobId || !createdAt) continue;
      notes.push({
        jobId,
        entry: {
          id: `srv-${String(row.id)}`,
          server_id: String(row.id),
          text: text(row, 'note') ?? '',
          // Left blank rather than invented — an unattributed note shows no
          // author at all.
          author: text(row, 'author_name') ?? '',
          created_at: createdAt,
        },
      });
    }
  } catch {
    unavailable.push('notes');
  }

  return { checkins, notes, unavailable };
}

/** Local + server check-ins, notes and completed tasks for every job. */
async function fetchActivityLog(): Promise<ActivityLog> {
  const [extras, tasks] = await Promise.all([
    jobExtras.getAll().catch(() => ({}) as Record<string, JobExtras>),
    storedCompletedTasks(),
  ]);
  const checkins: JobScoped<CheckIn>[] = [];
  const notes: JobScoped<JobNote>[] = [];
  for (const [jobId, entry] of Object.entries(extras)) {
    for (const visit of entry.checkins ?? []) checkins.push({ jobId, entry: visit });
    for (const note of entry.notes ?? []) notes.push({ jobId, entry: note });
  }
  if (!isSupabaseConfigured) return { checkins, notes, tasks, unavailable: [] };

  // The server rows are the team's, not this device's, so they are only asked
  // for once there is a tenant filter to ask with. Everything collected above
  // is this device's own record of its own visits and notes, which is yours to
  // see whichever workspace the job belongs to — so it stays either way.
  const scope = await workspaceJobIds();
  if (!scope.ok) {
    return { checkins, notes, tasks, unavailable: [], scopeError: scope.reason };
  }
  // A scoped workspace with no jobs has no check-ins or notes — an answer, not
  // a failure, and an empty `.in()` list would match nothing anyway.
  if (!scope.jobIds.length) return { checkins, notes, tasks, unavailable: [] };

  const remote = await fetchRemoteLog(scope.jobIds);
  // The same identity rules job-extras.ts hydrates with, so a visit this
  // device wrote and later synced is not listed twice.
  const seenVisits = new Set(
    checkins.map(({ jobId, entry }) => `${jobId}|${entry.checked_in_at}`),
  );
  const seenNotes = new Set(
    notes.map(({ jobId, entry }) => `${jobId}|${entry.author}|${entry.text}`),
  );
  for (const visit of remote.checkins) {
    if (!seenVisits.has(`${visit.jobId}|${visit.entry.checked_in_at}`)) checkins.push(visit);
  }
  for (const note of remote.notes) {
    if (!seenNotes.has(`${note.jobId}|${note.entry.author}|${note.entry.text}`)) notes.push(note);
  }
  return { checkins, notes, tasks, unavailable: remote.unavailable };
}

/**
 * job_media.uploaded_by is a user id, not a display name, so it is never
 * rendered raw. findTeamMember (lib/team.ts) is the single copy of that rule,
 * shared with the job screen's Activity tab and the photo viewer — an id it
 * declines to resolve shows no actor at all.
 */
function uploaderResolver(roster?: TeamRoster): (value?: string) => string | undefined {
  return (value?: string) => findTeamMember(value, roster)?.name;
}

/** A name a row recorded for itself, or nothing when it recorded none. */
function actorName(value?: string): string | undefined {
  const name = value?.trim();
  return name ? name : undefined;
}

function valid(iso?: string): boolean {
  return !!iso && !Number.isNaN(new Date(iso).getTime());
}

/**
 * One row of the cross-job timeline. Same shape as the job screen's Activity
 * tab (components/job/job-activity-tab.tsx), plus the job each row belongs to —
 * which is the only thing a cross-job view needs that a per-job one does not.
 */
interface ActivityEvent {
  id: string;
  at: string;
  icon: IconName;
  tone: Tone;
  title: string;
  /** Job name first, then whatever else the row has to say. */
  detail?: string;
  /** Only set when the source really knows who did it. */
  actor?: string;
  onPress?: () => void;
}

export default function ActivityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const [presence, setPresence] = useState<Presence[]>([]);
  // "Nobody is checked in" and "we couldn't work out whose team to ask about"
  // both arrive as an empty list — and the second must never arrive as
  // everyone's list — so this card cannot tell them apart without the channel
  // lib/team-presence.ts publishes. Demo mode never queries anything, so it
  // never raises a reason here and the card keeps its plain empty copy.
  const [presenceError, setPresenceError] = useState<string | null>(() => presenceErrors.get());
  useEffect(() => presenceErrors.subscribe(() => setPresenceError(presenceErrors.get())), []);
  // Bumped by the pull-to-refresh below, so "try again" on that message is a
  // real offer rather than a dead end.
  const [presenceTick, setPresenceTick] = useState(0);
  const refreshPresence = useCallback(() => setPresenceTick((tick) => tick + 1), []);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void fetchPresence(user?.name ?? 'You').then((all) => {
        if (alive) setPresence(all);
      });
    };
    refresh();
    const unsubscribe = jobExtras.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [user?.name, presenceTick]);
  const {
    data: jobs,
    loading: jobsLoading,
    refreshing: jobsRefreshing,
    refresh: refreshJobs,
  } = useData(fetchJobs);
  const { data: media, refresh: refreshMedia } = useData(fetchMedia);
  const { data: posts, refresh: refreshPosts } = useData(fetchRecentPosts);
  const { data: gmb, loading: gmbLoading, refresh: refreshGmb } = useData(fetchGmbData);
  const { data: log, refresh: refreshLog } = useData(fetchActivityLog);
  // Check-ins, notes and tasks all live outside React — re-read the log
  // whenever one of them changes so the timeline is never a stale snapshot.
  useEffect(() => jobExtras.subscribe(refreshLog), [refreshLog]);
  useEffect(() => tasksStore.subscribe(refreshLog), [refreshLog]);

  // The roster is what turns an uploaded_by id into a name. useData only runs
  // its fetcher on mount, and the business arrives a tick later, so refetch
  // when the workspace or the signed-in user changes.
  const { data: roster, refresh: refreshRoster } = useData(() => fetchTeam(business?.id, user));
  useEffect(() => {
    refreshRoster();
  }, [business?.id, user?.id, refreshRoster]);

  const refreshAll = useCallback(() => {
    refreshJobs();
    refreshMedia();
    refreshPosts();
    refreshLog();
    // The profile card is one of the things pulling down is meant to update —
    // a profile connected on the GMB tab should turn up here on a pull.
    refreshGmb();
    // "Team on site" otherwise only re-reads when a check-in changes, so a
    // scope failure shown on that card would survive every pull.
    refreshPresence();
  }, [refreshJobs, refreshMedia, refreshPosts, refreshLog, refreshGmb, refreshPresence]);

  const now = Date.now();

  /**
   * The workspace's jobs, by id.
   *
   * fetchJobs is the one source on this screen the server actually scopes —
   * it filters on business_id (lib/data.ts) — so this map is what every other
   * source has to be checked against.
   */
  const jobsById = useMemo(() => new Map((jobs ?? []).map((job) => [job.id, job])), [jobs]);

  /**
   * Photos and videos, narrowed to the jobs this screen actually lists.
   *
   * The tenant boundary is NOT here. job_media carries no business column, so
   * lib/data.ts scopes fetchMedia on the server through this workspace's job
   * ids — another tenant's file URLs and GPS never reach the device to be
   * filtered in the first place. This check is the second line behind that one,
   * and what it really does is reconcile two different lists: fetchMedia's
   * server scope covers the workspace's newest 150 jobs, while `jobs` here is
   * the newest 50, and fetchMedia also returns this device's own queued uploads
   * even when its scope could not be established. So a row dropped below is
   * almost always one whose job simply isn't in the list this screen loaded —
   * not evidence of a leak.
   *
   * It still earns its keep: every row kept has a job on this screen to name
   * and to open, and rows without one are withheld from the counts and the
   * chart too, not just from the timeline, so no tile ever counts a photo the
   * screen cannot account for.
   */
  const scopedMedia = useMemo(
    () => (media ?? []).filter((item) => jobsById.has(item.job_id)),
    [media, jobsById],
  );
  // How many rows that check dropped. Meaningless until the jobs it checks
  // against have loaded, so it stays at zero until then.
  const withheldMedia = jobsLoading ? 0 : (media?.length ?? 0) - scopedMedia.length;

  const stats = useMemo(() => {
    const allJobs = jobs ?? [];
    const allMedia = scopedMedia;
    const within = (iso: string, days: number) => {
      const time = new Date(iso).getTime();
      return !Number.isNaN(time) && now - time < days * DAY_MS;
    };
    return {
      completed: allJobs.filter((job) => job.status === 'completed').length,
      open: allJobs.filter((job) => ['active', 'in_progress'].includes(job.status)).length,
      photos30: allMedia.filter((item) => within(item.taken_at, 30)).length,
      // Rows of the publish queue, not a count of successful publishes: the
      // web app owns social_media_posts and its status vocabulary (drafts
      // included), and fetchRecentPosts asks for at most ten. The tile's label
      // says "Recent posts" for exactly that reason.
      posts: (posts ?? []).length,
      // Demo mode replays this device's own publish records, where nothing was
      // sent anywhere — the tile has to say so rather than counting them as
      // real posts.
      demoPosts: (posts ?? []).length > 0 && (posts ?? []).every((post) => post.status === 'demo'),
    };
  }, [jobs, scopedMedia, posts, now]);

  // Photos per day, last 7 days — simple bar chart with plain Views.
  const week = useMemo(() => {
    const allMedia = scopedMedia;
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now - i * DAY_MS);
      const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
        day.getDate(),
      ).padStart(2, '0')}`;
      days.push({
        label: day.toLocaleDateString('en-US', { weekday: 'narrow' }),
        count: allMedia.filter((item) => item.taken_at.startsWith(stamp)).length,
      });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, max };
  }, [scopedMedia, now]);

  // The cross-job timeline: the same union the job screen's Activity tab
  // builds (media, check-ins, notes, completed tasks, publishes), across every
  // job instead of one. Each row states who did it only when the underlying
  // record says, and nothing when it does not.
  const feed = useMemo<ActivityEvent[]>(() => {
    const resolveUploader = uploaderResolver(roster);
    // Read inside the memo rather than from the render-scoped `now`, which
    // changes every render and would make this memo pointless.
    const nowMs = Date.now();
    // The job's name leads every detail line — it is what a cross-job row has
    // to say that a per-job one does not.
    const about = (jobTitle: string | undefined, extra?: string) =>
      [jobTitle, extra].filter(Boolean).join(' · ') || undefined;
    const openJob = (jobId: string) => () =>
      router.push({ pathname: '/job/[id]', params: { id: jobId } });
    const events: ActivityEvent[] = [];

    for (const job of jobs ?? []) {
      events.push({
        id: `job-${job.id}`,
        at: job.start_date,
        icon: 'briefcase-outline',
        tone: 'neutral',
        // The start is the only dated fact a job row carries. "Completed" is
        // current state with no timestamp behind it — the old feed dated it
        // with start_date, which was simply wrong. And start_date falls back
        // to a scheduled date (lib/data.ts), so a date still ahead of us is
        // not a start that happened.
        title: new Date(job.start_date).getTime() > nowMs ? 'Job scheduled' : 'Job started',
        detail: about(job.title, job.city || undefined),
        onPress: openJob(job.id),
      });
    }

    // scopedMedia has already been narrowed to jobs in this workspace, so every
    // row below has a job to name and to open.
    for (const item of scopedMedia) {
      // taken_at is always populated; uploaded_at only once the row reaches the
      // server. Never claim both unless both are really there and differ.
      const at = valid(item.uploaded_at) ? item.uploaded_at! : item.taken_at;
      const capturedApart =
        valid(item.captured_at) && valid(item.uploaded_at) && item.captured_at !== item.uploaded_at;
      const kind = item.media_type === 'video' ? 'Video' : 'Photo';
      const jobTitle = jobsById.get(item.job_id)?.title || item.job_title || undefined;
      events.push({
        id: `media-${item.id}`,
        at,
        icon: item.media_type === 'video' ? 'videocam-outline' : 'camera-outline',
        tone: 'primary',
        title: item.pending
          ? `${kind} captured — waiting to upload`
          : `${kind} added · ${CATEGORY_LABELS[item.category] ?? 'Photo'}`,
        detail: about(
          jobTitle,
          capturedApart ? `Captured ${formatDateTime(item.captured_at!)}` : undefined,
        ),
        actor: resolveUploader(item.uploaded_by),
        onPress: openJob(item.job_id),
      });
    }

    // The server-side check-ins and notes were already scoped to this
    // workspace's jobs before they were read (see workspaceJobIds). Completed
    // tasks were not — storedCompletedTasks reads an on-device map keyed by job
    // id, which has no notion of a workspace and can still hold jobs from one
    // this device has since switched away from. So all three are held to the
    // same rule as the photos above: a row is shown only when its job is one
    // this screen loaded, which is also what gives each row a title to print.
    for (const { jobId, entry } of log?.checkins ?? []) {
      const job = jobsById.get(jobId);
      if (!job) continue;
      const openVisit = () =>
        router.push({ pathname: '/visit-detail', params: { jobId, visitId: entry.id } });
      events.push({
        id: `in-${jobId}-${entry.id}`,
        at: entry.checked_in_at,
        icon: 'log-in-outline',
        tone: 'success',
        title: 'Checked in on site',
        detail: about(
          job.title,
          typeof entry.latitude === 'number' ? 'GPS location recorded' : undefined,
        ),
        actor: actorName(entry.user_name),
        onPress: openVisit,
      });
      if (valid(entry.checked_out_at)) {
        events.push({
          id: `out-${jobId}-${entry.id}`,
          at: entry.checked_out_at!,
          icon: 'log-out-outline',
          tone: 'neutral',
          title: 'Checked out',
          detail: about(
            job.title,
            `On site ${visitDuration(entry.checked_in_at, entry.checked_out_at)}`,
          ),
          actor: actorName(entry.user_name),
          onPress: openVisit,
        });
      }
    }

    for (const { jobId, entry } of log?.notes ?? []) {
      const job = jobsById.get(jobId);
      if (!job) continue;
      events.push({
        id: `note-${jobId}-${entry.id}`,
        at: entry.created_at,
        icon: 'chatbubble-ellipses-outline',
        tone: 'warning',
        title: 'Note added',
        detail: about(job.title, entry.text || undefined),
        actor: actorName(entry.author),
        onPress: openJob(jobId),
      });
    }

    for (const { jobId, entry } of log?.tasks ?? []) {
      const job = jobsById.get(jobId);
      if (!job || !valid(entry.done_at)) continue;
      events.push({
        id: `task-${jobId}-${entry.id}`,
        at: entry.done_at!,
        icon: 'checkmark-circle-outline',
        tone: 'success',
        title: 'Checklist item completed',
        detail: about(job.title, entry.label),
        actor: actorName(entry.done_by),
        onPress: openJob(jobId),
      });
    }

    for (const post of posts ?? []) {
      events.push({
        id: `post-${post.id}`,
        at: post.created_at,
        icon: 'megaphone-outline',
        tone: 'primary',
        title: 'Job published',
        // Demo mode replays on-device records: nothing was posted anywhere and
        // the row has to say so. Neither social_media_posts nor those records
        // name who pressed publish, so no actor is shown either.
        detail: about(
          post.title || undefined,
          post.status === 'demo' ? 'Demo — nothing was posted' : undefined,
        ),
      });
    }

    return events.filter((event) => valid(event.at)).sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [jobs, jobsById, scopedMedia, posts, log, roster, router]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  // Only ever a score this business really has. gmb_profiles is missing until
  // a profile is connected, and useData has nothing at all on the first render
  // — a number invented for either case reads as real Google profile health.
  // Demo mode has no database to ask, so it shows the sample profile's score
  // and says on the card that that is what it is.
  const sampleScore = gmb?.mode === 'demo';
  const score =
    gmb?.mode === 'connected'
      ? gmb.profile.overall_score
      : sampleScore
        ? DEMO_GMB_PROFILE.score
        : null;
  const scoreColor =
    score === null
      ? colors.textMuted
      : score >= 80
        ? colors.success
        : score >= 60
          ? colors.warning
          : colors.danger;
  // Demo mode is the only place presence stands people up: fetchPresence
  // simulates nobody once Supabase is configured, and every local check-in it
  // returns is your own.
  const simulatedPresence = !isSupabaseConfigured;
  const shown = feed.slice(0, MAX_EVENTS);
  // Set only when the team's check-ins and notes were never read, because there
  // was no tenant filter to read them with. Distinct from `log.unavailable`,
  // which is the milder "this database doesn't have those tables yet".
  const scopeError = log?.scopeError ?? null;

  return (
    <Screen refreshing={jobsRefreshing} onRefresh={refreshAll}>
      <DetailHeader title="Activity" />

      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <StatTile value={String(stats.open)} label="Open jobs" tone="primary" />
        <StatTile value={String(stats.completed)} label="Completed" tone="success" />
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <StatTile value={String(stats.photos30)} label="Photos (30d)" />
        <StatTile
          value={String(stats.posts)}
          label={stats.demoPosts ? 'Demo posts' : 'Recent posts'}
          tone="warning"
        />
      </View>

      <Section title="Team on site">
        {presence.length === 0 ? (
          <Card style={{ gap: 4 }}>
            {/* Only claim an empty site when the site was actually asked
                about. With no scope, fetchPresence never read the server at
                all, and "nobody is checked in" would be a guess stated as a
                fact about the crew. */}
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
              {presenceError
                ? `${presenceError} Pull down to try again.`
                : 'Nobody is checked in right now. Check-ins from the job screen appear here live.'}
            </Text>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {presence.map((entry, index) => {
              const job = (jobs ?? []).find((candidate) => candidate.id === entry.jobId);
              return (
                <Pressable
                  key={`${entry.name}-${entry.jobId}`}
                  onPress={() =>
                    router.push({ pathname: '/job/[id]', params: { id: entry.jobId } })
                  }
                  style={({ pressed }) => [
                    styles.presenceRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <View style={[styles.presenceDot, { backgroundColor: colors.success }]} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {entry.isYou ? 'You' : entry.name}
                      </Text>
                      {/* Demo mode simulates who else is on site (see
                          lib/team-presence.ts) — say so on the row rather than
                          letting a sample name read as a colleague. */}
                      {simulatedPresence && !entry.isYou ? (
                        <Badge label="Sample" tone="warning" />
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                      {job?.title ?? 'Job'}
                      {job?.city ? ` · ${job.city}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.success }}>
                    {visitDuration(entry.since)}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </Card>
        )}
        {/* A reason alongside rows means the server list was skipped and every
            name above is this device's own check-in: the rest of the crew could
            be on site without appearing here. */}
        {presenceError && presence.length > 0 ? (
          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            {`${presenceError} Only check-ins recorded on this device are shown.`}
          </Text>
        ) : null}
        {/* The roster is what puts names to the ids on this screen. While it is
            the sample one, say why — these are not colleagues. */}
        {roster?.isDemo && roster.demoReason ? (
          <Text style={[styles.footnote, { color: colors.textMuted }]}>{roster.demoReason}</Text>
        ) : null}
      </Section>

      <Section title="Photos this week">
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.chart}>
            {week.days.map((day, index) => (
              <View key={index} style={styles.barColumn}>
                <Text style={{ fontSize: 10.5, color: colors.textSecondary }}>
                  {day.count > 0 ? day.count : ''}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (day.count / week.max) * 72),
                      backgroundColor: day.count > 0 ? colors.primary : colors.cardPressed,
                    },
                  ]}
                />
                <Text style={{ fontSize: 10.5, color: colors.textMuted }}>{day.label}</Text>
              </View>
            ))}
          </View>
        </Card>
        {/* The counts and the chart only include photos whose job is on this
            screen's list — the tenant scoping itself already happened on the
            server (see scopedMedia). Say so when that check actually held rows
            back, so a short bar is never read as "no photos were taken". */}
        {withheldMedia > 0 ? (
          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            {`Counting photos on this workspace's jobs only — ${withheldMedia} ${
              withheldMedia === 1 ? 'photo belongs' : 'photos belong'
            } to jobs that aren't in this workspace's job list.`}
          </Text>
        ) : null}
      </Section>

      <Section title="GMB profile score">
        {score === null ? (
          // Nothing to score: the profile lookup has not answered yet, it
          // failed, or this workspace has no gmb_profiles row. Each says so
          // plainly rather than filling the card with a number.
          !gmb ? (
            <Card>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {gmbLoading
                  ? 'Checking your Google Business Profile…'
                  : "Couldn't check your Google Business Profile just now. Pull down to try again."}
              </Text>
            </Card>
          ) : (
            <Card onPress={() => router.push('/gmb')}>
              <View style={styles.scoreEmptyRow}>
                <IconTile icon="storefront-outline" tone="neutral" size={34} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }}>
                    No profile connected
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    Connect your Google Business Profile on the GMB tab to see its score here.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </View>
            </Card>
          )
        ) : (
          <>
            <Card style={{ gap: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: scoreColor }}>{score}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>/ 100</Text>
                {/* Demo mode's score belongs to the sample profile, not to this
                    business — mark it on the number itself. */}
                {sampleScore ? <Badge label="Sample" tone="warning" /> : null}
              </View>
              <View style={[styles.scoreTrack, { backgroundColor: colors.cardPressed }]}>
                <View
                  style={[
                    styles.scoreFill,
                    { backgroundColor: scoreColor, width: `${Math.min(100, Math.max(0, score))}%` },
                  ]}
                />
              </View>
            </Card>
            {sampleScore ? (
              <Text style={[styles.footnote, { color: colors.textMuted }]}>
                {`Sample score for ${DEMO_GMB_PROFILE.name} — connect Supabase and your Google Business Profile to see your own.`}
              </Text>
            ) : null}
          </>
        )}
      </Section>

      <Section title="Recent activity">
        {/* The scope failed, so the team's rows were deliberately not read.
            Said as an error rather than a footnote: the timeline below is
            missing everything the rest of the crew did, which is a different
            thing from a quiet week. */}
        {scopeError ? (
          <Card style={{ gap: 4 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }}>
              Team check-ins and notes aren&apos;t shown
            </Text>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>
              {`${scopeError} Pull down to try again — until then this shows only what this device recorded.`}
            </Text>
          </Card>
        ) : null}
        {feed.length === 0 ? (
          // "No activity yet" is a claim about the whole team, so it is only
          // made when the whole team was actually asked about. With the scope
          // unknown the card above already says why, and this would be a
          // second, false statement on top of it.
          scopeError ? null : (
            <EmptyState
              icon="time-outline"
              title="No activity yet"
              message="Photos, check-ins, notes, completed tasks and publishes show up here as your team works."
            />
          )
        ) : (
          <Card style={{ padding: 0 }}>
            {shown.map((event, index) => {
              const body = (
                <>
                  <IconTile icon={event.icon} tone={event.tone} size={30} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }}>
                      {event.title}
                    </Text>
                    {event.detail ? (
                      <Text
                        style={{ fontSize: 12.5, color: colors.textSecondary }}
                        numberOfLines={3}>
                        {event.detail}
                      </Text>
                    ) : null}
                    {/* Actor first, then when — and the actor half is simply
                        absent when the record does not name anyone. */}
                    <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                      {event.actor ? `${event.actor} · ` : ''}
                      {formatDateTime(event.at)}
                    </Text>
                  </View>
                  {event.onPress ? (
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  ) : null}
                </>
              );
              const rowStyle = [
                styles.feedRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ];
              // Publish rows have no job to open (social_media_posts does not
              // reference one), so they are plain rows rather than dead taps.
              return event.onPress ? (
                <Pressable
                  key={event.id}
                  onPress={event.onPress}
                  style={({ pressed }) => [
                    ...rowStyle,
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  {body}
                </Pressable>
              ) : (
                <View key={event.id} style={rowStyle}>
                  {body}
                </View>
              );
            })}
          </Card>
        )}
        {feed.length > shown.length ? (
          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            Showing the {MAX_EVENTS} most recent of {feed.length} events.
          </Text>
        ) : null}
        {/* Sources the database could not answer for. Said plainly so nobody
            reads a short timeline as "nothing happened". */}
        {log?.unavailable.length ? (
          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            {`Team ${log.unavailable.join(' and ')} aren't available on this database yet — showing what this device recorded.`}
          </Text>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    height: 110,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    borderRadius: Radius.sm,
  },
  scoreEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreTrack: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  footnote: {
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: Spacing.xs,
  },
});
