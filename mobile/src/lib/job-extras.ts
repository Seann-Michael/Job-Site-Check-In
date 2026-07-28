/**
 * Per-job extras: site-visit check-ins, notes, and document attachments.
 * Stored on-device (AsyncStorage) for instant, offline-friendly use, and
 * mirrored to Supabase (job_checkins / job_notes / job_documents + Storage)
 * when it is configured.
 *
 * DOCUMENTS AND HONESTY
 *   A document is only visible to a teammate once BOTH the object is in
 *   Storage and the `job_documents` row landed — the web client lists rows,
 *   not bucket contents. Every attachment therefore records where it actually
 *   is (`sync`), and `documentStatus()` turns that into a sentence the
 *   Documents tab must render. A file that never left the phone must never be
 *   presented as shared.
 *
 * The checklist deliberately does NOT live here: it is
 * mobile/src/lib/tasks-store.ts, which syncs a JSONB blob to
 * `job_field_state.tasks`. Two stores for one checklist would be two answers
 * to "is this ticked".
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

import { jobInWorkspace } from '@/lib/job-meta';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-job-extras-v1';

/**
 * One app launch / one browser page. A web `blob:` URL dies with the page that
 * minted it, so a document attached in an earlier session is a dead link, not
 * a file — see DocumentState 'lost'.
 */
const SESSION_ID = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Real jobs carry a uuid; `demo-*`, `job-1` and `local-job-*` never reach the server. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorText(error: unknown): string {
  if (!error) return 'Unknown error.';
  const raw =
    error instanceof Error
      ? error.message
      : String((error as { message?: unknown } | null)?.message ?? error);
  return raw.trim() || 'Unknown error.';
}

export interface CheckIn {
  id: string;
  checked_in_at: string;
  checked_out_at?: string;
  latitude?: number;
  longitude?: number;
  /** Row id in job_checkins once synced. */
  server_id?: string;
  /** Who checked in (defaults to you for local rows). */
  user_name?: string;
}

export interface JobNote {
  id: string;
  text: string;
  author: string;
  created_at: string;
  /** Row id in job_notes once synced. */
  server_id?: string;
}

/**
 * Where an attachment actually is.
 *   'shared' — object in Storage AND a job_documents row: a teammate can open it.
 *   'local'  — nowhere to send it (demo mode, or a job that has never synced).
 *   'failed' — there is a workspace, but the upload has not gone through.
 *   'lost'   — web only: attached in an earlier page session, the blob is gone.
 */
export type DocumentState = 'shared' | 'local' | 'failed' | 'lost';

export interface JobDocument {
  id: string;
  name: string;
  /** Best URL to open: the shared copy when there is one, else the device copy. */
  uri: string;
  mime_type: string;
  size: number;
  added_at: string;
  tags?: string[];
  /** `job_documents` row id. Present only once the row really landed. */
  server_id?: string;
  /** Public URL of the uploaded object. */
  remote_url?: string;
  /** Durable copy in the app's document directory (native only). */
  local_uri?: string;
  /** Storage object key, frozen at attach time so a retry re-uses it. */
  storage_path?: string;
  /** Recorded state. Absent on rows written by an older build — see documentStatus. */
  sync?: DocumentState;
  /** Why it is not shared, in the words the tab should show. */
  sync_note?: string;
  /** Web: `uri` is a blob: URL, valid only for `session`. */
  volatile?: boolean;
  session?: string;
}

/** What the Documents tab needs to tell the truth about one attachment. */
export interface DocumentStatus {
  state: DocumentState;
  /** One honest sentence, or null when the document is genuinely shared. */
  note: string | null;
  /** Whether tapping the row can actually open anything. */
  openable: boolean;
  /** Whether offering "Try again" would do something. */
  retryable: boolean;
}

/**
 * Rows written before this build recorded nothing: an http uri meant the old
 * upload path had run end to end, anything else meant device-only.
 */
