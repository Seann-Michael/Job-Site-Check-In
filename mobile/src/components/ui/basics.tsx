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

import { cardShadow, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export function useToneColors(tone: Tone): { fg: string; bg: string; solid: string } {
  const { colors } = useTheme();
  switch (tone) {
    case 'primary':
      return { fg: colors.primaryStrong, bg: colors.primarySoft, solid: colors.primary };
    case 'success':
      return { fg: colors.successStrong, bg: colors.successSoft, solid: colors.success };
    case 'warning':
      return { fg: colors.warningStrong, bg: colors.warningSoft, solid: colors.warning };
    case 'danger':
      return { fg: colors.dangerStrong, bg: colors.dangerSoft, solid: colors.danger };
    default:
      return { fg: colors.neutralStrong, bg: colors.cardPressed, solid: colors.textSecondary };
  }
}

/** Subtle press feedback shared by cards and buttons. */
function pressScale(pressed: boolean): ViewStyle {
  return { transform: [{ scale: pressed ? 0.98 : 1 }] };
}

export function Card({
  children,
  onPress,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** Set false for edge-to-edge content (lists that draw their own dividers). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: Radius.card,
    padding: padded ? Spacing.lg + 2 : 0,
    // Minimal borders: shadow carries elevation in light mode, a hairline
    // separates cards from the near-black background in dark mode.
    borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.border,
    ...(isDark ? null : cardShadow),
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
        pressed && pressScale(pressed),
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
  size = 44,
  round = false,
}: {
  icon: IconName;
  tone?: Tone;
  size?: number;
  /** Fully-rounded soft circle (used by StatCard). */
  round?: boolean;
}) {
  const { fg, bg } = useToneColors(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? Radius.pill : Radius.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={fg} />
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
        borderRadius: Radius.pill,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.primaryStrong, fontWeight: '700', fontSize: size * 0.38 }}>
        {parts.join('')}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'large' | 'small';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.primarySoft
          : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? '#FFFFFF'
        : colors.primary;
  const container: ViewStyle = {
    backgroundColor: bg,
    opacity: disabled ? 0.45 : 1,
    height: size === 'large' ? 50 : 40,
    paddingHorizontal: size === 'large' ? Spacing.xl : Spacing.lg,
    alignSelf: fullWidth ? 'stretch' : undefined,
    width: fullWidth ? '100%' : undefined,
  };
  const labelStyle: TextStyle = {
    ...(size === 'large' ? Typography.bodyStrong : Typography.label),
    color: fg,
  };
  const iconSize = size === 'large' ? 18 : 16;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        container,
        pressed && !disabled && pressScale(pressed),
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={iconSize} color={fg} /> : null}
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
      <Text style={[Typography.stat, { color: tone === 'neutral' ? colors.text : fg }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Card>
  );
}

/**
 * Evolved StatTile: big number, caption label, a soft tinted icon circle and an
 * optional delta chip (e.g. "+12%"). Lay a few out with <KpiRow>.
 */
export function StatCard({
  value,
  label,
  icon,
  tone = 'primary',
  delta,
  onPress,
}: {
  value: string;
  label: string;
  icon?: IconName;
  tone?: Tone;
  /** Small trend chip; positive → success, negative → danger. */
  delta?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const deltaTone: Tone = delta?.trim().startsWith('-') ? 'danger' : 'success';
  const deltaColors = useToneColors(deltaTone);
  return (
    <Card onPress={onPress} style={styles.statCard}>
      <View style={styles.statCardTop}>
        {icon ? <IconTile icon={icon} tone={tone} size={38} round /> : <View />}
        {delta ? (
          <View style={[styles.deltaChip, { backgroundColor: deltaColors.bg }]}>
            <Text style={[Typography.caption, { color: deltaColors.fg }]}>{delta}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[Typography.stat, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

/** Responsive row of StatCards (wraps to a 2-up grid). */
export function KpiRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiRow}>{children}</View>;
}

/**
 * Horizontal scroll of pill chips. Selected pill is solid primary; the rest are
 * cards with a border. Kept under the `Segmented` name (aliased below) so every
 * existing screen keeps working while getting the new look.
 */
export function SegmentedPills({
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
    <View style={styles.pillRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.pill,
              selected
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border },
              pressed && pressScale(pressed),
            ]}>
            <Text
              style={[
                Typography.label,
                { color: selected ? colors.onPrimary : colors.textSecondary },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Back-compat alias — same props as before, pill rendering now. */
export const Segmented = SegmentedPills;

/** A single pill chip, for one-off / custom pill rows. */
export function Pill({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.card, borderColor: colors.border },
        pressed && pressScale(pressed),
      ]}>
      {icon ? (
        <Ionicons name={icon} size={15} color={selected ? colors.onPrimary : colors.textSecondary} />
      ) : null}
      <Text
        style={[Typography.label, { color: selected ? colors.onPrimary : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Section eyebrow + title row with an optional trailing text action. Complements
 * `Section` in ui/screen.tsx (which owns the vertical rhythm).
 */
export function SectionHeader({
  title,
  eyebrow,
  actionLabel,
  onAction,
}: {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={{ flex: 1, gap: 3 }}>
        {eyebrow ? (
          <Text style={[Typography.eyebrow, { color: colors.textMuted }]}>
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[Typography.h1, { color: colors.text }]}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={[Typography.label, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A tappable list row: leading icon tile or avatar, title + subtitle, optional
 * trailing value, and a chevron. Use inside a padded={false} Card for a grouped
 * list, or standalone.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'primary',
  avatarName,
  value,
  onPress,
  showChevron = true,
  divider = false,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: Tone;
  avatarName?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  divider?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <>
      {avatarName ? (
        <Avatar name={avatarName} size={42} />
      ) : icon ? (
        <IconTile icon={icon} tone={iconTone} size={42} />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[Typography.label, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </>
  );
  const rowStyle: ViewStyle = {
    ...styles.listRow,
    ...(divider
      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
      : null),
  };
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.cardPressed }]}>
      {body}
    </Pressable>
  );
}

/** Icon tile + label, laid out in a grid (see styles.quickGrid usage). */
export function QuickAction({
  icon,
  label,
  tone = 'primary',
  onPress,
}: {
  icon: IconName;
  label: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && pressScale(pressed)]}>
      <Card style={styles.quickCard}>
        <IconTile icon={icon} tone={tone} size={46} />
        <Text
          style={[Typography.caption, { color: colors.text, textAlign: 'center' }]}
          numberOfLines={2}>
          {label}
        </Text>
      </Card>
    </Pressable>
  );
}

/** Small "Read-only access" pill for viewer-role headers. */
export function ReadOnlyPill() {
  const { colors } = useTheme();
  return (
    <View style={[styles.readOnly, { backgroundColor: colors.cardPressed }]}>
      <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
      <Text style={[Typography.caption, { color: colors.textSecondary }]}>Read-only</Text>
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
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[Typography.h2, { color: colors.text }]}>{title}</Text>
      <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...Typography.caption,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.button,
  },
  statTile: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: 4,
  },
  statLabel: {
    ...Typography.caption,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: 8,
    padding: Spacing.lg,
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
  },
  deltaChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 9,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: '30%',
  },
  quickCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
