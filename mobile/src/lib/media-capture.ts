/**
 * Media capture: camera photos, camera videos, and device-gallery uploads.
 *
 * Photos are downscaled/re-encoded per the media settings and can be stamped
 * (timestamp / GPS / business name burned into the image via StampHost).
 * Saving mirrors the web app's uploadProjectMedia: Supabase Storage bucket
 * 'media' at project-media/{jobId}/{name}, then a job_media row with GPS in
 * the geolocation column and metadata json. Demo mode keeps files on-device.
 * Network failures land in the offline upload queue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { Linking, Platform } from 'react-native';

import { stampImage } from '@/components/stamp-host';
import { getLogoUri } from '@/lib/logo';
import { getMediaPrefs, QUALITY_DIMENSIONS } from '@/lib/media-prefs';
import { mediaStore } from '@/lib/media-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { uploadQueue } from '@/lib/upload-queue';
import { workspace } from '@/lib/workspace';
import type { MediaCategory, MediaItem } from '@/lib/types';

export type CaptureSource = 'camera-photo' | 'camera-video' | 'library';

export interface CaptureResult {
  item?: MediaItem;
  canceled?: boolean;
  error?: string;
  /** Camera permission permanently denied — offer a path to Settings. */
  needsSettings?: boolean;
  hasLocation?: boolean;
  /** Saved on-device; uploads automatically when the network returns. */
  queued?: boolean;
}

export interface MultiCaptureResult {
  saved: number;
  queued: number;
  canceled?: boolean;
  needsSettings?: boolean;
  error?: string;
  hasLocation?: boolean;
}

const PENDING_CAPTURE_KEY = 'lsr-pending-capture-v1';
const MAX_DIMENSION = 2048;

