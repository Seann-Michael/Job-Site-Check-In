import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, IconTile } from '@/components/ui/basics';
import { SERVICE_ICONS } from '@/components/job-card';
import { DetailHeader, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchJobs } from '@/lib/data';
import { getLocationFix, type GeoFix } from '@/lib/media-capture';
import { useAuth } from '@/providers/auth-provider';

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
  if (miles < 0.1) return 'right here';
  if (miles < 10) return `${miles.toFixed(2)} miles away`;
  return `${Math.round(miles)} miles away`;
}

/**
 * Capture-first flow (CompanyCam's "Choose a Project"): tap the camera on
 * the Jobs tab, pick the job — nearest first — and land in the camera.
 */
export default function CapturePickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data: jobs } = useData(fetchJobs);
  const [fix, setFix] = useState<GeoFix | undefined>();
  const [located, setLocated] = useState(false);

  useEffect(() => {
    let alive = true;
    void getLocationFix().then((result) => {
      if (alive) {
        setFix(result);
        setLocated(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const open = (jobs ?? []).filter(
      (job) => job.status !== 'completed' && job.status !== 'cancelled',
    );
    const entries = open.map((job) => ({
      job,
      miles:
        fix && job.latitude != null && job.longitude != null
          ? milesBetween(fix.latitude, fix.longitude, job.latitude, job.longitude)
          : null,
    }));
    return entries.sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity));
  }, [jobs, fix]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const openCamera = (jobId: string, jobTitle: string) => {
    router.replace({ pathname: '/camera', params: { jobId, jobTitle } });
  };

  return (
    <Screen>
      <DetailHeader title="Take photos" />
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: -Spacing.sm }}>
        {located && !fix
          ? 'Location unavailable — jobs are unsorted.'
          : 'Pick the job — closest first.'}
      </Text>

      {sorted.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="No open jobs"
          message="Create a job first, then capture photos into it."
        />
      ) : (
        sorted.map(({ job, miles }) => (
          <Card key={job.id} onPress={() => openCamera(job.id, job.title)}>
            <View style={styles.row}>
              <IconTile icon={SERVICE_ICONS[job.service_type] ?? 'hammer-outline'} size={42} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  {job.title}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
                  {[job.address, job.city].filter(Boolean).join(', ') || job.client_name}
                </Text>
                {miles != null ? (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primaryStrong }}>
                    {job.photo_count} photos · {formatMiles(miles)}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {job.photo_count} photos
                  </Text>
                )}
              </View>
              {miles != null && miles < 0.25 ? <Badge label="On site" tone="success" /> : null}
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
            </View>
          </Card>
        ))
      )}

      <Pressable
        onPress={() => router.push('/job/new')}
        style={({ pressed }) => [
          styles.newJob,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.85 },
        ]}>
        <Ionicons name="add" size={18} color={colors.onPrimary} />
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.onPrimary }}>
          New job
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  newJob: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
});
