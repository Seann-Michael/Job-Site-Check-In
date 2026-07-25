import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { JOB_STATUS_TONES, SERVICE_ICONS } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchJob, fetchJobTasks, fetchMedia } from '@/lib/data';
import { formatDate, JOB_STATUS_LABELS, notify } from '@/lib/format';
import { useData } from '@/hooks/use-data';
import { useAuth } from '@/providers/auth-provider';

export default function JobDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();

  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: tasks } = useData(() => fetchJobTasks(id ?? ''));
  const { data: media } = useData(fetchMedia);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const jobMedia = (media ?? []).filter((item) => item.job_id === id).slice(0, 6);

  return (
    <Screen>
      <DetailHeader title="Job details" />

      {job ? (
        <>
          <Card style={{ gap: Spacing.md }}>
            <View style={styles.heroRow}>
              <IconTile icon={SERVICE_ICONS[job.service_type] ?? 'hammer-outline'} size={46} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.title, { color: colors.text }]}>{job.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {job.client_name}
                </Text>
              </View>
              <Badge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
            </View>
            <View style={[styles.infoBlock, { borderTopColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text style={{ fontSize: 13.5, color: colors.textSecondary, flex: 1 }}>
                  {job.address}, {job.city}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
                  Started {formatDate(job.start_date)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="camera-outline" size={16} color={colors.textMuted} />
                <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
                  {job.photo_count} photos captured
                </Text>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button
              label="Capture photo"
              icon="camera-outline"
              style={{ flex: 1 }}
              onPress={() =>
                notify(
                  'Photo capture',
                  'Geotagged photo capture (EXIF + GPS for local SEO) arrives in the next milestone.',
                )
              }
            />
            <Button
              label="Request review"
              icon="star-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                notify(
                  'Review request',
                  'Sends an SMS/email review funnel using the same Twilio + ReviewGate flow as the web app.',
                )
              }
            />
          </View>

          {jobMedia.length > 0 ? (
            <Section title="Latest media">
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {jobMedia.slice(0, 3).map((item) => (
                  <MediaThumb key={item.id} item={item} />
                ))}
                {jobMedia.length < 3
                  ? Array.from({ length: 3 - jobMedia.length }).map((_, i) => (
                      <View key={`pad-${i}`} style={{ flex: 1 }} />
                    ))
                  : null}
              </View>
            </Section>
          ) : null}

          <Section title="Checklist">
            <Card style={{ padding: 0 }}>
              {(tasks ?? []).map((task, index) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}>
                  <Ionicons
                    name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={task.done ? colors.success : colors.textMuted}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      color: task.done ? colors.textSecondary : colors.text,
                      textDecorationLine: task.done ? 'line-through' : 'none',
                    }}>
                    {task.label}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Job not found.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  infoBlock: {
    gap: Spacing.sm + 2,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