function storedState(doc: JobDocument): DocumentState {
  if (doc.sync) return doc.sync;
  if (doc.server_id || doc.remote_url) return 'shared';
  if (doc.uri.startsWith('http')) return 'shared';
  return isSupabaseConfigured ? 'failed' : 'local';
}

export function documentStatus(doc: JobDocument): DocumentStatus {
  const state = storedState(doc);
  if (state === 'shared') {
    return { state, note: null, openable: true, retryable: false };
  }
  // A web blob from a previous page load is a dead link — never pretend it opens.
  if (doc.volatile && doc.session !== SESSION_ID) {
    return {
      state: 'lost',
      note: 'Attached in an earlier browser session, so the file is no longer available here. Attach it again to keep it.',
      openable: false,
      retryable: false,
    };
  }
  if (state === 'lost') {
    return {
      state,
      // A recorded reason is always more specific than the generic one — a
      // note that never reaches the tab is a note nobody wrote.
      note: doc.sync_note ?? 'The file is no longer available on this device. Attach it again to keep it.',
      openable: false,
      retryable: false,
    };
  }
  if (state === 'local') {
    return {
      state,
      note: doc.sync_note ?? 'Saved on this device only — nobody else can see it.',
      openable: true,
      retryable: false,
    };
  }
  return {
    state: 'failed',
    note: doc.sync_note ?? 'On this device only — the upload has not gone through yet.',
    openable: true,
    retryable: true,
  };
}

export interface VoiceNote {
  id: string;
  uri: string;
  duration_ms: number;
  created_at: string;
  author?: string;
}

export interface JobExtras {
  checkins: CheckIn[];
  notes: JobNote[];
  documents: JobDocument[];
  voiceNotes?: VoiceNote[];
}

type ExtrasMap = Record<string, JobExtras>;

function emptyExtras(): JobExtras {
  return { checkins: [], notes: [], documents: [], voiceNotes: [] };
}

function localId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

let cache: ExtrasMap | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<ExtrasMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as ExtrasMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function mutate(jobId: string, fn: (extras: JobExtras) => JobExtras): Promise<JobExtras> {
  const map = await load();
  const next = fn(map[jobId] ?? emptyExtras());
  map[jobId] = next;
  cache = map;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);
  emit();
  return next;
}

// Throttled background hydration of check-ins/notes from the server, so
// teammates' visits and notes appear without blocking the UI.
const lastHydrated: Record<string, number> = {};

// Server rows the user deleted locally — never re-add them from a hydrate,
// even if the server-side delete failed.
const deletedNoteIds = new Set<string>();
const deletedDocumentIds = new Set<string>();

/** `job_documents` row -> the shape the tab renders. */
function documentFromRow(row: Record<string, unknown>): JobDocument | null {
  const serverId = row.id == null ? '' : String(row.id);
  const url = typeof row.file_path === 'string' ? row.file_path : '';
  if (!serverId || !url) return null;
  const name =
    (typeof row.original_name === 'string' && row.original_name) ||
    (typeof row.filename === 'string' && row.filename) ||
    'Document';
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;
  return {
    id: `doc-srv-${serverId}`,
    server_id: serverId,
    name,
    uri: url,
    remote_url: url,
    mime_type: typeof row.mime_type === 'string' ? row.mime_type : 'application/octet-stream',
    size: typeof row.file_size === 'number' ? row.file_size : 0,
    added_at:
      typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    tags: tags?.length ? tags : undefined,
    sync: 'shared',
  };
}

/**
 * Fold the workspace's documents into this device's list.
 *
 * A row this device uploaded is matched by server_id and kept as the local
 * entry, so its durable on-device copy (which opens with no signal) survives.
 * Local-only attachments are never dropped: they are the ones the tab has to
 * warn about.
 *
 * `fetchedAt` is the instant the query was issued. Only a document attached
 * before it can be judged missing — otherwise an attachment made while the
 * read was in flight would be announced as "removed from the workspace".
 */
