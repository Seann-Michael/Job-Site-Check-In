/**
 * Media capture: camera photos, camera videos, and device-gallery uploads.
 *
 * Photos are downscaled/re-encoded per the media settings and can be stamped
 * (timestamp / GPS / business name burned into the image via StampHost).
 * Saving mirrors the web app's uploadProjectMedia: Supabase Storage bucket
 * 'media' at project-media/{jobId}/{name}, then a job_media row with GPS in
 * the geolocation column and metadata json. Demo mode keeps files on-device.
 *
 * Capture order is durability first: the bytes are copied to the app's
 * documents directory and a thumbnail is generated BEFORE any network call,
 * then the item is queued and the upload runs out of the queue. The previous
 * order — upload first, queue only if a regex matched the error message as
 * "network-related" — silently dropped a photo whenever the failure was an
 * expired login, a 413, a storage policy denial or a captive portal.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { Linking, Platform } from 'react-native';

import { stampImage } from '@/components/stamp-host';
import { snapshotUploader } from '@/lib/identity';
import { getLogoUri } from '@/lib/logo';
import { getMediaPrefs, QUALITY_DIMENSIONS } from '@/lib/media-prefs';
import { mediaStore } from '@/lib/media-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { uploadQueue, type FlushFailureKind, type QueuedUpload } from '@/lib/upload-queue';
import { workspace } from '@/lib/workspace';
import type { MediaCategory, MediaItem } from '@/lib/types';

export type CaptureSource = 'camera-photo' | 'camera-video' | 'library';

/**
 * Outcome of saving one captured item. `status` is the whole answer — read
 * it, never the presence of a message:
 *
 * - `saved`  — stored server-side (or on-device in demo mode).
 * - `queued` — SUCCESS. The bytes are in the app's own storage and the item is
 *   already in the job; only the upload is outstanding. Reporting this as a
 *   failure tells a tech their photo is gone when it is not.
 * - `failed` — the only real failure: nothing was persisted anywhere.
 *
 * `error` lives on the `failed` member alone, so "queued *and* errored" is a
 * value that cannot be constructed. A queued upload that needs a person
 * (expired login, oversized file) says so in `uploadNeedsAttention`, which is
 * a nuance on a success, not a failure.
 */
interface CaptureSaved {
  status: 'saved';
  item: MediaItem;
  queued?: false;
  error?: undefined;
  uploadNeedsAttention?: undefined;
  hasLocation?: boolean;
}

interface CaptureQueued {
  status: 'queued';
  /** Always true: "safe on this device, upload pending". */
  queued: true;
  item?: undefined;
  error?: undefined;
  /**
   * Set when the queued upload will not clear on its own — the photo is still
   * safe, but someone has to open Settings › Uploads.
   */
  uploadNeedsAttention?: string;
  hasLocation?: boolean;
}

interface CaptureFailed {
  status: 'failed';
  /** Why nothing could be saved. Present on this member only. */
  error: string;
  item?: undefined;
  queued?: false;
  uploadNeedsAttention?: undefined;
  hasLocation?: boolean;
}

export type CaptureResult = CaptureSaved | CaptureQueued | CaptureFailed;

/**
 * The words for a capture outcome, in one place so no screen has to decide
 * for itself what "queued" means. `savedMessage` is the screen's own sentence
 * for the happy path; the queued copy builds on it instead of contradicting
 * it.
 */
export function captureNotice(
  result: CaptureResult,
  savedMessage: string,
): { title: string; body: string } {
  if (result.status === 'failed') return { title: 'Could not save', body: result.error };
  if (result.status === 'queued') {
    return {
      title: 'Saved offline',
      body: result.uploadNeedsAttention
        ? `${savedMessage} It is safe on this device, but the upload needs attention — open Settings › Uploads. (${result.uploadNeedsAttention})`
        : `${savedMessage} It uploads automatically when you have signal.`,
    };
  }
  return { title: 'Saved', body: savedMessage };
}

