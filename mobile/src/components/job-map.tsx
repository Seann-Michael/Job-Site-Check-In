import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

import { JOB_STATUS_TONES } from '@/components/job-card';
import { useTheme } from '@/hooks/use-theme';
import { JOB_STATUS_LABELS } from '@/lib/format';
import type { Job } from '@/lib/types';

/** Native map with a pin per job (web build uses job-map.web.tsx instead). */
export function JobMap({ jobs }: { jobs: Job[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pinned = jobs.filter(
    (job) => typeof job.latitude === 'number' && typeof job.longitude === 'number',
  );

  const initialRegion =
    pinned.length > 0
      ? {
          latitude: pinned.reduce((sum, job) => sum + (job.latitude ?? 0), 0) / pinned.length,
          longitude: pinned.reduce((sum, job) => sum + (job.longitude ?? 0), 0) / pinned.length,
          latitudeDelta: 0.25,
          longitudeDelta: 0.25,
        }
      : { latitude: 39.5, longitude: -98.35, latitudeDelta: 30, longitudeDelta: 30 };

  return (
    <MapView style={StyleSheet.absoluteFill} initialRegion={initialRegion}>
      {pinned.map((job) => (
        <Marker
          key={job.id}
          coordinate={{ latitude: job.latitude ?? 0, longitude: job.longitude ?? 0 }}
          pinColor={
            JOB_STATUS_TONES[job.status] === 'success'
              ? '#059669'
              : JOB_STATUS_TONES[job.status] === 'warning'
                ? '#D97706'
                : '#0697E0'
          }>
          <Callout onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}>
            <View style={styles.callout}>
              <Text style={[styles.calloutTitle, { color: colors.text }]}>{job.title}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {job.client_name} · {JOB_STATUS_LABELS[job.status]}
              </Text>
              <Text style={{ fontSize: 11.5, color: '#0697E0', fontWeight: '600' }}>
                Open job →
              </Text>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  callout: {
    minWidth: 160,
    gap: 2,
    padding: 2,
  },
  calloutTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
