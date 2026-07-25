/**
 * Per-job task checklists, persisted on-device. Every job starts from the
 * standard field checklist; syncing to the web job_tasks table comes with a
 * later milestone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { JobTask } from '@/lib/types';

const STORAGE_KEY = 'lsr-job-tasks-v1';

const DEFAULT_TASKS: Omit<JobTask, 'id'>[] = [
  { label: 'Before photos captured', done: false },
  { label: 'Work completed', done: false },
  { label: 'After photos + walkthrough', done: false },
  { label: 'Site cleaned up', done: false },
  { label: 'Send review request', done: false },
];

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

export const tasksStore = {
  async getTasks(jobId: string): Promise<JobTask[]> {
    const map = await load();
    if (!map[jobId]) {
      map[jobId] = DEFAULT_TASKS.map((task, index) => ({ ...task, id: `${jobId}-t${index}` }));
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
    return map[jobId];
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