export interface MultiCaptureResult {
  /** Uploaded during this capture. */
  saved: number;
  /** Saved on-device and queued for upload. */
  queued: number;
  canceled?: boolean;
  needsSettings?: boolean;
  /** Reason the last unsaved asset was refused (e.g. an over-long video). */
  error?: string;
  hasLocation?: boolean;
}

const PENDING_CAPTURE_KEY = 'lsr-pending-capture-v1';
const MAX_DIMENSION = 2048;
/** Grid tiles render this instead of the 2048px original. */
const THUMBNAIL_WIDTH = 384;
/** Longest clip we accept from the library picker, which imposes no limit itself. */
const MAX_VIDEO_SECONDS = 120;
/** Ceiling on a picked clip, so a 4K recording is refused up front, not after a failed upload. */
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Durable home for captured bytes — outside the picker's purgeable cache. */
const CAPTURED_DIR = `${FileSystem.documentDirectory ?? ''}captured/`;

export function openAppSettings() {
  void Linking.openSettings();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const raw = error as Record<string, unknown>;
    if (typeof raw.message === 'string' && raw.message) return raw.message;
  }
  const text = String(error ?? '');
  return text && text !== '[object Object]' ? text : 'Upload failed.';
}

/** HTTP status off a Supabase storage / PostgREST error, when it carries one. */
function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const raw = error as Record<string, unknown>;
  const candidate = raw.status ?? raw.statusCode;
  const value = typeof candidate === 'string' ? Number(candidate) : candidate;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * What a failed upload means for the queued item.
 *
 * This replaces the old "is the message network-ish?" test, whose only two
 * outcomes were "retry" and "throw the photo away". Now nothing is thrown
 * away: the question is only whether to spend an attempt (`retry`), park the
 * item for manual attention (`blocked`), or treat the link as down and leave
 * the item untouched (`offline`).
 */
function classifyUploadError(error: unknown): FlushFailureKind {
  const message = errorMessage(error);
  const status = errorStatus(error);
  if (
    status === 413 ||
    /too large|payload too|exceeded the maximum|maximum allowed size/i.test(message)
  ) {
    return 'blocked';
  }
  if (
    status === 401 ||
    status === 403 ||
    /jwt|expired|not authori[sz]ed|unauthori[sz]ed|permission|row-level security|violates .* policy/i.test(
      message,
    )
  ) {
    return 'blocked';
  }
  if (/no such file|could not be read|does not exist at path|enoent|file not found/i.test(message)) {
    return 'blocked';
  }
  if (/network|fetch|timed? ?out|connection|offline|unreachable|internet/i.test(message)) {
    return 'offline';
  }
  if (status === 400 || status === 422) return 'blocked';
  // 5xx, a captive portal's HTML parsed as JSON, anything unrecognised: worth
  // another go, and the queue's attempt ceiling stops it becoming forever.
  return 'retry';
}

/** The retry landed after the bytes did: the object is already there. */
function isDuplicateObject(error: unknown): boolean {
  return errorStatus(error) === 409 || /already exists|duplicate/i.test(errorMessage(error));
}

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export async function getLocationFix(): Promise<GeoFix | undefined> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    if (!position) return undefined;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    };
  } catch {
    return undefined;
  }
}

type PickOutcome =
  | { kind: 'assets'; assets: ImagePicker.ImagePickerAsset[] }
  | { kind: 'canceled' }
  | { kind: 'needs-settings' }
  | { kind: 'error'; message: string };

