import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JobCard } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { Avatar, EmptyState, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { fetchJobs, fetchMedia } from '@/lib/data';
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

/** CompanyCam-style Company Feed: everything, newest first, by teammate. */
export default function FeedScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data: media, refresh, refreshing } = useData(fetchMedia);
  const { data: jobs } = useData(fetchJobs);
  useMediaRefresh(refresh);
  const [tab, setTab] = useState('photos');
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

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader title="Company feed" />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'photos' ? (
        groups.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="No photos yet"
            message="Everything your team captures shows up here, newest first."
          />
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
        <EmptyState icon="briefcase-outline" title="No jobs yet" message="Create your first job." />
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
});
