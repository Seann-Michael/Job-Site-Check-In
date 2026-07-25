/**
 * Geotagged photo capture.
 *
 * Flow: camera permission → capture → downscale/re-encode to JPEG →
 * best-effort GPS fix → save. Saving mirrors the web app's
 * uploadProjectMedia (client/lib/dataService.ts): Supabase Storage bucket
 * 'media' at project-media/{jobId}/{name}, then a job_media row with
 * file_path = public URL and GPS in both the geolocation column and the
 * metadata json. In demo mode the photo is copied to the app's documents
 * directory (picker output lives in an OS-purgeable cache) and tracked via
 * mediaStore.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { Linking, Platform } from 'react-native';

import { getMediaPrefs, QUALITY_DIMENSIONS } from '@/lib/media-prefs';
import { mediaStore } from '@/lib/media-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { MediaCategory, MediaItem } from '@/lib/types';

export interface CaptureResult {
  item?: MediaItem;
  canceled?: boolean;
  error?: string;
  /** Camera permission permanently denied — offer a path to Settings. */
  needsSettings?: boolean;
  hasLocation?: boolean;
}

const PENDING_CAPTURE_KEY = 'lsr-pending-capture-v1';
/** Cap the longest photo edge; full-resolution base64 can OOM low-end devices. */
const MAX_DIMENSION = 2048;

export function openAppSettings() {
  void Linking.openSettings();
}

interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

async function getLocationFix(): Promise<GeoFix | undefined> {
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
  | { kind: 'asset'; asset: ImagePicker.ImagePickerAsset }
  | { kind: 'canceled' }
  | { kind: 'needs-settings' }
  | { kind: 'error'; message: string };

async function pickImage(): Promise<PickOutcome> {
  const wrap = (result: ImagePicker.ImagePickerResult): PickOutcome => {
    if (result.canceled || !result.assets?.length) return { kind: 'canceled' };
    return { kind: 'asset', asset: result.assets[0] };
  };

  // Web has no in-app camera; the library picker maps to a file input.
  if (Platform.OS === 'web') {
    return wrap(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] }));
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    // Permanently denied: don't silently open the library — the user asked
    // for the camera. Point them at Settings instead.
    if (!permission.canAskAgain) return { kind: 'needs-settings' };
    return { kind: 'error', message: 'Camera permission is needed to capture job photos.' };
  }

  try {
    return wrap(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: true }));
  } catch {
    // No camera hardware (simulator) — the library is the honest fallback.
    return wrap(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], exif: true }));
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

async function uploadToSupabase(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  image: { base64: string; width: number; height: number },
  exif: Record<string, unknown> | undefined,
  geo: GeoFix | undefined,
  takenAt: string,
): Promise<MediaItem> {
  const bytes = decode(image.base64);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const filePath = `project-media/${jobId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, bytes, { contentType: 'image/jpeg', upsert: false });
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
      mime_type: 'image/jpeg',
      media_type: 'image',
      category,
      geolocation,
      metadata: {
        source: 'mobile',
        captured_at: takenAt,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        gps_accuracy_m: geo?.accuracy,
        width: image.width,
        height: image.height,
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
    media_type: 'image',
    category,
    taken_at: takenAt,
    uri: publicUrl,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
  };
}

/** Copy out of the picker's purgeable cache into the app documents dir. */
async function persistLocalCopy(uri: string): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory ?? ''}captured/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const target = `${dir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch {
    // Web (no documentDirectory) or copy failure — keep the original URI.
    return uri;
  }
}

async function saveCapture(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
  asset: ImagePicker.ImagePickerAsset,
): Promise<CaptureResult> {
  const takenAt = new Date().toISOString();
  const prefs = await getMediaPrefs();
  const geo = prefs.attachGps ? await getLocationFix() : undefined;
  const exif = (asset.exif ?? undefined) as Record<string, unknown> | undefined;

  let image: { uri: string; base64: string; width: number; height: number };
  try {
    image = await normalizeImage(asset);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not process the photo.' };
  }

  if (isSupabaseConfigured) {
    try {
      const item = await uploadToSupabase(jobId, jobTitle, category, image, exif, geo, takenAt);
      // Uploads don't touch the demo store — ping subscribers so open
      // screens (Gallery, job detail) refetch from Supabase.
      mediaStore.notifyChanged();
      return { item, hasLocation: Boolean(geo) };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      };
    }
  }

  const item: MediaItem = {
    id: `local-${Date.now()}`,
    job_id: jobId,
    job_title: jobTitle,
    media_type: 'image',
    category,
    taken_at: takenAt,
    uri: await persistLocalCopy(image.uri),
    latitude: geo?.latitude,
    longitude: geo?.longitude,
  };
  await mediaStore.add(item);
  return { item, hasLocation: Boolean(geo) };
}

export async function captureJobPhoto(
  jobId: string,
  jobTitle: string,
  category: MediaCategory,
): Promise<CaptureResult> {
  // Android can kill the app while the camera Intent is open; remember what
  // we were doing so recoverPendingCapture can finish the job on relaunch.
  if (Platform.OS === 'android') {
    await AsyncStorage.setItem(
      PENDING_CAPTURE_KEY,
      JSON.stringify({ jobId, jobTitle, category }),
    ).catch(() => undefined);
  }

  let outcome: PickOutcome;
  try {
    outcome = await pickImage();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not open the camera.' };
  } finally {
    if (Platform.OS === 'android') {
      await AsyncStorage.removeItem(PENDING_CAPTURE_KEY).catch(() => undefined);
    }
  }

  if (outcome.kind === 'canceled') return { canceled: true };
  if (outcome.kind === 'needs-settings') {
    return {
      needsSettings: true,
      error: 'Camera access is turned off for this app. Enable it in Settings to capture photos.',
    };
  }
  if (outcome.kind === 'error') return { error: outcome.message };

  return saveCapture(jobId, jobTitle, category, outcome.asset);
}

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

    return await saveCapture(context.jobId, context.jobTitle, context.category, first.assets[0]);
  } catch {
    return null;
  }
}
