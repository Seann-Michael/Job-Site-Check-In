import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, IconTile, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useRole } from '@/hooks/use-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchJobs } from '@/lib/data';
import { formatDateTime, notify } from '@/lib/format';
import {
  deleteShare,
  describeShareError,
  fetchShares,
  isSharingAvailable,
  runShare,
  SHARE_LABELS,
  shareStatusLabel,
  type ProjectShare,
  type ShareDestination,
} from '@/lib/shares';
import { useAuth } from '@/providers/auth-provider';

/** Share queue — what hasn't gone out yet, and what has, per destination. */
export default function ShareQueueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const { canWrite } = useRole();
  const [tab, setTab] = useState<'waiting' | 'shared'>('waiting');
  const [busy, setBusy] = useState<string | null>(null);

  const loader = useCallback(
    () => (business?.id && isSharingAvailable ? fetchShares(business.id, tab) : Promise.resolve([] as ProjectShare[])),
    [business?.id, tab],
  );
  const { data: shares, loading, refreshing, refresh } = useData(loader);
  const { data: jobs } = useData(fetchJobs);
  const titleFor = (jobId: string) => jobs?.find((j) => j.id === jobId)?.title ?? 'Project';

  if (!initializing && !user) return <Redirect href="/login" />;

  const sendOne = async (share: ProjectShare) => {
    setBusy(share.id);
    try {
      const done = await runShare(share.id);
      const live = done.destinations.filter((d) => done.results?.[d]?.status === 'live').length;
      notify(live > 0 ? 'Shared' : 'Not shared', `${titleFor(share.job_id)} · ${live} of ${done.destinations.length} places`);
      refresh();
    } catch (err) {
      notify('Could not share', describeShareError(err));
    } finally {
      setBusy(null);
    }
  };

  const sendAll = async () => {
    const waiting = (shares ?? []).filter((s) => s.status !== 'processing');
    if (!waiting.length) return;
    setBusy('all');
    let live = 0;
    for (const s of waiting) {
      try {
        const done = await runShare(s.id);
        if (done.status === 'done' || done.status === 'partial') live += 1;
      } catch {
        // Reported per row after refresh.
      }
    }
    setBusy(null);
    notify('Done', `${live} of ${waiting.length} projects shared.`);
    refresh();
  };

  const remove = async (share: ProjectShare) => {
    try {
      await deleteShare(share.id);
      refresh();
    } catch (err) {
      notify('Could not remove', describeShareError(err));
    }
  };

  const list = shares ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader title="Share queue" />
      {!isSharingAvailable ? (
        <Card style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
          <IconTile icon="cloud-offline-outline" tone="warning" />
          <Text style={{ flex: 1, fontSize: 13.5, color: colors.textSecondary }}>Sharing needs a signed-in workspace.</Text>
        </Card>
      ) : null}
      <Segmented
        options={[
          { value: 'waiting', label: 'Waiting' },
          { value: 'shared', label: 'Shared' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as 'waiting' | 'shared')}
      />
      {tab === 'waiting' && canWrite && list.length > 0 ? (
        <Button label={`Share all ${list.length}`} icon="paper-plane-outline" loading={busy === 'all'} onPress={() => void sendAll()} />
      ) : null}
      {loading && !shares ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'waiting' ? 'checkmark-done-outline' : 'megaphone-outline'}
          title={tab === 'waiting' ? 'Nothing waiting' : 'Nothing shared yet'}
          message={tab === 'waiting' ? 'Every project with photos is out.' : 'Share a project and it shows up here with where it went.'}
        />
      ) : (
        list.map((share) => {
          const status = shareStatusLabel(share);
          const problems = share.destinations.filter((d) => share.results?.[d] && share.results[d]!.status !== 'live');
          return (
            <Card key={share.id} style={{ gap: Spacing.sm }} onPress={() => router.push({ pathname: '/job/[id]', params: { id: share.job_id } })}>
              <View style={styles.head}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {share.caption?.title || titleFor(share.job_id)}
                </Text>
                <Badge label={status.label} tone={status.tone} />
              </View>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
                {share.media_ids.length} photo{share.media_ids.length === 1 ? '' : 's'} · {formatDateTime(share.finished_at ?? share.created_at)} ·{' '}
                {share.destinations.map((d) => SHARE_LABELS[d]).join(', ')}
              </Text>
              {share.destinations.map((d) => {
                const r = share.results?.[d];
                if (!r) return null;
                const ok = r.status === 'live';
                return (
                  <View key={d} style={styles.destRow}>
                    <Ionicons name={ok ? 'checkmark-circle' : r.status === 'not_configured' ? 'link-outline' : 'alert-circle'} size={15} color={ok ? colors.success : r.status === 'not_configured' ? colors.warning : colors.danger} />
                    <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={2}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{SHARE_LABELS[d as ShareDestination]}</Text> · {r.detail}
                    </Text>
                  </View>
                );
              })}
              {tab === 'waiting' && canWrite ? (
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <Button
                    label={problems.length ? 'Retry' : 'Share'}
                    icon={problems.length ? 'refresh-outline' : 'paper-plane-outline'}
                    size="small"
                    loading={busy === share.id}
                    disabled={share.status === 'processing' || busy !== null}
                    onPress={() => void sendOne(share)}
                  />
                  <Button label="Edit" variant="secondary" size="small" onPress={() => router.push({ pathname: '/publish/[id]', params: { id: share.job_id } })} />
                  {['draft', 'queued', 'failed'].includes(share.status) ? (
                    <Pressable onPress={() => void remove(share)} hitSlop={8} style={styles.trash}>
                      <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
      <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
        {Platform.OS === 'web' ? 'Shares are listed per business and update as the server delivers them.' : 'Pull down to refresh. Queued shares also send on their own in the background.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  destRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  trash: { marginLeft: 'auto', alignSelf: 'center', padding: 6 },
});
