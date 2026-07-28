/**
 * Per-job task checklists, persisted on-device. Every job starts from the
 * standard field checklist; syncing to the web job_tasks table comes with a
 * later milestone.
 *
 * Assignment lives here rather than in lib/types.ts: `JobTask` is shared with
 * the report builder and the web schema, while these fields are only ever
 * written and read through this store.
 *
 * Nothing in here notifies anybody. The app has no push registration and no
 * server-side sender, so an assignment is a shared piece of checklist state and
 * the UI must say so.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobInWorkspace } from '@/lib/job-meta';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { JobTask } from '@/lib/types';

const STORAGE_KEY = 'lsr-job-tasks-v1';
const TEMPLATE_KEY = 'lsr-checklist-template-v1';

/**
 * Who owns a task, and by when. Written as one unit by `assign` — including the
 * stamp, which is what lets a sync tell two devices' edits apart.
 */
export interface TaskAssignment {
  assignee_id?: string;
  /** Display name captured at assign time, so the row still reads if the roster changes. */
  assignee_name?: string;
  /** Display name of whoever made the assignment. */
  assigned_by?: string;
  assigned_at?: string;
  /** Date-only, 'YYYY-MM-DD'. */
  due_date?: string;
}

export type StoredJobTask = JobTask & TaskAssignment;

/** One assigned task plus the job it belongs to. */
export interface TaskAssignmentEntry {
  jobId: string;
  task: StoredJobTask;
}

/** What `assign` needs to record an assignment (or clear one). */
export interface AssignInput {
  /** The person, or null to clear the assignment. */
  member: { id: string; name: string } | null;
  /** 'YYYY-MM-DD' to set, null to clear, omitted to leave the current date alone. */
  dueDate?: string | null;
  /** Display name of whoever is assigning. */
  by?: string;
}

export const DEFAULT_TASK_LABELS = [
  'Before photos captured',
  'Work completed',
  'After photos + walkthrough',
  'Site cleaned up',
  'Send review request',
];

/** The reusable checklist template new jobs start from (editable in Settings). */
export async function getChecklistTemplate(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : null;
    return parsed?.length ? parsed : DEFAULT_TASK_LABELS;
  } catch {
    return DEFAULT_TASK_LABELS;
  }
}

export async function setChecklistTemplate(labels: string[]): Promise<void> {
  await AsyncStorage.setItem(
    TEMPLATE_KEY,
    JSON.stringify(labels.map((label) => label.trim()).filter(Boolean)),
  ).catch(() => undefined);
}

type TaskMap = Record<string, StoredJobTask[]>;

/** djb2 — small, stable, and identical on every device and platform. */
function hashLabel(label: string): string {
  const key = label.trim().toLowerCase();
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 33) ^ key.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Task ids derive from the label, not from its position.
 *
 * The old scheme (`${jobId}-t${index}`) meant "the third task", so editing the
 * checklist template silently re-pointed an id at a different piece of work on
 * any device that seeded later — and two devices seeding the same job produced
 * ids that could not be lined up at all. A label-derived id always names the
 * same task, whoever seeded it and whenever they did.
 *
 * `taken` disambiguates a checklist that repeats a label.
 */
function taskIdFor(label: string, taken: Set<string>): string {
  const base = `t-${hashLabel(label)}`;
  let id = base;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  taken.add(id);
  return id;
}

function seedFromTemplate(labels: string[]): StoredJobTask[] {
  const taken = new Set<string>();
  return labels.map((label) => ({ id: taskIdFor(label, taken), label, done: false }));
}

function labelKey(label: string): string {
  return label.trim().toLowerCase();
}

/** The completed copy of a task, preferring whoever ticked it first. */
function completionOf(a: StoredJobTask, b: StoredJobTask): StoredJobTask | null {
  const done = [a, b].filter((task) => task.done);
  if (!done.length) return null;
  // Missing stamps sort last, so a copy that knows *when* it was done wins.
  return done.sort((x, y) => (x.done_at ?? '~').localeCompare(y.done_at ?? '~'))[0];
}

/**
 * The winning assignment tuple. It moves as a unit — assignee, who assigned it
 * and the due date — so a clear made offline beats a stale assignee, and an
 * assignee set offline beats an older server row.
 */
