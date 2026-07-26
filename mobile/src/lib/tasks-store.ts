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

/** Best-effort write-through of a job's checklist to job_field_state. */
function pushTasks(jobId: string, tasks: JobTask[]): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
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
          const { data } = await supabase
            .from('job_field_state')
            .select('tasks')
            .eq('job_id', jobId)
            .single();
          if (Array.isArray(data?.tasks) && data.tasks.length > 0) {
            map[jobId] = data.tasks as JobTask[];
            await persist(map);
            return map[jobId];
          }
        } catch {
          // Offline or table missing — seed from the template below.
        }
      }
      const template = await getChecklistTemplate();
      map[jobId] = template.map((label, index) => ({
        id: `${jobId}-t${index}`,
        label,
        done: false,
      }));
      await persist(map);
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
