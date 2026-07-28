import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { uploadQueue, type QueuedUpload } from '@/lib/upload-queue';

interface Pending {
  total: number;
  blocked: number;
  /** 'photo' | 'video' when the queue is all one kind, otherwise null. */
  kind: 'photo' | 'video' | null;
  oldestAt: number | null;
}

const EMPTY: Pending = { total: 0, blocked: 0, kind: null, oldestAt: null };

function summarise(items: readonly QueuedUpload[]): Pending {
  if (items.length === 0) return EMPTY;
  let blocked = 0;
  let videos = 0;
  let oldestAt: number | null = null;
  for (const item of items) {
    if (item.state === 'blocked') blocked += 1;
    if (item.media_type === 'video') videos += 1;
    const at = Date.parse(item.taken_at);
    if (!Number.isNaN(at) && (oldestAt === null || at < oldestAt)) oldestAt = at;
  }
  const kind = videos === 0 ? 'photo' : videos === items.length ? 'video' : null;
  return { total: items.length, blocked, kind, oldestAt };
}

/** "12m", "3h", "2d" — short enough to sit inside the banner line. */
function waitingFor(oldestAt: number): string | null {
  const minutes = Math.floor(Math.max(0, Date.now() - oldestAt) / 60_000);
  if (minutes < 5) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Shown while captured media is waiting for the network.
 *
 * Deliberately has no retry of its own: the whole-queue retry lives once, on
 * the Uploads screen, where it can report what actually happened. A banner that
 * silently flushed and said nothing was the reason "Still offline" used to
 * appear while photos were landing fine.
 */
export function UploadBanner() {
  const { colors } = useTheme();
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(EMPTY);

  useEffect(() => {
    let alive = true;
    const update = () => {
      void uploadQueue.getAll().then((items) => {
        if (alive) setPending(summarise(items));
      });
    };
    update();
    const unsubscribe = uploadQueue.subscribe(update);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured || pending.total === 0) return null;

  const needsAttention = pending.blocked > 0;
  const fg = needsAttention ? colors.dangerStrong : colors.warningStrong;
  const bg = needsAttention ? colors.dangerSoft : colors.warningSoft;
  const noun =
    pending.kind === 'video' ? 'video' : pending.kind === 'photo' ? 'photo' : 'file';
  const waited = pending.oldestAt === null ? null : waitingFor(pending.oldestAt);

  const label = needsAttention
    ? `${pending.blocked} upload${pending.blocked === 1 ? '' : 's'} need attention`
    : `${pending.total} ${noun}${pending.total === 1 ? '' : 's'} waiting to upload${
        waited ? ` · oldest ${waited}` : ''
      }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open the uploads queue.`}
      onPress={() => router.push('/settings/uploads')}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: bg },
        pressed && { opacity: 0.85 },
      ]}>
      <Ionicons
        name={needsAttention ? 'alert-circle-outline' : 'cloud-upload-outline'}
        size={17}
        color={fg}
      />
      <Text style={[styles.text, { color: fg }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.action, { color: fg }]}>Review</Text>
      <Ionicons name="chevron-forward" size={14} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  action: {
    fontSize: 13,
    fontWeight: '700',
  },
});
