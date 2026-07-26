/**
 * Per-job extras: site-visit check-ins, notes, and document attachments.
 * Stored on-device (AsyncStorage) for instant, offline-friendly use.
 * Documents also upload to Supabase Storage + a job_documents row when
 * configured; check-ins/notes server sync arrives with a later milestone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-job-extras-v1';

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

export interface JobDocument {
  id: string;
  name: string;
  uri: string;
  mime_type: string;
  size: number;
  added_at: string;
}

export interface VoiceNote {
  id: string;
  uri: string;
  duration_ms: number;
  created_at: string;
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
  try {
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
    if (checkinsResult.error && notesResult.error) return;
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
      return next;
    });
  } catch {
    // Offline — local data stands.
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

  async deleteDocument(jobId: string, documentId: string): Promise<void> {
    await mutate(jobId, (extras) => ({
      ...extras,
      documents: extras.documents.filter((doc) => doc.id !== documentId),
    }));
  },

  /** Pick a document, store it with the job (and upload when configured). */
  async addDocument(jobId: string): Promise<{ added?: boolean; error?: string }> {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return {};
    const asset = result.assets[0];
    const name = asset.name ?? 'document';
    const mime = asset.mimeType ?? 'application/octet-stream';
    const size = asset.size ?? 0;

    let uri = asset.uri;

    // Keep a durable local copy (picker cache is purgeable).
    try {
      const dir = `${FileSystem.documentDirectory ?? ''}documents/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
      const target = `${dir}${Date.now()}-${name.replace(/[^\w.-]/g, '_')}`;
      await FileSystem.copyAsync({ from: asset.uri, to: target });
      uri = target;
    } catch {
      // Web or copy failure — keep the picker uri.
    }

    // Best-effort server upload, mirroring the web app's document storage.
    if (isSupabaseConfigured) {
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const path = `project-documents/${jobId}/${Date.now()}-${name.replace(/[^\w.-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(path, decode(base64), { contentType: mime, upsert: false });
        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('media').getPublicUrl(path);
          uri = publicUrl;
          await supabase.from('job_documents').insert({
            job_id: jobId,
            filename: name,
            original_name: name,
            file_path: publicUrl,
            file_size: size,
            mime_type: mime,
          });
        }
      } catch {
        // Local copy still attached.
      }
    }

    await mutate(jobId, (extras) => ({
      ...extras,
      documents: [
        { id: `d-${Date.now()}`, name, uri, mime_type: mime, size, added_at: new Date().toISOString() },
        ...extras.documents,
      ],
    }));
    return { added: true };
  },

  /** Store a finished voice recording with the job (durable local copy). */
  async addVoiceNote(jobId: string, recordingUri: string, durationMs: number): Promise<void> {
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
        { id: `v-${Date.now()}`, uri, duration_ms: durationMs, created_at: new Date().toISOString() },
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
