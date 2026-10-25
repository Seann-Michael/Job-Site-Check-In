import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card, IconTile, type IconName } from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { getNavApp, NAV_APP_LABELS, type NavApp } from '@/lib/directions';
import { fetchGoogleReviews } from '@/lib/google-business';
import { fetchShares, isSharingAvailable, type ProjectShare } from '@/lib/shares';
import { uploadQueue } from '@/lib/upload-queue';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference } from '@/providers/theme-preference';

/**
 * More — the business, the queues, the team, and settings grouped by what
 * they control. Everything a role can't change still shows and says so on
 * its own screen; nothing is hidden from the list.
 */
function Row({
  icon,
  label,
  sub,
  right,
  onPress,
  danger = false,
  isFirst = false,
}: {
  icon?: IconName;
  label: string;
  sub?: string;
  right?: React.ReactNode;
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
      {icon ? <IconTile icon={icon} size={34} tone={danger ? 'danger' : 'neutral'} /> : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: danger ? colors.danger : colors.text }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right ?? (!danger ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

export default function MoreScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { business, businesses } = useWorkspace();
  const { mode } = useRole();
  const { preference } = useThemePreference();
  const [navApp, setNavAppState] = React.useState<NavApp>('system');
  const [queued, setQueued] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      void getNavApp().then(setNavAppState);
      setQueued(uploadQueue.countSync());
    }, []),
  );

  const { data: waiting } = useData(() =>
    business?.id && isSharingAvailable ? fetchShares(business.id, 'waiting').catch(() => [] as ProjectShare[]) : Promise.resolve([] as ProjectShare[]),
  );
  const { data: reviews } = useData(() => fetchGoogleReviews().catch(() => null));
  const needsReply = (reviews ?? []).filter((r) => !r.reply).length;
  const waitingCount = (waiting ?? []).length;
  const failedCount = (waiting ?? []).filter((s) => s.status === 'failed' || s.status === 'partial').length;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const version = Constants.expoConfig?.version ?? '';
  const build = (Constants.expoConfig?.ios as { buildNumber?: string } | undefined)?.buildNumber;

  return (
    <Screen>
      <ScreenHeader title="More" />

      <Card style={styles.bizCard} onPress={() => router.push('/settings/business-profile')}>
        <Avatar name={business?.name ?? 'Business'} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>{business?.name ?? 'Your business'}</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
            {[businesses.length > 1 ? `${businesses.length} businesses` : null, business?.plan].filter(Boolean).join(' · ') || 'Business details'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Card>

      <Card style={{ padding: 0 }}>
        <Row isFirst icon="person-outline" label={user?.name ?? 'Profile'} sub={[user?.email, mode === 'owner' ? 'Owner' : mode === 'staff' ? 'Staff' : 'Viewer'].filter(Boolean).join(' · ')} onPress={() => router.push('/settings/profile')} />
      </Card>

      <Card style={{ padding: 0 }}>
        <Row
          isFirst
          icon="megaphone-outline"
          label="Share queue"
          sub={waitingCount ? `${waitingCount} waiting${failedCount ? ` · ${failedCount} failed` : ''}` : 'Nothing waiting'}
          right={waitingCount ? <Badge label={String(waitingCount)} tone={failedCount ? 'danger' : 'warning'} /> : undefined}
          onPress={() => router.push('/share-queue')}
        />
        <Row
          icon="star-outline"
          label="Reviews"
          sub={needsReply ? `${needsReply} need a reply` : 'Google reviews and requests'}
          right={needsReply ? <Badge label={String(needsReply)} tone="danger" /> : undefined}
          onPress={() => router.push('/gmb-reviews')}
        />
        <Row icon="people-outline" label="Team" sub="Members, roles and invites" onPress={() => router.push('/settings/team')} />
        {businesses.length > 1 ? <Row icon="swap-horizontal-outline" label="Switch business" sub={business?.name} onPress={() => router.push('/settings/business')} /> : null}
      </Card>

      <Section title="Settings">
        <Card style={{ padding: 0 }}>
          <Row isFirst icon="paper-plane-outline" label="Sharing & destinations" sub="Google, Facebook, Instagram, website · after-capture rule" onPress={() => router.push('/settings/sharing')} />
          <Row icon="camera-outline" label="Camera & stamps" sub="Quality, stage, date, GPS, logo" onPress={() => router.push('/settings/media')} />
          <Row icon="chatbubble-ellipses-outline" label="Review requests" sub="Text, email, QR" onPress={() => router.push('/reviews')} />
          <Row icon="checkbox-outline" label="Checklist template" sub="Items every new project starts with" onPress={() => router.push('/settings/checklist')} />
          <Row icon="notifications-outline" label="Notifications" sub="What alerts you get" onPress={() => router.push('/settings/notifications')} />
        </Card>
      </Section>

      <Card style={{ padding: 0 }}>
        <Row isFirst icon="link-outline" label="Connections" sub="Google Business Profile, website workflow" onPress={() => router.push('/settings/integrations')} />
        <Row icon="cloud-upload-outline" label="Storage & sync" sub={queued ? `${queued} waiting to upload` : 'Upload queue and retries'} right={queued ? <Badge label={String(queued)} tone="warning" /> : undefined} onPress={() => router.push('/settings/uploads')} />
        <Row icon="card-outline" label="Plan & billing" sub="Subscription and invoices" right={business?.plan ? <Badge label={business.plan} tone="primary" /> : undefined} onPress={() => router.push('/settings/billing')} />
        <Row icon="color-palette-outline" label="Appearance" sub={THEME_LABELS[preference]} onPress={() => router.push('/settings/appearance')} />
        <Row icon="navigate-outline" label="Directions open in" sub={NAV_APP_LABELS[navApp]} onPress={() => router.push('/settings/navigation')} />
        <Row icon="stats-chart-outline" label="Activity" sub="Stats and recent activity" onPress={() => router.push('/activity')} />
        <Row icon="pulse-outline" label="Diagnostics" sub="Connections, device, on-phone data" onPress={() => router.push('/settings/diagnostics')} />
        <Row icon="help-circle-outline" label="Help & support" sub="FAQ and contact" onPress={() => router.push('/settings/help')} />
      </Card>

      <Card style={{ padding: 0 }}>
        <Row isFirst danger icon="log-out-outline" label="Sign out" onPress={handleSignOut} />
      </Card>

      <Text style={{ textAlign: 'center', fontSize: 12, color: colors.textMuted }}>
        {user?.email ?? ''}{user?.email ? ' · ' : ''}Job Site Check In {version}{build ? ` (${build})` : ''}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bizCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
