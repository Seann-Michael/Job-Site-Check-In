/**
 * Durable upload queue.
 *
 * Every capture lands here first, with its bytes already copied to a durable
 * file on disk — the queue is the record of truth for "this photo exists",
 * and uploading is a separate, retryable step. Nothing is ever dropped because
 * a network call failed in an unexpected way.
 *
 * Design notes, each one paying for a photo that used to be lost:
 *
 * - Load sets its `loaded` flag AFTER the read resolves and shares one promise
 *   between concurrent callers. Setting it first let a capture racing app start
 *   observe an empty queue and persist over the whole backlog.
 * - Each item carries its own attempt count, backoff deadline and terminal
 *   `blocked` state. A single poison item (too large, rejected by RLS) no
 *   longer parks every photo behind it: the pass steps over it and keeps going.
 * - Offline failures are classified separately from item failures. Losing
 *   signal is a global condition, so it neither burns attempts nor pushes
 *   items toward the dead-letter state; it just ends the pass early.
 * - `storage_key` is decided once, at enqueue. A retry re-uses the exact same
 *   object path, so the classic flaky-4G case (bytes landed, ACK lost) resolves
 *   to "already there" instead of a duplicate object and a duplicate row.
 * - `flush()` returns a result. A manual retry that lands during a background
 *   flush joins it and reports what actually happened.
 *
 * The upload and file-disposal handlers are injected by the media pipeline
 * (lib/media-capture.ts) to avoid a circular import.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MediaCategory, MediaItem } from '@/lib/types';

const STORAGE_KEY = 'lsr-upload-queue-v1';

/** Attempts before an item is parked for manual attention. */
const MAX_ATTEMPTS = 5;
/** Backoff stays short (20s, 40s, 80s, 160s) so a photo is never stranded for long. */
const BASE_BACKOFF_MS = 20_000;
const MAX_BACKOFF_MS = 5 * 60_000;
/** After this many consecutive offline failures the pass stops: the link is down. */
const OFFLINE_STREAK_LIMIT = 2;
/** Retry window after an offline failure — short, because signal comes back suddenly. */
const OFFLINE_RETRY_MS = 10_000;
/** Items attempted per pass, so a 200-photo backlog can't run for an hour. */
const PASS_BUDGET = 15;
const IMAGE_TIMEOUT_MS = 90_000;
const VIDEO_TIMEOUT_MS = 300_000;

/**
 * `pending` — waiting for its turn or its backoff.
 * `blocked` — out of attempts, or rejected for a reason retrying won't fix
 *             (too large, permission denied). Skipped by automatic passes;
 *             revived by `flush({ force: true })`.
 */
export type QueuedUploadState = 'pending' | 'blocked';

export interface QueuedUpload {
  id: string;
  job_id: string;
  job_title: string;
  category: MediaCategory;
  /** Durable local file, copied out of any purgeable cache before enqueue. */
  uri: string;
  /** Durable local 384px thumbnail (images only). */
  thumb_uri?: string;
  width: number;
  height: number;
  taken_at: string;
  latitude?: number;
  longitude?: number;
  gps_accuracy?: number;
  /** File details; older queue items default to jpeg images. */
  ext?: string;
  content_type?: string;
  media_type?: 'image' | 'video';
  /** Camera EXIF, carried through so the queued path keeps what the direct path kept. */
  exif?: Record<string, unknown>;
  /**
   * Storage object path, decided once at enqueue. Every attempt writes to this
   * exact path — that is what makes a retry idempotent.
   */
  storage_key?: string;
  /** Uploader frozen at enqueue time (see lib/identity.ts). */
  uploaded_by?: string;
  uploaded_by_name?: string;
  /** Retry bookkeeping. Absent on items queued by older builds. */
  attempts?: number;
  state?: QueuedUploadState;
  last_error?: string;
  /** Epoch ms; the item is skipped until this passes. */
  next_attempt_at?: number;
}

/**
 * Why an attempt failed:
 * `offline`  — the link is down; not the item's fault, costs it no attempt.
 * `retry`    — transient (5xx, timeout, something unrecognised); costs an attempt.
 * `blocked`  — retrying cannot help (too large, rejected, file gone).
 */
export type FlushFailureKind = 'offline' | 'retry' | 'blocked';

export type FlushOutcome =
  | { ok: true; item?: MediaItem }
  | { ok: false; kind: FlushFailureKind; error: string };

export interface QueueHandlers {
  /** Push one item at its frozen storage key. */
  upload: (item: QueuedUpload) => Promise<FlushOutcome>;
  /** Delete the item's durable local files once they are no longer needed. */
  dispose?: (item: QueuedUpload) => Promise<void>;
}

