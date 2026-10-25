import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { Badge, Button, Card, IconTile, type IconName, type Tone } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchJob, fetchJobMedia } from '@/lib/data';
import { notify } from '@/lib/format';
import { jobExtras } from '@/lib/job-extras';
import {
  collectPublishFacts,
  getPhotoRelease,
  scrubPublishText,
  setPhotoRelease,
  type PrivacyRedaction,
} from '@/lib/publish';
import {
  createShare,
  DEFAULT_SHARE_SETTINGS,
  describeShareError,
  draftCaption,
  fetchShareSettings,
  isSharingAvailable,
  plainCaption,
  SHARE_DESTINATIONS,
  SHARE_LABELS,
  type CaptionFacts,
  type ProjectShare,
  type ShareCaption,
  type ShareDestination,
  type ShareSettings,
} from '@/lib/shares';
import { tasksStore } from '@/lib/tasks-store';
import { useAuth } from '@/providers/auth-provider';

/**
 * Share — the one screen a project leaves the app from.
 *
 * Photos in, one caption written once and fitted to each place, pick where it
 * goes, Share now or Save to queue. The server (POST /api/shares) does the
 * sending and reports back per destination, so the result screen shows what
 * actually happened rather than "handed off".
 */

const DEST_ICONS: Record<ShareDestination, IconName> = {
  gbp: 'storefront-outline',
  facebook: 'logo-facebook',
  instagram: 'logo-instagram',
  website: 'globe-outline',
};

