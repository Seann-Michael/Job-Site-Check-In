import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CategorySheet } from '@/components/category-sheet';
import { ContactRow } from '@/components/contact-row';
import { JobActionSheet } from '@/components/job/job-action-sheet';
import { JobActivityTab } from '@/components/job/job-activity-tab';
import { JobAssignSheet } from '@/components/job/job-assign-sheet';
import { JobChecklistTab } from '@/components/job/job-checklist-tab';
import { JobDocumentsTab } from '@/components/job/job-documents-tab';
import { JobStatusSheet } from '@/components/job/job-status-sheet';
import { JOB_STATUS_TONES, SERVICE_ICONS } from '@/components/job-card';
import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { NotesSection } from '@/components/notes-section';
import { Badge, Button, Card, IconTile, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchClients } from '@/lib/clients';
import { dataErrors, deleteJob, fetchJob, fetchJobMedia, updateJob } from '@/lib/data';
import { openDirections } from '@/lib/directions';
import { jobExtras, visitDuration } from '@/lib/job-extras';
import { TagList } from '@/components/tag-editor';
import { tasksStore } from '@/lib/tasks-store';
import { formatDate, JOB_STATUS_LABELS, notify, timeAgo } from '@/lib/format';
import { jobsStore } from '@/lib/jobs-store';
import {
  captureJobMedia,
  getLocationFix,
  openAppSettings,
  type CaptureSource,
} from '@/lib/media-capture';
import { getMediaPrefs } from '@/lib/media-prefs';
import { DESTINATION_LABELS, getPublishRecord } from '@/lib/publish';
import { exportJobReport } from '@/lib/report';
import { formatJobValue, jobMeta } from '@/lib/job-meta';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchTeam } from '@/lib/team';
import { useJobPresence } from '@/lib/team-presence';
import { useWorkspace } from '@/hooks/use-workspace';
import { useData } from '@/hooks/use-data';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { useAuth } from '@/providers/auth-provider';
import type { JobStatus, MediaCategory, MediaItem } from '@/lib/types';

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/**
 * The lower half of the screen is tabbed rather than stacked: everything that
 * identifies the job (hero, actions, check-in) stays pinned above, and the four
 * long-running lists share one pane below.
 */
type JobTab = 'activity' | 'checklist' | 'notes' | 'documents';

const TABS: { value: JobTab; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'notes', label: 'Notes' },
  { value: 'documents', label: 'Docs' },
];

