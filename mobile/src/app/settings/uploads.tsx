import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  StatTile,
  useToneColors,
  type IconName,
  type Tone,
} from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, timeAgo } from '@/lib/format';
import {
  uploadQueue,
  type AttemptResult,
  type FlushResult,
  type QueuedUpload,
} from '@/lib/upload-queue';
import { useAuth } from '@/providers/auth-provider';

/** How often the on-screen ages and backoff countdowns are refreshed. */
const TICK_MS = 15_000;

interface Note {
  tone: Tone;
  text: string;
}

const NOTE_ICONS: Record<Tone, IconName> = {
  neutral: 'information-circle-outline',
  primary: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'time-outline',
  danger: 'alert-circle-outline',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Tight enough for a stat tile: "now", "12m", "3h", "2d". */
function compactAge(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '—';
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function countdown(target: number, now: number): string {
  const seconds = Math.round((target - now) / 1000);
  if (seconds <= 0) return 'any moment';
  if (seconds < 60) return `in ${seconds}s`;
  return `in ${Math.round(seconds / 60)}m`;
}

/**
 * Best-effort byte size of a queued file. Native files can be stat'd; a web
 * data: URL carries its own length. Anything else (a blob: URL on web) is
 * genuinely unknowable without reading it back, so it stays uncounted and the
 * total is labelled as a floor rather than pretending to be exact.
 */
async function measureSize(item: QueuedUpload): Promise<number | undefined> {
  const uri = item.uri;
  if (!uri) return undefined;
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma < 0) return undefined;
    const payload = uri.slice(comma + 1);
    if (!/;base64/i.test(uri.slice(0, comma))) return payload.length;
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  if (Platform.OS === 'web') return undefined;
  try {
    const info = (await FileSystem.getInfoAsync(uri)) as { exists?: boolean; size?: number };
    return info?.exists && typeof info.size === 'number' ? info.size : undefined;
  } catch {
    return undefined;
  }
}

/** Turn a real flush result into a sentence — never a guess at "still offline". */
function describeFlush(result: FlushResult): Note {
  const prefix = result.joined ? 'A retry was already running. ' : '';
  if (result.remaining === 0 && result.uploaded > 0) {
    return { tone: 'success', text: `${prefix}All caught up — ${result.uploaded} uploaded.` };
  }
  if (result.remaining === 0) {
    return { tone: 'success', text: `${prefix}All caught up — nothing is waiting.` };
  }

  const parts: string[] = [];
  if (result.uploaded > 0) parts.push(`${result.uploaded} uploaded`);
  if (result.retrying > 0) parts.push(`${result.retrying} failed and will retry`);
  if (result.blocked > 0) parts.push(`${result.blocked} need attention`);

  if (parts.length === 0) {
    if (result.offline) {
      return {
        tone: 'warning',
        text: `${prefix}Still offline — ${result.remaining} item${result.remaining === 1 ? '' : 's'} still waiting.`,
      };
    }
    return {
      tone: 'neutral',
      text: `${prefix}Nothing was attempted — ${result.remaining} item${result.remaining === 1 ? '' : 's'} waiting for the uploader.`,
    };
  }

  const tone: Tone = result.blocked > 0 ? 'danger' : result.retrying > 0 ? 'warning' : 'success';
  const failed = result.retrying > 0 || result.blocked > 0;
  const detail = failed && result.lastError ? ` (${result.lastError})` : '';
  return {
    tone,
    text: `${prefix}${parts.join(', ')}. ${result.remaining} still queued.${detail}`,
  };
}

/** Same honesty for a single-item tap. */
function describeAttempt(result: AttemptResult, title: string): Note {
  switch (result.status) {
    case 'uploaded':
      return { tone: 'success', text: `${title} uploaded.` };
    case 'offline':
      return {
        tone: 'warning',
        text: `Still offline — ${title} stays queued and goes up on its own when signal returns.`,
      };
    case 'retrying':
      return {
        tone: 'warning',
        text: `${title} didn't upload: ${result.error ?? 'the upload failed'}. It stays queued and will be retried.`,
      };
    case 'blocked':
      return {
        tone: 'danger',
        text: `${title} needs attention: ${result.error ?? 'the upload was rejected'}. Automatic retries skip it until you try again here.`,
      };
    case 'busy':
      return { tone: 'neutral', text: 'A retry is already running — this item is part of it.' };
    default:
      return { tone: 'neutral', text: 'That item is no longer in the queue.' };
  }
}

function NoteBanner({ note }: { note: Note }) {
  const { fg, bg } = useToneColors(note.tone);
  return (
    <View style={[styles.note, { backgroundColor: bg }]}>
      <Ionicons name={NOTE_ICONS[note.tone]} size={16} color={fg} style={{ marginTop: 1 }} />
      <Text style={[styles.noteText, { color: fg }]}>{note.text}</Text>
    </View>
  );
}

function StatusPill({ tone, icon, label }: { tone: Tone; icon: IconName; label: string }) {
  const { fg, bg } = useToneColors(tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={11} color={fg} />
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function QueueRow({
  item,
  now,
  uploading,
  disabled,
  first,
  size,
  onUpload,
  onRemove,
}: {
  item: QueuedUpload;
  now: number;
  uploading: boolean;
  disabled: boolean;
  first: boolean;
  size?: number;
  onUpload: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const attempts = item.attempts ?? 0;
  const blocked = item.state === 'blocked';

  const status: { tone: Tone; icon: IconName; label: string } = uploading
    ? { tone: 'primary', icon: 'cloud-upload-outline', label: 'Uploading' }
    : blocked
      ? { tone: 'danger', icon: 'alert-circle-outline', label: 'Needs attention' }
      : attempts > 0
        ? { tone: 'warning', icon: 'refresh-outline', label: `Retrying · ${attempts} failed` }
        : { tone: 'neutral', icon: 'time-outline', label: 'Queued' };

  const detail: string[] = [];
  detail.push(`${item.category} · ${item.media_type ?? 'image'}`);
  if (typeof size === 'number') detail.push(formatBytes(size));
  detail.push(timeAgo(item.taken_at));

  const nextTry =
    !uploading && !blocked && attempts > 0 && item.next_attempt_at
      ? `Next try ${countdown(item.next_attempt_at, now)}`
      : null;

  return (
    <View
      style={[
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
      ]}>
      <View style={styles.rowTop}>
        {item.media_type === 'video' ? (
          <View style={[styles.thumb, { backgroundColor: colors.cardPressed }]}>
            <Ionicons name="videocam" size={18} color={colors.textSecondary} />
          </View>
        ) : (
          <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
            {item.job_title || 'Job media'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
            {detail.join(' · ')}
          </Text>
          <View style={styles.statusLine}>
            <StatusPill tone={status.tone} icon={status.icon} label={status.label} />
            {nextTry ? (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{nextTry}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              blocked || attempts > 0 ? 'Try this upload again now' : 'Upload this item now'
            }
            disabled={disabled || uploading}
            onPress={onUpload}
            style={({ pressed }) => [
              styles.uploadButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: disabled && !uploading ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name={blocked || attempts > 0 ? 'refresh' : 'cloud-upload-outline'}
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.uploadLabel, { color: colors.primary }]}>
                  {blocked || attempts > 0 ? 'Retry' : 'Upload'}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove this item from the queue"
            hitSlop={8}
            disabled={uploading}
            onPress={onRemove}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
      {item.last_error && !uploading ? (
        <Text
          style={{
            fontSize: 11,
            color: blocked ? colors.dangerStrong : colors.textSecondary,
            marginLeft: 44 + Spacing.md,
          }}>
          {item.last_error}
        </Text>
      ) : null}
    </View>
  );
}

/** Dedicated upload-queue manager: see, retry, or drop pending uploads. */
export default function UploadsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [items, setItems] = useState<QueuedUpload[]>([]);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [retryingAll, setRetryingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void uploadQueue.getAll().then(async (all) => {
        if (!alive) return;
        setItems([...all]);
        const measured = await Promise.all(all.map((item) => measureSize(item)));
        if (!alive) return;
        const next: Record<string, number> = {};
        all.forEach((item, index) => {
          const bytes = measured[index];
          if (typeof bytes === 'number') next[item.id] = bytes;
        });
        setSizes(next);
      });
    };
    refresh();
    const unsubscribe = uploadQueue.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const retryAll = useCallback(async () => {
    setRetryingAll(true);
    setNote(null);
    try {
      // `force` clears every backoff and revives items parked for attention —
      // that is what a person means by "retry all now".
      const result = await uploadQueue.flush({ force: true });
      setNow(Date.now());
      setNote(describeFlush(result));
    } finally {
      setRetryingAll(false);
    }
  }, []);

  const uploadOne = useCallback(async (item: QueuedUpload) => {
    setBusyId(item.id);
    setNote(null);
    try {
      const result = await uploadQueue.attemptNow(item.id);
      setNow(Date.now());
      setNote(describeAttempt(result, item.job_title || 'The item'));
    } finally {
      setBusyId(null);
    }
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const totalBytes = items.reduce((sum, item) => sum + (sizes[item.id] ?? 0), 0);
  const measuredCount = items.filter((item) => sizes[item.id] !== undefined).length;
  const sizeValue =
    measuredCount === 0
      ? '—'
      : `${formatBytes(totalBytes)}${measuredCount < items.length ? '+' : ''}`;
  const oldest = items.reduce<QueuedUpload | null>((acc, item) => {
    const at = Date.parse(item.taken_at);
    if (Number.isNaN(at)) return acc;
    if (!acc) return item;
    return at < Date.parse(acc.taken_at) ? item : acc;
  }, null);
  const blockedCount = items.filter((item) => item.state === 'blocked').length;

  return (
    <Screen>
      <DetailHeader title="Uploads" />

      {note ? <NoteBanner note={note} /> : null}

      {items.length === 0 ? (
        <EmptyState
          icon="cloud-done-outline"
          title="Nothing waiting"
          message="Photos and videos upload immediately when you have signal. Anything captured offline queues here."
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <StatTile
              value={String(items.length)}
              label={items.length === 1 ? 'Item waiting' : 'Items waiting'}
              tone={blockedCount > 0 ? 'danger' : 'warning'}
            />
            <StatTile value={sizeValue} label="Total size" />
            <StatTile value={oldest ? compactAge(oldest.taken_at, now) : '—'} label="Oldest" />
          </View>

          <Card style={{ gap: 4 }}>
            {oldest ? (
              <Text style={{ fontSize: 13, color: colors.text }}>
                Oldest capture: {formatDateTime(oldest.taken_at)} ({timeAgo(oldest.taken_at)}).
              </Text>
            ) : null}
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {measuredCount === 0
                ? 'File sizes are not readable on this platform, so only the count is exact.'
                : measuredCount < items.length
                  ? `Sizes measured for ${measuredCount} of ${items.length} files — the total is a minimum.`
                  : 'Every file is stored on this device until it uploads, so nothing is lost.'}
            </Text>
            {blockedCount > 0 ? (
              <Text style={{ fontSize: 12, color: colors.dangerStrong }}>
                {blockedCount} item{blockedCount === 1 ? '' : 's'} need attention — automatic
                retries skip {blockedCount === 1 ? 'it' : 'them'} until you retry by hand.
              </Text>
            ) : null}
          </Card>

          <Section title={`Waiting to upload (${items.length})`}>
            <Card style={{ padding: 0 }}>
              {items.map((item, index) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  now={now}
                  first={index === 0}
                  size={sizes[item.id]}
                  uploading={busyId === item.id}
                  disabled={retryingAll || (busyId !== null && busyId !== item.id)}
                  onUpload={() => void uploadOne(item)}
                  onRemove={() => {
                    void uploadQueue.remove(item.id);
                    setNote({
                      tone: 'neutral',
                      text: 'Removed from the queue. It will not be uploaded.',
                    });
                  }}
                />
              ))}
            </Card>
          </Section>

          <Button
            label="Retry all now"
            icon="cloud-upload-outline"
            loading={retryingAll}
            disabled={busyId !== null}
            onPress={() => void retryAll()}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            The queue also retries on its own every 30 seconds and on app launch. Retry all now
            also revives anything parked for attention.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  row: {
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 74,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  uploadLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
