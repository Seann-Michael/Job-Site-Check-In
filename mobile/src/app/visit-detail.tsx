import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { Badge, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchJob, fetchJobMedia } from '@/lib/data';
import { formatDate, formatDateTime, notify } from '@/lib/format';
import { jobExtras, visitDuration } from '@/lib/job-extras';
import { tasksStore } from '@/lib/tasks-store';
import { useAuth } from '@/providers/auth-provider';
import type { MediaItem } from '@/lib/types';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Everything that happened during one site visit's time window. */
export default function VisitDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { jobId, visitId } = useLocalSearchParams<{ jobId: string; visitId: string }>();
  const { user, initializing } = useAuth();

  const { data: job } = useData(() => fetchJob(jobId ?? ''));
  const { data: media } = useData(() => fetchJobMedia(jobId ?? ''));
  const { data: extras, refresh } = useData(() => jobExtras.get(jobId ?? ''));
  const { data: tasks } = useData(() => tasksStore.getTasks(jobId ?? ''));
  useEffect(() => jobExtras.subscribe(refresh), [refresh]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const visit = (extras?.checkins ?? []).find((entry) => entry.id === visitId);
  const visitNumber =
    (extras?.checkins ?? []).findIndex((entry) => entry.id === visitId) + 1;

  const windowStart = visit ? new Date(visit.checked_in_at).getTime() : 0;
  const windowEnd = visit?.checked_out_at
    ? new Date(visit.checked_out_at).getTime()
    : Number.MAX_SAFE_INTEGER;

  const inWindow = (iso: string) => {
    const time = new Date(iso).getTime();
    return !Number.isNaN(time) && time >= windowStart && time <= windowEnd;
  };

  const visitMedia = useMemo(
    () => (media ?? []).filter((item) => inWindow(item.taken_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [media, windowStart, windowEnd],
  );
  const visitNotes = (extras?.notes ?? []).filter((note) => inWindow(note.created_at));
  const visitVoice = (extras?.voiceNotes ?? []).filter((note) => inWindow(note.created_at));
  const visitDocs = (extras?.documents ?? []).filter((doc) => inWindow(doc.added_at));
  const visitTasks = (tasks ?? []).filter((task) => task.done_at && inWindow(task.done_at));

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const activityCount =
    visitMedia.length + visitNotes.length + visitVoice.length + visitDocs.length + visitTasks.length;

  return (
    <Screen>
      <DetailHeader title={`Site visit ${visitNumber > 0 ? visitNumber : ''}`} />

      {!visit ? (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Visit not found.</Text>
        </Card>
      ) : (
        <>
          <Card style={{ gap: Spacing.sm }}>
            <View style={styles.row}>
              <Ionicons
                name={visit.checked_out_at ? 'checkmark-circle' : 'radio-button-on'}
                size={18}
                color={colors.success}
              />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>
                {job?.title ?? 'Job'}
              </Text>
              <Badge
                label={visit.checked_out_at ? 'Completed' : 'On site now'}
                tone={visit.checked_out_at ? 'neutral' : 'success'}
              />
            </View>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
              {formatDate(visit.checked_in_at)} · {fmtTime(visit.checked_in_at)} –{' '}
              {visit.checked_out_at ? fmtTime(visit.checked_out_at) : 'now'} ·{' '}
              {visitDuration(visit.checked_in_at, visit.checked_out_at)}
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
              {visit.user_name ?? user?.name ?? 'Team member'}
              {typeof visit.latitude === 'number'
                ? ` · GPS ${visit.latitude.toFixed(4)}, ${visit.longitude?.toFixed(4)}`
                : ''}
            </Text>
          </Card>

          {activityCount === 0 ? (
            <EmptyState
              icon="time-outline"
              title="No activity recorded"
              message="Photos, notes, completed tasks, and documents from this visit's time window show up here."
            />
          ) : null}

          {visitMedia.length > 0 ? (
            <Section title={`Photos & video (${visitMedia.length})`}>
              <View style={styles.grid}>
                {visitMedia.map((item, index) => (
                  <Pressable
                    key={item.id}
                    style={styles.cell}
                    onPress={() => setViewerIndex(index)}>
                    <MediaThumb item={item} />
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}

          {visitTasks.length > 0 ? (
            <Section title={`Tasks completed (${visitTasks.length})`}>
              <Card style={{ padding: 0 }}>
                {visitTasks.map((task, index) => (
                  <View
                    key={task.id}
                    style={[
                      styles.listRow,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                    ]}>
                    <Ionicons name="checkmark-circle" size={19} color={colors.success} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.text }}>{task.label}</Text>
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {task.done_by ?? 'Team member'} · {formatDateTime(task.done_at!)}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          {visitNotes.length > 0 || visitVoice.length > 0 ? (
            <Section title={`Notes (${visitNotes.length + visitVoice.length})`}>
              <Card style={{ padding: 0 }}>
                {[...visitNotes.map((note) => ({ kind: 'text' as const, note })),
                  ...visitVoice.map((note) => ({ kind: 'voice' as const, note }))]
                  .sort((a, b) => (a.note.created_at < b.note.created_at ? 1 : -1))
                  .map((entry, index) => (
                    <View
                      key={entry.note.id}
                      style={[
                        styles.listRow,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.border,
                        },
                      ]}>
                      <Ionicons
                        name={entry.kind === 'voice' ? 'mic-outline' : 'create-outline'}
                        size={18}
                        color={colors.textSecondary}
                      />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 14, color: colors.text }}>
                          {entry.kind === 'text'
                            ? entry.note.text
                            : `Voice note · ${Math.round(entry.note.duration_ms / 1000)}s`}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                          {entry.note.author ?? 'Team member'} ·{' '}
                          {formatDateTime(entry.note.created_at)}
                        </Text>
                      </View>
                    </View>
                  ))}
              </Card>
            </Section>
          ) : null}

          {visitDocs.length > 0 ? (
            <Section title={`Documents (${visitDocs.length})`}>
              <Card style={{ padding: 0 }}>
                {visitDocs.map((doc, index) => (
                  <View
                    key={doc.id}
                    style={[
                      styles.listRow,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                    ]}>
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.text }} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {formatDateTime(doc.added_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          {job ? (
            <Pressable
              onPress={() => {
                notify('Tip', 'Open the job to add notes or media to this visit.');
                router.push({ pathname: '/job/[id]', params: { id: job.id } });
              }}
              style={({ pressed }) => [
                styles.openJob,
                { backgroundColor: colors.primarySoft },
                pressed && { opacity: 0.7 },
              ]}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.primaryStrong }}>
                Open the job
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      <MediaViewer
        items={visitMedia}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  cell: {
    width: '31.5%',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  openJob: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md - 2,
  },
});