export interface FlushResult {
  uploaded: number;
  /** Failed this pass, will be tried again automatically. */
  retrying: number;
  /** Parked as `blocked` during this pass. */
  blocked: number;
  /** Not attempted: backoff not elapsed, already blocked, or past the pass budget. */
  skipped: number;
  /** Items left in the queue when the pass ended. */
  remaining: number;
  /** The pass stopped early because the network looked down. */
  offline: boolean;
  /** This call joined a flush that was already running rather than starting one. */
  joined: boolean;
  /** Most recent failure message — for honest UI copy instead of a guess. */
  lastError?: string;
}

/** Result of the immediate upload attempt made right after a capture is queued. */
export interface AttemptResult {
  status: 'uploaded' | 'retrying' | 'blocked' | 'offline' | 'busy' | 'missing';
  /** Present only on `uploaded`, when the handler could describe the stored row. */
  item?: MediaItem;
  error?: string;
}

let items: QueuedUpload[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
let handlers: QueueHandlers | null = null;
let inFlight: Promise<FlushResult> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Read through a function so a check after an `await` sees the current value. */
function activeFlush(): Promise<FlushResult> | null {
  return inFlight;
}

/**
 * Concurrent callers share one read, and `loaded` flips only once the items
 * are actually in memory. The old order (flag first, then await) meant a
 * capture during app start enqueued onto an empty array and persisted that
 * over the entire stored backlog.
 */
function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as QueuedUpload[]) : [];
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        items = [];
      }
      loaded = true;
      loading = null;
    })();
  }
  return loading;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort persistence.
  }
}

async function update(id: string, patch: Partial<QueuedUpload>): Promise<void> {
  items = items.map((queued) => (queued.id === id ? { ...queued, ...patch } : queued));
  await persist();
  emit();
}

async function drop(item: QueuedUpload): Promise<void> {
  items = items.filter((queued) => queued.id !== item.id);
  await persist();
  emit();
  if (handlers?.dispose) {
    try {
      await handlers.dispose(item);
    } catch {
      // A leftover file is a disk-space problem, not a data-loss one.
    }
  }
}

function backoffFor(attempts: number): number {
  const raw = BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1);
  const capped = Math.min(raw, MAX_BACKOFF_MS);
  // Jitter so a hundred photos queued in the same minute don't retry in lockstep.
  return Math.round(capped * (0.8 + Math.random() * 0.4));
}

function isDue(item: QueuedUpload, now: number): boolean {
  if (item.state === 'blocked') return false;
  return !item.next_attempt_at || item.next_attempt_at <= now;
}

function timeoutFor(item: QueuedUpload): number {
  return item.media_type === 'video' ? VIDEO_TIMEOUT_MS : IMAGE_TIMEOUT_MS;
}

/**
 * A hard ceiling per item. Supabase's upload can't be aborted mid-flight, but
 * the pass must not be held hostage by a stalled socket — the item is released
 * back to the queue and the rest of the backlog keeps moving.
 */
