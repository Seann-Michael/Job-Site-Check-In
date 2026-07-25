/**
 * Business logo for photo stickers — one logo per business (workspace).
 * Picked from the device gallery, kept locally for offline stamping, and
 * uploaded to the Supabase 'avatars' bucket (with a best-effort
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

/** Open the gallery, store the chosen logo for this business. */
export async function pickLogo(businessId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  const rawExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'png';
  const ext = ['png', 'jpg', 'jpeg', 'webp'].includes(rawExt) ? rawExt : 'png';

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
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, decode(asset.base64), { contentType, upsert: true });
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
  return uri;
}

export async function clearLogo(businessId: string): Promise<void> {
  const map = await loadMap();
  delete map[businessId];
  await saveMap(map);
}
