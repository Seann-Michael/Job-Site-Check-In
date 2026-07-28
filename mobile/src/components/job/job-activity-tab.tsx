import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import { visitDuration, type JobExtras } from '@/lib/job-extras';
import { DESTINATION_LABELS, type PublishRecord } from '@/lib/publish';
import { findTeamMember, type TeamRoster } from '@/lib/team';
import type { JobTask, MediaCategory, MediaItem } from '@/lib/types';

/**
 * The job's history, assembled from the sources that already exist — media,
 * check-ins, notes, voice notes, completed checklist items and the publish
 * record. There is no event table behind this and none is invented: a source
 * that has nothing (or does not exist on this database yet) simply contributes
 * no rows, and the rest of the timeline still renders.
 *
 * What changes when the pending migrations land: job_media gains uploaded_by /
 * uploaded_at, so photo rows start naming who uploaded them and when the row
 * reached the server. Until then those fields are undefined everywhere and
 * photo rows are stamped with taken_at and no actor.
 */

const MAX_EVENTS = 60;

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  before: 'Before',
  after: 'After',
  progress: 'Progress',
  final: 'Final',
};

interface ActivityEvent {
  id: string;
  at: string;
  icon: IconName;
  tone: Tone;
  title: string;
  detail?: string;
  /** Only set when the source really knows who did it. */
  actor?: string;
  onPress?: () => void;
}

function valid(iso?: string): boolean {
  return !!iso && !Number.isNaN(new Date(iso).getTime());
}

export function JobActivityTab({
  jobId,
  media,
  extras,
  tasks,
  publishRecord,
  roster,
}: {
  jobId: string;
  media: MediaItem[];
  extras?: JobExtras;
  tasks: JobTask[];
  publishRecord?: PublishRecord;
  /** Used only to turn a job_media.uploaded_by id into a name. */
  roster?: TeamRoster;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  // uploaded_by is a user id, not a display name, so it is never rendered raw.
  // findTeamMember (lib/team.ts) is the one place that rule lives, shared with
  // the photo viewer and the cross-job activity screen: an id it declines to
  // resolve shows no actor at all.
  const resolveUploader = useMemo(
    () => (value?: string): string | undefined => findTeamMember(value, roster)?.name,
    [roster],
  );

  const events = useMemo<ActivityEvent[]>(() => {
    const all: ActivityEvent[] = [];

    for (const item of media) {
      // taken_at is always populated; uploaded_at only after the row reaches
      // the server. Never claim both unless both are really there and differ.
      const at = valid(item.uploaded_at) ? item.uploaded_at! : item.taken_at;
      const capturedApart =
        valid(item.captured_at) &&
        valid(item.uploaded_at) &&
        item.captured_at !== item.uploaded_at;
      const kind = item.media_type === 'video' ? 'Video' : 'Photo';
      all.push({
        id: `media-${item.id}`,
        at,
        icon: item.media_type === 'video' ? 'videocam-outline' : 'camera-outline',
        tone: 'primary',
        title: item.pending
          ? `${kind} captured — waiting to upload`
          : `${kind} added · ${CATEGORY_LABELS[item.category] ?? 'Photo'}`,
        detail: capturedApart ? `Captured ${formatDateTime(item.captured_at!)}` : undefined,
        actor: resolveUploader(item.uploaded_by),
      });
    }

    for (const visit of extras?.checkins ?? []) {
      const open = () =>
        router.push({ pathname: '/visit-detail', params: { jobId, visitId: visit.id } });
      all.push({
        id: `in-${visit.id}`,
        at: visit.checked_in_at,
        icon: 'log-in-outline',
        tone: 'success',
        title: 'Checked in on site',
        detail: typeof visit.latitude === 'number' ? 'GPS location recorded' : undefined,
        actor: visit.user_name,
        onPress: open,
      });
      if (valid(visit.checked_out_at)) {
        all.push({
          id: `out-${visit.id}`,
          at: visit.checked_out_at!,
          icon: 'log-out-outline',
          tone: 'neutral',
          title: 'Checked out',
          detail: `On site ${visitDuration(visit.checked_in_at, visit.checked_out_at)}`,
          actor: visit.user_name,
          onPress: open,
        });
      }
    }

    for (const note of extras?.notes ?? []) {
      all.push({
        id: `note-${note.id}`,
        at: note.created_at,
        icon: 'chatbubble-ellipses-outline',
        tone: 'warning',
        title: 'Note added',
        detail: note.text,
        actor: note.author,
      });
    }

    for (const note of extras?.voiceNotes ?? []) {
      all.push({
        id: `voice-${note.id}`,
        at: note.created_at,
        icon: 'mic-outline',
        tone: 'warning',
        title: 'Voice note recorded',
        actor: note.author,
      });
    }

    for (const task of tasks) {
      if (!task.done || !valid(task.done_at)) continue;
      all.push({
        id: `task-${task.id}`,
        at: task.done_at!,
        icon: 'checkmark-circle-outline',
        tone: 'success',
        title: 'Checklist item completed',
        detail: task.label,
        actor: task.done_by,
      });
    }

    if (publishRecord && valid(publishRecord.published_at)) {
      all.push({
        id: `publish-${publishRecord.job_id}`,
        at: publishRecord.published_at,
        icon: 'megaphone-outline',
        tone: 'primary',
        title: 'Job published',
        detail: publishRecord.destinations
          .map((destination) => DESTINATION_LABELS[destination] ?? destination)
          .join(', '),
      });
    }

    return all
      .filter((event) => valid(event.at))
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [media, extras, tasks, publishRecord, resolveUploader, router, jobId]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon="time-outline"
        title="Nothing has happened yet"
        message="Photos, check-ins, notes and completed checklist items all show up here as they happen."
      />
    );
  }

  const shown = events.slice(0, MAX_EVENTS);

  return (
    <View style={{ gap: Spacing.sm }}>
      <Card style={{ padding: 0 }}>
        {shown.map((event, index) => {
          const body = (
            <>
              <IconTile icon={event.icon} tone={event.tone} size={30} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }}>
                  {event.title}
                </Text>
                {event.detail ? (
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={3}>
                    {event.detail}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                  {event.actor ? `${event.actor} · ` : ''}
                  {formatDateTime(event.at)}
                </Text>
              </View>
              {event.onPress ? (
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              ) : null}
            </>
          );
          const rowStyle = [
            styles.row,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            },
          ];
          return event.onPress ? (
            <Pressable
              key={event.id}
              onPress={event.onPress}
              style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: colors.cardPressed }]}>
              {body}
            </Pressable>
          ) : (
            <View key={event.id} style={rowStyle}>
              {body}
            </View>
          );
        })}
      </Card>
      {events.length > shown.length ? (
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          Showing the {MAX_EVENTS} most recent of {events.length} events.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
});
