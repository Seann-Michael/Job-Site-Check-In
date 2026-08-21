import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { type IconName } from '@/components/ui/basics';
import { floatingShadow, Radius, Spacing } from '@/constants/theme';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';

/**
 * Primary floating action button. Hidden for viewer-role accounts (read-only),
 * since it always maps to a create action.
 */
export function Fab({ icon = 'add', onPress }: { icon?: IconName; onPress: () => void }) {
  const { colors } = useTheme();
  const { isViewer } = useRole();
  if (isViewer) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        floatingShadow,
        { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}>
      <Ionicons name={icon} size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl + 4,
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
