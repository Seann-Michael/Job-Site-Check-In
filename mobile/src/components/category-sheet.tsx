import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MediaCategory } from '@/lib/types';

const OPTIONS: { value: MediaCategory; label: string; sub: string; icon: IconName; tone: Tone }[] =
  [
    { value: 'before', label: 'Before', sub: 'Site condition before work', icon: 'image-outline', tone: 'neutral' },
    { value: 'progress', label: 'Progress', sub: 'Work in progress', icon: 'hammer-outline', tone: 'warning' },
    { value: 'after', label: 'After', sub: 'Completed result', icon: 'checkmark-circle', tone: 'success' },
    { value: 'final', label: 'Final', sub: 'Hero shot for the client', icon: 'star-outline', tone: 'primary' },
  ];

/** Bottom sheet asking which bucket the photo belongs to before capture. */
export function CategorySheet({
  visible,
  onSelect,
  onClose,
  onDismissed,
}: {
  visible: boolean;
  onSelect: (category: MediaCategory) => void;
  onClose: () => void;
  /** Fires (iOS) once the close animation finishes — safe to present the camera. */
  onDismissed?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissed}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Photo category</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Categories keep before/after galleries organized for reviews and local SEO.
          </Text>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: colors.border },
                pressed && { backgroundColor: colors.cardPressed },
              ]}>
              <IconTile icon={option.icon} tone={option.tone} size={36} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  {option.label}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{option.sub}</Text>
              </View>
              <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { borderColor: colors.border },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  cancel: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
});