export function openAppSettings() {
  void Linking.openSettings();
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|timed out|connection|offline/i.test(message);
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

/** Downscale + re-encode to JPEG so uploads are bounded and mime is known. */
async function normalizeImage(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ uri: string; base64: string; width: number; height: number }> {
  const prefs = await getMediaPrefs();
  const maxDimension = QUALITY_DIMENSIONS[prefs.quality] ?? Number.MAX_SAFE_INTEGER;
  const width = asset.width ?? MAX_DIMENSION;
  const actions: ImageManipulator.Action[] =
    width > maxDimension ? [{ resize: { width: maxDimension } }] : [];
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('Could not encode the captured image');
  return { uri: result.uri, base64: result.base64, width: result.width, height: result.height };
}

interface UploadFile {
  base64: string;
  width?: number;
  height?: number;
  ext: string;
  contentType: string;
  mediaType: 'image' | 'video';
}

async function uploadToSupabase(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  file: UploadFile,
  exif: Record<string, unknown> | undefined,
  geo: GeoFix | undefined,
  takenAt: string,
): Promise<MediaItem> {
  const bytes = decode(file.base64);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${file.ext}`;
  const filePath = `project-media/${jobId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, bytes, { contentType: file.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('media').getPublicUrl(filePath);

  const geolocation = geo
    ? { latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy }
    : null;

  // Same columns the web app writes in uploadProjectMedia, plus the
  // job_media.geolocation jsonb column.
  const { data, error } = await supabase
    .from('job_media')
    .insert({
      job_id: jobId,
      filename: fileName,
      original_name: fileName,
      file_path: publicUrl,
      file_size: bytes.byteLength,
      mime_type: file.contentType,
      media_type: file.mediaType,
      category,
      geolocation,
      metadata: {
        source: 'mobile',
        captured_at: takenAt,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        gps_accuracy_m: geo?.accuracy,
        width: file.width,
        height: file.height,
        exif,
      },
    })
    .select()
    .single();
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    id: typeof row.id === 'string' ? row.id : String(row.id ?? fileName),
    job_id: jobId,
    job_title: jobTitle,
    media_type: file.mediaType,
    category,
    taken_at: takenAt,
    uri: publicUrl,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
  };
}

/** Copy out of the picker's purgeable cache into the app documents dir. */
async function persistLocalCopy(uri: string, ext = 'jpg'): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory ?? ''}captured/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const target = `${dir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch {
    // Web (no documentDirectory) or copy failure — keep the original URI.
    return uri;
  }
}

async function saveOrQueue(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  file: UploadFile & { uri: string },
  extras: { geo?: GeoFix; exif?: Record<string, unknown> },
): Promise<CaptureResult> {
  const takenAt = new Date().toISOString();
  const geo = extras.geo;

  if (isSupabaseConfigured) {
    try {
      const item = await uploadToSupabase(jobId, jobTitle, category, file, extras.exif, geo, takenAt);
      mediaStore.notifyChanged();
      return { item, hasLocation: Boolean(geo) };
    } catch (error) {
      if (isNetworkError(error)) {
        // Offline on a job site: keep the file and queue the upload.
        const localUri = await persistLocalCopy(file.uri, file.ext);
        await uploadQueue.enqueue({
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          job_id: jobId,
          job_title: jobTitle,
          category,
          uri: localUri,
          width: file.width ?? 0,
          height: file.height ?? 0,
          taken_at: takenAt,
          latitude: geo?.latitude,
          longitude: geo?.longitude,
          ext: file.ext,
          content_type: file.contentType,
          media_type: file.mediaType,
        });
        mediaStore.notifyChanged();
        return { queued: true, hasLocation: Boolean(geo) };
      }
      return {
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      };
    }
  }

  const item: MediaItem = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    job_id: jobId,
    job_title: jobTitle,
    media_type: file.mediaType,
    category,
    taken_at: takenAt,
    uri: await persistLocalCopy(file.uri, file.ext),
    latitude: geo?.latitude,
    longitude: geo?.longitude,
  };
  await mediaStore.add(item);
  return { item, hasLocation: Boolean(geo) };
}

/**
 * Save an already-processed JPEG (from the camera pipeline or a composed
 * image like a before/after collage) to the job's media.
 */
export async function savePreparedImage(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  image: { uri: string; base64: string; width: number; height: number },
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
  image: { uri: string; base64: string; width: number; height: number },
  geo: GeoFix | undefined,
): Promise<{ uri: string; base64: string; width: number; height: number }> {
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

  try {
    const base64 = await FileSystem.readAsStringAsync(stampedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri: stampedUri, base64, width: image.width, height: image.height };
  } catch {
    return image;
  }
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
  let image: { uri: string; base64: string; width: number; height: number };
  try {
    image = await normalizeImage(asset);
    image = await applyStamps(image, geo);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not process the photo.' };
  }
  return savePreparedImage(jobId, jobTitle, category, image, { geo, exif });
}

async function saveVideoAsset(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  asset: ImagePicker.ImagePickerAsset,
  geo: GeoFix | undefined,
): Promise<CaptureResult> {
  const uriExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'mp4';
  const ext = ['mp4', 'mov', 'm4v', 'webm'].includes(uriExt) ? uriExt : 'mp4';
  const contentType =
    asset.mimeType ?? (ext === 'mov' ? 'video/quicktime' : `video/${ext === 'm4v' ? 'mp4' : ext}`);

  let base64 = '';
  if (isSupabaseConfigured) {
    try {
      base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      return { error: 'Could not read the video file.' };
    }
  }

  return saveOrQueue(
    jobId,
    jobTitle,
    category,
    {
      uri: asset.uri,
      base64,
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
    if (result.item) saved += 1;
    else if (result.queued) queued += 1;
    else if (result.error) lastError = result.error;
  }

  return { saved, queued, error: lastError, hasLocation: Boolean(geo) };
}

// Flush handler: re-read the queued file and push it through the same
// upload path. Returns false while still offline so the queue stops early.
uploadQueue.setFlushHandler(async (queuedItem) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(queuedItem.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await uploadToSupabase(
      queuedItem.job_id,
      queuedItem.job_title,
      queuedItem.category,
      {
        base64,
        width: queuedItem.width,
        height: queuedItem.height,
        ext: queuedItem.ext ?? 'jpg',
        contentType: queuedItem.content_type ?? 'image/jpeg',
        mediaType: queuedItem.media_type ?? 'image',
      },
      undefined,
      typeof queuedItem.latitude === 'number' && typeof queuedItem.longitude === 'number'
        ? { latitude: queuedItem.latitude, longitude: queuedItem.longitude, accuracy: null }
        : undefined,
      queuedItem.taken_at,
    );
    mediaStore.notifyChanged();
    return true;
  } catch {
    return false;
  }
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