function mergeDocuments(
  local: JobDocument[],
  rows: Record<string, unknown>[],
  fetchedAt: string,
): JobDocument[] {
  const byServerId = new Map(
    local.filter((doc) => doc.server_id).map((doc) => [doc.server_id!, doc]),
  );
  const seen = new Set<string>();
  const merged: JobDocument[] = [];
  for (const row of rows) {
    const fromServer = documentFromRow(row);
    if (!fromServer?.server_id) continue;
    if (deletedDocumentIds.has(fromServer.server_id)) continue;
    seen.add(fromServer.server_id);
    const mine = byServerId.get(fromServer.server_id);
    merged.push(
      mine
        ? {
            ...mine,
            name: fromServer.name,
            remote_url: fromServer.remote_url,
            uri: fromServer.remote_url ?? mine.uri,
            size: fromServer.size || mine.size,
            tags: fromServer.tags ?? mine.tags,
            sync: 'shared',
            sync_note: undefined,
          }
        : fromServer,
    );
  }
  for (const doc of local) {
    if (doc.server_id && seen.has(doc.server_id)) continue;
    // A row we thought we had created is gone from the server (deleted in the
    // web app): keep the file, stop claiming it is shared.
    if (doc.server_id && doc.added_at < fetchedAt) {
      const onDevice = Boolean(doc.local_uri) || doc.uri.startsWith('file:');
      merged.push({
        ...doc,
        server_id: undefined,
        sync: onDevice ? 'failed' : 'lost',
        // Only claim a device copy when there is one: with no local file this
        // row is a name and nothing else.
        sync_note: onDevice
          ? 'Removed from the workspace — this is the copy on your device.'
          : 'Removed from the workspace, and no copy was kept on this device.',
      });
      continue;
    }
    merged.push(doc);
  }
  return merged.sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
}

/** Re-push a checkout that the server missed (failed or racing update). */
function pushCheckout(serverId: string, endedAt: string): void {
  void (async () => {
    try {
      await supabase.from('job_checkins').update({ checked_out_at: endedAt }).eq('id', serverId);
    } catch {
      // Retried on the next hydrate.
    }
  })();
}

