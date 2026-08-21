/**
 * Business logo for photo stickers — one logo per business (workspace).
 * Picked from the device gallery (PNG only, so transparency survives and the
 * uploaded content-type is always honest), kept locally for offline stamping,
 * and uploaded to the Supabase 'media' bucket (the only bucket this project
 * has) with the public URL recorded in `businesses.settings.businessLogo` —
 * the same key the web app's Settings page reads and writes — so the logo
 * follows the business across devices. Sync failures are reported to callers
 * via `LogoPickResult.syncError` instead of being swallowed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-business-logos-v1';

type LogoMap = Record<string, string>;

async function loadMap(): Promise<LogoMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LogoMap) : {};
  } catch {
    return {};
  }
}

async function saveMap(map: LogoMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);
}

export async function getLogoUri(businessId: string): Promise<string | null> {
  const map = await loadMap();
  if (map[businessId]) return map[businessId];

  // Another device (or the web Settings page) may have set the logo — it
  // lives in the settings JSONB under `businessLogo`, the key the web writes.
  if (isSupabaseConfigured && !businessId.startsWith('demo')) {
    try {
      const { data } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .maybeSingle();
      const settings = (data as { settings?: unknown } | null)?.settings;
      const url =
        settings && typeof settings === 'object' && !Array.isArray(settings)
          ? (settings as Record<string, unknown>).businessLogo
          : undefined;
      if (typeof url === 'string' && url) {
        map[businessId] = url;
        await saveMap(map);
        return url;
      }
    } catch {
      // Unreachable server — local-only is fine.
    }
  }
  return null;
}

export interface LogoPickResult {
  /** Set when a logo was accepted and stored. */
  uri?: string;
  /** The picked file was rejected; show this to the user. */
  error?: string;
  /**
   * Set alongside `uri` when the logo was kept locally but could NOT be
   * synced to the business record — other devices and the web dashboard will
   * not see it. Callers should tell the user so.
   */
  syncError?: string;
  /** No field set means the user backed out — callers say nothing. */
}

const PNG_REQUIRED =
  'Logos must be PNG files. Export your logo as a .png (transparent background works best) and choose it again.';

/**
 * The gallery picker cannot filter by file format, so PNG is enforced here on
 * the picked asset. mimeType is authoritative when the platform provides it;
 * otherwise fall back to the file extension. Anything we cannot positively
 * identify as PNG is rejected rather than silently relabelled — an iPhone HEIC
 * used to be uploaded as image/png with HEIC bytes inside.
 */
function isPngAsset(asset: ImagePicker.ImagePickerAsset): boolean {
  const mime = asset.mimeType?.toLowerCase();
  if (mime) return mime === 'image/png';
  const name = (asset.fileName ?? asset.uri).split('?')[0];
  return name.split('.').pop()?.toLowerCase() === 'png';
}

/** Open the gallery, store the chosen logo for this business. PNG only. */
export async function pickLogo(businessId: string): Promise<LogoPickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return {};
  const asset = result.assets[0];

  if (!isPngAsset(asset)) return { error: PNG_REQUIRED };
  const ext = 'png';

  let uri = asset.uri;
  try {
    const target = `${FileSystem.documentDirectory ?? ''}logo-${businessId}.${ext}`;
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
    await FileSystem.copyAsync({ from: asset.uri, to: target });
    uri = target;
  } catch {
    // Web / copy failure: keep the picker uri.
  }

  // Sync so the business logo exists server-side too. The local logo still
  // works for stamping either way, but a failure here means other devices and
  // the web dashboard won't see it — so it is reported, not swallowed.
  let syncError: string | undefined;
  if (isSupabaseConfigured && !businessId.startsWith('demo') && asset.base64) {
    try {
      // Branding lives in the PUBLIC `public-assets` bucket (the web dashboard
      // and the review-gate read it by plain URL). The object key's second
      // segment must be the owned business id for the path-scoped storage RLS
      // to allow the write — matches the web app's `business-logos/<id>/logo.*`.
      const path = `business-logos/${businessId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(path, decode(asset.base64), { contentType: 'image/png', upsert: true });
      if (uploadError) {
        syncError = uploadError.message;
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from('public-assets').getPublicUrl(path);
        // `?v=` busts caches on other devices — the path itself never changes.
        const url = `${publicUrl}?v=${Date.now()}`;
        // The web app keeps the logo in the settings JSONB, so merge that one
        // key into the existing blob rather than replacing the whole thing.
        const { data: row, error: readError } = await supabase
          .from('businesses')
          .select('settings')
          .eq('id', businessId)
          .maybeSingle();
        if (readError) {
          syncError = readError.message;
        } else {
          const existing = (row as { settings?: unknown } | null)?.settings;
          const blob =
            existing && typeof existing === 'object' && !Array.isArray(existing)
              ? (existing as Record<string, unknown>)
              : {};
          const { error: writeError } = await supabase
            .from('businesses')
            .update({ settings: { ...blob, businessLogo: url } })
            .eq('id', businessId);
          if (writeError) syncError = writeError.message;
        }
      }
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Network request failed';
    }
  }

  const map = await loadMap();
  map[businessId] = uri;
  await saveMap(map);
  return { uri, syncError };
}

export async function clearLogo(businessId: string): Promise<void> {
  const map = await loadMap();
  delete map[businessId];
  await saveMap(map);
}