async function attemptUpload(item: QueuedUpload): Promise<FlushOutcome> {
  if (!handlers) return { ok: false, kind: 'retry', error: 'Uploader not ready yet.' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      handlers.upload(item),
      new Promise<FlushOutcome>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, kind: 'retry', error: 'Upload timed out.' }),
          timeoutFor(item),
        );
      }),
    ]);
  } catch (error) {
    return {
      ok: false,
      kind: 'retry',
      error: error instanceof Error ? error.message : 'Upload failed.',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ProcessOutcome = { kind: 'uploaded' | FlushFailureKind; error?: string; item?: MediaItem };

/** Run one item and record what happened. Never throws. */
async function processItem(item: QueuedUpload): Promise<ProcessOutcome> {
  const outcome = await attemptUpload(item);
  if (outcome.ok) {
    await drop(item);
    return { kind: 'uploaded', item: outcome.item };
  }

  const attempts = (item.attempts ?? 0) + 1;
  if (outcome.kind === 'offline') {
    // Not this photo's fault — no attempt spent, just a short pause.
    await update(item.id, {
      last_error: outcome.error,
      next_attempt_at: Date.now() + OFFLINE_RETRY_MS,
    });
    return { kind: 'offline', error: outcome.error };
  }

  if (outcome.kind === 'blocked' || attempts >= MAX_ATTEMPTS) {
    await update(item.id, {
      attempts,
      state: 'blocked',
      last_error: outcome.error,
      next_attempt_at: undefined,
    });
    return { kind: 'blocked', error: outcome.error };
  }

  await update(item.id, {
    attempts,
    state: 'pending',
    last_error: outcome.error,
    next_attempt_at: Date.now() + backoffFor(attempts),
  });
  return { kind: 'retry', error: outcome.error };
}

function emptyResult(overrides?: Partial<FlushResult>): FlushResult {
  return {
    uploaded: 0,
    retrying: 0,
    blocked: 0,
    skipped: 0,
    remaining: items.length,
    offline: false,
    joined: false,
    ...overrides,
  };
}

/** Clear every backoff and revive blocked items — what "Retry all now" means. */
async function revive(): Promise<void> {
  if (!items.some((item) => item.state === 'blocked' || item.next_attempt_at)) return;
  items = items.map((item) => ({
    ...item,
    state: 'pending',
    attempts: 0,
    next_attempt_at: undefined,
  }));
  await persist();
  emit();
}

async function runPass(force: boolean): Promise<FlushResult> {
  await load();
  if (force) await revive();

  const result = emptyResult();
  if (!handlers || items.length === 0) {
    result.remaining = items.length;
    return result;
  }

  const now = Date.now();
  const queue = [...items];
  let offlineStreak = 0;
  let attempted = 0;

  for (const item of queue) {
    // Re-check: a concurrent remove() may have taken it out from under us.
    if (!items.some((queued) => queued.id === item.id)) continue;
    if (!isDue(item, now)) {
      result.skipped += 1;
      continue;
    }
    if (attempted >= PASS_BUDGET) {
      result.skipped += 1;
      continue;
    }
    attempted += 1;

    const outcome = await processItem(item);
    if (outcome.error) result.lastError = outcome.error;
    if (outcome.kind === 'uploaded') {
      result.uploaded += 1;
      offlineStreak = 0;
      continue;
    }
    if (outcome.kind === 'offline') {
      result.offline = true;
      offlineStreak += 1;
      // A dead link is a global condition: stop rather than march the whole
      // backlog through the same failure.
      if (offlineStreak >= OFFLINE_STREAK_LIMIT) break;
      continue;
    }
    offlineStreak = 0;
    if (outcome.kind === 'blocked') result.blocked += 1;
    else result.retrying += 1;
  }

  result.remaining = items.length;
  return result;
}

export const uploadQueue = {
  /** Injected by lib/media-capture.ts on import. */
  setHandlers(next: QueueHandlers): void {
    handlers = next;
  },

  async enqueue(item: QueuedUpload): Promise<void> {
    await load();
    items = [...items, { state: 'pending', attempts: 0, ...item }];
    await persist();
    emit();
  },

  async getAll(): Promise<QueuedUpload[]> {
    await load();
    return items;
  },

  /** Synchronous count of what's already loaded (0 before first load). */
  countSync(): number {
    return items.length;
  },

  /**
   * Forget an item and delete its local files. In connected mode the queued
   * copy is the only copy on the device, so this really does discard the photo.
   */
  async remove(id: string): Promise<void> {
    await load();
    const item = items.find((queued) => queued.id === id);
    if (!item) return;
    await drop(item);
  },

  /**
   * Upload one specific item now — the immediate attempt a capture makes after
   * queuing itself. Returns `busy` when a flush is already running, in which
   * case that flush will pick the item up.
   */
  async attemptNow(id: string): Promise<AttemptResult> {
    await load();
    const item = items.find((queued) => queued.id === id);
    if (!item) return { status: 'missing' };
    if (!handlers) return { status: 'retrying', error: 'Uploader not ready yet.' };
    if (inFlight) return { status: 'busy' };

    let last: ProcessOutcome = { kind: 'retry' };
    const run = (async (): Promise<FlushResult> => {
      last = await processItem(item);
      const result = emptyResult({ lastError: last.error });
      if (last.kind === 'uploaded') result.uploaded = 1;
      else if (last.kind === 'offline') result.offline = true;
      else if (last.kind === 'blocked') result.blocked = 1;
      else result.retrying = 1;
      return result;
    })();

    inFlight = run;
    try {
      await run;
    } finally {
      inFlight = null;
    }
    if (last.kind === 'uploaded') return { status: 'uploaded', item: last.item };
    if (last.kind === 'offline') return { status: 'offline', error: last.error };
    if (last.kind === 'blocked') return { status: 'blocked', error: last.error };
    return { status: 'retrying', error: last.error };
  },

  /**
   * Work the queue. Always resolves with what happened, so a manual retry can
   * report the truth instead of assuming the worst — tapping "Retry" during a
   * background flush joins that flush rather than reporting "still offline"
   * while uploads are landing.
   *
   * `force` clears every backoff and revives blocked items.
   */
  async flush(options?: { force?: boolean }): Promise<FlushResult> {
    const force = Boolean(options?.force);
    const running = activeFlush();
    if (running) {
      const joined = await running.catch(() => emptyResult());
      // A plain flush is satisfied by the pass that just finished.
      if (!force) return { ...joined, joined: true };
      // A forced retry is an explicit user action, so it gets its own pass —
      // unless yet another flush started while we were waiting.
      const next = activeFlush();
      if (next && next !== running) {
        const second = await next.catch(() => emptyResult());
        return { ...second, joined: true };
      }
    }
    const run = runPass(force);
    inFlight = run;
    try {
      return await run;
    } catch {
      return emptyResult();
    } finally {
      inFlight = null;
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
