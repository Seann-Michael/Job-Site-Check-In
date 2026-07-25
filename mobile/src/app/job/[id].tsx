import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import {
  Alert,
  Linking,
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
import { VoiceNotes } from '@/components/voice-notes';
import { Badge, Button, Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchJob, fetchJobMedia, updateJob } from '@/lib/data';
import { openDirections } from '@/lib/directions';
import { jobExtras, visitDuration } from '@/lib/job-extras';
import { getLocationFix } from '@/lib/media-capture';
import { TagList } from '@/components/tag-editor';
import { tasksStore } from '@/lib/tasks-store';
import { formatDate, JOB_STATUS_LABELS, notify, timeAgo } from '@/lib/format';
import { jobsStore } from '@/lib/jobs-store';
import { captureJobMedia, openAppSettings, type CaptureSource } from '@/lib/media-capture';
import { getMediaPrefs } from '@/lib/media-prefs';
import { DESTINATION_LABELS, getPublishRecord } from '@/lib/publish';
import { exportJobReport } from '@/lib/report';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useJobPresence } from '@/lib/team-presence';
import { useWorkspace } from '@/hooks/use-workspace';
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
  const { business } = useWorkspace();

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
  const [newNote, setNewNote] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const { data: extras, refresh: refreshExtras } = useData(() => jobExtras.get(id ?? ''));
  useEffect(() => jobExtras.subscribe(refreshExtras), [refreshExtras]);

  const activeVisit = (extras?.checkins ?? []).find((visit) => !visit.checked_out_at);
  const presence = useJobPresence(id ?? '', user?.name ?? 'You');
  const teammatesOnSite = presence.filter((entry) => !entry.isYou);
  const [exporting, setExporting] = useState(false);

  const handleExportReport = async () => {
    if (!job || exporting) return;
    setExporting(true);
    try {
      const result = await exportJobReport({
        job,
        media: jobMediaData ?? [],
        tasks: tasks ?? [],
        extras: extras ?? { checkins: [], notes: [], documents: [] },
        businessName: business?.name ?? 'Your business',
        businessId: business?.id,
      });
      if (result.error) notify('Could not export', result.error);
    } finally {
      setExporting(false);
    }
  };

  const handleCheckInOut = async () => {
    if (!id || checkingIn) return;
    setCheckingIn(true);
    try {
      if (activeVisit) {
        await jobExtras.checkOut(id);
        notify('Checked out', 'Site visit saved to the job history.');
      } else {
        const geo = await getLocationFix();
        await jobExtras.checkIn(id, geo);
        notify('Checked in', geo ? 'On site — visit is being tracked with GPS.' : 'On site — visit is being tracked.');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    await jobExtras.addNote(id, newNote, user?.name ?? 'You');
    setNewNote('');
  };

  const handleAddDocument = async () => {
    if (!id) return;
    const result = await jobExtras.addDocument(id);
    if (result.error) notify('Could not attach', result.error);
    else if (result.added) notify('Document attached', 'Saved with this job.');
  };

  const startCapture = useCallback(
    async (category: MediaCategory, source: CaptureSource) => {
      if (!job || capturing) return;
      setCapturing(true);
      try {
        // Launching the picker too soon after an alert/sheet dismissal hangs
        // the native presentation on iOS.
        if (Platform.OS === 'ios') {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        const result = await captureJobMedia(job.id, job.title, category, source);
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
        if (result.saved === 0 && result.queued === 0) {
          notify('Not saved', result.error ?? 'Something went wrong. Please try again.');
          return;
        }
        refresh();
        const total = result.saved + result.queued;
        const what = total === 1 ? 'Media item' : `${total} media items`;
        notify(
          result.queued > 0 ? 'Saved offline' : 'Saved',
          result.queued > 0
            ? `${what} saved — uploads automatically when you are back online.`
            : result.hasLocation
              ? `${what} saved with GPS location — great for local SEO.`
              : `${what} saved (no GPS — location unavailable or turned off).`,
        );
      } finally {
        setCapturing(false);
      }
    },
    [job, capturing, refresh],
  );

  const chooseSource = useCallback(
    (category: MediaCategory) => {
      if (Platform.OS === 'web') {
        void startCapture(category, 'library');
        return;
      }
      Alert.alert('Add media', 'Photos are stamped per your media settings.', [
        { text: 'Take photo', onPress: () => void startCapture(category, 'camera-photo') },
        { text: 'Record video', onPress: () => void startCapture(category, 'camera-video') },
        { text: 'Choose from gallery', onPress: () => void startCapture(category, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [startCapture],
  );

  // Arriving from "Create job → Capture now": start the before-photo capture
  // once the job has loaded (native only — web needs a user gesture).
  const autoCaptured = useRef(false);
  useEffect(() => {
    if (capture === 'before' && job && !autoCaptured.current && Platform.OS !== 'web') {
      autoCaptured.current = true;
      void startCapture('before', 'camera-photo');
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
      // Presenting anything while the sheet is mid-dismissal misbehaves on
      // iOS — wait for the Modal's onDismiss instead.
      setPendingCategory(category);
    } else {
      chooseSource(category);
    }
  };

  const handleSheetDismissed = () => {
    if (pendingCategory) {
      const category = pendingCategory;
      setPendingCategory(null);
      chooseSource(category);
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

  const openJobMenu = () => {
    if (!job) return;
    const setStatus = async (status: typeof job.status) => {
      const result = await updateJob(job, { status });
      if (result.error) notify('Could not update', result.error);
      else refreshJob();
    };
    if (Platform.OS === 'web') {
      router.push({ pathname: '/job/edit/[id]', params: { id: job.id } });
      return;
    }
    Alert.alert(job.title, 'Manage this job', [
      {
        text: 'Edit job',
        onPress: () => router.push({ pathname: '/job/edit/[id]', params: { id: job.id } }),
      },
      job.status !== 'active'
        ? { text: 'Mark active', onPress: () => void setStatus('active') }
        : { text: 'Mark in progress', onPress: () => void setStatus('in_progress') },
      job.status !== 'paused'
        ? { text: 'Pause job', onPress: () => void setStatus('paused') }
        : { text: 'Resume job', onPress: () => void setStatus('active') },
      { text: 'Mark completed', onPress: () => void setStatus('completed') },
      {
        text: 'Cancel job',
        style: 'destructive',
        onPress: () => void setStatus('cancelled'),
      },
      { text: 'Close', style: 'cancel' },
    ]);
  };

  return (
    <>
      <Screen>
        <DetailHeader
          title="Job details"
          actions={[
            { icon: 'share-outline', onPress: () => void shareJob() },
            { icon: 'ellipsis-horizontal', onPress: openJobMenu },
          ]}
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
                  {job.address || job.latitude != null ? (
                    <Pressable
                      onPress={() => void openDirections(job)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.directionsChip,
                        { backgroundColor: colors.primarySoft },
                        pressed && { opacity: 0.7 },
                      ]}>
                      <Ionicons name="navigate" size={12} color={colors.primaryStrong} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryStrong }}>
                        Directions
                      </Text>
                    </Pressable>
                  ) : null}
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
                {job.tags?.length ? <TagList tags={job.tags} /> : null}
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button
                label="Add media"
                icon="camera-outline"
                style={{ flex: 1 }}
                loading={capturing}
                onPress={() => {
                  // Media settings can pin a default category and skip the sheet.
                  void getMediaPrefs().then((prefs) => {
                    if (prefs.defaultCategory !== 'ask') {
                      chooseSource(prefs.defaultCategory);
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

            <Card
              style={[
                styles.checkinCard,
                activeVisit && { borderColor: colors.success, borderWidth: 1 },
              ]}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={activeVisit ? 'radio-button-on' : 'location-outline'}
                    size={15}
                    color={activeVisit ? colors.success : colors.textSecondary}
                  />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {activeVisit
                      ? `On site — ${visitDuration(activeVisit.checked_in_at)}`
                      : `Site visits: ${(extras?.checkins ?? []).length}`}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {activeVisit
                    ? `Checked in ${timeAgo(activeVisit.checked_in_at)}`
                    : 'Track each day you are at this job'}
                </Text>
              </View>
              <Button
                label={activeVisit ? 'Check out' : 'Check in'}
                icon={activeVisit ? 'log-out-outline' : 'log-in-outline'}
                variant={activeVisit ? 'primary' : 'secondary'}
                loading={checkingIn}
                onPress={() => void handleCheckInOut()}
              />
            </Card>

            {teammatesOnSite.length > 0 ? (
              <Card style={{ gap: Spacing.sm }}>
                {teammatesOnSite.map((entry) => (
                  <View key={entry.name} style={styles.infoRow}>
                    <View style={[styles.presenceDot, { backgroundColor: colors.success }]} />
                    <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>
                      <Text style={{ fontWeight: '700' }}>{entry.name}</Text> is on site
                    </Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      {visitDuration(entry.since)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

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

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button
                label="PDF report"
                icon="document-text-outline"
                variant="secondary"
                style={{ flex: 1 }}
                loading={exporting}
                onPress={() => void handleExportReport()}
              />
              <Button
                label="Share gallery"
                icon="link-outline"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/share/[id]', params: { id: job.id } })}
              />
            </View>

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

            {(extras?.checkins ?? []).length > 0 ? (
              <Section title={`Site visits (${extras?.checkins.length})`}>
                <Card style={{ padding: 0 }}>
                  {(extras?.checkins ?? [])
                    .slice()
                    .reverse()
                    .map((visit, index) => (
                      <View
                        key={visit.id}
                        style={[
                          styles.visitRow,
                          index > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          },
                        ]}>
                        <Text style={{ width: 52, fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>
                          Day {(extras?.checkins.length ?? 0) - index}
                        </Text>
                        <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>
                          {formatDate(visit.checked_in_at)} ·{' '}
                          {new Date(visit.checked_in_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {visit.checked_out_at
                            ? ` – ${new Date(visit.checked_out_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}`
                            : ' – now'}
                        </Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: visit.checked_out_at ? colors.textSecondary : colors.success }}>
                          {visitDuration(visit.checked_in_at, visit.checked_out_at)}
                        </Text>
                        {typeof visit.latitude === 'number' ? (
                          <Ionicons name="location" size={12} color={colors.success} />
                        ) : null}
                      </View>
                    ))}
                </Card>
              </Section>
            ) : null}

            <Section title={`Notes (${extras?.notes.length ?? 0})`}>
              <Card style={{ padding: 0 }}>
                <View style={[styles.taskRow]}>
                  <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    value={newNote}
                    onChangeText={setNewNote}
                    placeholder="Add a note about this job..."
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
                    onSubmitEditing={() => void handleAddNote()}
                    returnKeyType="done"
                  />
                  <Pressable hitSlop={8} onPress={() => void handleAddNote()} disabled={!newNote.trim()}>
                    <Ionicons
                      name="arrow-up-circle"
                      size={22}
                      color={newNote.trim() ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                </View>
                {(extras?.notes ?? []).map((note) => (
                  <View
                    key={note.id}
                    style={[
                      styles.noteRow,
                      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, color: colors.text }}>{note.text}</Text>
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {note.author} · {timeAgo(note.created_at)}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => void jobExtras.deleteNote(id ?? '', note.id)}>
                      <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </Section>

            <VoiceNotes jobId={id ?? ''} notes={extras?.voiceNotes ?? []} />

            <Section
              title={`Documents (${extras?.documents.length ?? 0})`}
              action={
                <Pressable hitSlop={8} onPress={() => void handleAddDocument()}>
                  <Ionicons name="add-circle" size={22} color={colors.primary} />
                </Pressable>
              }>
              {(extras?.documents ?? []).length === 0 ? (
                <Card>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Attach contracts, estimates, or permits — tap + to add one.
                  </Text>
                </Card>
              ) : (
                <Card style={{ padding: 0 }}>
                  {(extras?.documents ?? []).map((doc, index) => (
                    <Pressable
                      key={doc.id}
                      onPress={() => {
                        if (doc.uri.startsWith('http')) void Linking.openURL(doc.uri);
                        else void Sharing.shareAsync(doc.uri).catch(() => undefined);
                      }}
                      style={({ pressed }) => [
                        styles.taskRow,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.border,
                        },
                        pressed && { backgroundColor: colors.cardPressed },
                      ]}>
                      <Ionicons name="document-text-outline" size={19} color={colors.primary} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {doc.name}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                          {doc.size > 0 ? `${Math.max(1, Math.round(doc.size / 1024))} KB · ` : ''}
                          {timeAgo(doc.added_at)}
                        </Text>
                      </View>
                      <Pressable
                        hitSlop={8}
                        onPress={() => void jobExtras.deleteDocument(id ?? '', doc.id)}>
                        <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                      </Pressable>
                    </Pressable>
                  ))}
                </Card>
              )}
            </Section>

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
        onLogoSticker={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/logo-sticker', params: { mediaId: item.id } });
        }}
        onAnnotate={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/annotate', params: { mediaId: item.id } });
        }}
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
  directionsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  checkinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
