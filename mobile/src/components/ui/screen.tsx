import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  avatarName,
  action,
}: {
  title: string;
  subtitle?: string;
  avatarName?: string;
  action?: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: Spacing.md }]}>
      <View style={styles.headerText}>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.headerRight}>
        {action ? (
          <Pressable
            onPress={action.onPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerAction,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { backgroundColor: colors.cardPressed },
            ]}>
            <Ionicons name={action.icon} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {avatarName ? <Avatar name={avatarName} size={38} /> : null}
      </View>
    </View>
  );
}

export function DetailHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.detailHeader, { paddingTop: Spacing.sm }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
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
    paddingHorizontal: Spacing.lg,
    // Clears the 56px floating action button plus its 20px bottom offset
    paddingBottom: 104,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
  },
  headerText: {
    gap: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  detailTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.sm + 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
});
