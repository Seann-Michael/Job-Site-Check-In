import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab } from '@/components/fab';
import { ReviewCard } from '@/components/review-card';
import { Button, Card, EmptyState, IconTile, Segmented, StatTile } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dataErrors, fetchJobs, fetchReviewRequests } from '@/lib/data';
import { JOB_STATUS_LABELS } from '@/lib/format';
import { useData } from '@/hooks/use-data';
import { REVIEW_DELIVERY_NOTE } from '@/lib/review-requests';
import type { Job } from '@/lib/types';

// Mirrors the web app's AdminReviews pipeline tabs (Current / Past / Scheduled)
const TABS = [
  { value: 'current', label: 'Current' },
  { value: 'past', label: 'Past' },
  { value: 'scheduled', label: 'Scheduled' },
];

/** Enough to pick from without turning the sheet into a second Jobs screen. */
const PICKER_LIMIT = 25;

export default function ReviewsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: requests, loading, refreshing, refresh } = useData(fetchReviewRequests);
  const [tab, setTab] = useState('current');
  // Tells "no requests in this stage" apart from "the review query failed".
  const [loadError, setLoadError] = useState<string | null>(() => dataErrors.get('reviews'));
  React.useEffect(() => dataErrors.subscribe(() => setLoadError(dataErrors.get('reviews'))), []);

  // A request always belongs to a job, and this tab has no job in hand — so the
  // FAB asks which one first, then hands off to the existing request form
  // (which is where the text / email / QR choice lives).
  const [picking, setPicking] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const loadJobs = useCallback(() => {
    setJobsLoading(true);
    setJobsError(null);
    void fetchJobs()
      .then((all) => {
        setJobs(all);
        // fetchJobs swallows failures and returns [] — the reason lands here.
        setJobsError(dataErrors.get('jobs'));
      })
      .finally(() => setJobsLoading(false));
  }, []);

  const openPicker = useCallback(() => {
    setPicking(true);
    if (!jobs && !jobsLoading) loadJobs();
  }, [jobs, jobsLoading, loadJobs]);

  const chooseJob = useCallback(
    (job: Job) => {
      setPicking(false);
      router.push({ pathname: '/review-request/[id]', params: { id: job.id } });
    },
    [router],
  );

  const filtered = useMemo(() => {
    const all = requests ?? [];
    if (tab === 'current') return all.filter((r) => r.status === 'sent' || r.status === 'viewed');
    if (tab === 'past') return all.filter((r) => r.status === 'completed' || r.status === 'expired');
    return all.filter((r) => r.status === 'scheduled');
  }, [requests, tab]);

  const stats = useMemo(() => {
    const all = requests ?? [];
    // Deliberately "requests", not "requests sent": this app cannot send one
    // (see lib/review-requests.ts), so a count of everything it knows about is
    // the only figure here that is true of every row.
    const total = all.length;
    const completed = all.filter((r) => r.status === 'completed');
    const rated = completed.filter((r) => typeof r.rating === 'number');
    const avg =
      rated.length > 0
        ? (rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length).toFixed(1)
        : '—';
    return { total, completed: completed.length, avg };
  }, [requests]);

  const pickerJobs = (jobs ?? []).slice(0, PICKER_LIMIT);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader title="Reviews" subtitle="Request pipeline" />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <StatTile value={String(stats.total)} label="Requests" tone="primary" />
          <StatTile value={String(stats.completed)} label="Completed" tone="success" />
          <StatTile value={stats.avg} label="Avg rating" tone="warning" />
        </View>

        {/*
          The FAB used to be a paper plane onto a flow that told people a
          customer had been contacted. Nothing sends. This says so once, up
          front, so no screen underneath has to imply otherwise.
        */}
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
          <IconTile icon="qr-code-outline" tone="primary" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.text }}>
              Best on the spot: a QR code
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
              {REVIEW_DELIVERY_NOTE}
            </Text>
          </View>
        </Card>

        <Segmented options={TABS} value={tab} onChange={setTab} />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : loadError ? (
          <Card style={{ alignItems: 'center', gap: Spacing.sm }}>
            <IconTile icon="cloud-offline-outline" tone="danger" />
            <Text
              style={{ color: colors.text, fontWeight: '600', fontSize: 15, textAlign: 'center' }}>
              {loadError}
            </Text>
            <Button
              label="Try again"
              variant="secondary"
              icon="refresh"
              loading={refreshing}
              onPress={refresh}
            />
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title="Nothing here yet"
            message="Review requests in this stage will show up here."
          />
        ) : (
          filtered.map((request) => <ReviewCard key={request.id} request={request} />)
        )}
      </Screen>
      {/* Not a paper plane: this button records a request, it does not send one. */}
      <Fab icon="qr-code" onPress={openPicker} />

      <Modal
        visible={picking}
        transparent
        animationType="slide"
        onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.lg },
            ]}
            onPress={(event) => event.stopPropagation()}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Which job?</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
              Pick the job the review is about. On the next screen you can turn it into a QR code the
              customer scans while you are still there — or record a text/email request, which waits
              under Scheduled for the web dashboard to send.
            </Text>

            {jobsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.xl }} />
            ) : jobsError ? (
              <View style={{ gap: Spacing.md, paddingVertical: Spacing.md }}>
                <Text style={{ fontSize: 13.5, color: colors.dangerStrong }}>{jobsError}</Text>
                <Button label="Try again" variant="secondary" icon="refresh" onPress={loadJobs} />
              </View>
            ) : pickerJobs.length === 0 ? (
              <Text
                style={{
                  fontSize: 13.5,
                  color: colors.textSecondary,
                  paddingVertical: Spacing.lg,
                }}>
                No jobs yet. Create a job first — a review request is always tied to work you did.
              </Text>
            ) : (
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled">
                {pickerJobs.map((job) => (
                  <Pressable
                    key={job.id}
                    onPress={() => chooseJob(job)}
                    style={({ pressed }) => [
                      styles.row,
                      { borderColor: colors.border },
                      pressed && { backgroundColor: colors.cardPressed },
                    ]}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {job.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 12.5, color: colors.textSecondary }}>
                        {job.client_name} · {JOB_STATUS_LABELS[job.status]}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Pressable
              onPress={() => setPicking(false)}
              style={({ pressed }) => [
                styles.cancel,
                { borderColor: colors.border },
                pressed && { backgroundColor: colors.cardPressed },
              ]}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  listScroll: {
    // Keeps a long job list inside the sheet instead of pushing Cancel offscreen.
    flexGrow: 0,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  cancel: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
});