function newerAssignment(local: StoredJobTask, server: StoredJobTask): TaskAssignment {
  let winner: StoredJobTask;
  if (local.assigned_at || server.assigned_at) {
    winner = (local.assigned_at ?? '') >= (server.assigned_at ?? '') ? local : server;
  } else {
    // Neither side stamped (a row written by another client): keep whichever
    // actually names somebody, preferring this device's copy.
    winner = local.assignee_id ? local : server.assignee_id ? server : local;
  }
  return {
    assignee_id: winner.assignee_id,
    assignee_name: winner.assignee_name,
    assigned_by: winner.assigned_by,
    assigned_at: winner.assigned_at,
    due_date: winner.due_date,
  };
}

function mergeTask(server: StoredJobTask, local: StoredJobTask): StoredJobTask {
  const done = completionOf(server, local);
  return {
    ...server,
    done: !!done,
    done_at: done?.done_at,
    done_by: done?.done_by,
    ...newerAssignment(local, server),
  };
}

/**
 * Reconcile the server's checklist with this device's copy.
 *
 * Pairing is by id — the previous version keyed on the label string and copied
 * only `done` across, so an assignee (or a due date) set offline was thrown
 * away by the first sync. A label match is still used as a fallback so a
 * checklist written by an older build, whose ids were job-id-plus-index, lines
 * up instead of doubling every row.
 */
function mergeTaskLists(server: StoredJobTask[], local: StoredJobTask[]): StoredJobTask[] {
  const byId = new Map(local.map((task) => [task.id, task]));
  const byLabel = new Map<string, StoredJobTask>();
  for (const task of local) {
    if (!byLabel.has(labelKey(task.label))) byLabel.set(labelKey(task.label), task);
  }
  const consumed = new Set<string>();
  const merged = server.map((task) => {
    const match = byId.get(task.id) ?? byLabel.get(labelKey(task.label));
    if (!match || consumed.has(match.id)) return task;
    consumed.add(match.id);
    return mergeTask(task, match);
  });
  for (const task of local) {
    if (!consumed.has(task.id)) merged.push(task);
  }
  return merged;
}

let cache: TaskMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<TaskMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as TaskMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(map: TaskMap): Promise<void> {
  cache = map;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort persistence.
  }
}

// Jobs whose first server read failed: their local list may be a blind
// template seed, so pushing it wholesale could clobber a teammate's
// checklist. Resolve the conflict before the first push.
const unverifiedSeeds = new Set<string>();

/** Best-effort write-through of a job's checklist to job_field_state. */
function pushTasks(jobId: string, tasks: StoredJobTask[]): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      // job_field_state is keyed by job_id, so this upsert would not sit beside
      // another tenant's checklist — it would replace it. Same guard the read
      // uses, pointed the other way.
      if (!(await jobInWorkspace(jobId))) return;
      if (unverifiedSeeds.has(jobId)) {
        const { data, error } = await supabase
          .from('job_field_state')
          .select('tasks')
          .eq('job_id', jobId)
          .single();
        if (error && error.code !== 'PGRST116') return; // Still offline — don't clobber.
        unverifiedSeeds.delete(jobId);
        if (Array.isArray(data?.tasks) && data.tasks.length > 0) {
          // Server had a checklist all along: merge this device's edits into it
          // instead of replacing it.
          const merged = mergeTaskLists(data.tasks as StoredJobTask[], tasks);
          tasks = merged;
          const map = await load();
          map[jobId] = merged;
          await persist(map);
          emit();
        }
      }
      await supabase
        .from('job_field_state')
        .upsert({ job_id: jobId, tasks, updated_at: new Date().toISOString() });
    } catch {
      // Best-effort.
    }
  })();
}

