import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { Avatar, Badge, IconTile } from '@/components/ui/basics';
import { JOB_STATUS_TONES, SERVICE_ICONS } from '@/components/job-card';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JOB_STATUS_LABELS } from '@/lib/format';
import type { Job, MediaItem } from '@/lib/types';

/**
 * Project card for the Feed: a photo mosaic (up to three, "+N" for the rest)
 * over the title, address, crew and counts. Projects with no photos render
 * as a plain row so the list reads at a glance which ones still need a visit.
 */
export function ProjectCard({
  job,
  media,
  crew,
  onSite,
  shared,
  miles,
}: {
  job: Job;
  media: MediaItem[];
  crew?: string[];
  onSite?: string[];
  shared?: 'shared' | 'waiting' | 'none';
  miles?: number | null;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const photos = media.filter((m) => m.media_type === 'image');
  const open = () => router.push({ pathname: '/job/[id]', params: { id: job.id } });
  const status = onSite?.length
    ? { label: `● ${onSite.length} on site`, tone: 'success' as const }
    : { label: JOB_STATUS_LABELS[job.status], tone: JOB_STATUS_TONES[job.status] };
  const counts = [
    `${media.filter((m) => m.media_type === 'image').length} photo${photos.length === 1 ? '' : 's'}`,
    media.some((m) => m.media_type === 'video') ? `${media.filter((m) => m.media_type === 'video').length} video` : '',
    miles != null ? `${miles < 0.1 ? 'right here' : `${miles.toFixed(1)} mi`}` : '',
  ].filter(Boolean);

  if (photos.length === 0) {
    return (
      <Pressable onPress={open} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.cardPressed : colors.card, borderColor: colors.border }]}>
        <IconTile icon={SERVICE_ICONS[job.service_type] ?? 'hammer-outline'} size={42} tone="neutral" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>{job.title}</Text>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
            {[job.address, job.city].filter(Boolean).join(', ') || job.client_name}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>No photos yet</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    );
  }

  const [a, b, c] = photos;
  const extra = photos.length - 3;
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.9 }]}>
      <View style={styles.mosaic}>
        <View style={[styles.big]}>{a ? <MediaThumb item={a} fill /> : null}</View>
        <View style={styles.col}>
          <View style={styles.small}>{b ? <MediaThumb item={b} fill /> : <View style={{ flex: 1, backgroundColor: colors.cardPressed }} />}</View>
          <View style={styles.small}>
            {c ? <MediaThumb item={c} fill /> : <View style={{ flex: 1, backgroundColor: colors.cardPressed }} />}
            {extra > 0 ? (
              <View style={styles.more}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.rowBetween}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>{job.title}</Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
          {[job.address, job.city].filter(Boolean).join(', ')}{job.client_name ? ` · ${job.client_name}` : ''}
        </Text>
        <View style={[styles.rowBetween, { marginTop: 6 }]}>
          <View style={{ flexDirection: 'row' }}>
            {(crew ?? []).slice(0, 4).map((name, i) => (
              <View key={name} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: colors.card, borderRadius: 999 }}>
                <Avatar name={name} size={24} />
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {counts.join(' · ')}{shared === 'shared' ? ' · shared' : shared === 'waiting' ? ' · not shared' : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.md },
  mosaic: { flexDirection: 'row', height: 150, gap: 3 },
  big: { flex: 2, overflow: 'hidden' },
  col: { flex: 1, gap: 3 },
  small: { flex: 1, overflow: 'hidden' },
  more: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F172A8C', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, gap: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
});