export default function JobDetailScreen() {
  const { colors } = useTheme();
  const { id, capture } = useLocalSearchParams<{ id: string; capture?: string }>();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const router = useRouter();
  const {
    data: job,
    loading: jobLoading,
    refreshing: jobRefreshing,
    refresh: refreshJob,
  } = useData(() => fetchJob(id ?? ''));
  const { data: tasks, refresh: refreshTasks } = useData(() => tasksStore.getTasks(id ?? ''));
  useEffect(() => tasksStore.subscribe(refreshTasks), [refreshTasks]);
  const {
    data: jobMediaData,
    refresh,
    refreshing: mediaRefreshing,
  } = useData(() => fetchJobMedia(id ?? ''));
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

  // fetchJob returns undefined both for "no such job" and for "the query
  // failed" — dataErrors is what tells them apart. Same for the per-job photo
  // query, which returns an empty list either way. Both live outside React, so
  // mirror the slots into state and re-read them whenever they change.
  const [jobError, setJobError] = useState<string | null>(() => dataErrors.get('job'));
  const [mediaError, setMediaError] = useState<string | null>(() => dataErrors.get('jobMedia'));
  useEffect(
    () =>
      dataErrors.subscribe(() => {
        setJobError(dataErrors.get('job'));
        setMediaError(dataErrors.get('jobMedia'));
      }),
    [],
  );

  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<MediaCategory | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [tab, setTab] = useState<JobTab>('activity');
  const [actionsVisible, setActionsVisible] = useState(false);
  const [assignVisible, setAssignVisible] = useState(false);
  const [addingDocument, setAddingDocument] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Survives the moment between "row is gone" and "we have navigated away".
  const [deleted, setDeleted] = useState(false);
  const { data: clients } = useData(fetchClients);
  const { data: extras, refresh: refreshExtras } = useData(() => jobExtras.get(id ?? ''));
  useEffect(() => jobExtras.subscribe(refreshExtras), [refreshExtras]);

  const { data: meta, refresh: refreshMeta } = useData(() => jobMeta.get(id ?? ''));
  useEffect(() => jobMeta.subscribe(refreshMeta), [refreshMeta]);

  // The shared roster: names for the assign sheet, and the only way a
  // job_media.uploaded_by id becomes a person in the activity feed. The
  // business arrives asynchronously, so re-read once it (or the user) lands —
  // otherwise the first, business-less answer would be a sample roster forever.
  const { data: roster, refresh: refreshRoster } = useData(() =>
    fetchTeam(business?.id, user),
  );
  const rosterKey = `${business?.id ?? ''}|${user?.id ?? ''}`;
  const lastRosterKey = useRef(rosterKey);
  useEffect(() => {
    if (lastRosterKey.current === rosterKey) return;
    lastRosterKey.current = rosterKey;
    refreshRoster();
  }, [rosterKey, refreshRoster]);

  const toggleAssignee = (name: string) => {
    const assignees = meta?.assignees ?? [];
    const next = assignees.includes(name)
      ? assignees.filter((entry) => entry !== name)
      : [...assignees, name];
    void jobMeta.set(id ?? '', { assignees: next });
  };

  // Customer contact: the job row's client_contact first, the client
  // record as fallback (covers demo data and older jobs).
  const clientRecord = (clients ?? []).find((entry) => entry.name === job?.client_name);
  const clientPhone = job?.client_phone || clientRecord?.phone || '';
  const clientEmail = job?.client_email || clientRecord?.email || '';
  // The company this client is billed under — a separate fact from the person
  // named above it, so it gets its own line. Dropped when the two are the same
  // string, so a company-only row doesn't print its name twice.
  const businessName = (clientRecord?.business_name ?? '').trim();
  const clientBusinessName = businessName === (job?.client_name ?? '').trim() ? '' : businessName;
  // Scope of work comes from the jobs table's `description` column. The web
  // client requires that column to be non-empty, so createJob falls back to the
  // job title when no notes were entered — a block that only repeats the title
  // above it is noise, so it is dropped here instead of printing it twice.
  const scopeOfWork = (job?.description ?? '').trim();
  const showScope = scopeOfWork.length > 0 && scopeOfWork !== (job?.title ?? '').trim();
  const fullAddress = job
    ? [job.address, job.city, [job.state, job.zip].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : '';

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
        await jobExtras.checkIn(id, geo, user?.name ?? 'You');
        notify('Checked in', geo ? 'On site — visit is being tracked with GPS.' : 'On site — visit is being tracked.');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleAddDocument = async () => {
    if (!id || addingDocument) return;
    setAddingDocument(true);
    try {
      const result = await jobExtras.addDocument(id);
      if (result.error) notify('Could not attach', result.error);
      else if (result.added) notify('Document attached', 'Saved with this job.');
    } finally {
      setAddingDocument(false);
    }
  };

  /**
   * Irreversible, and there is no undo — the sheet confirms first. deleteJob
   * clears the row (when connected), the local copy, its media and a tombstone
   * so the job cannot reappear, then emits; we leave the screen ourselves
   * because this route's job no longer exists.
   */
  const handleDeleteJob = async () => {
    if (!job || deleting) return;
    setDeleting(true);
    const result = await deleteJob(job);
    setDeleting(false);
    if (result.error) {
      setActionsVisible(false);
      notify('Could not delete', result.error);
      return;
    }
    setDeleted(true);
    setActionsVisible(false);
    notify('Job deleted', `"${job.title}" and everything on it were removed.`);
    if (router.canGoBack()) router.back();
    else router.replace('/');
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

  const openCamera = useCallback(
    (category: MediaCategory, mode: 'photo' | 'video' = 'photo') => {
      if (!job) return;
      router.push({
        pathname: '/camera',
        params: { jobId: job.id, jobTitle: job.title, category, mode },
      });
    },
    [job, router],
  );

  const chooseSource = useCallback(
    (category: MediaCategory) => {
      if (Platform.OS === 'web') {
        void startCapture(category, 'library');
        return;
      }
      Alert.alert('Add media', 'Photos are stamped per your media settings.', [
        { text: 'Take photos (in-app camera)', onPress: () => openCamera(category) },
        { text: 'Record video', onPress: () => openCamera(category, 'video') },
        { text: 'Choose from gallery', onPress: () => void startCapture(category, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [startCapture, openCamera],
  );

  // Arriving from "Create job → Capture now": open the in-app camera for
  // before photos once the job has loaded (native only).
  const autoCaptured = useRef(false);
  useEffect(() => {
    if (capture === 'before' && job && !autoCaptured.current && Platform.OS !== 'web') {
      autoCaptured.current = true;
      openCamera('before');
    }
  }, [capture, job, openCamera]);

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

  // Single write path for status changes — the sheet and the native menu both
  // go through it, and the job is re-read afterwards so a status stamped
  // elsewhere (e.g. the publish flow) is never overwritten by stale local state.
  const setStatus = async (status: JobStatus) => {
    if (!job || status === job.status) return;
    const result = await updateJob(job, { status });
    if (result.error) notify('Could not update', result.error);
    else refreshJob();
  };

  return (
    <>
      <Screen>
        <DetailHeader
          title="Job details"
          actions={[
            {
              icon: meta?.starred ? 'star' : 'star-outline',
              onPress: () => void jobMeta.toggle(id ?? '', 'starred'),
            },
            // Both share paths and Delete live in one sheet now — an
            // Alert-based menu was invisible on web, which put Delete out of
            // reach there entirely. Hidden while there is no job to act on.
            ...(job
              ? [
                  {
                    icon: 'ellipsis-horizontal' as const,
                    onPress: () => setActionsVisible(true),
                  },
                ]
              : []),
          ]}
        />

        {deleted ? (
          // The job really is gone; say so plainly instead of flashing the
          // "not found" dead end while the navigation away completes.
          <Card style={styles.stateRow}>
            <IconTile icon="trash-outline" tone="neutral" size={40} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>
              This job was deleted.
            </Text>
          </Card>
        ) : job ? (
          <>
            <Card style={{ gap: Spacing.md }}>
              <View style={styles.heroRow}>
                <IconTile icon={SERVICE_ICONS[job.service_type] ?? 'hammer-outline'} size={46} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.title, { color: colors.text }]}>{job.title}</Text>
                </View>
                <Pressable
                  onPress={() => setStatusSheetVisible(true)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.statusChip, pressed && { opacity: 0.7 }]}>
                  <Badge
                    label={JOB_STATUS_LABELS[job.status]}
                    tone={JOB_STATUS_TONES[job.status]}
                  />
                  <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.customerBlock}>
                <Text style={[styles.customerName, { color: colors.text }]}>{job.client_name}</Text>
                {clientBusinessName ? (
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {clientBusinessName}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.infoBlock, { borderTopColor: colors.border }]}>
                {fullAddress ? (
                  <ContactRow
                    icon="location-outline"
                    text={fullAddress}
                    copyLabel="Address"
                    actions={[
                      { icon: 'navigate', onPress: () => void openDirections(job) },
                    ]}
                  />
                ) : (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                    <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
                      No address on file
                    </Text>
                  </View>
                )}
                {clientPhone ? (
                  <ContactRow
                    icon="call-outline"
                    text={clientPhone}
                    copyLabel="Phone number"
                    actions={[
                      {
                        icon: 'call',
                        onPress: () =>
                          void Linking.openURL(`tel:${clientPhone.replace(/[^+\d]/g, '')}`),
                      },
                      {
                        icon: 'chatbubble-outline',
                        onPress: () =>
                          void Linking.openURL(`sms:${clientPhone.replace(/[^+\d]/g, '')}`),
                      },
                    ]}
                  />
                ) : null}
                {clientEmail ? (
                  <ContactRow
                    icon="mail-outline"
                    text={clientEmail}
                    copyLabel="Email"
                    actions={[
                      { icon: 'mail', onPress: () => void Linking.openURL(`mailto:${clientEmail}`) },
                    ]}
                  />
                ) : null}
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
                {meta?.value != null || meta?.group ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="cash-outline" size={16} color={colors.textMuted} />
                    <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
                      {[
                        meta?.value != null ? `${formatJobValue(meta.value)} job value` : null,
                        meta?.group ?? null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                  <Text style={{ fontSize: 13.5, color: colors.textSecondary, flex: 1 }}>
                    {(meta?.assignees ?? []).length > 0
                      ? (meta?.assignees ?? []).join(', ')
                      : 'Nobody assigned yet'}
                  </Text>
                  <Pressable
                    onPress={() => setAssignVisible(true)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.directionsChip,
                      { backgroundColor: colors.primarySoft },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Ionicons name="person-add-outline" size={12} color={colors.primaryStrong} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryStrong }}>
                      Assign
                    </Text>
                  </Pressable>
                </View>
                {job.tags?.length ? <TagList tags={job.tags} /> : null}
              </View>
            </Card>

            {showScope ? (
              <Section title="Scope of work">
                <Card>
                  <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}>
                    {scopeOfWork}
                  </Text>
                </Card>
              </Section>
            ) : null}

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
                  router.push({ pathname: '/review-request/[id]', params: { id: job.id } })
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

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button
                label="PDF report"
                icon="document-text-outline"
                variant="secondary"
                style={{ flex: 1 }}
                loading={exporting}
                onPress={() => void handleExportReport()}
              />
              {jobMedia.length > 0 ? (
                <Button
                  label="Before / After"
                  icon="images-outline"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({ pathname: '/before-after/[id]', params: { id: job.id } })
                  }
                />
              ) : null}
            </View>

            {mediaRows.length > 0 || mediaError ? (
              <Section title="Latest media">
                {/* A banner, not a replacement: photos still waiting in this
                    device's upload queue are real and keep rendering below. */}
                {mediaError ? (
                  <Card style={styles.mediaErrorCard}>
                    <IconTile icon="cloud-offline-outline" tone="danger" />
                    <Text style={[styles.mediaErrorText, { color: colors.text }]}>
                      {mediaError}
                    </Text>
                    <Button
                      label="Try again"
                      variant="secondary"
                      icon="refresh"
                      loading={mediaRefreshing}
                      onPress={refresh}
                    />
                  </Card>
                ) : null}
                {mediaRows.length > 0 ? (
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
                ) : null}
              </Section>
            ) : null}

            {/* Everything above stays pinned; the four long lists share this
                pane. Site visits are no longer a stack of their own — each
                check-in and checkout is an Activity row that still opens the
                same visit detail screen. */}
            <View style={{ gap: Spacing.md }}>
              <Segmented
                options={TABS}
                value={tab}
                onChange={(value) => setTab(value as JobTab)}
              />
              {tab === 'activity' ? (
                <JobActivityTab
                  jobId={id ?? ''}
                  media={jobMedia}
                  extras={extras}
                  tasks={tasks ?? []}
                  publishRecord={publishRecord}
                  roster={roster}
                />
              ) : null}
              {tab === 'checklist' ? (
                <JobChecklistTab
                  jobId={id ?? ''}
                  tasks={tasks ?? []}
                  author={user?.name ?? 'You'}
                />
              ) : null}
              {tab === 'notes' ? (
                <NotesSection
                  bare
                  jobId={id ?? ''}
                  notes={extras?.notes ?? []}
                  voiceNotes={extras?.voiceNotes ?? []}
                  author={user?.name ?? 'You'}
                />
              ) : null}
              {tab === 'documents' ? (
                <JobDocumentsTab
                  jobId={id ?? ''}
                  documents={extras?.documents ?? []}
                  onAdd={() => void handleAddDocument()}
                  adding={addingDocument}
                />
              ) : null}
            </View>
          </>
        ) : jobLoading ? (
          <Card style={styles.stateRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading job…</Text>
          </Card>
        ) : jobError ? (
          // A failed read is not a deleted job — say what went wrong and let
          // them retry instead of showing the "not found" dead end.
          <Card style={{ gap: Spacing.md }}>
            <View style={styles.stateRow}>
              <IconTile icon="alert-circle" tone="danger" size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  Could not open this job
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{jobError}</Text>
              </View>
            </View>
            <Button
              label="Try again"
              icon="refresh-outline"
              loading={jobRefreshing}
              onPress={refreshJob}
            />
          </Card>
        ) : (
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Job not found.</Text>
          </Card>
        )}
      </Screen>
      <JobStatusSheet
        visible={statusSheetVisible}
        current={job?.status ?? 'active'}
        onSelect={(status) => {
          setStatusSheetVisible(false);
          void setStatus(status);
        }}
        onClose={() => setStatusSheetVisible(false)}
      />
      <JobActionSheet
        visible={actionsVisible && !!job}
        jobTitle={job?.title ?? 'This job'}
        archived={!!meta?.archived}
        mediaCount={jobMediaData?.length ?? 0}
        deleting={deleting}
        onClose={() => setActionsVisible(false)}
        onEdit={() => {
          setActionsVisible(false);
          if (job) router.push({ pathname: '/job/edit/[id]', params: { id: job.id } });
        }}
        onShareDetails={() => {
          setActionsVisible(false);
          void shareJob();
        }}
        onShareGallery={() => {
          setActionsVisible(false);
          if (job) router.push({ pathname: '/share/[id]', params: { id: job.id } });
        }}
        onToggleArchive={() => {
          setActionsVisible(false);
          if (job) void jobMeta.toggle(job.id, 'archived');
        }}
        onDelete={() => void handleDeleteJob()}
      />
      <JobAssignSheet
        visible={assignVisible}
        roster={roster}
        assignees={meta?.assignees ?? []}
        onToggle={toggleAssignee}
        onClose={() => setAssignVisible(false)}
      />
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
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mediaErrorCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mediaErrorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  customerBlock: {
    gap: 1,
  },
  customerName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
