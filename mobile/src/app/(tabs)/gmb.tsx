import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, IconTile, type IconName } from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchGmbAudit, fetchGmbProfile } from '@/lib/data';
import { notify } from '@/lib/format';
import { useData } from '@/hooks/use-data';
import type { AuditStatus } from '@/lib/types';

// Mirrors the web app's GMB Optimization tabs: Audit / Hours / Q&A / Categories / Services
const QUICK_ACTIONS: { icon: IconName; label: string; sub: string }[] = [
  { icon: 'time-outline', label: 'Hours', sub: 'Updated Jul 20' },
  { icon: 'help-circle-outline', label: 'Q&A', sub: '2 unanswered' },
  { icon: 'pricetag-outline', label: 'Categories', sub: '1 primary, 3 more' },
  { icon: 'list-outline', label: 'Services', sub: '8 listed' },
];

const AUDIT_ICONS: Record<AuditStatus, { icon: IconName; tone: 'success' | 'warning' | 'danger' }> =
  {
    pass: { icon: 'checkmark-circle', tone: 'success' },
    warn: { icon: 'alert-circle', tone: 'warning' },
    fail: { icon: 'close-circle', tone: 'danger' },
  };

export default function GmbScreen() {
  const { colors } = useTheme();
  const { data: profile } = useData(fetchGmbProfile);
  const { data: audit, refreshing, refresh } = useData(fetchGmbAudit);

  const score = profile?.score ?? 0;
  const scoreColor = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.danger;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="GMB Profile" subtitle="Google Business Profile" />

      <Card style={{ gap: Spacing.md }}>
        <View style={styles.profileRow}>
          <IconTile icon="storefront-outline" size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.businessName, { color: colors.text }]}>{profile?.name ?? ''}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {profile?.category ?? ''}
            </Text>
          </View>
          <Badge label="Connected" tone="success" />
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <View style={styles.metricValueRow}>
              <Ionicons name="star" size={14} color={colors.star} />
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {profile?.rating ?? '—'}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              {profile?.review_count ?? 0} reviews
            </Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {profile?.photo_count ?? 0}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>photos</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, { color: scoreColor }]}>{score}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              profile score
            </Text>
          </View>
        </View>
        <View style={[styles.scoreTrack, { backgroundColor: colors.cardPressed }]}>
          <View
            style={[
              styles.scoreFill,
              { backgroundColor: scoreColor, width: `${Math.min(100, Math.max(0, score))}%` },
            ]}
          />
        </View>
      </Card>

      <Section title="Manage">
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Card
              key={action.label}
              style={styles.actionCard}
              onPress={() =>
                notify(
                  action.label,
                  'Editing your Google Business Profile from mobile is part of an upcoming milestone.',
                )
              }>
              <IconTile icon={action.icon} size={36} />
              <View style={{ gap: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {action.label}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{action.sub}</Text>
              </View>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Audit checklist">
        <Card style={{ padding: 0 }}>
          {(audit ?? []).map((item, index) => {
            const config = AUDIT_ICONS[item.status];
            const iconColor =
              config.tone === 'success'
                ? colors.success
                : config.tone === 'warning'
                  ? colors.warning
                  : colors.danger;
            return (
              <View
                key={item.id}
                style={[
                  styles.auditRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}>
                <Ionicons name={config.icon} size={20} color={iconColor} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{item.detail}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  scoreTrack: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: Spacing.md,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