export const tasksStore = {
  async getTasks(jobId: string): Promise<StoredJobTask[]> {
    const map = await load();
    if (!map[jobId]) {
      // First time this device sees the job: prefer the synced checklist —
      // but only once the job is known to be this workspace's. The id is a
      // route param, so a deep link to someone else's uuid would otherwise pull
      // their checklist (labels, assignees, who ticked what) onto this device.
      const mine = isSupabaseConfigured && (await jobInWorkspace(jobId));
      // Refused or unknown: nothing is read, so the template seed below is a
      // blind guess at this job's checklist. Mark it unverified exactly as a
      // failed read does — if the job does turn out to be ours, the first push
      // then merges into whatever the workspace already has instead of
      // replacing it.
      if (isSupabaseConfigured && !mine) unverifiedSeeds.add(jobId);
      if (mine) {
        try {
          const { data, error } = await supabase
            .from('job_field_state')
            .select('tasks')
            .eq('job_id', jobId)
            .single();
          if (error && error.code !== 'PGRST116') unverifiedSeeds.add(jobId);
          if (Array.isArray(data?.tasks) && data.tasks.length > 0) {
            const current = await load();
            // A concurrent getTasks may have seeded (and the user toggled)
            // while this fetch was in flight — don't overwrite it.
            if (current[jobId]) return current[jobId];
            current[jobId] = data.tasks as StoredJobTask[];
            await persist(current);
            return current[jobId];
          }
        } catch {
          unverifiedSeeds.add(jobId);
        }
      }
      const current = await load();
      if (current[jobId]) return current[jobId];
      const template = await getChecklistTemplate();
      current[jobId] = seedFromTemplate(template);
      await persist(current);
      return current[jobId];
    }
    return map[jobId];
  },

  async toggle(jobId: string, taskId: string, userName?: string): Promise<StoredJobTask[]> {
    const map = await load();
    map[jobId] = (map[jobId] ?? []).map((task) => {
      if (task.id !== taskId) return task;
      const done = !task.done;
      return {
        ...task,
        done,
        // Stamp who checked it off and when; clear on uncheck.
        done_at: done ? new Date().toISOString() : undefined,
        done_by: done ? (userName ?? 'You') : undefined,
      };
    });
    await persist(map);
    emit();
    pushTasks(jobId, map[jobId]);
    return map[jobId];
  },

  async add(jobId: string, label: string): Promise<StoredJobTask[]> {
    const map = await load();
    const existing = map[jobId] ?? [];
    const trimmed = label.trim();
    const taken = new Set(existing.map((task) => task.id));
    map[jobId] = [...existing, { id: taskIdFor(trimmed, taken), label: trimmed, done: false }];
    await persist(map);
    emit();
    pushTasks(jobId, map[jobId]);
    return map[jobId];
  },

  /**
   * Give a task to someone (or take it back with `member: null`).
   *
   * This is checklist state, not a message: nobody is told. The assignment is
   * stamped so a later sync can tell which device edited last.
   */
  async assign(jobId: string, taskId: string, input: AssignInput): Promise<StoredJobTask[]> {
    const map = await load();
    const existing = map[jobId];
    if (!existing) {
      // No checklist on this device yet — writing here would persist, and push,
      // an empty one. Seed it instead and let the caller assign from that.
      return tasksStore.getTasks(jobId);
    }
    const now = new Date().toISOString();
    map[jobId] = existing.map((task) => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        assignee_id: input.member?.id,
        assignee_name: input.member?.name,
        assigned_by: input.member ? input.by : undefined,
        // Stamped even when clearing — the stamp is how the merge decides.
        assigned_at: now,
        due_date: input.dueDate === undefined ? task.due_date : (input.dueDate ?? undefined),
      };
    });
    await persist(map);
    emit();
    pushTasks(jobId, map[jobId]);
    return map[jobId];
  },

  /**
   * Every assigned task this device knows about, open ones first then by due
   * date. Local only: it covers the jobs whose checklist has been opened on
   * this device, so callers should say as much rather than imply it is the
   * whole workspace.
   */
  async getAssignments(): Promise<TaskAssignmentEntry[]> {
    const map = await load();
    const entries: TaskAssignmentEntry[] = [];
    for (const [jobId, tasks] of Object.entries(map)) {
      for (const task of tasks) {
        if (task.assignee_id) entries.push({ jobId, task });
      }
    }
    return entries.sort(
      (a, b) =>
        Number(a.task.done) - Number(b.task.done) ||
        (a.task.due_date ?? '~').localeCompare(b.task.due_date ?? '~') ||
        a.task.label.localeCompare(b.task.label),
    );
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
