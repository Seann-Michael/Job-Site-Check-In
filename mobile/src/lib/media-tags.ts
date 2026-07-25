/**
 * Photo/video tags. Stored on-device for instant UI, and merged into the
 * job_media row's metadata.tags (the field the web app's MediaMetadata uses)
 * when Supabase is configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { mediaStore } from '@/lib/media-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'lsr-media-tags-v1';

type TagMap = Record<string, string[]>;

let cache: TagMap | null = null;

async function load(): Promise<TagMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as TagMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export async function getMediaTagOverrides(): Promise<TagMap> {
  return load();
}

export async function setMediaTags(mediaId: string, tags: string[]): Promise<void> {
  const map = await load();
  map[mediaId] = tags;
  cache = map;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => undefined);

  // Persist into the row's metadata for real (web-visible) media.
  if (isSupabaseConfigured && !mediaId.startsWith('local-') && !mediaId.startsWith('m-')) {
    try {
      const { data } = await supabase
        .from('job_media')
        .select('metadata')
        .eq('id', mediaId)
        .maybeSingle();
      const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
      await supabase
        .from('job_media')
        .update({ metadata: { ...metadata, tags } })
        .eq('id', mediaId);
    } catch {
      // The local override still applies; the row syncs next edit.
    }
  }

  mediaStore.notifyChanged();
}