const RESULT_BADGE: Record<string, { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  not_configured: { label: 'Not connected', tone: 'warning' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  pending: { label: 'Queued', tone: 'neutral' },
};

const ALL_ON: Record<ShareDestination, boolean> = { gbp: true, facebook: false, instagram: false, website: true };

export default function ShareScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: media } = useData(() => fetchJobMedia(id ?? ''));
  const { data: tasks } = useData(() => (id ? tasksStore.getTasks(id) : Promise.resolve([])));
  const { data: extras } = useData(() => jobExtras.get(id ?? ''));
  const { data: storedRelease } = useData(() => getPhotoRelease(id ?? ''));
  const { data: settingsData } = useData(() =>
    business?.id && isSharingAvailable
      ? fetchShareSettings(business.id).catch(() => ({}) as ShareSettings)
      : Promise.resolve({} as ShareSettings),
  );
  const settings: ShareSettings = settingsData ?? {};
  const maxPhotos = settings.max_photos ?? DEFAULT_SHARE_SETTINGS.max_photos;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState<ShareCaption | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftedByAi, setDraftedByAi] = useState(false);
  const [release, setRelease] = useState<boolean | null>(null);
  const [destinations, setDestinations] = useState<Record<ShareDestination, boolean> | null>(null);
  const [hashtags, setHashtags] = useState(true);
  const [markComplete, setMarkComplete] = useState(false);
  const [sending, setSending] = useState<'now' | 'queue' | null>(null);
  const [result, setResult] = useState<ProjectShare | null>(null);

  const chosenMedia = useMemo(() => (media ?? []).filter((m) => selected.has(m.id)), [media, selected]);

  // Default photo pick: finished-work photos first, up to the business's limit.
  useEffect(() => {
    if (media && selected.size === 0 && media.length > 0) {
      const images = media.filter((m) => m.media_type === 'image');
      const preferred = images.filter((m) => m.category === 'after' || m.category === 'final');
      const pool = preferred.length > 0 ? preferred : images;
      setSelected(new Set(pool.slice(0, maxPhotos).map((m) => m.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, maxPhotos]);

  useEffect(() => {
    if (release === null && storedRelease) setRelease(storedRelease.granted);
  }, [storedRelease, release]);

  useEffect(() => {
    if (destinations === null && settingsData) {
      const d = { ...ALL_ON, ...(settings.destinations ?? {}) };
      setDestinations({ gbp: !!d.gbp, facebook: !!d.facebook, instagram: !!d.instagram, website: !!d.website });
      setHashtags(settings.hashtags ?? true);
    }
  }, [settingsData, destinations, settings.destinations, settings.hashtags]);

  const facts = useMemo<CaptionFacts | null>(() => {
    if (!job) return null;
    const f = collectPublishFacts({
      job,
      businessName: business?.name ?? 'We',
      media: chosenMedia,
      tasks: tasks ?? [],
      checkins: extras?.checkins ?? [],
      notes: extras?.notes ?? [],
    });
    const stage: CaptionFacts['stage'] = chosenMedia.some((m) => m.category === 'final')
      ? 'final'
      : chosenMedia.some((m) => m.category === 'after')
        ? 'after'
        : chosenMedia.some((m) => m.category === 'progress')
          ? 'progress'
          : 'before';
    const photoCounts: NonNullable<CaptionFacts['photoCounts']> = {};
    for (const p of f.photosByPhase) {
      if (p.phase === 'before' || p.phase === 'progress' || p.phase === 'after' || p.phase === 'final') photoCounts[p.phase] = p.count;
    }
    return {
      businessName: business?.name ?? 'We',
      service: job.title,
      stage,
      city: job.city,
      state: job.state,
      keywords: job.keywords,
      onSiteMinutes: f.onSiteMinutes,
      checklistDone: f.completedTasks.length,
      checklistTotal: f.taskCount,
      photoCounts,
      materials: f.materials,
      note: (extras?.notes ?? [])[0]?.text,
      tone: settings.caption?.tone,
      alwaysMention: settings.caption?.always_mention,
      neverSay: settings.caption?.never_say,
      hashtags,
    };
  }, [job, business?.name, chosenMedia, tasks, extras, settings.caption, hashtags]);

  const writeDraft = async (force = false) => {
    if (!facts || drafting || (caption && !force)) return;
    setDrafting(true);
    try {
      if (isSharingAvailable) {
        setCaption(await draftCaption(facts));
        setDraftedByAi(true);
      } else {
        setCaption(plainCaption(facts));
        setDraftedByAi(false);
      }
    } catch {
      setCaption(plainCaption(facts));
      setDraftedByAi(false);
    } finally {
      setDrafting(false);
    }
  };

  // First draft once the facts exist. After that the text belongs to the user.
  useEffect(() => {
    if (facts && !caption && !drafting) void writeDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts]);

  const pending = useMemo(() => {
    if (!job || !caption) return { redactions: [] as PrivacyRedaction[] };
    const merged: PrivacyRedaction[] = [];
    for (const key of ['gbp', 'facebook', 'instagram', 'website'] as const) {
      const text = caption[key];
      if (!text) continue;
      for (const r of scrubPublishText(text, job).redactions) {
        const existing = merged.find((m) => m.label === r.label);
        if (existing) existing.count += r.count;
        else merged.push({ ...r });
      }
    }
    return { redactions: merged };
  }, [job, caption]);

  const applyRedactions = () => {
    if (!job || !caption) return;
    const next: ShareCaption = { ...caption };
    for (const key of ['gbp', 'facebook', 'instagram', 'website'] as const) {
      const text = next[key];
      if (text) next[key] = scrubPublishText(text, job).text;
    }
    setCaption(next);
  };

  const chosenDestinations = (Object.keys(destinations ?? {}) as ShareDestination[]).filter((d) => destinations?.[d]);
  const releaseGranted = release === true;
  const needsRelease = chosenMedia.length > 0 && !releaseGranted;
  const hasText = Boolean(caption?.gbp || caption?.facebook || caption?.instagram || caption?.website);

  const togglePhoto = (photoId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else if (next.size < maxPhotos) next.add(photoId);
      else notify('Photo limit', `Up to ${maxPhotos} photos per post. Change it under Sharing & destinations.`);
      return next;
    });

  const toggleRelease = async (value: boolean) => {
    if (!id) return;
    setRelease(value);
    await setPhotoRelease(id, value, user?.name || user?.email);
  };

  const send = async (run: 'now' | 'queue') => {
    if (!job || !caption || sending) return;
    if (chosenDestinations.length === 0) {
      notify('Pick a destination', 'Choose at least one place to share this project.');
      return;
    }
    if (!isSharingAvailable) {
      notify('Sharing needs an account', 'Sign in to a connected workspace to share projects.');
      return;
    }
    setSending(run);
    try {
      const out = await createShare({
        job,
        media: chosenMedia,
        destinations: chosenDestinations,
        caption: { ...caption, hashtags: hashtags ? caption.hashtags : [] },
        run,
        markComplete,
        websiteWorkflowId: settings.website_workflow_id,
      });
      if (out.warning) notify('Saved', out.warning);
      if (run === 'queue') {
        notify('Saved to queue', 'Share it from the queue whenever you are ready.');
        router.back();
        return;
      }
      setResult(out.share);
    } catch (err) {
      notify('Could not share', describeShareError(err));
    } finally {
      setSending(null);
    }
  };

  const rows = useMemo(() => {
    const items = (media ?? []).filter((m) => m.media_type === 'image');
    const chunked: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += 3) chunked.push(items.slice(i, i + 3));
    return chunked;
  }, [media]);

  if (!initializing && !user) return <Redirect href="/login" />;

  // ── Result ──────────────────────────────────────────────────────────────────
  if (result && job) {
    const entries = result.destinations.map((d) => ({ d, r: result.results?.[d] }));
    const live = entries.filter((e) => e.r?.status === 'live').length;
    const heading =
      result.status === 'done'
        ? 'Shared'
        : result.status === 'partial'
          ? 'Partly shared'
          : result.status === 'queued'
            ? 'Queued to retry'
            : 'Not shared';
    const icon: IconName = result.status === 'done' ? 'checkmark-circle' : result.status === 'partial' ? 'alert-circle' : 'close-circle';
    const tone: Tone = result.status === 'done' ? 'success' : result.status === 'partial' ? 'warning' : 'danger';
    return (
      <Screen>
        <DetailHeader title="Share result" />
        <Card style={{ gap: Spacing.lg, paddingVertical: Spacing.xl }}>
          <View style={{ alignItems: 'center', gap: Spacing.md }}>
            <IconTile icon={icon} tone={tone} size={56} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{heading}</Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' }}>
              {job.title} · {live} of {entries.length} {entries.length === 1 ? 'place' : 'places'}
              {markComplete && live > 0 ? ' · marked complete' : ''}
            </Text>
          </View>
          <View style={{ gap: Spacing.sm }}>
            {entries.map(({ d, r }) => {
              const badge = RESULT_BADGE[r?.status ?? 'pending'];
              return (
                <View key={d} style={styles.resultRow}>
                  <IconTile icon={DEST_ICONS[d]} size={34} tone={badge.tone === 'success' ? 'success' : 'neutral'} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>{SHARE_LABELS[d]}</Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{r?.detail ?? 'Waiting to send.'}</Text>
                  </View>
                  <Badge label={badge.label} tone={badge.tone} />
                </View>
              );
            })}
          </View>
          {result.status === 'failed' || result.status === 'partial' ? (
            <Button label="Try the failed ones again" icon="refresh-outline" variant="secondary" onPress={() => router.replace('/share-queue')} />
          ) : null}
          <Button
            label="Back to project"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/job/[id]', params: { id: job.id } })}
          />
        </Card>
      </Screen>
    );
  }

  // ── Compose ─────────────────────────────────────────────────────────────────
  return (
    <Screen>
      <DetailHeader title="Share this work" />
      {job ? (
        <>
          <Card style={styles.jobRow}>
            <IconTile icon="briefcase-outline" size={40} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{job.title}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                {[job.city, job.state].filter(Boolean).join(', ')} · one post, fitted to each place
              </Text>
            </View>
          </Card>

          {rows.length > 0 ? (
            <Section title={`Photos (${selected.size} of ${maxPhotos})`}>
              <View style={{ gap: Spacing.sm }}>
                {rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {row.map((item) => {
                      const isSelected = selected.has(item.id);
                      return (
                        <Pressable key={item.id} style={{ flex: 1 }} onPress={() => togglePhoto(item.id)}>
                          <View style={{ opacity: isSelected ? 1 : 0.45 }}>
                            <MediaThumb item={item} />
                          </View>
                          {isSelected ? (
                            <View style={[styles.check, { backgroundColor: colors.primary }]}>
                              <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                    {row.length < 3
                      ? Array.from({ length: 3 - row.length }).map((_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />)
                      : null}
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Location data is stripped from photos before they go out. Each place takes the first photo for now.
              </Text>
            </Section>
          ) : null}

          <Section title="Post">
            <Card style={{ gap: Spacing.md }}>
              <View style={styles.metaRow}>
                <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }}>
                  {drafting
                    ? 'Writing from the job…'
                    : draftedByAi
                      ? 'Drafted from what was recorded on this job. Edit anything.'
                      : 'Written from the job facts. Edit anything.'}
                </Text>
                <Button label="Rewrite" icon="refresh-outline" variant="ghost" size="small" loading={drafting} onPress={() => void writeDraft(true)} />
              </View>
              <TextInput
                value={caption?.title ?? ''}
                onChangeText={(v) => setCaption((c) => ({ ...(c ?? {}), title: v }))}
                placeholder="Title (website and report)"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              />
              <TextInput
                value={caption?.gbp ?? ''}
                onChangeText={(v) =>
                  setCaption((c) => ({ ...(c ?? {}), gbp: v, facebook: v, instagram: v, website: c?.website || v }))
                }
                multiline
                placeholder="What should the post say?"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.caption, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              />
              <View style={styles.metaRow}>
                <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
                  {hashtags && caption?.hashtags?.length ? caption.hashtags.map((t) => `#${t}`).join(' ') : 'No hashtags'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{(caption?.gbp ?? '').length} chars</Text>
              </View>
              {pending.redactions.length > 0 ? (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={{ fontSize: 12.5, color: colors.warningStrong }}>
                    Personal details will be removed before this goes out:{' '}
                    {pending.redactions.map((e) => `${e.label} (${e.count})`).join(', ')}.
                  </Text>
                  <Button label="Remove them now" icon="eye-off-outline" variant="secondary" onPress={applyRedactions} />
                </View>
              ) : null}
            </Card>
          </Section>

          <Section title="Where it goes">
            <View style={styles.destGrid}>
              {SHARE_DESTINATIONS.map((d) => {
                const on = Boolean(destinations?.[d]);
                const connected = d === 'facebook' ? settings.facebook?.connected : d === 'instagram' ? settings.instagram?.connected : true;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDestinations((prev) => ({ ...(prev ?? ALL_ON), [d]: !on }))}
                    style={[
                      styles.destTile,
                      { backgroundColor: on ? colors.primarySoft : colors.card, borderColor: on ? colors.primary : colors.border },
                    ]}>
                    <IconTile icon={DEST_ICONS[d]} size={36} tone={on ? 'primary' : 'neutral'} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{SHARE_LABELS[d]}</Text>
                    <Text style={{ fontSize: 11, color: connected === false ? colors.warningStrong : colors.textSecondary }}>
                      {connected === false ? 'Not connected' : d === 'gbp' ? 'Post + photo' : d === 'website' ? 'Project page' : 'Page post'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Card style={{ padding: 0 }}>
              <View style={styles.optRow}>
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.text }}>Hashtags on social</Text>
                <Switch value={hashtags} onValueChange={setHashtags} trackColor={{ true: colors.primary, false: colors.cardPressed }} thumbColor="#FFFFFF" />
              </View>
              <View style={[styles.optRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Mark project complete</Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Leave off while the job is still in progress</Text>
                </View>
                <Switch value={markComplete} onValueChange={setMarkComplete} trackColor={{ true: colors.primary, false: colors.cardPressed }} thumbColor="#FFFFFF" />
              </View>
              <View style={[styles.optRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <IconTile icon={releaseGranted ? 'shield-checkmark-outline' : 'shield-outline'} size={32} tone={releaseGranted ? 'success' : 'warning'} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>Customer photo release</Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {releaseGranted ? 'On file for this project.' : 'Confirm the customer agreed their photos can be published.'}
                  </Text>
                </View>
                <Switch value={releaseGranted} onValueChange={(v) => void toggleRelease(v)} trackColor={{ true: colors.success, false: colors.cardPressed }} thumbColor="#FFFFFF" />
              </View>
            </Card>
          </Section>

          <Button
            label="Share now"
            icon="paper-plane-outline"
            loading={sending === 'now'}
            disabled={!hasText || needsRelease || chosenDestinations.length === 0 || Boolean(sending)}
            onPress={() => void send('now')}
          />
          <Button
            label="Save to queue, share later"
            icon="time-outline"
            variant="secondary"
            loading={sending === 'queue'}
            disabled={!hasText || chosenDestinations.length === 0 || Boolean(sending)}
            onPress={() => void send('queue')}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            {needsRelease
              ? 'Turn on the photo release to share these photos, or deselect them to share text only.'
              : 'Names, street address, phone and email are scrubbed from the text. Only the city is published.'}
          </Text>
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Project not found.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  check: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44, fontSize: 14.5 },
  caption: { height: 130, paddingTop: 10, textAlignVertical: 'top' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  destGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  destTile: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.md },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