async function pickMedia(source: CaptureSource): Promise<PickOutcome> {
  const wrap = (result: ImagePicker.ImagePickerResult): PickOutcome => {
    if (result.canceled || !result.assets?.length) return { kind: 'canceled' };
    return { kind: 'assets', assets: result.assets };
  };

  if (source === 'library' || Platform.OS === 'web') {
    return wrap(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        exif: true,
      }),
    );
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    // Permanently denied: don't silently open the library — the user asked
    // for the camera. Point them at Settings instead.
    if (!permission.canAskAgain) return { kind: 'needs-settings' };
    return { kind: 'error', message: 'Camera permission is needed to capture job media.' };
  }

  try {
    if (source === 'camera-video') {
      return wrap(
        await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 30 }),
      );
    }
    return wrap(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: true }));
  } catch {
    // No camera hardware (simulator) — the library is the honest fallback.
    return wrap(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: source === 'camera-video' ? ['videos'] : ['images'],
        exif: true,
      }),
    );
  }
}

/**
 * Downscale + re-encode to JPEG so uploads are bounded and mime is known.
 * No base64: the upload reads the durable copy back from disk, and holding a
 * 2048px photo as a base64 string is pure memory pressure on an old phone.
 */
async function normalizeImage(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ uri: string; width: number; height: number }> {
  const prefs = await getMediaPrefs();
  const maxDimension = QUALITY_DIMENSIONS[prefs.quality] ?? Number.MAX_SAFE_INTEGER;
  const width = asset.width ?? MAX_DIMENSION;
  const actions: ImageManipulator.Action[] =
    width > maxDimension ? [{ resize: { width: maxDimension } }] : [];
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}

interface UploadFile {
  /** Source file on disk. */
  uri?: string;
  width?: number;
  height?: number;
  ext: string;
  contentType: string;
  mediaType: 'image' | 'video';
}

function randomSuffix(length = 8): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}

