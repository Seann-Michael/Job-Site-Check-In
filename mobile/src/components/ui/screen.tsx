import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, ReadOnlyPill } from '@/components/ui/basics';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({
  children,
  refreshing,
  onRefresh,
  avoidKeyboard,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Opt in to lifting the content above the on-screen keyboard (screens with inputs). */
  avoidKeyboard?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {scroll}
        </KeyboardAvoidingView>
      ) : (
        scroll
      )}
    </View>
  );
}

interface HeaderAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}

/** Soft circular icon button used in the header (44pt touch target). */
function HeaderButton({ action }: { action: HeaderAction }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={action.onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.headerButton,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { backgroundColor: colors.cardPressed, transform: [{ scale: 0.96 }] },
      ]}>
      <Ionicons name={action.icon} size={20} color={colors.text} />
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  avatarName,
  action,
  actions,
  compact = false,
  readOnly = false,
}: {
  title: string;
  subtitle?: string;
  /** Small uppercase line above the title (e.g. a business name chip). */
  eyebrow?: string;
  avatarName?: string;
  action?: HeaderAction;
  actions?: HeaderAction[];
  /** Smaller title + tighter spacing. */
  compact?: boolean;
  /** Show the "Read-only" pill (viewer role). */
  readOnly?: boolean;
}) {
  const { colors } = useTheme();
  const allActions = actions ?? (action ? [action] : []);
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? (
          <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="business" size={12} color={colors.primaryStrong} />
            <Text style={[Typography.caption, { color: colors.primaryStrong }]} numberOfLines={1}>
              {eyebrow}
            </Text>
          </View>
        ) : null}
        <Text style={[compact ? Typography.h1 : Typography.title, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[Typography.body, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
        {readOnly ? (
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <ReadOnlyPill />
          </View>
        ) : null}
      </View>
      <View style={styles.headerRight}>
        {allActions.map((item) => (
          <HeaderButton key={item.icon} action={item} />
        ))}
        {avatarName ? <Avatar name={avatarName} size={44} /> : null}
      </View>
    </View>
  );
}

export function DetailHeader({
  title,
  action,
  actions,
}: {
  title: string;
  action?: HeaderAction;
  actions?: HeaderAction[];
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const allActions = actions ?? (action ? [action] : []);
  return (
    <View style={styles.detailHeader}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={6}
        style={({ pressed }) => [
          styles.headerButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { backgroundColor: colors.cardPressed },
        ]}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {allActions.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          {allActions.map((item) => (
            <HeaderButton key={item.icon} action={item} />
          ))}
        </View>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );
}

export function Section({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  /** Optional uppercase eyebrow rendered above the title. */
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ gap: 3 }}>
          {eyebrow ? (
            <Text style={[Typography.eyebrow, { color: colors.textMuted }]}>
              {eyebrow.toUpperCase()}
            </Text>
          ) : null}
          <Text style={[Typography.h1, { color: colors.text }]}>{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    // Clears the 56px floating action button plus its bottom offset.
    paddingBottom: 108,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  detailTitle: {
    flex: 1,
    textAlign: 'center',
    ...Typography.h2,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
});
