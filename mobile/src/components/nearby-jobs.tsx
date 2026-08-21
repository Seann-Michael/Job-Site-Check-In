import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/basics';
import { cardShadow, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLocationFix, type GeoFix } from '@/lib/media-capture';
import type { Job } from '@/lib/types';

const MAX_NEARBY = 5;
const MAX_MILES = 100;

/** Great-circle distance in miles. */
function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

function formatMiles(miles: number): string {
  if (miles < 0.2) return 'Here';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * "Nearby jobs" rail for the top of the Jobs tab: sorts non-completed jobs
 * with coordinates by distance from the device. Hidden entirely when
 * location is unavailable or nothing is in range.
 */
export function NearbyJobs({ jobs }: { jobs: Job[] }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [fix, setFix] = useState<GeoFix | undefined>();

  useEffect(() => {
    let alive = true;
    void getLocationFix().then((result) => {
      if (alive) setFix(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  const nearby = useMemo(() => {
    if (!fix) return [];
    return jobs
      .filter(
        (job) =>
          job.latitude != null &&
          job.longitude != null &&
          job.status !== 'completed' &&
          job.status !== 'cancelled',
      )
      .map((job) => ({
        job,
        miles: milesBetween(fix.latitude, fix.longitude, job.latitude!, job.longitude!),
      }))
      .filter((entry) => entry.miles <= MAX_MILES)
      .sort((a, b) => a.miles - b.miles)
      .slice(0, MAX_NEARBY);
  }, [jobs, fix]);

  if (nearby.length === 0) return null;

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.titleRow}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <Text style={[Typography.h1, { color: colors.text }]}>Nearby jobs</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.lg }}
        style={{ marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg }}>
        {nearby.map(({ job, miles }) => (
          <Pressable
            key={job.id}
            onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
            style={({ pressed }) => [
              styles.card,
              cardShadow,
              {
                backgroundColor: pressed ? colors.cardPressed : colors.card,
                borderColor: isDark ? colors.border : 'transparent',
                borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}>
            <View style={styles.cardTop}>
              <Badge label={formatMiles(miles)} tone="primary" />
              <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
            </View>
            <Text style={[Typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
              {[job.address, job.city].filter(Boolean).join(', ') || job.client_name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    width: 210,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
