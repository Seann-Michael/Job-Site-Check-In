import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, JOB_STATUS_LABELS } from '@/lib/format';
import { formatJobValue, jobMeta } from '@/lib/job-meta';
import type { Job, JobStatus, ServiceType } from '@/lib/types';

export const SERVICE_ICONS: Record<ServiceType, IconName> = {
  gutters: 'home-outline',
  drainage: 'water-outline',
  plumbing: 'construct-outline',
  roofing: 'home-outline',
  landscaping: 'leaf-outline',
  painting: 'brush-outline',
  snow_removal: 'snow-outline',
  general: 'hammer-outline',
};

export const JOB_STATUS_TONES: Record<JobStatus, Tone> = {
  draft: 'neutral',
  active: 'primary',
  in_progress: 'warning',
  paused: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

export function JobCard({ job }: { job: Job }) {
  const { colors } = useTheme();
  const router = useRouter();
  // Cached meta (stars, group, value) — list screens subscribe to jobMeta,
  // so cards re-render when it changes.
  const meta = jobMeta.getSync(job.id);
  return (
    <Card onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}>
      <View style={styles.topRow}>
        <IconTile icon={SERVICE_ICONS[job.service_type] ?? 'hammer-outline'} />
        <View style={styles.titleBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {meta.starred ? <Ionicons name="star" size={13} color={colors.star} /> : null}
            <Text style={[styles.title, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {job.title}
            </Text>
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {job.client_name} · {job.city}
            {meta.group ? ` · ${meta.group}` : ''}
          </Text>
        </View>
        <Badge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
      </View>
      <View style={[styles.bottomRow, { borderTopColor: colors.border }]}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatDate(job.start_date)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {job.photo_count} photos
          </Text>
        </View>
        {job.review_requested ? (
          <View style={styles.metaItem}>
            <Ionicons name="star" size={13} color={colors.star} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Review sent</Text>
          </View>
        ) : null}
        {meta.value != null ? (
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatJobValue(meta.value)}
            </Text>
          </View>
        ) : null}
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h2,
  },
  meta: {
    ...Typography.caption,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    ...Typography.caption,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
  },
});
