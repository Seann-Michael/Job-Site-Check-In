import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { Badge, Button, Card, EmptyState, IconTile } from '@/components/ui/basics';
import { SERVICE_ICONS } from '@/components/job-card';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchJobs, fetchMedia } from '@/lib/data';
import { jobMeta } from '@/lib/job-meta';
import { useAuth } from '@/providers/auth-provider';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

/**
 * Portfolio: showcase your best completed work. Feature/unfeature completed
 * jobs; the featured set becomes a shareable summary (and a public page
 * once the web app is connected).
 */
export default function PortfolioScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const { data: jobs } = useData(fetchJobs);
  const { data: media } = useData(fetchMedia);
  const [metaTick, setMetaTick] = useState(0);
  React.useEffect(() => jobMeta.subscribe(() => setMetaTick((t) => t + 1)), []);

  const completed = useMemo(() => {
    void metaTick;
    return (jobs ?? []).filter((job) => job.status === 'completed');
  }, [jobs, metaTick]);

  const featured = completed.filter((job) => jobMeta.getSync(job.id).featured);
  const rest = completed.filter((job) => !jobMeta.getSync(job.id).featured);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const coverFor = (jobId: string) =>
    (media ?? []).find((item) => item.job_id === jobId && item.uri && item.media_type === 'image') ??
    (media ?? []).find((item) => item.job_id === jobId);

  const sharePortfolio = async () => {
    const base = APP_URL ? `${APP_URL.replace(/\/$/, '')}/portfolio` : '';
    const lines = [
      `${business?.name ?? 'Our'} recent work:`,
      ...featured.map((job) => `• ${job.title} — ${job.city}`),
      base,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // dismissed
    }
  };

  return (
    <Screen>
      <DetailHeader title="Portfolio" />
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: -Spacing.sm }}>
        Feature your best completed jobs to show off to prospects.
      </Text>

      {featured.length > 0 ? (
        <Section title={`Featured (${featured.length})`}>
          {featured.map((job) => {
            const cover = coverFor(job.id);
            return (
              <Card key={job.id} style={{ padding: 0, overflow: 'hidden' }}>
                {cover ? <MediaThumb item={cover} /> : null}
                <View style={styles.featuredBody}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {job.title}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      {[job.city, job.client_name].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Badge label="Featured" tone="primary" />
                  <Pressable
                    hitSlop={8}
                    onPress={() => void jobMeta.toggle(job.id, 'featured')}>
                    <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              </Card>
            );
          })}
          <Button
            label="Share portfolio"
            icon="share-outline"
            onPress={() => void sharePortfolio()}
          />
        </Section>
      ) : null}

      <Section title={featured.length > 0 ? 'More completed jobs' : 'Completed jobs'}>
        {completed.length === 0 ? (
          <EmptyState
            icon="ribbon-outline"
            title="Nothing completed yet"
            message="Finish a job and it can go straight into your portfolio."
          />
        ) : rest.length === 0 ? (
          <Card>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Everything completed is already featured.
            </Text>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {rest.map((job, index) => (
              <View
                key={job.id}
                style={[
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <IconTile icon={SERVICE_ICONS[job.service_type] ?? 'hammer-outline'} size={38} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    {job.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {job.city} · {job.photo_count} photos
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => void jobMeta.toggle(job.id, 'featured')}
                  style={({ pressed }) => [
                    styles.featureButton,
                    { backgroundColor: colors.primarySoft },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Ionicons name="ribbon-outline" size={13} color={colors.primaryStrong} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryStrong }}>
                    Feature
                  </Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  featuredBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  featureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
