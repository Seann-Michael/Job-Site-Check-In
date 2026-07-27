/**
 * Business logo for photo stickers — one logo per business (workspace).
 * Picked from the device gallery (PNG only, so transparency survives and the
 * uploaded content-type is always honest), kept locally for offline stamping,
 * and uploaded to the Supabase 'avatars' bucket (with a best-effort
 * businesses.logo_url update) when configured, so the logo follows the
 * business across devices.
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

  // Another device may have set the logo — check the business row.
  if (isSupabaseConfigured && !businessId.startsWith('demo')) {
    try {
      const { data } = await supabase
        .from('businesses')
        .select('logo_url')
        .eq('id', businessId)
        .maybeSingle();
      const url = (data as { logo_url?: unknown } | null)?.logo_url;
      if (typeof url === 'string' && url) {
        map[businessId] = url;
        await saveMap(map);
        return url;
      }
    } catch {
      // Column may not exist yet — local-only is fine.
    }
  }
  return null;
}

export interface LogoPickResult {
  /** Set when a logo was accepted and stored. */
  uri?: string;
  /** The picked file was rejected; show this to the user. */
  error?: string;
  /** Neither field set means the user backed out — callers say nothing. */
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

  // Best-effort sync so the business logo exists server-side too.
  if (isSupabaseConfigured && !businessId.startsWith('demo') && asset.base64) {
    try {
      const path = `business-logos/${businessId}.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, decode(asset.base64), { contentType: 'image/png', upsert: true });
      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(path);
        await supabase.from('businesses').update({ logo_url: publicUrl }).eq('id', businessId);
      }
    } catch {
      // Local logo still works for stamping.
    }
  }

  const map = await loadMap();
  map[businessId] = uri;
  await saveMap(map);
  return { uri };
}

export async function clearLogo(businessId: string): Promise<void> {
  const map = await loadMap();
  delete map[businessId];
  await saveMap(map);
}
