import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card, IconTile, type IconName } from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { getNavApp, NAV_APP_LABELS, type NavApp } from '@/lib/directions';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference } from '@/providers/theme-preference';

function SettingsRow({
  icon,
  label,
  sub,
  onPress,
  danger = false,
  isFirst = false,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  isFirst?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed && { backgroundColor: colors.cardPressed },
      ]}>
      <IconTile icon={icon} size={34} tone={danger ? 'danger' : 'neutral'} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            fontSize: 14.5,
            fontWeight: '600',
            color: danger ? colors.danger : colors.text,
          }}>
          {label}
        </Text>
        {sub ? <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{sub}</Text> : null}
      </View>
      {!danger ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const THEME_LABELS = { system: 'Follows your device', light: 'Always light', dark: 'Always dark' };

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { business } = useWorkspace();
  const { preference } = useThemePreference();
  const [navApp, setNavAppState] = React.useState<NavApp>('system');

  useFocusEffect(
    React.useCallback(() => {
      void getNavApp().then(setNavAppState);
    }, []),
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <Card style={styles.profileCard} onPress={() => router.push('/settings/profile')}>
        <Avatar name={user?.name ?? 'User'} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {user?.name ?? ''}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{user?.email ?? ''}</Text>
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Badge label={business?.plan ?? 'Pro Plan'} tone="primary" />
          {user?.isDemo ? <Badge label="Demo" tone="warning" /> : null}
        </View>
      </Card>

      <Section title="Account">
        <Card style={{ padding: 0 }}>
          <SettingsRow
            isFirst
            icon="person-outline"
            label="Profile"
            sub="Name, email, password"
            onPress={() => router.push('/settings/profile')}
          />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            sub="What alerts you get"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            icon="card-outline"
            label="Billing"
            sub="Plan, payment, invoices"
            onPress={() => router.push('/settings/billing')}
          />
        </Card>
      </Section>

      <Section title="Workspace">
        <Card style={{ padding: 0 }}>
          <SettingsRow
            isFirst
            icon="business-outline"
            label={business?.name ?? 'Business'}
            sub="Switch business"
            onPress={() => router.push('/settings/business')}
          />
          <SettingsRow
            icon="people-outline"
            label="Team"
            sub="Members and invites"
            onPress={() => router.push('/settings/team')}
          />
        </Card>
      </Section>

      <Section title="App">
        <Card style={{ padding: 0 }}>
          <SettingsRow
            isFirst
            icon="stats-chart-outline"
            label="Activity"
            sub="Stats, charts, recent activity"
            onPress={() => router.push('/activity')}
          />
          <SettingsRow
            icon="color-palette-outline"
            label="Appearance"
            sub={THEME_LABELS[preference]}
            onPress={() => router.push('/settings/appearance')}
          />
          <SettingsRow
            icon="camera-outline"
            label="Media & camera"
            sub="Photo quality, GPS, stamps, logo"
            onPress={() => router.push('/settings/media')}
          />
          <SettingsRow
            icon="cloud-upload-outline"
            label="Uploads"
            sub="Offline queue — view and retry"
            onPress={() => router.push('/settings/uploads')}
          />
          <SettingsRow
            icon="checkbox-outline"
            label="Checklist template"
            sub="Tasks every new job starts with"
            onPress={() => router.push('/settings/checklist')}
          />
          <SettingsRow
            icon="navigate-outline"
            label="Navigation app"
            sub={NAV_APP_LABELS[navApp]}
            onPress={() => router.push('/settings/navigation')}
          />
          <SettingsRow
            icon="pulse-outline"
            label="Diagnostics"
            sub="Connections and on-device data"
            onPress={() => router.push('/settings/diagnostics')}
          />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & support"
            sub="FAQ and contact"
            onPress={() => router.push('/settings/help')}
          />
        </Card>
      </Section>

      <Card style={{ padding: 0 }}>
        <SettingsRow isFirst danger icon="log-out-outline" label="Sign out" onPress={handleSignOut} />
      </Card>

      <Text style={{ textAlign: 'center', fontSize: 12, color: colors.textMuted }}>
        Local SEO Ranker Mobile · v0.1.0
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
