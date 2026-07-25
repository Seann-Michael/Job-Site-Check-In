import { Ionicons } from '@expo/vector-icons';
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
 * Placeholder thumbnail: a tinted tile per category. Real photo rendering
 * (Supabase Storage URLs via expo-image) arrives with the capture milestone.
 */
export function MediaThumb({ item }: { item: MediaItem }) {
  const { colors, isDark } = useTheme();

  const tints: Record<MediaCategory, { bg: string; fg: string }> = {
    before: { bg: isDark ? '#252B38' : '#E7EBF1', fg: colors.textSecondary },
    progress: { bg: colors.warningSoft, fg: colors.warning },
    after: { bg: colors.successSoft, fg: colors.success },
    final: { bg: colors.primarySoft, fg: colors.primary },
  };
  const tint = tints[item.category];

  return (
    <View style={[styles.tile, { backgroundColor: tint.bg }]}>
      <Ionicons
        name={item.media_type === 'video' ? 'videocam' : 'image-outline'}
        size={26}
        color={tint.fg}
      />
      {item.media_type === 'video' ? (
        <View style={[styles.playOverlay, { backgroundColor: isDark ? '#00000066' : '#ffffffAA' }]}>
          <Ionicons name="play" size={13} color={colors.text} />
        </View>
      ) : null}
      <View style={[styles.chip, { backgroundColor: isDark ? '#00000080' : '#ffffffE0' }]}>
        <Text style={[styles.chipText, { color: colors.text }]}>
          {CATEGORY_LABELS[item.category]}
        </Text>
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
  playOverlay: {
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
