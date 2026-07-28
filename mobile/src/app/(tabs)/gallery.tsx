/**
 * Feed — the cross-job view of everything the crew produced.
 *
 * Five nested tabs (Gallery, Tasks, Check Lists, Jobs, Published Jobs) with the
 * gallery as the default. `Segmented` has no horizontal scroll and five labels
 * do not fit one row at 13pt, so the strip below is a local scrollable pill row
 * rather than a shortened `Segmented` — the component lives in
 * components/ui/basics.tsx, which this change does not own.
 *
 * Three things this screen has to be honest about:
 *
 * 1. SCOPE. `fetchMedia` has no business filter (jobs do) and caps at 100 rows,
 *    so on its own "Company" would mean "the first 100 rows of job_media".
 *    Every item is therefore joined to the business-scoped job list and an item
 *    whose job isn't in it is held back and counted, not silently shown. When
 *    the job read itself failed there is nothing to join against, so nothing is
 *    hidden and the screen says the scope is unverified.
 *
 * 2. ATTRIBUTION. "Mine" needs job_media.uploaded_by, which the migration has
 *    not added yet — but the capture pipeline already writes the same id into
 *    metadata.uploaded_by, and data.ts reads either. So photos this build
 *    uploaded are attributable today; everything older (and everything uploaded
 *    from the web app) carries no uploader and can only appear under Company.
 *    That count is shown rather than guessed at.
 *
 * 3. RECENCY. The only timestamp a media row carries is when it was taken
 *    (`taken_at`, which data.ts fills from captured_at and falls back to the
 *    upload time). Comments are device-local, so they would not reflect
 *    teammates — sorting by "latest comment" would be a lie on a shared job.
 *    "Newest" therefore means capture time, and says so on screen.
 *
 * 4. ASSIGNMENT. The Tasks tab filters on the checklist item's own assignee
 *    (lib/tasks-store.ts records one per task), not on who the job belongs to.
 *    Those records are device-local, so the tab only knows about jobs whose
 *    checklist has been read here — which is what it says.
 *
 * The legacy `/feed` URL redirects in with `view=company`; that param is read
 * below and lands on the company-wide photo grid.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JobCard } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { SearchBar } from '@/components/search-bar';
import { Badge, Button, Card, EmptyState, IconTile, Segmented } from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dataErrors, fetchJobs, fetchMedia } from '@/lib/data';
import { formatDate, formatDateTime } from '@/lib/format';
import { getUploader, snapshotUploader } from '@/lib/identity';
import { jobMeta } from '@/lib/job-meta';
import { mediaStore } from '@/lib/media-store';
import { DESTINATION_LABELS, getPublishRecord, type PublishRecord } from '@/lib/publish';
import { isSupabaseConfigured } from '@/lib/supabase';
import { tasksStore, type StoredJobTask } from '@/lib/tasks-store';
import { uploadQueue } from '@/lib/upload-queue';
import { workspace } from '@/lib/workspace';
import { useData } from '@/hooks/use-data';
import { useJobsRefresh } from '@/hooks/use-jobs-refresh';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAuth } from '@/providers/auth-provider';
import type { Job, MediaItem } from '@/lib/types';

type FeedTab = 'gallery' | 'tasks' | 'lists' | 'jobs' | 'published';

const TABS: { value: FeedTab; label: string }[] = [
  { value: 'gallery', label: 'Gallery' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'lists', label: 'Check Lists' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'published', label: 'Published Jobs' },
];

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
];

const SCOPES = [
  { value: 'company', label: 'Company Feed' },
  { value: 'mine', label: 'My Stuff' },
];

const TASK_SCOPES = [
  { value: 'all', label: 'All tasks' },
  { value: 'mine', label: 'Assigned to me' },
];

/**
 * tasksStore is keyed by job id with no bulk read, and seeds a job's checklist
 * the first time it is asked for — so a cross-job list costs one call (and,
 * when connected, one query) per job. Bounded to the most recent jobs, and the
 * bound is stated on screen rather than quietly truncating.
 */
const CHECKLIST_JOB_LIMIT = 20;
const JOBS_TAB_PREVIEW = 5;

