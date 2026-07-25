import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CategorySheet } from '@/components/category-sheet';
import { JOB_STATUS_TONES, SERVICE_ICONS } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchJob, fetchJobMedia } from '@/lib/data';
import { tasksStore } from '@/lib/tasks-store';
import { formatDate, JOB_STATUS_LABELS, notify } from '@/lib/format';
import { jobsStore } from '@/lib/jobs-store';
import { captureJobPhoto, openAppSettings } from '@/lib/media-capture';
import { getMediaPrefs } from '@/lib/media-prefs';
import { DESTINATION_LABELS, getPublishRecord } from '@/lib/publish';
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
  const { id, capture } = useLocalSearchParams<{ id: string; capture?: string }>();
  const { user, initializing } = useAuth();

  const router = useRouter();
  const { data: job, refresh: refreshJob } = useData(() => fetchJob(id ?? ''));
  const { data: tasks, refresh: refreshTasks } = useData(() => tasksStore.getTasks(id ?? ''));
  useEffect(() => tasksStore.subscribe(refreshTasks), [refreshTasks]);
  const { data: jobMediaData, refresh } = useData(() => fetchJobMedia(id ?? ''));
  const { data: publishRecord, refresh: refreshPublish } = useData(() =>
    getPublishRecord(id ?? ''),
  );
  useMediaRefresh(refresh);
  useEffect(
    () =>
      jobsStore.subscribe(() => {
        refreshJob();
        refreshPublish();
      }),
    [refreshJob, refreshPublish],
  );

  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<MediaCategory | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [newTask, setNewTask] = useState('');

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
          result.queued ? 'Saved offline' : 'Photo saved',
          result.queued
            ? 'No connection right now — the photo is queued and uploads automatically when you are back online.'
            : result.hasLocation
              ? 'Saved with GPS location — great for local SEO.'
              : 'Saved without GPS (location unavailable or permission denied).',
        );
      } finally {
        setCapturing(false);
      }
    },
    [job, capturing, refresh],
  );

  // Arriving from "Create job → Capture now": start the before-photo capture
  // once the job has loaded (native only — web needs a user gesture).
  const autoCaptured = useRef(false);
  useEffect(() => {
    if (capture === 'before' && job && !autoCaptured.current && Platform.OS !== 'web') {
      autoCaptured.current = true;
      void startCapture('before');
    }
  }, [capture, job, startCapture]);

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

  const shareJob = async () => {
    if (!job) return;
    const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? '';
    const link = appUrl ? `${appUrl.replace(/\/$/, '')}/public/job/${job.id}` : '';
    try {
      await Share.share({
        message: [
          `${job.title} — ${job.client_name}`,
          [job.address, job.city].filter(Boolean).join(', '),
          link,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch {
      // User dismissed the share sheet.
    }
  };

  return (
    <>
      <Screen>
        <DetailHeader
          title="Job details"
          action={{ icon: 'share-outline', onPress: () => void shareJob() }}
        />

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
                onPress={() => {
                  // Media settings can pin a default category and skip the sheet.
                  void getMediaPrefs().then((prefs) => {
                    if (prefs.defaultCategory !== 'ask') {
                      void startCapture(prefs.defaultCategory);
                    } else {
                      setSheetVisible(true);
                    }
                  });
                }}
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

            {publishRecord ? (
              <Card style={{ gap: Spacing.sm }}>
                <View style={styles.publishedHeader}>
                  <Ionicons name="megaphone" size={16} color={colors.success} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    Published {formatDate(publishRecord.published_at)}
                  </Text>
                </View>
                <View style={styles.publishedBadges}>
                  {publishRecord.destinations.map((destination) => (
                    <Badge
                      key={destination}
                      label={DESTINATION_LABELS[destination]}
                      tone="success"
                    />
                  ))}
                </View>
              </Card>
            ) : (
              <Button
                label="Complete & publish"
                icon="megaphone-outline"
                variant="secondary"
                onPress={() => router.push({ pathname: '/publish/[id]', params: { id: job.id } })}
              />
            )}

            {jobMedia.length > 0 ? (
              <Button
                label="Before / After collage"
                icon="images-outline"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/before-after/[id]', params: { id: job.id } })
                }
              />
            ) : null}

            {mediaRows.length > 0 ? (
              <Section title="Latest media">
                <View style={{ gap: Spacing.sm }}>
                  {mediaRows.map((row, rowIndex) => (
                    <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      {row.map((item, colIndex) => (
                        <Pressable
                          key={item.id}
                          style={{ flex: 1 }}
                          onPress={() => setViewerIndex(rowIndex * 3 + colIndex)}>
                          <MediaThumb item={item} />
                        </Pressable>
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
                  <Pressable
                    key={task.id}
                    onPress={() => void tasksStore.toggle(id ?? '', task.id)}
                    style={({ pressed }) => [
                      styles.taskRow,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                      pressed && { backgroundColor: colors.cardPressed },
                    ]}>
                    <Ionicons
                      name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={task.done ? colors.success : colors.textMuted}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: task.done ? colors.textSecondary : colors.text,
                        textDecorationLine: task.done ? 'line-through' : 'none',
                      }}>
                      {task.label}
                    </Text>
                  </Pressable>
                ))}
                <View
                  style={[
                    styles.taskRow,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    value={newTask}
                    onChangeText={setNewTask}
                    placeholder="Add a task..."
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
                    onSubmitEditing={() => {
                      if (newTask.trim()) {
                        void tasksStore.add(id ?? '', newTask);
                        setNewTask('');
                      }
                    }}
                    returnKeyType="done"
                  />
                </View>
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
      <MediaViewer
        items={jobMedia}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
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
  publishedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publishedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
