import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaThumb } from '@/components/media-thumb';
import { UploadBanner } from '@/components/upload-banner';
import { Avatar, Badge, Button, Card, EmptyState, IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useJobsRefresh } from '@/hooks/use-jobs-refresh';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { useRole } from '@/hooks/use-role';
import { useWorkspace } from '@/hooks/use-workspace';
import { dataErrors, fetchJobs, fetchMedia } from '@/lib/data';
import { formatDate, timeAgo } from '@/lib/format';
import { fetchGmbData } from '@/lib/gmb';
import { fetchGoogleReviews } from '@/lib/google-business';
import { jobExtras } from '@/lib/job-extras';
import { getLocationFix, type GeoFix } from '@/lib/media-capture';
import { openDirections } from '@/lib/directions';
import { fetchShares, isSharingAvailable, type ProjectShare } from '@/lib/shares';
import { fetchPresence, type Presence } from '@/lib/team-presence';
import { workspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';
import type { Job, MediaItem } from '@/lib/types';

/**
 * Today — what's near you, what needs you, what the crew did today.
 *
 * Nothing here assumes a schedule: jobs have no start time, so "next" means
 * the nearest active project by GPS, and the day is shown as what actually
 * happened (photos, visits, shares), newest first.
 */

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function sameDay(iso: string | undefined, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function durationSince(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

interface ActivityRow {
  at: string;
  icon: IconName;
  tone: Tone;
  title: string;
  subtitle: string;
  jobId: string;
  badge?: { label: string; tone: Tone };
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { business, businesses, select } = useWorkspace();
  const { canWrite } = useRole();

  const { data: jobs, loading, refreshing, refresh } = useData(fetchJobs);
  const { data: media, refresh: refreshMedia } = useData(fetchMedia);
  const { data: gmbData } = useData(fetchGmbData);
  const { data: reviews } = useData(() => fetchGoogleReviews().catch(() => null));
  const { data: waitingShares, refresh: refreshShares } = useData(() =>
    business?.id && isSharingAvailable ? fetchShares(business.id, 'waiting').catch(() => [] as ProjectShare[]) : Promise.resolve([] as ProjectShare[]),
  );
  const { data: sharedThisWeek } = useData(() =>
    business?.id && isSharingAvailable ? fetchShares(business.id, 'shared').catch(() => [] as ProjectShare[]) : Promise.resolve([] as ProjectShare[]),
  );
  const { data: presence } = useData(() => fetchPresence(user?.name ?? 'You').catch(() => [] as Presence[]));
  useJobsRefresh(refresh);
  useMediaRefresh(refreshMedia);
  useEffect(() => workspace.subscribe(() => { refresh(); refreshShares(); }), [refresh, refreshShares]);

  const [loadError, setLoadError] = useState<string | null>(() => dataErrors.get('jobs'));
  useEffect(() => dataErrors.subscribe(() => setLoadError(dataErrors.get('jobs'))), []);

  const [fix, setFix] = useState<GeoFix | undefined>();
  useEffect(() => {
    let alive = true;
    void getLocationFix().then((f) => { if (alive) setFix(f); });
    return () => { alive = false; };
  }, []);

  const [switching, setSwitching] = useState(false);

  const active = useMemo(() => (jobs ?? []).filter((j) => j.status !== 'completed' && j.status !== 'cancelled'), [jobs]);
  const nearest = useMemo(() => {
    const withMiles = active.map((job) => ({
      job,
      miles: fix && job.latitude != null && job.longitude != null ? milesBetween(fix.latitude, fix.longitude, job.latitude, job.longitude) : null,
    }));
    return withMiles.sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity));
  }, [active, fix]);
  const hero = nearest[0];
  const onSiteByJob = useMemo(() => {
    const map = new Map<string, Presence[]>();
    for (const p of presence ?? []) map.set(p.jobId, [...(map.get(p.jobId) ?? []), p]);
    return map;
  }, [presence]);

  const today = new Date();
  const todaysMedia = useMemo(
    () => (media ?? []).filter((m) => sameDay(m.taken_at, today)).sort((a, b) => Date.parse(b.taken_at) - Date.parse(a.taken_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [media],
  );
  const jobTitle = useCallback((id: string) => jobs?.find((j) => j.id === id)?.title ?? 'Project', [jobs]);

  // Today so far: photos grouped per uploader+job+hour, visits, and shares.
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const rows: ActivityRow[] = [];
      const groups = new Map<string, { at: string; count: number; video: number; jobId: string; by?: string }>();
      for (const m of todaysMedia) {
        const key = `${m.job_id}|${m.uploaded_by ?? 'local'}|${new Date(m.taken_at).getHours()}`;
        const g = groups.get(key) ?? { at: m.taken_at, count: 0, video: 0, jobId: m.job_id, by: m.uploaded_by };
        g.count += m.media_type === 'image' ? 1 : 0;
        g.video += m.media_type === 'video' ? 1 : 0;
        if (Date.parse(m.taken_at) > Date.parse(g.at)) g.at = m.taken_at;
        groups.set(key, g);
      }
      for (const g of groups.values()) {
        const who = g.by && g.by === user?.id ? 'You' : 'Crew';
        const what = [g.count ? `${g.count} photo${g.count === 1 ? '' : 's'}` : '', g.video ? `${g.video} video${g.video === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
        rows.push({ at: g.at, icon: 'camera', tone: 'primary', title: `${who} added ${what}`, subtitle: jobTitle(g.jobId), jobId: g.jobId });
      }
      for (const job of active.slice(0, 20)) {
        try {
          const extras = await jobExtras.get(job.id);
          for (const v of extras?.checkins ?? []) {
            if (!sameDay(v.checked_in_at, today)) continue;
            rows.push({ at: v.checked_in_at, icon: 'location', tone: 'success', title: `${v.user_name ?? 'Crew'} arrived`, subtitle: `${job.title} · visit started`, jobId: job.id });
            if (v.checked_out_at) rows.push({ at: v.checked_out_at, icon: 'log-out-outline', tone: 'neutral', title: `${v.user_name ?? 'Crew'} left`, subtitle: job.title, jobId: job.id });
          }
        } catch { /* one unreadable job must not blank the day */ }
      }
      for (const s of sharedThisWeek ?? []) {
        if (!sameDay(s.finished_at ?? s.created_at, today)) continue;
        const live = s.destinations.filter((d) => s.results?.[d]?.status === 'live');
        rows.push({ at: s.finished_at ?? s.created_at, icon: 'megaphone', tone: 'success', title: `Shared to ${live.length ? live.map((d) => ({ gbp: 'Google', facebook: 'Facebook', instagram: 'Instagram', website: 'website' })[d]).join(', ') : 'nowhere yet'}`, subtitle: s.caption?.title || jobTitle(s.job_id), jobId: s.job_id, badge: { label: live.length ? 'Shared' : 'Failed', tone: live.length ? 'success' : 'danger' } });
      }
      rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (alive) setActivity(rows.slice(0, 12));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysMedia, active, sharedThisWeek, user?.id]);

  const needsReply = (reviews ?? []).filter((r) => !r.reply);
  const failedShares = (waitingShares ?? []).filter((s) => s.status === 'failed' || s.status === 'partial');
  const unshared = (waitingShares ?? []).filter((s) => s.status !== 'failed' && s.status !== 'partial');
  const gmb = gmbData && gmbData.mode === 'connected' ? gmbData : null;
  const unansweredQa = gmb ? Math.max(0, (gmb.counts?.qas ?? 0) - 0) : 0; // count shown; answered split comes with the Q&A write-back

  const weekAgo = Date.now() - 7 * 86400000;
  const weekShared = (sharedThisWeek ?? []).filter((s) => Date.parse(s.finished_at ?? s.created_at) >= weekAgo).length;
  const weekPhotos = (media ?? []).filter((m) => Date.parse(m.taken_at) >= weekAgo).length;
  const weekReviews = (reviews ?? []).filter((r) => Date.parse(r.created_at) >= weekAgo).length;
  const weeklyGoal = 15;

  const needsYou = [
    unshared.length ? { key: 'unshared', icon: 'megaphone-outline' as IconName, tone: 'warning' as Tone, title: `${unshared.length} project${unshared.length === 1 ? '' : 's'} not shared yet`, sub: unshared.slice(0, 3).map((s) => s.caption?.title || jobTitle(s.job_id)).join(' · '), onPress: () => router.push('/share-queue') } : null,
    needsReply.length ? { key: 'reviews', icon: 'star' as IconName, tone: 'danger' as Tone, title: `${needsReply.length} review${needsReply.length === 1 ? '' : 's'} need a reply`, sub: needsReply.slice(0, 2).map((r) => `${r.reviewer} ${'★'.repeat(r.rating)}`).join(' · '), onPress: () => router.push('/gmb-reviews') } : null,
    failedShares.length ? { key: 'failed', icon: 'alert-circle' as IconName, tone: 'danger' as Tone, title: `${failedShares.length} share${failedShares.length === 1 ? '' : 's'} failed`, sub: failedShares.map((s) => Object.values(s.results ?? {}).find((r) => r.status !== 'live')?.detail ?? '').filter(Boolean)[0] ?? 'Open the queue to retry.', onPress: () => router.push('/share-queue') } : null,
  ].filter(Boolean) as { key: string; icon: IconName; tone: Tone; title: string; sub: string; onPress: () => void }[];

  const crew = useMemo(() => {
    const byName = new Map<string, Presence>();
    for (const p of presence ?? []) if (!byName.has(p.name)) byName.set(p.name, p);
    return [...byName.values()];
  }, [presence]);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={() => { refresh(); refreshMedia(); refreshShares(); }}>
        {/* Header: business switcher, greeting, avatar → More */}
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Pressable onPress={() => businesses.length > 1 && setSwitching(true)} style={({ pressed }) => [styles.switcher, { backgroundColor: colors.cardPressed }, pressed && { opacity: 0.7 }]}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }} numberOfLines={1}>
                {business?.name ?? 'Your business'}
              </Text>
              {businesses.length > 1 ? <Ionicons name="chevron-down" size={13} color={colors.textMuted} /> : null}
            </Pressable>
            <Text style={[Typography.h1, { color: colors.text }]}>{greeting()}, {user?.firstName ?? 'there'}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatDate(new Date().toISOString())}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Avatar name={user?.name ?? 'User'} size={44} />
          </Pressable>
        </View>
        <UploadBanner />
        {loadError ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <IconTile icon="cloud-offline-outline" tone="danger" />
            <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{loadError}</Text>
            <Button label="Retry" variant="secondary" size="small" icon="refresh" loading={refreshing} onPress={refresh} />
          </Card>
        ) : null}

        {/* Hero: nearest active project */}
        {loading && !jobs ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : hero ? (
          <Card style={{ padding: 0, overflow: 'hidden', borderColor: colors.primary, borderWidth: 1 }}>
            <View style={{ padding: Spacing.lg, gap: 6 }}>
              <View style={styles.rowBetween}>
                <Badge label={hero.miles != null ? `Nearest active · ${hero.miles < 0.1 ? 'right here' : `${hero.miles.toFixed(1)} mi`}` : 'Active project'} tone="primary" />
                {(onSiteByJob.get(hero.job.id) ?? []).length ? (
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{(onSiteByJob.get(hero.job.id) ?? []).map((p) => (p.isYou ? 'You' : p.name.split(' ')[0])).join(', ')} on site</Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{hero.job.title}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{[hero.job.address, hero.job.city].filter(Boolean).join(', ')}{hero.job.client_name ? ` · ${hero.job.client_name}` : ''}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{todaysMedia.filter((m) => m.job_id === hero.job.id).length} photos today · {hero.job.photo_count} total</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                {canWrite ? (
                  <Button label="Capture here" icon="camera" style={{ flex: 2 }} onPress={() => router.push({ pathname: '/camera', params: { jobId: hero.job.id, jobTitle: hero.job.title } })} />
                ) : null}
                <Button label="Navigate" icon="navigate-outline" variant="secondary" style={{ flex: 1 }} onPress={() => void openDirections(hero.job)} />
                <Button label="" icon="chevron-forward" variant="secondary" onPress={() => router.push({ pathname: '/job/[id]', params: { id: hero.job.id } })} />
              </View>
            </View>
          </Card>
        ) : (
          <EmptyState icon="briefcase-outline" title="No active projects" message={canWrite ? 'Create one and start capturing.' : 'Projects appear here once the owner creates them.'} />
        )}
        {nearest.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
            {nearest.slice(1, 6).map(({ job, miles }) => (
              <Pressable key={job.id} onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }} numberOfLines={1}>{job.title}{miles != null ? ` · ${miles.toFixed(1)} mi` : ''}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/gallery?view=projects')} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.primaryStrong }}>All active ›</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {/* Needs you */}
        {needsYou.length ? (
          <Section title={`Needs you · ${needsYou.length}`}>
            <Card style={{ padding: 0 }}>
              {needsYou.map((n, i) => (
                <Pressable key={n.key} onPress={n.onPress} style={({ pressed }) => [styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
                  <IconTile icon={n.icon} tone={n.tone} size={34} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>{n.title}</Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{n.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </Card>
          </Section>
        ) : null}

        {/* Latest photos */}
        {todaysMedia.length ? (
          <Section title="Latest photos" action={<Button label="Feed" variant="ghost" size="small" onPress={() => router.push('/gallery')} />}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
              {todaysMedia.slice(0, 10).map((m) => (
                <Pressable key={m.id} style={{ width: 84, height: 84 }} onPress={() => router.push({ pathname: '/job/[id]', params: { id: m.job_id } })}>
                  <MediaThumb item={m} />
                </Pressable>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {/* Today so far */}
        <Section title="Today so far">
          {activity.length === 0 ? (
            <EmptyState icon="time-outline" title="Nothing yet today" message="Photos, visits and shares show up here as they happen." />
          ) : (
            <Card style={{ padding: 0 }}>
              {activity.map((row, i) => (
                <Pressable key={`${row.at}-${i}`} onPress={() => router.push({ pathname: '/job/[id]', params: { id: row.jobId } })} style={({ pressed }) => [styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
                  <Text style={{ width: 52, fontSize: 12.5, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{clock(row.at)}</Text>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{row.title}</Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{row.subtitle}</Text>
                  </View>
                  {row.badge ? <Badge label={row.badge.label} tone={row.badge.tone} /> : null}
                </Pressable>
              ))}
            </Card>
          )}
        </Section>

        {/* Crew */}
        {crew.length ? (
          <Section title="Crew">
            <Card style={{ padding: 0 }}>
              {crew.map((p, i) => (
                <Pressable key={p.name} onPress={() => router.push({ pathname: '/job/[id]', params: { id: p.jobId } })} style={({ pressed }) => [styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
                  <Avatar name={p.name} size={34} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{p.isYou ? 'You' : p.name}</Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{jobTitle(p.jobId)} · on site {durationSince(p.since)}</Text>
                  </View>
                  <Badge label="● On site" tone="success" />
                </Pressable>
              ))}
            </Card>
          </Section>
        ) : null}

        {/* This week */}
        <Section title="This week">
          <Card style={{ gap: Spacing.sm }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Projects shared</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}><Text style={{ fontWeight: '800', color: colors.text }}>{weekShared}</Text> of {weeklyGoal} goal</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.cardPressed }]}>
              <View style={{ width: `${Math.min(100, Math.round((weekShared / weeklyGoal) * 100))}%`, height: '100%', backgroundColor: weekShared >= weeklyGoal ? colors.success : colors.primary }} />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {[
                { v: String(weekPhotos), l: 'Photos' },
                { v: String(weekReviews), l: 'New reviews' },
                { v: gmb ? String(gmb.profile.overall_score) : '—', l: 'Profile score' },
              ].map((t) => (
                <View key={t.l} style={[styles.stat, { backgroundColor: colors.cardPressed }]}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{t.v}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.l}</Text>
                </View>
              ))}
            </View>
            {unshared.length ? (
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Sharing the {unshared.length} in the queue puts you at {weekShared + unshared.length}.</Text>
            ) : null}
          </Card>
        </Section>

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {canWrite ? <Button label="New project" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/job/new')} /> : null}
          <Button label="Ask for a review" icon="star-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/reviews')} />
        </View>
      </Screen>

      <Modal visible={switching} transparent animationType="slide" onRequestClose={() => setSwitching(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSwitching(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Switch business</Text>
            {businesses.map((b) => (
              <Pressable key={b.id} onPress={() => { setSwitching(false); void select(b); }} style={({ pressed }) => [styles.bizRow, { borderColor: colors.border }, pressed && { backgroundColor: colors.cardPressed }]}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{b.name}</Text>
                {b.id === business?.id ? <Badge label="Current" tone="primary" /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginTop: Spacing.sm },
  switcher: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 220 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  stat: { flex: 1, borderRadius: Radius.md, padding: 10, gap: 2 },
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.sheet + 6, borderTopRightRadius: Radius.sheet + 6, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.sm },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 999, marginBottom: Spacing.xs },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.button, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
});