async function hydrateFromServer(jobId: string): Promise<void> {
  if (!isSupabaseConfigured || !jobId) return;
  const now = Date.now();
  if (now - (lastHydrated[jobId] ?? 0) < 15_000) return;
  lastHydrated[jobId] = now;
  // This job id arrived from a route param, and a deep link can carry any uuid.
  // Check it is one of ours before reading anything: these rows are site visits
  // with crew names and GPS coordinates, internal notes, and document URLs.
  // A "no" — not ours, or a workspace that hasn't loaded — hydrates nothing and
  // leaves this device's own copy untouched. The throttle above has already
  // been stamped, so a foreign id costs one small query per 15s, not per read.
  if (!(await jobInWorkspace(jobId))) return;
  const fetchedAt = new Date().toISOString();
  // A job that only exists on this device has no rows to read, and its non-uuid
  // id would come back as a cast error on every query.
  const onServer = UUID_RE.test(jobId);
  try {
    // select('*'): naming columns here would break the read on any database
    // whose job_documents is a column behind (or ahead of) this build.
    const documentsQuery = onServer
      ? supabase
          .from('job_documents')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
      : null;
    const [checkinsResult, notesResult] = await Promise.all([
      supabase
        .from('job_checkins')
        .select('id, user_name, checked_in_at, checked_out_at, latitude, longitude')
        .eq('job_id', jobId)
        .order('checked_in_at', { ascending: true }),
      supabase
        .from('job_notes')
        .select('id, author_name, note, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false }),
    ]);
    const documentsResult = documentsQuery ? await documentsQuery : null;
    if (checkinsResult.error && notesResult.error && !documentsResult?.data) return;
    await mutate(jobId, (extras) => {
      let next = extras;
      if (!checkinsResult.error && checkinsResult.data) {
        const localBySrv = new Map(
          extras.checkins
            .filter((visit) => visit.server_id)
            .map((visit) => [visit.server_id!, visit]),
        );
        const fromServer: CheckIn[] = checkinsResult.data.map((row) => {
          const serverId = String(row.id);
          const local = localBySrv.get(serverId);
          const serverOut = row.checked_out_at ? String(row.checked_out_at) : undefined;
          // A local checkout the server hasn't seen yet must win — and get
          // re-pushed — or a stale fetch would reopen the visit forever.
          if (!serverOut && local?.checked_out_at) {
            pushCheckout(serverId, local.checked_out_at);
          }
          return {
            id: `srv-${serverId}`,
            server_id: serverId,
            checked_in_at: String(row.checked_in_at),
            checked_out_at: serverOut ?? local?.checked_out_at,
            latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
            longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
            user_name: typeof row.user_name === 'string' ? row.user_name : undefined,
          };
        });
        // Keep unsynced local rows unless the server already has that exact
        // visit (insert landed but the server_id write-back hasn't yet).
        const serverStarts = new Set(fromServer.map((visit) => visit.checked_in_at));
        const localOnly = extras.checkins.filter(
          (visit) => !visit.server_id && !serverStarts.has(visit.checked_in_at),
        );
        next = {
          ...next,
          checkins: [...fromServer, ...localOnly].sort((a, b) =>
            a.checked_in_at < b.checked_in_at ? -1 : 1,
          ),
        };
      }
      if (!notesResult.error && notesResult.data) {
        const fromServer: JobNote[] = notesResult.data
          .filter((row) => !deletedNoteIds.has(String(row.id)))
          .map((row) => ({
            id: `srv-${row.id}`,
            server_id: String(row.id),
            text: String(row.note ?? ''),
            author: String(row.author_name ?? 'Team member'),
            created_at: String(row.created_at),
          }));
        const serverTexts = new Set(fromServer.map((note) => `${note.author}::${note.text}`));
        const localOnly = extras.notes.filter(
          (note) => !note.server_id && !serverTexts.has(`${note.author}::${note.text}`),
        );
        next = {
          ...next,
          notes: [...fromServer, ...localOnly].sort((a, b) =>
            a.created_at < b.created_at ? 1 : -1,
          ),
        };
      }
      if (documentsResult && !documentsResult.error && Array.isArray(documentsResult.data)) {
        next = {
          ...next,
          documents: mergeDocuments(
            next.documents,
            documentsResult.data as Record<string, unknown>[],
            fetchedAt,
          ),
        };
      }
      return next;
    });
  } catch {
    // Offline — local data stands.
  }
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.-]/g, '_').slice(-80);
  return cleaned || 'document';
}

/** The object key inside the `media` bucket, recovered from a public URL. */
function storageKeyFromUrl(url: string): string | null {
  const marker = '/object/public/media/';
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const key = url.slice(at + marker.length).split('?')[0];
  return key ? decodeURIComponent(key) : null;
}

/** Why this job's documents cannot go anywhere, or null when they can. */
function describeNoServer(jobId: string): string | null {
  if (!isSupabaseConfigured) {
    return 'Demo mode — documents stay on this device until a workspace is connected.';
  }
  if (!UUID_RE.test(jobId)) {
    return 'This job has not synced to your workspace yet, so its documents stay on this device.';
  }
  return null;
}

async function patchDocument(
  jobId: string,
  documentId: string,
  patch: Partial<JobDocument>,
): Promise<void> {
  await mutate(jobId, (extras) => ({
    ...extras,
    documents: extras.documents.map((doc) =>
      doc.id === documentId ? { ...doc, ...patch } : doc,
    ),
  }));
}