/** Copy out of the picker's purgeable cache into the app documents dir. */
async function persistLocalCopy(uri: string, ext = 'jpg', prefix = ''): Promise<string> {
  try {
    if (!FileSystem.documentDirectory) return uri;
    await FileSystem.makeDirectoryAsync(CAPTURED_DIR, { intermediates: true }).catch(
      () => undefined,
    );
    const target = `${CAPTURED_DIR}${prefix}${Date.now()}-${randomSuffix(6)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch {
    // Web (no documentDirectory) or copy failure — keep the original URI.
    return uri;
  }
}

/**
 * Delete a copy this module made. Guarded by the captured/ prefix: the picker
 * hands back URIs inside the user's own photo library, and deleting one of
 * those would destroy a photo we do not own.
 */
async function deleteLocalCopy(uri?: string): Promise<void> {
  if (!uri || !FileSystem.documentDirectory || !uri.startsWith(CAPTURED_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // A leftover file costs disk space; failing here must not undo an upload.
  }
}

/**
 * A 384px JPEG stored next to the full image. Grids that render the 2048px
 * original pull ~500KB per tile — a 200-photo job is >100MB over cellular.
 * Best-effort: a missing thumbnail degrades to the full image, never an error.
 */
async function makeThumbnail(uri: string, width?: number): Promise<string | undefined> {
  try {
    const actions: ImageManipulator.Action[] =
      !width || width > THUMBNAIL_WIDTH ? [{ resize: { width: THUMBNAIL_WIDTH } }] : [];
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return await persistLocalCopy(result.uri, 'jpg', 'thumb-');
  } catch {
    return undefined;
  }
}

/** The file is gone: a missing-file message, so the queue parks the item
 *  instead of retrying a URI that can never resolve. */
const MISSING_FILE = 'The file could not be read from this device.';

/** Bytes for one file. Videos always stream as a blob — base64-decoding a
 *  two-minute clip (hundreds of MB as string + buffer) is an OOM crash. */
async function readUploadBody(
  uri: string,
  mediaType: 'image' | 'video',
): Promise<{ body: ArrayBuffer | Blob; size: number }> {
  if (Platform.OS !== 'web' && uri.startsWith('file:')) {
    // Check first: fetch() on a missing file reports "Network request failed",
    // which would otherwise look like being offline and retry forever.
    try {
      const info = (await FileSystem.getInfoAsync(uri)) as { exists: boolean };
      if (!info.exists) throw new Error(MISSING_FILE);
    } catch (error) {
      if (error instanceof Error && error.message === MISSING_FILE) throw error;
      // Couldn't stat it — carry on and let the read itself decide.
    }
  }

  if (mediaType === 'image' && Platform.OS !== 'web') {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = decode(base64);
    return { body: bytes, size: bytes.byteLength };
  }

  let response: Response;
  try {
    response = await fetch(uri);
  } catch (error) {
    // A blob:/data: URL only lives as long as the page that made it. On web a
    // queued item can outlive its own URL, and that is a dead file, not a
    // network outage — it must never retry forever.
    if (/^(blob|data):/.test(uri)) throw new Error(MISSING_FILE);
    throw error;
  }
  const blob = await response.blob();
  return { body: blob, size: blob.size };
}

/** Storage path for an item's thumbnail, derived from its frozen object key. */
function thumbKeyFor(storageKey: string): string {
  const slash = storageKey.lastIndexOf('/');
  const dir = storageKey.slice(0, slash);
  const name = storageKey.slice(slash + 1).replace(/\.[^.]+$/, '');
  return `${dir}/thumbs/${name}.jpg`;
}

/**
 * Upload at a fixed path. A retry that lands after the bytes did gets a 409
 * from storage, which means "already there" — the point of freezing the key
 * at enqueue. Without it every attempt wrote a new timestamp-random object.
 */
async function uploadObject(
  path: string,
  body: ArrayBuffer | Blob,
  contentType: string,
): Promise<'stored' | 'existing'> {
  const { error } = await supabase.storage
    .from('media')
    .upload(path, body, { contentType, upsert: false });
  if (!error) return 'stored';
  if (isDuplicateObject(error)) return 'existing';
  throw error;
}

async function uploadThumbnail(item: QueuedUpload, storageKey: string): Promise<string | undefined> {
  if (!item.thumb_uri) return undefined;
  try {
    const { body } = await readUploadBody(item.thumb_uri, 'image');
    const key = thumbKeyFor(storageKey);
    await uploadObject(key, body, 'image/jpeg');
    const {
      data: { publicUrl },
    } = supabase.storage.from('media').getPublicUrl(key);
    return publicUrl;
  } catch {
    // The full image is what matters; a missing thumbnail is a slow grid.
    return undefined;
  }
}

/**
 * `job_media.uploaded_by / captured_at / uploaded_at` arrive with a migration
 * that has not been applied yet. Probe once per session and fall back to the
 * columns that exist today; the same values always go into `metadata` too, so
 * nothing is lost either way.
 */
let extendedMediaColumns: boolean | null = null;

function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    /column .* does not exist|could not find the .* column|schema cache/i.test(errorMessage(error))
  );
}

/** An uploader id the database won't accept (deleted user, demo id, no FK target). */
function isBadUploaderReference(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '23503' || /foreign key|invalid input syntax for type uuid/i.test(errorMessage(error));
}

async function findExistingRow(publicUrl: string): Promise<Record<string, unknown> | null> {
  try {
    // `id` only: any wider projection risks naming a column this database
    // doesn't have yet, and the id is all the caller needs.
    const { data, error } = await supabase
      .from('job_media')
      .select('id')
      .eq('file_path', publicUrl)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as Record<string, unknown> | null) ?? null;
  } catch {
    return null;
  }
}

function mediaItemFrom(
  row: Record<string, unknown>,
  item: QueuedUpload,
  publicUrl: string,
): MediaItem {
  return {
    id: typeof row.id === 'string' ? row.id : String(row.id ?? item.id),
    job_id: item.job_id,
    job_title: item.job_title,
    media_type: item.media_type ?? 'image',
    category: item.category,
    taken_at: item.taken_at,
    uri: publicUrl,
    latitude: item.latitude,
    longitude: item.longitude,
  };
}

async function insertMediaRow(
  item: QueuedUpload,
  publicUrl: string,
  byteLength: number,
  thumbnailPath: string | undefined,
): Promise<Record<string, unknown>> {
  const fileName = item.storage_key?.split('/').pop() ?? `${item.id}.${item.ext ?? 'jpg'}`;
  const uploadedAt = new Date().toISOString();
  const geolocation =
    typeof item.latitude === 'number' && typeof item.longitude === 'number'
      ? { latitude: item.latitude, longitude: item.longitude, accuracy: item.gps_accuracy ?? null }
      : null;

  // Same columns the web app writes in uploadProjectMedia, plus the
  // job_media.geolocation jsonb column.
  const base = {
    job_id: item.job_id,
    filename: fileName,
    original_name: fileName,
    file_path: publicUrl,
    file_size: byteLength,
    mime_type: item.content_type ?? 'image/jpeg',
    media_type: item.media_type ?? 'image',
    category: item.category,
    geolocation,
    metadata: {
      source: 'mobile',
      captured_at: item.taken_at,
      uploaded_at: uploadedAt,
      uploaded_by: item.uploaded_by,
      uploaded_by_name: item.uploaded_by_name,
      latitude: item.latitude,
      longitude: item.longitude,
      gps_accuracy_m: item.gps_accuracy,
      width: item.width || undefined,
      height: item.height || undefined,
      thumbnail_path: thumbnailPath,
      exif: item.exif,
    },
  };
  const extended = {
    captured_at: item.taken_at,
    uploaded_at: uploadedAt,
    ...(item.uploaded_by ? { uploaded_by: item.uploaded_by } : {}),
  };

  const insert = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('job_media').insert(payload).select().single();
    if (error) throw error;
    return (data ?? {}) as Record<string, unknown>;
  };

  if (extendedMediaColumns === false) return insert(base);
  try {
    const row = await insert({ ...base, ...extended });
    extendedMediaColumns = true;
    return row;
  } catch (error) {
    if (isMissingColumnError(error)) {
      // Pre-migration database: the values still live in `metadata`.
      extendedMediaColumns = false;
      return insert(base);
    }
    if (isBadUploaderReference(error)) return insert(base);
    throw error;
  }
}

/** Push one queued item: object at its frozen key, then the row. */
async function uploadQueuedItem(item: QueuedUpload): Promise<MediaItem> {
  const mediaType = item.media_type ?? 'image';
  const storageKey =
    item.storage_key ?? `project-media/${item.job_id}/${item.id}.${item.ext ?? 'jpg'}`;
  const { body, size } = await readUploadBody(item.uri, mediaType);
  const objectState = await uploadObject(storageKey, body, item.content_type ?? 'image/jpeg');
  const {
    data: { publicUrl },
  } = supabase.storage.from('media').getPublicUrl(storageKey);

  const thumbnailPath = await uploadThumbnail(item, storageKey);

  // Only pay for the lookup when this could be a repeat: a first attempt on a
  // freshly stored object cannot already have a row.
  if (objectState === 'existing' || (item.attempts ?? 0) > 0) {
    const existing = await findExistingRow(publicUrl);
    if (existing) return mediaItemFrom(existing, item, publicUrl);
  }
  const row = await insertMediaRow(item, publicUrl, size, thumbnailPath);
  return mediaItemFrom(row, item, publicUrl);
}

/**
 * Durability first, network second.
 *
 * 1. Copy the bytes somewhere the OS will not purge, and build a thumbnail.
 * 2. Demo mode stops there.
 * 3. Otherwise queue the item — with its storage key and its uploader frozen —
 *    and only then try to upload it. Whatever the upload does, the photo is
 *    already safe and already visible in the job.
 */
async function saveOrQueue(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  file: UploadFile & { uri: string },
  extras: { geo?: GeoFix; exif?: Record<string, unknown> },
): Promise<CaptureResult> {
  const takenAt = new Date().toISOString();
  const geo = extras.geo;
  const localUri = await persistLocalCopy(file.uri, file.ext);
  const thumbUri =
    file.mediaType === 'image' ? await makeThumbnail(localUri, file.width) : undefined;

  if (!isSupabaseConfigured) {
    const item: MediaItem = {
      id: `local-${Date.now()}-${randomSuffix(4)}`,
      job_id: jobId,
      job_title: jobTitle,
      media_type: file.mediaType,
      category,
      taken_at: takenAt,
      uri: localUri,
      thumb_uri: thumbUri,
      latitude: geo?.latitude,
      longitude: geo?.longitude,
    };
    await mediaStore.add(item);
    return { status: 'saved', item, hasLocation: Boolean(geo) };
  }

  // Frozen now, not at flush time: the crew member who shot this is often not
  // the session that finally syncs it.
  const uploader = await snapshotUploader();
  const id = `q-${Date.now()}-${randomSuffix(8)}`;
  const ext = file.ext;
  const queued: QueuedUpload = {
    id,
    job_id: jobId,
    job_title: jobTitle,
    category,
    uri: localUri,
    thumb_uri: thumbUri,
    width: file.width ?? 0,
    height: file.height ?? 0,
    taken_at: takenAt,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
    gps_accuracy: geo?.accuracy ?? undefined,
    ext,
    content_type: file.contentType,
    media_type: file.mediaType,
    exif: extras.exif,
    storage_key: `project-media/${jobId}/${Date.now()}-${randomSuffix(8)}.${ext}`,
    uploaded_by: uploader?.id,
    uploaded_by_name: uploader?.name ?? uploader?.email,
    attempts: 0,
    state: 'pending',
  };
  await uploadQueue.enqueue(queued);
  mediaStore.notifyChanged();

  const attempt = await uploadQueue.attemptNow(id);
  if (attempt.status === 'uploaded') {
    mediaStore.notifyChanged();
    return {
      status: 'saved',
      item: attempt.item ?? mediaItemFrom({}, queued, localUri),
      hasLocation: Boolean(geo),
    };
  }
  // Still on the device and still in the job, whatever went wrong — so this is
  // a success, and the type has no `error` to mistake it for anything else.
  // A blocked upload only adds "someone has to look at this".
  return {
    status: 'queued',
    queued: true,
    hasLocation: Boolean(geo),
    uploadNeedsAttention:
      attempt.status === 'blocked'
        ? (attempt.error ?? 'This upload was refused and will not retry on its own.')
        : undefined,
  };
}

/**
 * Save an already-processed JPEG (from the camera pipeline or a composed
 * image like a before/after collage) to the job's media. `base64` is accepted
 * because existing callers compute it, but nothing reads it any more — the
 * bytes come from the durable copy this makes.
 */
export async function savePreparedImage(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  image: { uri: string; base64?: string; width: number; height: number },
  extras?: { geo?: GeoFix; exif?: Record<string, unknown> },
): Promise<CaptureResult> {
  return saveOrQueue(
    jobId,
    jobTitle,
    category,
    { ...image, ext: 'jpg', contentType: 'image/jpeg', mediaType: 'image' },
    extras ?? {},
  );
}

function formatStampTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStampGps(geo: GeoFix): string {
  const lat = `${Math.abs(geo.latitude).toFixed(5)}° ${geo.latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(geo.longitude).toFixed(5)}° ${geo.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

/** Burn enabled overlays into the image; falls back to the original. */
async function applyStamps(
  image: { uri: string; width: number; height: number },
  geo: GeoFix | undefined,
): Promise<{ uri: string; width: number; height: number }> {
  const prefs = await getMediaPrefs();
  const business = await workspace.getCurrent();
  const lines: string[] = [];
  if (prefs.stampBusiness && business?.name) lines.push(business.name);
  if (prefs.stampTimestamp) lines.push(formatStampTimestamp(new Date()));
  if (prefs.stampGps && geo) lines.push(formatStampGps(geo));
  const logoUri = prefs.stampLogo && business ? await getLogoUri(business.id) : null;
  if ((lines.length === 0 && !logoUri) || Platform.OS === 'web') return image;

  const stampedUri = await stampImage({
    uri: image.uri,
    width: image.width,
    height: image.height,
    lines,
    emphasizeFirst: prefs.stampBusiness,
    logoUri: logoUri ?? undefined,
  });
  if (!stampedUri) return image;
  return { uri: stampedUri, width: image.width, height: image.height };
}

/** Save a video recorded by the in-app camera (upload or offline queue). */
export async function saveCameraVideo(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  video: { uri: string; width?: number; height?: number },
  geo: GeoFix | undefined,
): Promise<CaptureResult> {
  return saveVideoAsset(
    jobId,
    jobTitle,
    category,
    { uri: video.uri, width: video.width ?? 0, height: video.height ?? 0 } as ImagePicker.ImagePickerAsset,
    geo,
  );
}

/** Save a photo taken by the in-app camera through the normal pipeline
 *  (normalize → stamps → upload or offline queue). */
export async function saveCameraPhoto(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  photo: { uri: string; width: number; height: number; exif?: Record<string, unknown> },
  geo: GeoFix | undefined,
): Promise<CaptureResult> {
  return saveImageAsset(jobId, jobTitle, category, photo as ImagePicker.ImagePickerAsset, geo);
}

async function saveImageAsset(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  asset: ImagePicker.ImagePickerAsset,
  geo: GeoFix | undefined,
): Promise<CaptureResult> {
  const exif = (asset.exif ?? undefined) as Record<string, unknown> | undefined;
  let image: { uri: string; width: number; height: number };
  try {
    image = await normalizeImage(asset);
    image = await applyStamps(image, geo);
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Could not process the photo.',
    };
  }
  return savePreparedImage(jobId, jobTitle, category, image, { geo, exif });
}

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return minutes > 0 ? `${minutes}m ${whole % 60}s` : `${whole}s`;
}

/**
 * The library picker enforces no duration or size limit of its own, so a
 * five-minute 4K clip is selectable. Refuse it here, before it is copied and
 * queued: a 2GB file cannot upload, and the honest answer is "trim it", not a
 * queue item that retries forever.
 */
async function videoLimitError(
  asset: ImagePicker.ImagePickerAsset,
): Promise<string | undefined> {
  // expo-image-picker reports duration in milliseconds.
  const seconds = typeof asset.duration === 'number' ? asset.duration / 1000 : undefined;
  if (seconds && seconds > MAX_VIDEO_SECONDS + 1) {
    return `That clip is ${formatDuration(seconds)}. Videos are limited to ${
      MAX_VIDEO_SECONDS / 60
    } minutes — trim it and try again.`;
  }

  let size = typeof asset.fileSize === 'number' ? asset.fileSize : undefined;
  if (size === undefined) {
    try {
      const info = (await FileSystem.getInfoAsync(asset.uri)) as { exists: boolean; size?: number };
      if (info.exists && typeof info.size === 'number') size = info.size;
    } catch {
      // Web, or a URI the file system can't stat — fall through and allow it.
    }
  }
  if (size !== undefined && size > MAX_VIDEO_BYTES) {
    return `That clip is ${Math.round(size / 1_000_000)} MB. Videos are limited to ${Math.round(
      MAX_VIDEO_BYTES / 1_000_000,
    )} MB — record a shorter one.`;
  }
  return undefined;
}

async function saveVideoAsset(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  asset: ImagePicker.ImagePickerAsset,
  geo: GeoFix | undefined,
): Promise<CaptureResult> {
  const tooBig = await videoLimitError(asset);
  if (tooBig) return { status: 'failed', error: tooBig };

  const uriExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'mp4';
  const ext = ['mp4', 'mov', 'm4v', 'webm'].includes(uriExt) ? uriExt : 'mp4';
  const contentType =
    asset.mimeType ?? (ext === 'mov' ? 'video/quicktime' : `video/${ext === 'm4v' ? 'mp4' : ext}`);

  return saveOrQueue(
    jobId,
    jobTitle,
    category,
    {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      ext,
      contentType,
      mediaType: 'video',
    },
    { geo },
  );
}

/** Capture or pick media for a job. Library picks can return several items. */
export async function captureJobMedia(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  source: CaptureSource,
): Promise<MultiCaptureResult> {
  // Android can kill the app while the camera Intent is open; remember what
  // we were doing so recoverPendingCapture can finish the job on relaunch.
  if (Platform.OS === 'android' && source !== 'library') {
    await AsyncStorage.setItem(
      PENDING_CAPTURE_KEY,
      JSON.stringify({ jobId, jobTitle, category }),
    ).catch(() => undefined);
  }

  let outcome: PickOutcome;
  try {
    outcome = await pickMedia(source);
  } catch (error) {
    return {
      saved: 0,
      queued: 0,
      error: error instanceof Error ? error.message : 'Could not open the camera.',
    };
  } finally {
    if (Platform.OS === 'android' && source !== 'library') {
      await AsyncStorage.removeItem(PENDING_CAPTURE_KEY).catch(() => undefined);
    }
  }

  if (outcome.kind === 'canceled') return { saved: 0, queued: 0, canceled: true };
  if (outcome.kind === 'needs-settings') {
    return {
      saved: 0,
      queued: 0,
      needsSettings: true,
      error: 'Camera access is turned off for this app. Enable it in Settings to capture media.',
    };
  }
  if (outcome.kind === 'error') return { saved: 0, queued: 0, error: outcome.message };

  const prefs = await getMediaPrefs();
  const geo = prefs.attachGps ? await getLocationFix() : undefined;

  let saved = 0;
  let queued = 0;
  let lastError: string | undefined;
  for (const asset of outcome.assets) {
    const isVideo = asset.type === 'video';
    const result = isVideo
      ? await saveVideoAsset(jobId, jobTitle, category, asset, geo)
      : await saveImageAsset(jobId, jobTitle, category, asset, geo);
    // A queued item counts as queued, never as an error: the bytes are safe.
    if (result.status === 'saved') saved += 1;
    else if (result.status === 'queued') queued += 1;
    else lastError = result.error;
  }

  return { saved, queued, error: lastError, hasLocation: Boolean(geo) };
}

// The queue owns retry policy; this module owns the bytes and the network.
uploadQueue.setHandlers({
  async upload(queuedItem) {
    try {
      const item = await uploadQueuedItem(queuedItem);
      mediaStore.notifyChanged();
      return { ok: true, item };
    } catch (error) {
      return {
        ok: false,
        kind: classifyUploadError(error),
        error: errorMessage(error),
      };
    }
  },

  // Confirmed upload (or a discard from the Uploads screen): the local copies
  // have done their job. Nothing deleted these before, and they sit in
  // Documents, which the OS never purges — a heavy week filled the device.
  async dispose(queuedItem) {
    await deleteLocalCopy(queuedItem.uri);
    await deleteLocalCopy(queuedItem.thumb_uri);
  },
});

/**
 * Android only: if the OS killed the app while the camera was open, the
 * photo is waiting in ImagePicker.getPendingResultAsync — finish saving it.
 */
export async function recoverPendingCapture(): Promise<CaptureResult | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const raw = await AsyncStorage.getItem(PENDING_CAPTURE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_CAPTURE_KEY);
    const context = JSON.parse(raw) as { jobId: string; jobTitle: string; category: MediaCategory };

    const pending = await ImagePicker.getPendingResultAsync();
    const first = Array.isArray(pending) ? pending[0] : undefined;
    if (!first || !('assets' in first) || first.canceled || !first.assets?.length) return null;

    const asset = first.assets[0];
    const prefs = await getMediaPrefs();
    const geo = prefs.attachGps ? await getLocationFix() : undefined;
    return asset.type === 'video'
      ? await saveVideoAsset(context.jobId, context.jobTitle, context.category, asset, geo)
      : await saveImageAsset(context.jobId, context.jobTitle, context.category, asset, geo);
  } catch {
    return null;
  }
}
