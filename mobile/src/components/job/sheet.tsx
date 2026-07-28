import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The job screen's bottom-sheet chrome, matching CategorySheet/StatusSheet.
 *
 * A real sheet rather than an Alert menu: Alert.alert with more than one
 * button is a no-op on react-native-web, so anything reachable only from a
 * menu (Delete, Assign) would be unreachable on web.
 */
export function JobSheet({
  visible,
  title,
  subtitle,
  closeLabel = 'Close',
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  closeLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
          {children}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { borderColor: colors.border },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
              {closeLabel}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** One tappable line inside a JobSheet. */
export function SheetRow({
  icon,
  tone = 'neutral',
  label,
  sub,
  trailing,
  danger,
  onPress,
}: {
  icon: IconName;
  tone?: Tone;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: danger ? colors.dangerSoft : colors.border },
        pressed && { backgroundColor: colors.cardPressed },
      ]}>
      <IconTile icon={icon} tone={danger ? 'danger' : tone} size={34} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: danger ? colors.dangerStrong : colors.text,
          }}>
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{sub}</Text>
        ) : null}
      </View>
      {trailing ?? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
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

