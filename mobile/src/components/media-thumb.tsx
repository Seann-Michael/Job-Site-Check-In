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

/**
 * Renders the real photo when the item has a URI (captured or from Supabase
 * Storage); otherwise a tinted placeholder tile per category.
 */
export function MediaThumb({ item }: { item: MediaItem }) {
  const { colors, isDark } = useTheme();
  const [loadFailed, setLoadFailed] = React.useState(false);

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
      {item.uri && !loadFailed ? (
        <Image
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          onError={() => setLoadFailed(true)}
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
      {typeof item.latitude === 'number' ? (
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