/** Local 'YYYY-MM-DD', to compare against a task's date-only due date. */
function todayKey(): string {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/** One media item, joined to its job so it can be searched and attributed. */
interface FeedEntry {
  item: MediaItem;
  /** From the job row — job_media has no job_title column, so real rows arrive blank. */
  jobTitle: string;
  clientName: string;
  /** Uploaded by the signed-in account (or, in demo mode, captured on this device). */
  mine: boolean;
  /** Whether anything at all records who produced it. */
  attributed: boolean;
  haystack: string;
}

interface FeedData {
  jobs: Job[];
  entries: FeedEntry[];
  /** Items held back because their job isn't in this workspace's job list. */
  offScope: number;
  /** False when the job read failed, i.e. nothing to join against. */
  scopeVerified: boolean;
  /** Whether we know which account this device is signed in as. */
  myIdKnown: boolean;
  /** In-scope items with no uploader on record — Company-only, forever. */
  unattributed: number;
}

async function loadFeed(): Promise<FeedData> {
  const [media, jobs, queued, captured] = await Promise.all([
    fetchMedia(),
    fetchJobs(),
    uploadQueue.getAll(),
    mediaStore.getCaptured(),
  ]);
  // Disk first (no network). Only reach for the live session when this device
  // has never recorded one — otherwise every feed load would wait on auth.
  let uploader = await getUploader();
  if (isSupabaseConfigured && !uploader) {
    uploader = await snapshotUploader().catch(() => null);
  }
  const myId = uploader?.id;

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  // A jobs query that succeeded is authoritative even when it returns nothing:
  // a workspace with no jobs can own no photos. A failed one tells us nothing.
  const scopeVerified = isSupabaseConfigured && !dataErrors.get('jobs');
  const queuedById = new Map(queued.map((item) => [item.id, item]));
  const capturedIds = new Set(captured.map((item) => item.id));

  const entries: FeedEntry[] = [];
  let offScope = 0;
  for (const item of media) {
    const job = jobsById.get(item.job_id);
    // Queued items are this device's own captures — they belong here whether or
    // not the job list has caught up with a just-created job.
    if (!job && scopeVerified && !item.pending) {
      offScope += 1;
      continue;
    }
    const uploadedBy = item.uploaded_by ?? queuedById.get(item.id)?.uploaded_by;
    const deviceCapture = capturedIds.has(item.id);
    const jobTitle = job?.title || item.job_title || '';
    const clientName = job?.client_name ?? '';
    entries.push({
      item,
      jobTitle,
      clientName,
      mine: uploadedBy ? uploadedBy === myId : deviceCapture,
      attributed: Boolean(uploadedBy) || deviceCapture,
      haystack: [
        jobTitle,
        clientName,
        job?.city ?? '',
        job?.address ?? '',
        item.category,
        ...(item.tags ?? []),
      ]
        .join(' ')
        .toLowerCase(),
    });
  }

  return {
    jobs,
    entries,
    offScope,
    scopeVerified,
    myIdKnown: Boolean(myId) || !isSupabaseConfigured,
    unattributed: entries.filter((entry) => !entry.attributed).length,
  };
}

interface JobChecklist {
  job: Job;
  /**
   * The stored shape, not the bare `JobTask`: assignment (assignee, who handed
   * it over, due date) lives on the stored task and the Tasks tab filters on it.
   */
  tasks: StoredJobTask[];
}

async function loadChecklists(jobs: Job[]): Promise<JobChecklist[]> {
  const meta = await jobMeta.getAll();
  const targets = jobs
    .filter((job) => job.status !== 'cancelled' && !meta[job.id]?.archived)
    .slice(0, CHECKLIST_JOB_LIMIT);
  return Promise.all(
    targets.map(async (job) => {
      let tasks: StoredJobTask[] = [];
      try {
        tasks = await tasksStore.getTasks(job.id);
      } catch {
        // One unreachable checklist must not empty the whole list.
      }
      return { job, tasks };
    }),
  );
}

interface PublishedEntry {
  job: Job;
  record: PublishRecord;
}

async function loadPublished(jobs: Job[]): Promise<PublishedEntry[]> {
  const found = await Promise.all(
    jobs.map(async (job) => {
      try {
        const record = await getPublishRecord(job.id);
        return record ? { job, record } : null;
      } catch {
        return null;
      }
    }),
  );
  return found
    .filter((entry): entry is PublishedEntry => entry !== null)
    .sort((a, b) => Date.parse(b.record.published_at) - Date.parse(a.record.published_at));
}

/** Scrollable tab strip: five labels never fit a fixed-width Segmented. */
function TabStrip({
  value,
  onChange,
}: {
  value: FeedTab;
  onChange: (value: FeedTab) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.xs, paddingRight: Spacing.lg }}>
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border,
              },
              pressed && !selected && { backgroundColor: colors.cardPressed },
            ]}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: selected ? colors.onPrimary : colors.textSecondary,
              }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A read failure, shown above the content it could not load — never instead of it. */
