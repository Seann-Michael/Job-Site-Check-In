import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Fab } from '@/components/fab';
import { JobCard } from '@/components/job-card';
import { NearbyJobs } from '@/components/nearby-jobs';
import { SearchBar } from '@/components/search-bar';
import { UploadBanner } from '@/components/upload-banner';
import {
  Button,
  Card,
  EmptyState,
  IconTile,
  KpiRow,
  ListRow,
  QuickAction,
  Segmented,
  StatCard,
  type IconName,
  type Tone,
} from '@/components/ui/basics';
import { Screen, ScreenHeader, Section } from '@/components/ui/screen';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dataErrors, fetchJobs } from '@/lib/data';
import { jobMeta } from '@/lib/job-meta';
import { syncJobReminders } from '@/lib/notifications';
import { useData } from '@/hooks/use-data';
import { useJobsRefresh } from '@/hooks/use-jobs-refresh';
import { useRole } from '@/hooks/use-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Complete' },
  { value: 'starred', label: 'Starred' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Placeholder GMB figures for the owner dashboard. Clearly-plausible values for
 * this UI pass — the real numbers come from fetchGmbData once the home KPIs are
 * wired to it. The business NAME always comes from the workspace hook, never a
 * hardcoded string.
 * TODO(data): source these from lib/gmb.ts fetchGmbData.
 */
const GMB_PLACEHOLDER = { score: 78, rating: 4.8 };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface ActivityRow {
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { business } = useWorkspace();
  const { mode, canWrite } = useRole();
  const { data: jobs, loading, refreshing, refresh } = useData(fetchJobs);
  useJobsRefresh(refresh);
  React.useEffect(() => workspace.subscribe(refresh), [refresh]);
  // Tells "no jobs match" apart from "the jobs query failed" (empty either way).
  const [loadError, setLoadError] = useState<string | null>(() => dataErrors.get('jobs'));
  React.useEffect(() => dataErrors.subscribe(() => setLoadError(dataErrors.get('jobs'))), []);
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

  const isOwner = mode === 'owner';

  // Recent activity: derived from the most recent jobs so it reflects the real
  // workspace rather than fabricated names.
  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];
    for (const job of (jobs ?? []).slice(0, 4)) {
      if (job.review_requested) {
        rows.push({
          icon: 'star',
          tone: 'warning',
          title: 'Review request sent',
          subtitle: `${job.client_name} · ${job.title}`,
        });
      } else if (job.status === 'completed') {
        rows.push({
          icon: 'checkmark-circle',
          tone: 'success',
          title: 'Job completed',
          subtitle: `${job.client_name} · ${job.title}`,
        });
      } else {
        rows.push({
          icon: 'camera',
          tone: 'primary',
          title: `${job.photo_count} photos on file`,
          subtitle: `${job.client_name} · ${job.title}`,
        });
      }
    }
    return rows;
  }, [jobs]);

  const errorBanner = loadError ? (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
      <IconTile icon="cloud-offline-outline" tone="danger" />
      <Text style={[Typography.bodyStrong, { flex: 1, color: colors.text }]}>{loadError}</Text>
      <Button
        label="Retry"
        variant="secondary"
        size="small"
        icon="refresh"
        loading={refreshing}
        onPress={refresh}
      />
    </Card>
  ) : null;

  // ---- Owner dashboard ----
  if (isOwner) {
    return (
      <View style={{ flex: 1 }}>
        <Screen refreshing={refreshing} onRefresh={refresh}>
          <ScreenHeader
            eyebrow={business?.name}
            title={`${greeting()},\n${user?.firstName ?? 'there'}`}
            avatarName={user?.name ?? 'User'}
            actions={[
              { icon: 'notifications-outline', onPress: () => router.push('/activity') },
              { icon: 'settings-outline', onPress: () => router.push('/settings') },
            ]}
          />
          <UploadBanner />
          {errorBanner}

          <Section title="Overview" eyebrow="This month">
            <KpiRow>
              <StatCard
                icon="pulse"
                tone="primary"
                value={String(GMB_PLACEHOLDER.score)}
                label="GMB score"
                delta="+6"
                onPress={() => router.push('/gmb')}
              />
              <StatCard
                icon="star"
                tone="warning"
                value={GMB_PLACEHOLDER.rating.toFixed(1)}
                label="Avg rating"
                onPress={() => router.push('/gmb-reviews')}
              />
              <StatCard
                icon="chatbubbles"
                tone="success"
                value={String(stats.reviews)}
                label="Review requests"
              />
              <StatCard
                icon="briefcase"
                tone="primary"
                value={String(stats.open)}
                label="Active jobs"
              />
            </KpiRow>
          </Section>

          <Section title="Quick actions">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
              <QuickAction
                icon="sync"
                label="Sync GMB"
                onPress={() => router.push('/gmb')}
              />
              <QuickAction
                icon="star"
                tone="warning"
                label="Request review"
                onPress={() => router.push('/reviews')}
              />
              <QuickAction
                icon="add-circle"
                tone="success"
                label="New job"
                onPress={() => router.push('/job/new')}
              />
              <QuickAction
                icon="images"
                label="Feed"
                onPress={() => router.push('/gallery')}
              />
              <QuickAction
                icon="people"
                label="Team"
                onPress={() => router.push('/settings/team')}
              />
              <QuickAction
                icon="card"
                tone="neutral"
                label="Billing"
                onPress={() => router.push('/settings/billing')}
              />
            </View>
          </Section>

          <NearbyJobs jobs={jobs ?? []} />

          <Section
            title="Recent activity"
            action={
              <Button
                label="All jobs"
                variant="ghost"
                size="small"
                onPress={() => router.push('/gallery')}
              />
            }>
            {loading && !jobs ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.lg }} />
            ) : activity.length === 0 ? (
              <EmptyState
                icon="pulse-outline"
                title="Nothing yet"
                message="Job activity across your workspace shows up here."
              />
            ) : (
              <Card padded={false}>
                {activity.map((row, index) => (
                  <ListRow
                    key={`${row.title}-${index}`}
                    icon={row.icon}
                    iconTone={row.tone}
                    title={row.title}
                    subtitle={row.subtitle}
                    divider={index > 0}
                    showChevron={false}
                  />
                ))}
              </Card>
            )}
          </Section>
        </Screen>
        <Fab onPress={() => router.push('/job/new')} />
      </View>
    );
  }

  // ---- Staff / viewer: today + active jobs, restyled ----
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader
          eyebrow={business?.name}
          title="Jobs"
          subtitle={`${greeting()}, ${user?.firstName ?? 'there'}`}
          avatarName={user?.name ?? 'User'}
          readOnly={mode === 'viewer'}
          actions={[
            { icon: 'map-outline', onPress: () => router.push('/map') },
            { icon: 'settings-outline', onPress: () => router.push('/settings') },
          ]}
        />
        <UploadBanner />
        {canWrite ? (
          <Button
            label="Capture photos"
            icon="camera"
            fullWidth
            onPress={() => router.push('/capture-picker')}
          />
        ) : null}
        <NearbyJobs jobs={jobs ?? []} />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <StatCard icon="briefcase" value={String(stats.open)} label="Active jobs" />
          <StatCard icon="camera" tone="success" value={String(stats.photos)} label="Photos" />
        </View>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search jobs, clients..." />
        {todayJobs.length > 0 ? (
          <Section title={`Today · ${todayJobs.length}`}>
            {todayJobs.map((job) => (
              <JobCard key={`today-${job.id}`} job={job} />
            ))}
          </Section>
        ) : null}
        {errorBanner}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : filtered.length === 0 ? (
          loadError ? null : (
            <EmptyState
              icon="briefcase-outline"
              title="No jobs found"
              message="Try a different search or filter, or create your first job."
            />
          )
        ) : (
          <View style={{ gap: Spacing.md }}>
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </View>
        )}
      </Screen>
      <Fab onPress={() => router.push('/job/new')} />
    </View>
  );
}
