/**
 * Per-job task checklists, persisted on-device. Every job starts from the
 * standard field checklist; syncing to the web job_tasks table comes with a
 * later milestone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { JobTask } from '@/lib/types';

const STORAGE_KEY = 'lsr-job-tasks-v1';
const TEMPLATE_KEY = 'lsr-checklist-template-v1';

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

type TaskMap = Record<string, JobTask[]>;

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
function pushTasks(jobId: string, tasks: JobTask[]): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      if (unverifiedSeeds.has(jobId)) {
        const { data, error } = await supabase
          .from('job_field_state')
          .select('tasks')
          .eq('job_id', jobId)
          .single();
        if (error && error.code !== 'PGRST116') return; // Still offline — don't clobber.
        unverifiedSeeds.delete(jobId);
        if (Array.isArray(data?.tasks) && data.tasks.length > 0) {
          // Server had a checklist all along: merge our done-toggles and
          // additions into it by label instead of replacing it.
          const localByLabel = new Map(tasks.map((task) => [task.label, task]));
          const merged: JobTask[] = (data.tasks as JobTask[]).map((task) => ({
            ...task,
            done: localByLabel.get(task.label)?.done ?? task.done,
          }));
          const serverLabels = new Set(merged.map((task) => task.label));
          for (const task of tasks) {
            if (!serverLabels.has(task.label)) merged.push(task);
          }
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
  async getTasks(jobId: string): Promise<JobTask[]> {
    const map = await load();
    if (!map[jobId]) {
      // First time this device sees the job: prefer the synced checklist.
      if (isSupabaseConfigured) {
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
            current[jobId] = data.tasks as JobTask[];
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
      current[jobId] = template.map((label, index) => ({
        id: `${jobId}-t${index}`,
        label,
        done: false,
      }));
      await persist(current);
      return current[jobId];
    }
    return map[jobId];
  },

  async toggle(jobId: string, taskId: string): Promise<JobTask[]> {
    const map = await load();
    map[jobId] = (map[jobId] ?? []).map((task) =>
      task.id === taskId ? { ...task, done: !task.done } : task,
    );
    await persist(map);
    emit();
    pushTasks(jobId, map[jobId]);
    return map[jobId];
  },

  async add(jobId: string, label: string): Promise<JobTask[]> {
    const map = await load();
    map[jobId] = [
      ...(map[jobId] ?? []),
      { id: `${jobId}-t${Date.now()}`, label: label.trim(), done: false },
    ];
    await persist(map);
    emit();
    pushTasks(jobId, map[jobId]);
    return map[jobId];
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
