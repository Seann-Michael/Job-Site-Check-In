import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { JobCard } from '@/components/job-card';
import { Card } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Job } from '@/lib/types';

/** Web fallback: react-native-maps is native-only, so list pinned jobs. */
export function JobMap({ jobs }: { jobs: Job[] }) {
  const { colors } = useTheme();
  const pinned = jobs.filter(
    (job) => typeof job.latitude === 'number' && typeof job.longitude === 'number',
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.notice}>
        <Ionicons name="map-outline" size={18} color={colors.primary} />
        <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
          The interactive pin map renders on iOS and Android. {pinned.length} job
          {pinned.length === 1 ? '' : 's'} with GPS locations:
        </Text>
      </Card>
      {pinned.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
