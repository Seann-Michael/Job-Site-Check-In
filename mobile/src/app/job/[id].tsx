import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { CategorySheet } from '@/components/category-sheet';
import { JOB_STATUS_TONES, SERVICE_ICONS } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchJob, fetchJobMedia, fetchJobTasks } from '@/lib/data';
import { formatDate, JOB_STATUS_LABELS, notify } from '@/lib/format';
import { captureJobPhoto, openAppSettings } from '@/lib/media-capture';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useData } from '@/hooks/use-data';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { useAuth } from '@/providers/auth-provider';
import type { MediaCategory, MediaItem } from '@/lib/types';

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function JobDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();

  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: tasks } = useData(() => fetchJobTasks(id ?? ''));
  const { data: jobMediaData, refresh } = useData(() => fetchJobMedia(id ?? ''));
  useMediaRefresh(refresh);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<MediaCategory | null>(null);
  const [capturing, setCapturing] = useState(false);

  const startCapture = useCallback(
    async (category: MediaCategory) => {
      if (!job || capturing) return;
      setCapturing(true);
      try {
        const result = await captureJobPhoto(job.id, job.title, category);
        if (result.canceled) return;
        if (result.needsSettings) {
          if (Platform.OS === 'web') {
            notify('Camera access needed', result.error ?? '');
          } else {
            Alert.alert('Camera access needed', result.error ?? '', [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: openAppSettings },
            ]);
          }
          return;
        }
        if (result.error) {
          notify('Photo not saved', result.error);
          return;
        }
        refresh();
        notify(
          'Photo saved',
          result.hasLocation
            ? 'Saved with GPS location — great for local SEO.'
            : 'Saved without GPS (location unavailable or permission denied).',
        );
      } finally {
        setCapturing(false);
      }
    },
    [job, capturing, refresh],
  );

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const jobMedia = jobMediaData ?? [];
  const mediaRows = chunk<MediaItem>(jobMedia.slice(0, 6), 3);
  // Configured: the per-job query is the source of truth. Demo: the job row's
  // count plus anything captured on this device.
  const capturedCount = jobMedia.filter((item) => item.id.startsWith('local-')).length;
  const photoCount = isSupabaseConfigured
    ? jobMedia.length
    : (job?.photo_count ?? 0) + capturedCount;

  const handleCategoryPick = (category: MediaCategory) => {
    setSheetVisible(false);
    if (Platform.OS === 'ios') {
      // Presenting the camera while the sheet is mid-dismissal hangs the
      // picker on iOS — wait for the Modal's onDismiss instead.
      setPendingCategory(category);
    } else {
      void startCapture(category);
    }
  };

  const handleSheetDismissed = () => {
    if (pendingCategory) {
      const category = pendingCategory;
      setPendingCategory(null);
      void startCapture(category);
    }
  };

  return (
    <>
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
                    {[job.address, job.city].filter(Boolean).join(', ') || 'No address on file'}
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
                    {photoCount} photos captured
                  </Text>
                </View>
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button
                label="Capture photo"
                icon="camera-outline"
                style={{ flex: 1 }}
                loading={capturing}
                onPress={() => setSheetVisible(true)}
              />
              <Button
                label="Request review"
                icon="star-outline"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  notify(
                    'Review request',
                    'Sends an SMS/email review funnel using the same Twilio + ReviewGate flow as the web app — next milestone.',
                  )
                }
              />
            </View>

            {mediaRows.length > 0 ? (
              <Section title="Latest media">
                <View style={{ gap: Spacing.sm }}>
                  {mediaRows.map((row, rowIndex) => (
                    <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      {row.map((item) => (
                        <MediaThumb key={item.id} item={item} />
                      ))}
                      {row.length < 3
                        ? Array.from({ length: 3 - row.length }).map((_, i) => (
                            <View key={`pad-${i}`} style={{ flex: 1 }} />
                          ))
                        : null}
                    </View>
                  ))}
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
      <CategorySheet
        visible={sheetVisible}
        onSelect={handleCategoryPick}
        onClose={() => setSheetVisible(false)}
        onDismissed={handleSheetDismissed}
      />
    </>
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
