import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Fab } from '@/components/fab';
import { JobCard } from '@/components/job-card';
import { SearchBar } from '@/components/search-bar';
import { EmptyState, Segmented, StatTile } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchJobs } from '@/lib/data';
import { notify } from '@/lib/format';
import { useData } from '@/hooks/use-data';
import { useAuth } from '@/providers/auth-provider';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

export default function JobsScreen() {
  const { colors } = useTheme();
  const { user, businessName } = useAuth();
  const { data: jobs, loading, refreshing, refresh } = useData(fetchJobs);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const all = jobs ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((job) => {
      if (filter === 'open' && !['active', 'in_progress', 'paused'].includes(job.status)) {
        return false;
      }
      if (filter === 'completed' && job.status !== 'completed') return false;
      if (!q) return true;
      return [job.title, job.client_name, job.city, job.address]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [jobs, query, filter]);

  const stats = useMemo(() => {
    const all = jobs ?? [];
    const open = all.filter((job) => ['active', 'in_progress'].includes(job.status)).length;
    const photos = all.reduce((sum, job) => sum + job.photo_count, 0);
    const reviews = all.filter((job) => job.review_requested).length;
    return { open, photos, reviews };
  }, [jobs]);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader title="Jobs" subtitle={businessName} avatarName={user?.name ?? 'User'} />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search jobs, clients..." />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <StatTile value={String(stats.open)} label="Active jobs" tone="primary" />
          <StatTile value={String(stats.photos)} label="Photos captured" />
          <StatTile value={String(stats.reviews)} label="Reviews sent" tone="success" />
        </View>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
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
      <Fab
        onPress={() =>
          notify(
            'New job',
            'Job creation with address autocomplete, Street View and geotagged photo capture lands in the next milestone.',
          )
        }
      />
    </View>
  );
}