function ErrorBanner({
  message,
  busy,
  onRetry,
}: {
  message: string;
  busy: boolean;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
      }}>
      <IconTile icon="cloud-offline-outline" tone="danger" size={32} />
      <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 }}>
        {message}
      </Text>
      <Button label="Try again" variant="secondary" icon="refresh" loading={busy} onPress={onRetry} />
    </Card>
  );
}

export default function GalleryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { business } = useWorkspace();
  const { data: feed, loading, refreshing, refresh } = useData(loadFeed);
  useMediaRefresh(refresh);
  useJobsRefresh(refresh);
  // The feed is scoped to the active business, so switching workspaces re-reads.
  useEffect(() => workspace.subscribe(refresh), [refresh]);

  // Tells "nothing captured yet" apart from "the query failed" (empty either way).
  const [mediaError, setMediaError] = useState<string | null>(() => dataErrors.get('media'));
  const [jobsError, setJobsError] = useState<string | null>(() => dataErrors.get('jobs'));
  useEffect(
    () =>
      dataErrors.subscribe(() => {
        setMediaError(dataErrors.get('media'));
        setJobsError(dataErrors.get('jobs'));
      }),
    [],
  );

  const [tab, setTab] = useState<FeedTab>('gallery');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('company');
  // The company-wide photo grid: gallery tab, company scope. One place, so the
  // header button and the /feed deep link cannot drift apart.
  const showCompany = useCallback(() => {
    setTab('gallery');
    setScope('company');
  }, []);

  // `/feed` (a bookmarkable URL on web, a deep link on native) redirects here
  // with view=company. Reacting to the param rather than only seeding state
  // matters: this tab is usually already mounted, so it may be sitting on
  // "Mine" or on another sub-tab when the link is opened.
  const { view } = useLocalSearchParams<{ view?: string }>();
  useEffect(() => {
    if (view === 'company') showCompany();
  }, [view, showCompany]);

  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState<'recent' | 'type'>('recent');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const jobs = feed?.jobs;
  const entries = useMemo(() => feed?.entries ?? [], [feed]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.item.media_type !== typeFilter) return false;
      if (scope === 'mine' && !entry.mine) return false;
      // One index, built from the media→jobs join: tag, project and customer.
      if (q && !entry.haystack.includes(q)) return false;
      return true;
    });
    const takenAt = (entry: FeedEntry) => Date.parse(entry.item.taken_at) || 0;
    return matched.sort((a, b) => {
      if (sort === 'type' && a.item.media_type !== b.item.media_type) {
        return a.item.media_type === 'image' ? -1 : 1;
      }
      return takenAt(b) - takenAt(a);
    });
  }, [entries, query, scope, typeFilter, sort]);

  // job_media carries no job title, so the real title comes from the join —
  // without it the viewer's caption reads "Job photo" on every uploaded row.
  const viewerItems = useMemo(
    () => visible.map((entry) => ({ ...entry.item, job_title: entry.jobTitle })),
    [visible],
  );
  const rows = useMemo(() => chunk(viewerItems, 3), [viewerItems]);

  // ---- Tasks + Check Lists (same per-job checklist, two readings of it) ----
  const [checklists, setChecklists] = useState<JobChecklist[] | null>(null);
  const [checklistsLoading, setChecklistsLoading] = useState(false);
  const [taskScope, setTaskScope] = useState('all');
  const needsChecklists = tab === 'tasks' || tab === 'lists';

  useEffect(() => {
    if (!needsChecklists || !jobs) return;
    let cancelled = false;
    setChecklistsLoading(true);
    loadChecklists(jobs)
      .then((result) => {
        if (!cancelled) setChecklists(result);
      })
      .catch(() => {
        if (!cancelled) setChecklists([]);
      })
      .finally(() => {
        if (!cancelled) setChecklistsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsChecklists, jobs]);

  const toggleTask = useCallback(
    async (jobId: string, taskId: string) => {
      const next = await tasksStore.toggle(jobId, taskId, user?.name);
      // Patch in place: reloading would re-read every job's checklist (and, when
      // connected, re-query each one) on every tick of a checkbox.
      setChecklists((prev) =>
        prev ? prev.map((entry) => (entry.job.id === jobId ? { ...entry, tasks: next } : entry)) : prev,
      );
    },
    [user?.name],
  );

  // Assignment is per task and identified by account id — the same id
  // Settings › Checklists writes. Comparing names would hand a task to anyone
  // who shares a first name, and an unassigned task must never match anybody.
  const assignedToMe = useCallback(
    (task: StoredJobTask) => Boolean(task.assignee_id) && task.assignee_id === user?.id,
    [user?.id],
  );

  const openTasks = useMemo(() => {
    const lists = checklists ?? [];
    return lists
      .flatMap((entry) => entry.tasks.filter((task) => !task.done).map((task) => ({ entry, task })))
      .filter(({ task }) => taskScope !== 'mine' || assignedToMe(task))
      // Dated work first, soonest first; undated keeps its checklist order after.
      .sort((a, b) => (a.task.due_date ?? '~').localeCompare(b.task.due_date ?? '~'));
  }, [checklists, taskScope, assignedToMe]);

  // ---- Published jobs ----
  const [published, setPublished] = useState<PublishedEntry[] | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);
  useEffect(() => {
    if (tab !== 'published' || !jobs) return;
    let cancelled = false;
    setPublishedLoading(true);
    loadPublished(jobs)
      .then((result) => {
        if (!cancelled) setPublished(result);
      })
      .catch(() => {
        if (!cancelled) setPublished([]);
      })
      .finally(() => {
        if (!cancelled) setPublishedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, jobs]);

  const openJob = (jobId: string) =>
    router.push({ pathname: '/job/[id]', params: { id: jobId } });

  const muted = { color: colors.textMuted, fontSize: 12, lineHeight: 17 };

  // The count describes what is actually on screen. When the read behind a tab
  // failed, a "0" would assert an emptiness we can no longer vouch for.
  const subtitle = (): string | undefined => {
    if (tab === 'gallery') {
      return mediaError && visible.length === 0 ? undefined : `${visible.length} items`;
    }
    if (jobsError) return undefined;
    if (tab === 'tasks') return checklists ? `${openTasks.length} open` : undefined;
    if (tab === 'lists') return checklists ? `${checklists.length} checklists` : undefined;
    if (tab === 'jobs') return jobs ? `${jobs.length} jobs` : undefined;
    return published ? `${published.length} published` : undefined;
  };

  const scopeNote = (): string | null => {
    if (scope !== 'mine') return null;
    if (!isSupabaseConfigured) {
      return 'Demo mode — “Mine” means photos captured on this device. The sample photos record no uploader, so they stay under Company.';
    }
    if (!feed?.myIdKnown) {
      return 'This device has no signed-in account on record, so no photo can be matched to you — everything stays under Company.';
    }
    const orphans = feed?.unattributed ?? 0;
    if (orphans === 0) return '“Mine” matches photos uploaded from your account.';
    return `“Mine” matches photos uploaded from your account. ${orphans} ${
      orphans === 1 ? 'photo records' : 'photos record'
    } no uploader — nothing stamped one when they were uploaded, so they can only appear under Company.`;
  };

  const galleryNotes = (): string[] => {
    const notes: string[] = [];
    const scoped = scopeNote();
    if (scoped) notes.push(scoped);
    if (feed && !feed.scopeVerified && isSupabaseConfigured) {
      notes.push(
        `Showing every photo that loaded — the job list didn't, so these could not be checked against ${
          business?.name ?? 'this workspace'
        }.`,
      );
    }
    if (feed && feed.offScope > 0) {
      notes.push(
        `${feed.offScope} ${feed.offScope === 1 ? 'photo is' : 'photos are'} hidden: they belong to jobs outside ${
          business?.name ?? 'this workspace'
        } — or to jobs older than its 50 most recent, which is as far back as the job list reads.`,
      );
    }
    return notes;
  };

  const renderGallery = () => (
    <>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search tags, projects, customers"
      />
      <Segmented options={SCOPES} value={scope} onChange={setScope} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Segmented options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
        </View>
        <Pressable
          onPress={() => setSort((current) => (current === 'recent' ? 'type' : 'recent'))}
          style={({ pressed }) => [
            styles.sortChip,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { backgroundColor: colors.cardPressed },
          ]}>
          <Ionicons
            name={sort === 'recent' ? 'time-outline' : 'albums-outline'}
            size={15}
            color={colors.textSecondary}
          />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
            {sort === 'recent' ? 'Newest' : 'By type'}
          </Text>
        </Pressable>
      </View>
      {galleryNotes().map((note) => (
        <Text key={note} style={muted}>
          {note}
        </Text>
      ))}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : rows.length === 0 ? (
        entries.length === 0 ? (
          // A failed read already has a banner; "No media yet" on top of it
          // would assert an empty workspace we can no longer vouch for.
          mediaError ? null : (
            <EmptyState
              icon="images-outline"
              title="No media yet"
              message="Photos and videos you capture on jobs show up here."
            />
          )
        ) : (
          <EmptyState
            icon="search-outline"
            title="Nothing matches"
            message="No photo matches that search and filter combination."
          />
        )
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {row.map((item, colIndex) => (
                <Pressable
                  key={item.id}
                  style={{ flex: 1 }}
                  onPress={() => setViewerIndex(rowIndex * 3 + colIndex)}>
                  <MediaThumb item={item} />
                </Pressable>
              ))}
              {row.length < 3
                ? Array.from({ length: 3 - row.length }).map((_, i) => (
                    <View key={`pad-${i}`} style={{ flex: 1 }} />
                  ))
                : null}
            </View>
          ))}
        </View>
      )}
      <Text style={[muted, { textAlign: 'center' }]}>
        “Newest” sorts by when each photo was taken — the only time a photo carries. Comments live
        on this device, so they are not counted as activity.
      </Text>
    </>
  );

  const renderTasks = () => {
    const today = todayKey();
    return (
      <>
        <Segmented options={TASK_SCOPES} value={taskScope} onChange={setTaskScope} />
        <Text style={muted}>
          Open checklist items across your {CHECKLIST_JOB_LIMIT} most recent jobs. “Assigned to me”
          matches items handed to you in Settings › Checklists. Assignments are shared checklist
          state, not a message — nobody is notified when work changes hands.
        </Text>
        {checklistsLoading && !checklists ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : openTasks.length === 0 ? (
          <>
            <EmptyState
              icon="checkmark-done-outline"
              title={taskScope === 'mine' ? 'Nothing assigned to you' : 'Nothing open'}
              message={
                taskScope === 'mine'
                  ? 'No open checklist item on these jobs is assigned to your account.'
                  : 'Every checklist item on your recent jobs is done.'
              }
            />
            {taskScope === 'mine' ? (
              <Button
                label="Hand out checklist items"
                icon="person-add-outline"
                variant="secondary"
                onPress={() => router.push('/settings/checklist')}
              />
            ) : null}
          </>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {openTasks.map(({ entry, task }) => {
              const overdue = !!task.due_date && task.due_date < today;
              return (
                <Card
                  key={`${entry.job.id}-${task.id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.md,
                    padding: Spacing.md,
                  }}>
                  <Pressable onPress={() => void toggleTask(entry.job.id, task.id)} hitSlop={10}>
                    <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
                  </Pressable>
                  <Pressable style={{ flex: 1, gap: 2 }} onPress={() => openJob(entry.job.id)}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {task.label}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                      {[entry.job.title, entry.job.client_name].filter(Boolean).join(' · ')}
                    </Text>
                    {/* Only ever the name captured at assign time — an id on its
                        own names nobody, so it is not rendered as one. */}
                    <Text style={muted} numberOfLines={1}>
                      {!task.assignee_id
                        ? 'Unassigned'
                        : assignedToMe(task)
                          ? 'Assigned to you'
                          : task.assignee_name
                            ? `Assigned to ${task.assignee_name}`
                            : 'Assigned to a teammate'}
                    </Text>
                  </Pressable>
                  {task.due_date ? (
                    <Badge label={formatDate(task.due_date)} tone={overdue ? 'danger' : 'neutral'} />
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
        <Text style={muted}>
          Assignments are recorded on this device, so this counts the checklists it has loaded — an
          item handed out on another phone appears once that job’s checklist syncs here.
        </Text>
      </>
    );
  };

  const renderLists = () => {
    const lists = checklists ?? [];
    return (
      <>
        <Text style={muted}>
          The same per-job checklist the Tasks tab reads — here as progress, one line per job, for
          your {CHECKLIST_JOB_LIMIT} most recent.
        </Text>
        {checklistsLoading && !checklists ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : lists.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="No checklists yet"
            message="Every job starts from your checklist template — create a job and it appears here."
          />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {lists.map(({ job, tasks }) => {
              const done = tasks.filter((task) => task.done).length;
              const total = tasks.length;
              return (
                <Card key={job.id} onPress={() => openJob(job.id)} style={{ gap: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <Text
                      style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' }}
                      numberOfLines={1}>
                      {job.title}
                    </Text>
                    <Badge
                      label={total === 0 ? 'No items' : `${done} of ${total} done`}
                      tone={total > 0 && done === total ? 'success' : 'neutral'}
                    />
                  </View>
                  {total > 0 ? (
                    <View
                      style={[styles.progressTrack, { backgroundColor: colors.cardPressed }]}>
                      <View
                        style={{
                          flexGrow: done,
                          flexBasis: 0,
                          backgroundColor: done === total ? colors.success : colors.primary,
                        }}
                      />
                      <View style={{ flexGrow: total - done, flexBasis: 0 }} />
                    </View>
                  ) : null}
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                    {[job.client_name, job.city].filter(Boolean).join(' · ')}
                  </Text>
                </Card>
              );
            })}
          </View>
        )}
      </>
    );
  };

  const renderJobs = () => (
    <Section title="Recent jobs">
      <Text style={muted}>
        A shortcut, not a second job list — the Jobs tab has the search, filters and stats. These
        are your {JOBS_TAB_PREVIEW} most recent.
      </Text>
      {loading && !jobs ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (jobs ?? []).length === 0 ? (
        jobsError ? null : (
          <EmptyState
            icon="briefcase-outline"
            title="No jobs yet"
            message="Create a job from the Jobs tab and it shows up here."
          />
        )
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {(jobs ?? []).slice(0, JOBS_TAB_PREVIEW).map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </View>
      )}
      <Button label="Open the Jobs tab" icon="briefcase-outline" onPress={() => router.push('/')} />
    </Section>
  );

  const renderPublished = () => (
    <>
      <Text style={muted}>
        {isSupabaseConfigured
          ? 'Publish history is recorded on this device. A job published from another phone, or from the web app, is not listed here.'
          : 'Demo mode — these are sample publishes recorded on this device. Nothing was posted to Google or sent anywhere.'}
      </Text>
      {publishedLoading && !published ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (published ?? []).length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          title="Nothing published yet"
          message="Finish a job and publish it — the record shows up here."
        />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {(published ?? []).map(({ job, record }) => (
            <Card key={job.id} onPress={() => openJob(job.id)} style={{ gap: Spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                {record.title || job.title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                {[job.client_name, job.city].filter(Boolean).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                {record.destinations.map((destination) => (
                  <Badge key={destination} label={DESTINATION_LABELS[destination]} />
                ))}
              </View>
              <Text style={muted}>{formatDateTime(record.published_at)}</Text>
            </Card>
          ))}
        </View>
      )}
    </>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {/* The header's company button jumps to the company-wide photo grid from
          whichever sub-tab you are on. It used to push /feed, which redirects
          straight back here — a round trip that changed nothing on screen. */}
      <ScreenHeader
        title="Feed"
        subtitle={subtitle()}
        actions={[{ icon: 'business-outline', onPress: showCompany }]}
      />
      <TabStrip value={tab} onChange={setTab} />
      {/* Banners, not replacements: a failed read still returns this device's
          queued captures, and hiding them makes just-taken work look lost. */}
      {mediaError && tab === 'gallery' ? (
        <ErrorBanner message={mediaError} busy={refreshing} onRetry={refresh} />
      ) : null}
      {jobsError ? <ErrorBanner message={jobsError} busy={refreshing} onRetry={refresh} /> : null}
      {tab === 'gallery' ? renderGallery() : null}
      {tab === 'tasks' ? renderTasks() : null}
      {tab === 'lists' ? renderLists() : null}
      {tab === 'jobs' ? renderJobs() : null}
      {tab === 'published' ? renderPublished() : null}
      <MediaViewer
        items={viewerItems}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null && viewerIndex < viewerItems.length}
        onClose={() => setViewerIndex(null)}
        onLogoSticker={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/logo-sticker', params: { mediaId: item.id } });
        }}
        onAnnotate={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/annotate', params: { mediaId: item.id } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
});
