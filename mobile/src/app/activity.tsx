import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, StatTile, type IconName } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchJobs, fetchMedia } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { fetchGmbData } from '@/lib/gmb';
import { fetchRecentPosts } from '@/lib/publish';
import { DEMO_GMB_PROFILE } from '@/lib/demo-data';
import { jobExtras, visitDuration } from '@/lib/job-extras';
import { fetchPresence, type Presence } from '@/lib/team-presence';
import { useAuth } from '@/providers/auth-provider';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivityEvent {
  id: string;
  icon: IconName;
  label: string;
  date: string;
}

export default function ActivityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const [presence, setPresence] = useState<Presence[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void fetchPresence(user?.name ?? 'You').then((all) => {
        if (alive) setPresence(all);
      });
    };
    refresh();
    const unsubscribe = jobExtras.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [user?.name]);
  const { data: jobs } = useData(fetchJobs);
  const { data: media } = useData(fetchMedia);
  const { data: posts } = useData(fetchRecentPosts);
  const { data: gmb } = useData(fetchGmbData);

  const now = Date.now();

  const stats = useMemo(() => {
    const allJobs = jobs ?? [];
    const allMedia = media ?? [];
    const within = (iso: string, days: number) => {
      const time = new Date(iso).getTime();
      return !Number.isNaN(time) && now - time < days * DAY_MS;
    };
    return {
      completed: allJobs.filter((job) => job.status === 'completed').length,
      open: allJobs.filter((job) => ['active', 'in_progress'].includes(job.status)).length,
      photos30: allMedia.filter((item) => within(item.taken_at, 30)).length,
      publishes: (posts ?? []).length,
    };
  }, [jobs, media, posts, now]);

  // Photos per day, last 7 days — simple bar chart with plain Views.
  const week = useMemo(() => {
    const allMedia = media ?? [];
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now - i * DAY_MS);
      const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
        day.getDate(),
      ).padStart(2, '0')}`;
      days.push({
        label: day.toLocaleDateString('en-US', { weekday: 'narrow' }),
        count: allMedia.filter((item) => item.taken_at.startsWith(stamp)).length,
      });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, max };
  }, [media, now]);

  const feed = useMemo(() => {
    const events: ActivityEvent[] = [];
    for (const job of jobs ?? []) {
      events.push({
        id: `job-${job.id}`,
        icon: job.status === 'completed' ? 'checkmark-circle' : 'briefcase-outline',
        label: `${job.status === 'completed' ? 'Completed' : 'Job'}: ${job.title}`,
        date: job.start_date,
      });
    }
    for (const item of (media ?? []).slice(0, 15)) {
      events.push({
        id: `media-${item.id}`,
        icon: item.media_type === 'video' ? 'videocam-outline' : 'camera-outline',
        label: `${item.media_type === 'video' ? 'Video' : 'Photo'} (${item.category})${item.job_title ? ` — ${item.job_title}` : ''}`,
        date: item.taken_at,
      });
    }
    for (const post of posts ?? []) {
      events.push({
        id: `post-${post.id}`,
        icon: 'megaphone-outline',
        label: `Published: ${post.title}`,
        date: post.created_at,
      });
    }
    return events
      .filter((event) => !Number.isNaN(new Date(event.date).getTime()))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12);
  }, [jobs, media, posts]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const score =
    gmb?.mode === 'connected' ? gmb.profile.overall_score : DEMO_GMB_PROFILE.score;
  const scoreColor = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.danger;

  return (
    <Screen>
      <DetailHeader title="Activity" />

      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <StatTile value={String(stats.open)} label="Open jobs" tone="primary" />
        <StatTile value={String(stats.completed)} label="Completed" tone="success" />
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <StatTile value={String(stats.photos30)} label="Photos (30d)" />
        <StatTile value={String(stats.publishes)} label="Publishes" tone="warning" />
      </View>

      <Section title="Team on site">
        {presence.length === 0 ? (
          <Card>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Nobody is checked in right now. Check-ins from the job screen appear here live.
            </Text>
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {presence.map((entry, index) => {
              const job = (jobs ?? []).find((candidate) => candidate.id === entry.jobId);
              return (
                <Pressable
                  key={`${entry.name}-${entry.jobId}`}
                  onPress={() =>
                    router.push({ pathname: '/job/[id]', params: { id: entry.jobId } })
                  }
                  style={({ pressed }) => [
                    styles.presenceRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.cardPressed },
                  ]}>
                  <View style={[styles.presenceDot, { backgroundColor: colors.success }]} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                      {entry.isYou ? 'You' : entry.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                      {job?.title ?? 'Job'}
                      {job?.city ? ` · ${job.city}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.success }}>
                    {visitDuration(entry.since)}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </Card>
        )}
      </Section>

      <Section title="Photos this week">
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.chart}>
            {week.days.map((day, index) => (
              <View key={index} style={styles.barColumn}>
                <Text style={{ fontSize: 10.5, color: colors.textSecondary }}>
                  {day.count > 0 ? day.count : ''}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (day.count / week.max) * 72),
                      backgroundColor: day.count > 0 ? colors.primary : colors.cardPressed,
                    },
                  ]}
                />
                <Text style={{ fontSize: 10.5, color: colors.textMuted }}>{day.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      <Section title="GMB profile score">
        <Card style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: scoreColor }}>{score}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>/ 100</Text>
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
      </Section>

      <Section title="Recent activity">
        <Card style={{ padding: 0 }}>
          {feed.map((event, index) => (
            <View
              key={event.id}
              style={[
                styles.feedRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}>
              <Ionicons name={event.icon} size={16} color={colors.textSecondary} />
              <Text
                style={{ flex: 1, fontSize: 13.5, color: colors.text }}
                numberOfLines={1}>
                {event.label}
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                {formatDate(event.date)}
              </Text>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    height: 110,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    borderRadius: Radius.sm,
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
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
});
