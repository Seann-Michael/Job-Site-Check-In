import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JobMap } from '@/components/job-map';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useJobsRefresh } from '@/hooks/use-jobs-refresh';
import { fetchJobs } from '@/lib/data';
import { useAuth } from '@/providers/auth-provider';

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data: jobs, refresh } = useData(fetchJobs);
  useJobsRefresh(refresh);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <JobMap jobs={jobs ?? []} />
      <View style={[styles.header, { top: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.headerButton, { backgroundColor: colors.card }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.titleChip, { backgroundColor: colors.card }]}>
          <Ionicons name="map-outline" size={15} color={colors.primary} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Job map</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
