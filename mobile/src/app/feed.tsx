import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JobCard } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { Avatar, Button, Card, EmptyState, IconTile, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { dataErrors, fetchJobs, fetchMedia } from '@/lib/data';
import { TEAM_NAMES } from '@/lib/team-presence';
import { useAuth } from '@/providers/auth-provider';
import type { MediaItem } from '@/lib/types';

const TABS = [
  { value: 'photos', label: 'Photos' },
  { value: 'projects', label: 'Projects' },
];

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const label = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return sameDay ? `Today · ${label}` : label;
}

function dayKey(iso: string): string {
  // Local calendar day — slicing the ISO string groups by UTC day, which
  // splits evenings into the wrong group and duplicates headers.
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Who took it: your captures are yours; demo rows rotate through the team. */
function authorFor(item: MediaItem, index: number, userName: string): string {
  if (item.id.startsWith('local-') || item.pending) return userName;
  return TEAM_NAMES[index % TEAM_NAMES.length];
}

/**
 * Company view: everything the whole team captured, newest first, by teammate —
 * company-wide, unlike the Feed tab's own media grid. Slated to become the
 * "Company" sub-tab of Feed, which is why it is titled "Company", not "Feed".
 */
export default function CompanyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data: media, refresh, refreshing } = useData(fetchMedia);
  const { data: jobs, refresh: refreshJobs, refreshing: refreshingJobs } = useData(fetchJobs);
  useMediaRefresh(refresh);
  const [tab, setTab] = useState('photos');
  // Each tab reads a different domain, so track both: an outage returns an
  // empty list, indistinguishable from a workspace with nothing in it.
  const [mediaError, setMediaError] = useState<string | null>(() => dataErrors.get('media'));
  const [jobsError, setJobsError] = useState<string | null>(() => dataErrors.get('jobs'));
  React.useEffect(
    () =>
      dataErrors.subscribe(() => {
        setMediaError(dataErrors.get('media'));
        setJobsError(dataErrors.get('jobs'));
      }),
    [],
  );
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const sorted = useMemo(
    () =>
      [...(media ?? [])].sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1)),
    [media],
  );

  const groups = useMemo(() => {
    const byDay = new Map<
      string,
      { key: string; label: string; items: { item: MediaItem; index: number }[] }
    >();
    sorted.forEach((item, index) => {
      const key = dayKey(item.taken_at);
      if (!byDay.has(key)) byDay.set(key, { key, label: dayLabel(item.taken_at), items: [] });
      byDay.get(key)!.items.push({ item, index });
    });
    return [...byDay.values()];
  }, [sorted]);

  const activeJobs = useMemo(
    () =>
      [...(jobs ?? [])].sort((a, b) => (a.start_date < b.start_date ? 1 : -1)),
    [jobs],
  );

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const tabError = tab === 'photos' ? mediaError : jobsError;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader title="Company" />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {/* A banner, not a replacement: a failed media read still returns this
          device's queued captures, and hiding them makes just-taken work look
          lost. The content below renders underneath it either way. */}
      {tabError ? (
        <Card style={styles.errorBanner}>
          <IconTile icon="cloud-offline-outline" tone="danger" size={32} />
          <Text style={[styles.errorText, { color: colors.text }]}>{tabError}</Text>
          <Button
            label="Try again"
            variant="secondary"
            icon="refresh"
            loading={tab === 'photos' ? refreshing : refreshingJobs}
            onPress={tab === 'photos' ? refresh : refreshJobs}
          />
        </Card>
      ) : null}

      {tab === 'photos' ? (
        groups.length === 0 ? (
          // "No photos yet" would claim an empty workspace the failed read can
          // no longer vouch for — the banner already says what happened.
          tabError ? null : (
            <EmptyState
              icon="images-outline"
              title="No photos yet"
              message="Everything your team captures shows up here, newest first."
            />
          )
        ) : (
          groups.map((group) => (
            <View key={group.key} style={{ gap: Spacing.sm }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                {group.label}
              </Text>
              <View style={styles.grid}>
                {group.items.map(({ item, index }) => (
                  <Pressable
                    key={item.id}
                    style={styles.cell}
                    onPress={() => setViewerIndex(index)}>
                    <MediaThumb item={item} />
                    <View style={styles.author}>
                      <Avatar name={authorFor(item, index, user?.name ?? 'You')} size={22} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )
      ) : activeJobs.length === 0 ? (
        tabError ? null : (
          <EmptyState
            icon="briefcase-outline"
            title="No jobs yet"
            message="Create your first job."
          />
        )
      ) : (
        activeJobs.map((job) => <JobCard key={job.id} job={job} />)
      )}

      <MediaViewer
        items={sorted}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        onLogoSticker={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/logo-sticker', params: { mediaId: item.id } });
        }}
        onAnnotate={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/annotate', params: { mediaId: item.id } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  cell: {
    width: '31.5%',
  },
  author: {
    position: 'absolute',
    left: 6,
    bottom: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
});
