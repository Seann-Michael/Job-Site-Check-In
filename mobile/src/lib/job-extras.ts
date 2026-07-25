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
}

export interface JobNote {
  id: string;
  text: string;
  author: string;
  created_at: string;
}

export interface JobDocument {
  id: string;
  name: string;
  uri: string;
  mime_type: string;
  size: number;
  added_at: string;
}

interface JobExtras {
  checkins: CheckIn[];
  notes: JobNote[];
  documents: JobDocument[];
}

type ExtrasMap = Record<string, JobExtras>;

const EMPTY: JobExtras = { checkins: [], notes: [], documents: [] };

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
  const next = fn(map[jobId] ?? { ...EMPTY });
  map[jobId] = next;
  cache = map;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);
  emit();
  return next;
}

export const jobExtras = {
  async get(jobId: string): Promise<JobExtras> {
    const map = await load();
    return map[jobId] ?? { ...EMPTY };
  },

  /** The check-in without a checkout, if any. */
  async activeCheckIn(jobId: string): Promise<CheckIn | undefined> {
    const extras = await jobExtras.get(jobId);
    return extras.checkins.find((visit) => !visit.checked_out_at);
  },

  async checkIn(jobId: string, geo?: { latitude: number; longitude: number }): Promise<void> {
    await mutate(jobId, (extras) => ({
      ...extras,
      checkins: [
        ...extras.checkins,
        {
          id: `ci-${Date.now()}`,
          checked_in_at: new Date().toISOString(),
          latitude: geo?.latitude,
          longitude: geo?.longitude,
        },
      ],
    }));
  },

  async checkOut(jobId: string): Promise<void> {
    await mutate(jobId, (extras) => ({
      ...extras,
      checkins: extras.checkins.map((visit) =>
        visit.checked_out_at ? visit : { ...visit, checked_out_at: new Date().toISOString() },
      ),
    }));
  },

  async addNote(jobId: string, text: string, author: string): Promise<void> {
    await mutate(jobId, (extras) => ({
      ...extras,
      notes: [
        { id: `n-${Date.now()}`, text: text.trim(), author, created_at: new Date().toISOString() },
        ...extras.notes,
      ],
    }));
  },

  async deleteNote(jobId: string, noteId: string): Promise<void> {
    await mutate(jobId, (extras) => ({
      ...extras,
      notes: extras.notes.filter((note) => note.id !== noteId),
    }));
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
