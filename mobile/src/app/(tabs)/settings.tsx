import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card, IconTile, type IconName } from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_BUSINESS } from '@/lib/demo-data';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

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
      {!danger ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, businessName, signOut } = useAuth();

  const comingSoon = (label: string) =>
    notify(label, 'This section is part of an upcoming milestone.');

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <Card style={styles.profileCard}>
        <Avatar name={user?.name ?? 'User'} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {user?.name ?? ''}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{user?.email ?? ''}</Text>
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Badge label={DEMO_BUSINESS.plan} tone="primary" />
          {user?.isDemo ? <Badge label="Demo" tone="warning" /> : null}
        </View>
      </Card>

      <Section title="Workspace">
        <Card style={{ padding: 0 }}>
          <SettingsRow
            isFirst
            icon="business-outline"
            label={businessName}
            sub="Switch business"
            onPress={() => comingSoon('Business switcher')}
          />
          <SettingsRow
            icon="people-outline"
            label="Team"
            sub="Invite and manage staff"
            onPress={() => comingSoon('Team management')}
          />
        </Card>
      </Section>

      <Section title="App">
        <Card style={{ padding: 0 }}>
          <SettingsRow
            isFirst
            icon="notifications-outline"
            label="Notifications"
            sub="Push alerts for reviews and jobs"
            onPress={() => comingSoon('Notifications')}
          />
          <SettingsRow
            icon="color-palette-outline"
            label="Appearance"
            sub="Follows your device theme"
            onPress={() => comingSoon('Appearance')}
          />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & support"
            sub="Knowledge base and tickets"
            onPress={() => comingSoon('Help & support')}
          />
        </Card>
      </Section>

      <Card style={{ padding: 0 }}>
        <SettingsRow isFirst danger icon="log-out-outline" label="Sign out" onPress={handleSignOut} />
      </Card>

      <Text style={{ textAlign: 'center', fontSize: 12, color: colors.textMuted }}>
        Local SEO Ranker Mobile · v0.1.0 foundation
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