async function removeLocalCopy(doc: JobDocument): Promise<void> {
  const path = doc.local_uri ?? (doc.uri.startsWith('file:') ? doc.uri : undefined);
  if (!path || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // A leftover file costs disk, not correctness.
  }
}

/** A storage 409: the object is already there, which is what a retry wants. */
function isDuplicateObject(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return String(status) === '409' || /already exists|duplicate/i.test(errorText(error));
}

/**
 * Whether the bytes are genuinely gone rather than temporarily unreadable.
 * A file that no longer exists must stop offering a retry that can never work.
 */
async function fileMissing(doc: JobDocument): Promise<boolean> {
  const source = doc.local_uri ?? doc.uri;
  if (Platform.OS === 'web') return /^(blob|data):/.test(source);
  if (!source.startsWith('file:')) return false;
  try {
    const info = (await FileSystem.getInfoAsync(source)) as { exists?: boolean };
    return info?.exists === false;
  } catch {
    return false;
  }
}

/**
 * Bytes for one attachment. `picked` is the web File straight from the picker —
 * the only readable handle there, since a blob: URL cannot be re-fetched after
 * the page that made it has gone.
 */
async function readDocumentBytes(doc: JobDocument, picked?: File): Promise<ArrayBuffer | Blob> {
  if (picked) return picked;
  const source = doc.local_uri ?? doc.uri;
  if (Platform.OS !== 'web' && source.startsWith('file:')) {
    const base64 = await FileSystem.readAsStringAsync(source, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return decode(base64);
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error('The file could not be read from this device.');
  return await response.blob();
}

/**
 * Get one document onto the server: object into Storage, then the
 * `job_documents` row that makes it visible to the rest of the workspace.
 *
 * Both halves must land. An object with no row is listed by nobody, so it is
 * reported as still-local and stays retryable rather than being called shared.
 */
async function pushDocument(
  doc: JobDocument,
  jobId: string,
  picked?: File,
): Promise<{ patch: Partial<JobDocument>; error?: string }> {
  const blocked = describeNoServer(jobId);
  if (blocked) return { patch: { sync: 'local', sync_note: blocked } };

  const path = doc.storage_path ?? `project-documents/${jobId}/${Date.now()}-${safeFileName(doc.name)}`;
  let url = doc.remote_url;
  if (!url) {
    let body: ArrayBuffer | Blob;
    try {
      body = await readDocumentBytes(doc, picked);
    } catch (error) {
      const reason = errorText(error);
      const gone = await fileMissing(doc);
      return {
        patch: {
          storage_path: path,
          sync: gone ? 'lost' : 'failed',
          sync_note: gone
            ? 'The file is no longer on this device, so it can never be uploaded.'
            : `Could not read the file: ${reason}`,
        },
        error: reason,
      };
    }
    try {
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, body, { contentType: doc.mime_type, upsert: false });
      if (uploadError && !isDuplicateObject(uploadError)) throw uploadError;
    } catch (error) {
      const reason = errorText(error);
      return {
        patch: {
          storage_path: path,
          sync: 'failed',
          sync_note: `On this device only — the upload has not gone through (${reason})`,
        },
        error: reason,
      };
    }
    url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  }

  try {
    const { data, error } = await supabase
      .from('job_documents')
      .insert({
        job_id: jobId,
        filename: safeFileName(doc.name),
        original_name: doc.name,
        file_path: url,
        file_size: doc.size,
        mime_type: doc.mime_type,
      })
      .select('id')
      .single();
    if (error) throw error;
    return {
      patch: {
        server_id: data?.id ? String(data.id) : undefined,
        remote_url: url,
        storage_path: path,
        uri: url,
        sync: data?.id ? 'shared' : 'failed',
        sync_note: data?.id
          ? undefined
          : 'Uploaded, but it is not listed for your team yet — try again.',
      },
    };
  } catch (error) {
    const reason = errorText(error);
    return {
      // The bytes are up, but nothing lists them: still not shared.
      patch: {
        remote_url: url,
        storage_path: path,
        sync: 'failed',
        sync_note: `Uploaded, but it could not be listed for your team (${reason})`,
      },
      error: reason,
    };
  }
}

export const jobExtras = {
  async get(jobId: string): Promise<JobExtras> {
    const map = await load();
    void hydrateFromServer(jobId);
    return map[jobId] ?? emptyExtras();
  },

  /** Every job's extras (used by team presence to find active check-ins). */
  async getAll(): Promise<Record<string, JobExtras>> {
    return load();
  },

  /** The check-in without a checkout, if any. */
  async activeCheckIn(jobId: string): Promise<CheckIn | undefined> {
    const extras = await jobExtras.get(jobId);
    return extras.checkins.find((visit) => !visit.checked_out_at);
  },

  async checkIn(
    jobId: string,
    geo?: { latitude: number; longitude: number },
    userName?: string,
  ): Promise<void> {
    const id = localId('ci');
    const startedAt = new Date().toISOString();
    await mutate(jobId, (extras) => ({
      ...extras,
      checkins: [
        ...extras.checkins,
        {
          id,
          checked_in_at: startedAt,
          latitude: geo?.latitude,
          longitude: geo?.longitude,
          user_name: userName,
        },
      ],
    }));
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('job_checkins')
          .insert({
            job_id: jobId,
            user_name: userName ?? 'Team member',
            checked_in_at: startedAt,
            latitude: geo?.latitude ?? null,
            longitude: geo?.longitude ?? null,
          })
          .select('id')
          .single();
        if (data?.id) {
          let checkedOutMeanwhile: string | undefined;
          await mutate(jobId, (extras) => ({
            ...extras,
            checkins: extras.checkins.map((visit) => {
              if (visit.id !== id) return visit;
              checkedOutMeanwhile = visit.checked_out_at;
              return { ...visit, server_id: String(data.id) };
            }),
          }));
          // The user may have checked out while the insert was in flight —
          // close the server row too, or it stays open forever.
          if (checkedOutMeanwhile) pushCheckout(String(data.id), checkedOutMeanwhile);
        }
      } catch {
        // Stays local; presence still works on this device.
      }
    }
  },

  async checkOut(jobId: string): Promise<void> {
    const endedAt = new Date().toISOString();
    const map = await load();
    const open = (map[jobId]?.checkins ?? []).filter((visit) => !visit.checked_out_at);
    await mutate(jobId, (extras) => ({
      ...extras,
      checkins: extras.checkins.map((visit) =>
        visit.checked_out_at ? visit : { ...visit, checked_out_at: endedAt },
      ),
    }));
    if (isSupabaseConfigured) {
      for (const visit of open) {
        // Rows without a server_id are handled when the in-flight insert
        // resolves (checkIn re-pushes the checkout) or on the next hydrate.
        if (visit.server_id) pushCheckout(visit.server_id, endedAt);
      }
    }
  },

  async addNote(jobId: string, text: string, author: string): Promise<void> {
    const id = localId('n');
    await mutate(jobId, (extras) => ({
      ...extras,
      notes: [
        { id, text: text.trim(), author, created_at: new Date().toISOString() },
        ...extras.notes,
      ],
    }));
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('job_notes')
          .insert({ job_id: jobId, author_name: author, note: text.trim() })
          .select('id')
          .single();
        if (data?.id) {
          await mutate(jobId, (extras) => ({
            ...extras,
            notes: extras.notes.map((note) =>
              note.id === id ? { ...note, server_id: String(data.id) } : note,
            ),
          }));
        }
      } catch {
        // Stays local.
      }
    }
  },

  async deleteNote(jobId: string, noteId: string): Promise<void> {
    const map = await load();
    const target = (map[jobId]?.notes ?? []).find((note) => note.id === noteId);
    // Tombstone first so no hydrate can resurrect it, even if the server
    // delete fails.
    if (target?.server_id) deletedNoteIds.add(target.server_id);
    await mutate(jobId, (extras) => ({
      ...extras,
      notes: extras.notes.filter((note) => note.id !== noteId),
    }));
    if (isSupabaseConfigured && target?.server_id) {
      try {
        await supabase.from('job_notes').delete().eq('id', target.server_id);
      } catch {
        // Tombstoned locally either way.
      }
    }
  },

  /**
   * Detach a document: removed from the job everywhere this device can reach.
   * The row is tombstoned first, so a hydrate cannot bring it back even if the
   * server-side delete fails.
   */
  async deleteDocument(jobId: string, documentId: string): Promise<void> {
    const map = await load();
    const target = (map[jobId]?.documents ?? []).find((doc) => doc.id === documentId);
    if (target?.server_id) deletedDocumentIds.add(target.server_id);
    await mutate(jobId, (extras) => ({
      ...extras,
      documents: extras.documents.filter((doc) => doc.id !== documentId),
    }));
    if (!target) return;
    await removeLocalCopy(target);
    if (!isSupabaseConfigured) return;
    if (target.server_id) {
      try {
        await supabase.from('job_documents').delete().eq('id', target.server_id);
      } catch {
        // Tombstoned locally either way.
      }
    }
    const key = target.storage_path ?? storageKeyFromUrl(target.remote_url ?? target.uri);
    if (key) {
      try {
        await supabase.storage.from('media').remove([key]);
      } catch {
        // An orphaned object is invisible to the app; the row is what lists it.
      }
    }
  },

  /**
   * Pick a document and attach it to the job.
   *
   * The local record is written first so the file appears immediately, then
   * the upload runs and the record is patched with where it really ended up.
   *
   * The three outcomes are deliberately distinct:
   *   `{}`                       — the user cancelled.
   *   `{ error }`                — nothing was attached at all.
   *   `{ added, shared, localOnly }` — it is on the job. `shared` means a
   *     teammate can open it; `localOnly` is the sentence to show when they
   *     cannot, and is never set at the same time as `shared`.
   */
  async addDocument(
    jobId: string,
  ): Promise<{ added?: boolean; shared?: boolean; localOnly?: string; error?: string }> {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    } catch (error) {
      return { error: errorText(error) };
    }
    if (result.canceled || !result.assets?.length) return {};
    const asset = result.assets[0];
    const name = asset.name ?? 'document';
    const mime = asset.mimeType ?? 'application/octet-stream';
    const picked = asset.file;
    const size = asset.size ?? picked?.size ?? 0;
    const id = localId('d');

    // Keep a durable copy: the picker's cache directory is purgeable, and on
    // web there is no filesystem to copy into at all.
    let localUri: string | undefined;
    if (Platform.OS !== 'web') {
      try {
        const dir = `${FileSystem.documentDirectory ?? ''}documents/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
        const target = `${dir}${Date.now()}-${safeFileName(name)}`;
        await FileSystem.copyAsync({ from: asset.uri, to: target });
        localUri = target;
      } catch {
        // Copy failed — the picker uri still works for this session.
      }
    }

    const volatile = Platform.OS === 'web' && /^(blob|data):/.test(asset.uri);
    const offline = describeNoServer(jobId);
    const draft: JobDocument = {
      id,
      name,
      uri: localUri ?? asset.uri,
      local_uri: localUri,
      mime_type: mime,
      size,
      added_at: new Date().toISOString(),
      storage_path: `project-documents/${jobId}/${Date.now()}-${safeFileName(name)}`,
      // Written before the upload runs, and true at that instant: the file is
      // on the device and nowhere else. If the app dies mid-upload the record
      // that survives is one the user can retry, not one that lies.
      sync: offline ? 'local' : 'failed',
      sync_note: offline ?? 'Not uploaded yet.',
      volatile: volatile || undefined,
      session: volatile ? SESSION_ID : undefined,
    };

    await mutate(jobId, (extras) => ({
      ...extras,
      documents: [draft, ...extras.documents],
    }));

    if (offline) return { added: true, shared: false, localOnly: offline };

    const outcome = await pushDocument(draft, jobId, picked);
    // On web a failed upload leaves nothing durable behind — the blob dies with
    // the page — so do not leave a row implying the file is still attached.
    if (outcome.error && !localUri && Platform.OS === 'web') {
      await mutate(jobId, (extras) => ({
        ...extras,
        documents: extras.documents.filter((doc) => doc.id !== id),
      }));
      return { error: `${outcome.error} Nothing was attached — try again.` };
    }
    await patchDocument(jobId, id, outcome.patch);
    const shared = outcome.patch.sync === 'shared';
    return {
      added: true,
      shared,
      localOnly: shared ? undefined : (outcome.patch.sync_note ?? outcome.error),
    };
  },

  /**
   * Try the upload again for a document still sitting on this device.
   * The storage key was frozen when it was attached, so a retry that lands
   * after the bytes did re-uses the same object instead of orphaning one.
   */
  async retryDocumentUpload(
    jobId: string,
    documentId: string,
  ): Promise<{ shared?: boolean; error?: string }> {
    const map = await load();
    const target = (map[jobId]?.documents ?? []).find((doc) => doc.id === documentId);
    if (!target) return { error: 'That document is no longer attached to this job.' };
    const status = documentStatus(target);
    if (status.state === 'shared') return { shared: true };
    if (!status.retryable) return { error: status.note ?? 'This document cannot be uploaded.' };
    const outcome = await pushDocument(target, jobId);
    await patchDocument(jobId, documentId, outcome.patch);
    return { shared: outcome.patch.sync === 'shared', error: outcome.error };
  },

  async setDocumentTags(jobId: string, documentId: string, tags: string[]): Promise<void> {
    const clean = tags.map((tag) => tag.trim()).filter(Boolean);
    await patchDocument(jobId, documentId, { tags: clean.length ? clean : undefined });
    const map = await load();
    const target = (map[jobId]?.documents ?? []).find((doc) => doc.id === documentId);
    if (!isSupabaseConfigured || !target?.server_id) return;
    try {
      // job_documents.tags is what the web client reads; a database without it
      // just leaves the tags on this device.
      await supabase.from('job_documents').update({ tags: clean }).eq('id', target.server_id);
    } catch {
      // Tags stay local.
    }
  },

  /** Store a finished voice recording with the job (durable local copy). */
  async addVoiceNote(
    jobId: string,
    recordingUri: string,
    durationMs: number,
    author?: string,
  ): Promise<void> {
    let uri = recordingUri;
    try {
      const dir = `${FileSystem.documentDirectory ?? ''}voice-notes/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
      const ext = recordingUri.split('.').pop() ?? 'm4a';
      const target = `${dir}${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: recordingUri, to: target });
      uri = target;
    } catch {
      // Web or copy failure — keep the recorder uri.
    }
    await mutate(jobId, (extras) => ({
      ...extras,
      voiceNotes: [
        {
          id: localId('v'),
          uri,
          duration_ms: durationMs,
          created_at: new Date().toISOString(),
          author,
        },
        ...(extras.voiceNotes ?? []),
      ],
    }));
  },

  async deleteVoiceNote(jobId: string, voiceNoteId: string): Promise<void> {
    await mutate(jobId, (extras) => ({
      ...extras,
      voiceNotes: (extras.voiceNotes ?? []).filter((note) => note.id !== voiceNoteId),
    }));
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** "7h 14m" style duration between two ISO timestamps. */
export function visitDuration(checkedIn: string, checkedOut?: string): string {
  const start = new Date(checkedIn).getTime();
  const end = checkedOut ? new Date(checkedOut).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '';
  const minutes = Math.round((end - start) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${rest}m`;
}
