import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MediaCategory, MediaItem } from '@/lib/types';

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  before: 'Before',
  after: 'After',
  progress: 'Progress',
  final: 'Final',
};

type TileSource = { uri: string; full: boolean };

/**
 * Renders the real photo when the item has a URI (captured or from Supabase
 * Storage); otherwise a tinted placeholder tile per category.
 *
 * A grid tile is ~120pt wide, so it renders the thumbnail whenever the item
 * carries one and only falls back to the full-size original when it does not.
 * That fallback is the historical path and stays deliberately cheap: disk-only
 * cache, low network priority, and downscaled at decode time.
 *
 * `allowDownscaling` and `recyclingKey` are native-only, so on web the fallback
 * tile still downloads and decodes the full-size file — the browser has no
 * equivalent knob. Web gains nothing from the fallback tuning and everything
 * from the thumbnail itself.
 *
 * `thumb_uri` is read defensively: every photo taken before the thumbnailing
 * pipeline shipped has none and never will, and web uploads never have one
 * either. Its absence is normal, not an error.
 */
export function MediaThumb({ item }: { item: MediaItem }) {
  const { colors, isDark } = useTheme();

  // Preference order for this tile. A thumbnail that 404s (the object was
  // pruned, or the thumbnail upload failed after the row landed) falls through
  // to the original rather than leaving a hole in the grid; when the original
  // fails too the ladder runs out and the category placeholder shows.
  const sources = React.useMemo<TileSource[]>(() => {
    const list: TileSource[] = [];
    // Videos never get a thumbnail from the pipeline, so don't look for one.
    if (item.media_type === 'image' && item.thumb_uri) {
      list.push({ uri: item.thumb_uri, full: false });
    }
    if (item.uri) list.push({ uri: item.uri, full: true });
    return list;
  }, [item.media_type, item.thumb_uri, item.uri]);

  const sourceKey = sources.map((entry) => entry.uri).join('|');
  // The grids re-chunk their rows when a filter changes, so one MediaThumb
  // instance can be handed a different photo. Reset during render (not in an
  // effect) so a new photo is never hidden by the previous photo's failures.
  const [progress, setProgress] = React.useState({ key: sourceKey, attempt: 0 });
  if (progress.key !== sourceKey) setProgress({ key: sourceKey, attempt: 0 });
  const attempt = progress.key === sourceKey ? progress.attempt : 0;
  const source = sources[attempt];

  const tints: Record<MediaCategory, { bg: string; fg: string }> = {
    before: { bg: isDark ? '#252B38' : '#E7EBF1', fg: colors.textSecondary },
    progress: { bg: colors.warningSoft, fg: colors.warning },
    after: { bg: colors.successSoft, fg: colors.success },
    final: { bg: colors.primarySoft, fg: colors.primary },
  };
  const tint = tints[item.category] ?? tints.progress;
  const label = CATEGORY_LABELS[item.category] ?? 'Photo';
  const chipBg = isDark ? '#000000A0' : '#ffffffE0';

  return (
    <View style={[styles.tile, { backgroundColor: tint.bg }]}>
      {source ? (
        <Image
          source={{ uri: source.uri }}
          style={StyleSheet.absoluteFill}
          // Downscaling is skipped entirely for contentFit 'none' and 'fill',
          // so 'cover' is what makes allowDownscaling mean anything here.
          contentFit="cover"
          transition={120}
          // Same instance, different photo: without this the tile keeps showing
          // the old image until the new one has fully decoded.
          recyclingKey={item.id}
          // Thumbnails are ~25KB and these grids are remounted constantly
          // (tab switches, filter changes), so keeping the decoded bitmap is
          // cheap. Full-size originals stay on the app's default disk-only
          // policy — 200 × 2048px bitmaps in memory is an OOM, not a cache.
          cachePolicy={source.full ? 'disk' : 'memory-disk'}
          // In a grid that mixes both, the megabyte-scale fallbacks must not
          // queue ahead of the thumbnails.
          priority={source.full ? 'low' : 'normal'}
          // Default-true, stated explicitly because it is the only thing
          // keeping the fallback path from decoding a 2048px bitmap into a
          // 120pt tile. Native only — see the web note in the header comment.
          allowDownscaling
          onError={() => setProgress({ key: sourceKey, attempt: attempt + 1 })}
        />
      ) : (
        <Ionicons
          name={item.media_type === 'video' ? 'videocam' : 'image-outline'}
          size={26}
          color={tint.fg}
        />
      )}
      {item.media_type === 'video' ? (
        <View style={[styles.overlayIcon, { backgroundColor: chipBg }]}>
          <Ionicons name="play" size={13} color={colors.text} />
        </View>
      ) : null}
      {item.pending ? (
        <View style={[styles.overlayIcon, { backgroundColor: chipBg }]}>
          <Ionicons name="cloud-upload-outline" size={12} color={colors.warning} />
        </View>
      ) : typeof item.latitude === 'number' ? (
        <View style={[styles.overlayIcon, { backgroundColor: chipBg }]}>
          <Ionicons name="location" size={12} color={colors.success} />
        </View>
      ) : null}
      <View style={[styles.chip, { backgroundColor: chipBg }]}>
        <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlayIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
