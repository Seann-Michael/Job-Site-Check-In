import { Ionicons } from '@expo/vector-icons';
import React, { type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export function useToneColors(tone: Tone): { fg: string; bg: string } {
  const { colors } = useTheme();
  switch (tone) {
    case 'primary':
      return { fg: colors.primaryStrong, bg: colors.primarySoft };
    case 'success':
      return { fg: colors.successStrong, bg: colors.successSoft };
    case 'warning':
      return { fg: colors.warningStrong, bg: colors.warningSoft };
    case 'danger':
      return { fg: colors.dangerStrong, bg: colors.dangerSoft };
    default:
      return { fg: colors.neutralStrong, bg: colors.cardPressed };
  }
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  };
  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressed && { backgroundColor: colors.cardPressed },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { fg, bg } = useToneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function IconTile({
  icon,
  tone = 'primary',
  size = 40,
}: {
  icon: IconName;
  tone?: Tone;
  size?: number;
}) {
  const { fg, bg } = useToneColors(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: size * 0.38 }}>
        {parts.join('')}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const container: ViewStyle = {
    backgroundColor: isPrimary ? colors.primary : variant === 'secondary' ? colors.card : 'transparent',
    borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.border,
    opacity: disabled ? 0.5 : 1,
  };
  const labelStyle: TextStyle = {
    color: isPrimary ? colors.onPrimary : colors.text,
    fontWeight: '600',
    fontSize: 15,
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, container, pressed && { opacity: 0.85 }, style]}>
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={17} color={isPrimary ? colors.onPrimary : colors.text} />
          ) : null}
          <Text style={labelStyle}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function StatTile({
  value,
  label,
  tone = 'neutral',
}: {
  value: string;
  label: string;
  tone?: Tone;
}) {
  const { colors } = useTheme();
  const { fg } = useToneColors(tone);
  return (
    <Card style={styles.statTile}>
      <Text style={[styles.statValue, { color: tone === 'neutral' ? colors.text : fg }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Card>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.cardPressed }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: colors.raised, ...styles.segmentSelected },
            ]}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: selected ? colors.text : colors.textSecondary,
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={34} color={colors.textMuted} />
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{title}</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: 13,
    paddingHorizontal: Spacing.lg,
  },
  statTile: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: Radius.md - 3,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
  },
});
