import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Fab } from '@/components/fab';
import { JobCard } from '@/components/job-card';
import { NearbyJobs } from '@/components/nearby-jobs';
import { SearchBar } from '@/components/search-bar';
import { UploadBanner } from '@/components/upload-banner';
import { EmptyState, Segmented, StatTile } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchJobs } from '@/lib/data';
import { jobMeta } from '@/lib/job-meta';
import { syncJobReminders } from '@/lib/notifications';
import { useData } from '@/hooks/use-data';
import { useJobsRefresh } from '@/hooks/use-jobs-refresh';
import { useWorkspace } from '@/hooks/use-workspace';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Complete' },
  { value: 'starred', label: '★' },
  { value: 'archived', label: 'Archived' },
];

export default function JobsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { business } = useWorkspace();
  const { data: jobs, loading, refreshing, refresh } = useData(fetchJobs);
  useJobsRefresh(refresh);
  React.useEffect(() => workspace.subscribe(refresh), [refresh]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  // Re-render when stars/archive/groups change (JobCard reads the cache).
  const [metaTick, setMetaTick] = useState(0);
  React.useEffect(() => jobMeta.subscribe(() => setMetaTick((t) => t + 1)), []);

  const filtered = useMemo(() => {
    void metaTick;
    const all = jobs ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((job) => {
      const meta = jobMeta.getSync(job.id);
      if (filter === 'archived') {
        if (!meta.archived) return false;
      } else if (meta.archived) {
        return false;
      }
      if (filter === 'starred' && !meta.starred) return false;
      if (filter === 'open' && !['active', 'in_progress', 'paused'].includes(job.status)) {
        return false;
      }
      if (filter === 'completed' && job.status !== 'completed') return false;
      if (!q) return true;
      return [job.title, job.client_name, job.city, job.address, meta.group ?? '', ...(job.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [jobs, query, filter, metaTick]);

  const stats = useMemo(() => {
    const all = jobs ?? [];
    const open = all.filter((job) => ['active', 'in_progress'].includes(job.status)).length;
    const photos = all.reduce((sum, job) => sum + job.photo_count, 0);
    const reviews = all.filter((job) => job.review_requested).length;
    return { open, photos, reviews };
  }, [jobs]);

  const todayJobs = useMemo(() => {
    const all = jobs ?? [];
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    return all.filter(
      (job) =>
        job.start_date.startsWith(stamp) &&
        job.status !== 'completed' &&
        job.status !== 'cancelled',
    );
  }, [jobs]);

  // Keep "job starts today" local reminders in sync with the list.
  React.useEffect(() => {
    if (jobs?.length) void syncJobReminders(jobs);
  }, [jobs]);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader
          title="Jobs"
          subtitle={business?.name ?? ''}
          avatarName={user?.name ?? 'User'}
          actions={[
            { icon: 'camera-outline', onPress: () => router.push('/capture-picker') },
            { icon: 'map-outline', onPress: () => router.push('/map') },
            { icon: 'settings-outline', onPress: () => router.push('/settings') },
          ]}
        />
        <UploadBanner />
        <NearbyJobs jobs={jobs ?? []} />
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search jobs, clients..." />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <StatTile value={String(stats.open)} label="Active jobs" tone="primary" />
          <StatTile value={String(stats.photos)} label="Photos captured" />
          <StatTile value={String(stats.reviews)} label="Reviews sent" tone="success" />
        </View>
        {todayJobs.length > 0 ? (
          <View style={{ gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Today ({todayJobs.length})
              </Text>
            </View>
            {todayJobs.map((job) => (
              <JobCard key={`today-${job.id}`} job={job} />
            ))}
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="No jobs found"
            message="Try a different search or filter, or create your first job."
          />
        ) : (
          filtered.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </Screen>
      <Fab onPress={() => router.push('/job/new')} />
    </View>
  );
}
