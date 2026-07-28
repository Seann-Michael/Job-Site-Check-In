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
  buildPublishContent,
  collectPublishFacts,
  getPhotoRelease,
  isDelivered,
  publishJob,
  scrubPublishText,
  setPhotoRelease,
  DESTINATION_LABELS,
  type Destination,
  type DestinationResult,
  type DeliveryStatus,
  type PrivacyRedaction,
} from '@/lib/publish';
import { tasksStore } from '@/lib/tasks-store';
import { useAuth } from '@/providers/auth-provider';

/**
 * The destinations publish.ts accepts, in its own order. Derived from its
 * labels so this screen can never offer one it does not know about, or name one
 * differently.
 *
 * This app posts nowhere itself: a destination is a *request* carried in the
 * handoff, and the web app decides how — or whether — to fulfil it. So there is
 * no per-platform copy here, and nothing on this screen claims to know how a
 * post reaches Google, a website or anything else.
 */
const DESTINATIONS = Object.keys(DESTINATION_LABELS) as Destination[];

/** Decoration only — never a statement about how a destination is reached. */
const DESTINATION_ICONS: Record<Destination, IconName> = {
  gmb: 'storefront-outline',
  website: 'globe-outline',
  gohighlevel: 'flash-outline',
};

const STATUS_BADGE: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'success' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Not delivered', tone: 'danger' },
  'not-configured': { label: 'Not delivered', tone: 'warning' },
  demo: { label: 'Demo', tone: 'warning' },
};

export default function PublishScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: media } = useData(() => fetchJobMedia(id ?? ''));
  // Guarded: getTasks seeds a checklist for whatever key it is handed, and an
  // empty id would leave a stray one behind.
  const { data: tasks } = useData(() => (id ? tasksStore.getTasks(id) : Promise.resolve([])));
  const { data: extras } = useData(() => jobExtras.get(id ?? ''));
  const { data: storedRelease } = useData(() => getPhotoRelease(id ?? ''));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  // The exact copy the reviewer approved — any later edit invalidates it.
  const [approvedSnapshot, setApprovedSnapshot] = useState<string | null>(null);
  const [release, setRelease] = useState<boolean | null>(null);
  const [destinations, setDestinations] = useState<Record<Destination, boolean>>(
    () =>
      Object.fromEntries(DESTINATIONS.map((key) => [key, true])) as Record<Destination, boolean>,
  );
  const [publishing, setPublishing] = useState(false);
  // Null until we have a real per-destination answer from publishJob.
  const [results, setResults] = useState<DestinationResult[] | null>(null);
  const [redactions, setRedactions] = useState<PrivacyRedaction[] | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  const chosenMedia = useMemo(
    () => (media ?? []).filter((item) => selected.has(item.id)),
    [media, selected],
  );

  const contentInput = useMemo(
    () =>
      job
        ? {
            job,
            businessName: business?.name ?? 'We',
            media: chosenMedia,
            tasks: tasks ?? [],
            checkins: extras?.checkins ?? [],
            // `keywords` used to be passed separately here as well; it is read
            // off `job` inside buildPublishContent now, so there is one source.
            notes: extras?.notes ?? [],
          }
        : null,
    [job, business, chosenMedia, tasks, extras],
  );

  const generated = useMemo(
    () => (contentInput ? buildPublishContent(contentInput) : null),
    [contentInput],
  );
  const facts = useMemo(
    () => (contentInput ? collectPublishFacts(contentInput) : null),
    [contentInput],
  );

  // The evidence behind the generated copy, so the reviewer can see it is not
  // invented. Only facts that actually exist get a chip.
  const factChips = useMemo(() => {
    if (!facts) return [];
    const chips: string[] = [];
    if (facts.onSiteMinutes > 0) {
      const hours = Math.floor(facts.onSiteMinutes / 60);
      const rest = facts.onSiteMinutes % 60;
      chips.push(hours > 0 ? `${hours}h ${rest}m on site` : `${rest}m on site`);
    }
    if (facts.completedTasks.length > 0) {
      chips.push(`${facts.completedTasks.length}/${facts.taskCount} checklist`);
    }
    for (const entry of facts.photosByPhase) chips.push(`${entry.count} ${entry.label}`);
    for (const material of facts.materials) chips.push(material);
    return chips;
  }, [facts]);

  // Prefill once: after that the text belongs to the reviewer.
  useEffect(() => {
    if (generated && !caption) {
      setCaption(generated.content);
      setTitle(generated.title);
    }
  }, [generated, caption]);

  useEffect(() => {
    if (media && selected.size === 0 && media.length > 0) {
      const preferred = media.filter((m) => m.category === 'after' || m.category === 'final');
      const pick = (preferred.length > 0 ? preferred : media).slice(0, 6).map((m) => m.id);
      setSelected(new Set(pick));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  useEffect(() => {
    if (release === null && storedRelease) setRelease(storedRelease.granted);
  }, [storedRelease, release]);

  // What the privacy gate would strip from what is on screen right now.
  const pending = useMemo(() => {
    if (!job) return { redactions: [], title, caption };
    const scrubbedTitle = scrubPublishText(title, job);
    const scrubbedCaption = scrubPublishText(caption, job);
    const merged: PrivacyRedaction[] = [];
    for (const entry of [...scrubbedTitle.redactions, ...scrubbedCaption.redactions]) {
      const existing = merged.find((item) => item.label === entry.label);
      if (existing) existing.count += entry.count;
      else merged.push({ ...entry });
    }
    return { redactions: merged, title: scrubbedTitle.text, caption: scrubbedCaption.text };
  }, [job, title, caption]);

  const snapshot = `${title}\u0000${caption}`;
  const approved = approvedSnapshot === snapshot;
  const releaseGranted = release === true;
  const needsRelease = chosenMedia.length > 0 && !releaseGranted;

  const togglePhoto = (photoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else if (next.size < 10) next.add(photoId);
      return next;
    });
  };

  const chosenDestinations = (Object.keys(destinations) as Destination[]).filter(
    (key) => destinations[key],
  );

  const applyRedactions = () => {
    setTitle(pending.title);
    setCaption(pending.caption);
  };

  const regenerate = () => {
    if (!generated) return;
    setTitle(generated.title);
    setCaption(generated.content);
  };

  const toggleRelease = async (value: boolean) => {
    if (!id) return;
    setRelease(value);
    await setPhotoRelease(id, value, user?.name || user?.email);
  };

  const handlePublish = async () => {
    if (!job || !generated || publishing) return;
    if (chosenDestinations.length === 0) {
      notify('Pick a destination', 'Choose at least one place to publish this project.');
      return;
    }
    setPublishing(true);
    const result = await publishJob({
      job,
      media: chosenMedia,
      destinations: chosenDestinations,
      content: { ...generated, title, content: caption },
      approved,
    });
    setPublishing(false);
    if (result.error) {
      notify('Publish failed', result.error);
      return;
    }
    setRedactions(result.redactions ?? null);
    setPhotoNote(result.photoNote ?? null);
    setResults(result.results);
  };

  const rows = useMemo(() => {
    const items = media ?? [];
    const chunked: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += 3) chunked.push(items.slice(i, i + 3));
    return chunked;
  }, [media]);

  // Below every hook, so signing out never changes the hook order.
  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  if (results && job) {
    const deliveredCount = results.filter((result) => isDelivered(result.status)).length;
    const allDelivered = deliveredCount === results.length;
    const allDemo = results.every((result) => result.status === 'demo');
    const nothingConfigured = results.every((result) => result.status === 'not-configured');

    // Never announce a delivery we did not observe — say exactly what happened.
    // 'queued'/'sent' means the web app took the handoff, which is not the same
    // as a post being live: only the web app can say that, so we do not.
    let icon: IconName = 'checkmark-circle';
    let tone: Tone = 'success';
    let heading = 'Handed off for publishing';
    let body = `${job.title} is marked completed. Your web app has the post and publishes it from here:`;
    if (allDemo) {
      // Demo mode: the flow completed, but no post left this device.
      icon = 'flask-outline';
      tone = 'warning';
      heading = 'Published in demo mode';
      body = `${job.title} is marked completed. Nothing was actually posted — this is what a real publish would look like:`;
    } else if (!allDelivered && deliveredCount > 0) {
      icon = 'alert-circle';
      tone = 'warning';
      heading = 'Partly delivered';
      body = `${job.title} is marked completed, but only some destinations were reached:`;
    } else if (nothingConfigured) {
      icon = 'link-outline';
      tone = 'warning';
      heading = 'No publish destination configured';
      body = `${job.title} is marked completed, but nothing was sent anywhere:`;
    } else if (deliveredCount === 0) {
      // Nothing reached a destination, so nothing was recorded either — do not
      // imply the post is stored somewhere waiting to go out.
      icon = 'alert-circle';
      tone = 'danger';
      heading = 'Not delivered';
      body = `${job.title} is marked completed, but nothing was sent — your post is still here, so you can try again:`;
    }

    return (
      <Screen>
        <DetailHeader title={allDemo ? 'Demo publish' : 'Publish result'} />
        <Card style={{ gap: Spacing.lg, paddingVertical: Spacing.xl }}>
          <View style={{ alignItems: 'center', gap: Spacing.md }}>
            <IconTile icon={icon} tone={tone} size={56} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{heading}</Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' }}>
              {body}
            </Text>
          </View>
          <View style={{ gap: Spacing.sm }}>
            {results.map((result) => (
              <View key={result.destination} style={styles.resultRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                    {DESTINATION_LABELS[result.destination]}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {result.detail}
                  </Text>
                </View>
                <Badge
                  label={STATUS_BADGE[result.status].label}
                  tone={STATUS_BADGE[result.status].tone}
                />
              </View>
            ))}
          </View>
          {redactions && redactions.length > 0 ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
              Removed before publishing:{' '}
              {redactions.map((entry) => `${entry.label} (${entry.count})`).join(', ')}.
            </Text>
          ) : null}
          {photoNote ? (
            <Text style={{ fontSize: 12, color: colors.warningStrong, textAlign: 'center' }}>
              {photoNote}
            </Text>
          ) : null}
          {allDemo ? (
            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
              This is a demo build with nothing connected, so no post exists anywhere.
            </Text>
          ) : null}
          {deliveredCount === 0 && !nothingConfigured && !allDemo ? (
            <Button
              label="Try again"
              icon="refresh-outline"
              onPress={() => {
                setResults(null);
                setRedactions(null);
                setPhotoNote(null);
              }}
            />
          ) : null}
          <Button
            label="Back to job"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/job/[id]', params: { id: job.id } })}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <DetailHeader title="Complete & publish" />

      {job ? (
        <>
          <Card style={styles.jobRow}>
            <IconTile icon="briefcase-outline" size={40} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                {job.title}
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                {job.client_name} · {job.city}
              </Text>
            </View>
          </Card>

          <Section title="Privacy">
            <Card style={{ gap: Spacing.md }}>
              <View style={styles.destRowFlush}>
                <IconTile
                  icon={releaseGranted ? 'shield-checkmark-outline' : 'shield-outline'}
                  size={36}
                  tone={releaseGranted ? 'success' : 'warning'}
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                    Customer photo release
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    Confirm this customer agreed their photos can be published. Without it, no
                    photo from this job leaves the app.
                  </Text>
                </View>
                <Switch
                  value={releaseGranted}
                  onValueChange={(value) => void toggleRelease(value)}
                  trackColor={{ true: colors.success, false: colors.cardPressed }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Every post is stripped of the customer&apos;s name, street address, phone and
                email. Only {job.city ? `${job.city}` : 'the city'}
                {job.state ? `, ${job.state}` : ''}
                {job.zip ? ` ${job.zip}` : ''} is published. Photos are re-encoded to remove EXIF
                location data before they are sent.
              </Text>
              {needsRelease ? (
                <Text style={{ fontSize: 12.5, color: colors.warningStrong }}>
                  {chosenMedia.length} photo{chosenMedia.length === 1 ? '' : 's'} selected — turn
                  on the release, or deselect them to publish text only.
                </Text>
              ) : null}
            </Card>
          </Section>

          {rows.length > 0 ? (
            <Section title={`Photos (${selected.size} selected)`}>
              <View style={{ gap: Spacing.sm }}>
                {rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {row.map((item) => {
                      const isSelected = selected.has(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          style={{ flex: 1 }}
                          onPress={() => togglePhoto(item.id)}>
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
                      ? Array.from({ length: 3 - row.length }).map((_, i) => (
                          <View key={`pad-${i}`} style={{ flex: 1 }} />
                        ))
                      : null}
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="Post">
            <Card style={{ gap: Spacing.md }}>
              {factChips.length > 0 ? (
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    Written from what was recorded on this job:
                  </Text>
                  <View style={styles.chipRow}>
                    {factChips.map((chip) => (
                      <Badge key={chip} label={chip} />
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Nothing has been recorded on this job yet — no completed check-in, no checklist
                  item signed off, no photos selected and no materials named in the notes. Write
                  the post yourself before publishing.
                </Text>
              )}
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Post title"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                ]}
              />
              <TextInput
                value={caption}
                onChangeText={setCaption}
                multiline
                placeholder="What should the post say?"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  styles.caption,
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                ]}
              />
              <View style={styles.metaRow}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {generated?.hashtags.join(' ')}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {caption.length} chars
                </Text>
              </View>
              {pending.redactions.length > 0 ? (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={{ fontSize: 12.5, color: colors.warningStrong }}>
                    Personal details in this copy will be removed before it is published:{' '}
                    {pending.redactions
                      .map((entry) => `${entry.label} (${entry.count})`)
                      .join(', ')}
                    .
                  </Text>
                  <Button
                    label="Remove them now"
                    icon="eye-off-outline"
                    variant="secondary"
                    onPress={applyRedactions}
                  />
                </View>
              ) : null}
              <Button
                label="Rewrite from job details"
                icon="refresh-outline"
                variant="ghost"
                onPress={regenerate}
              />
            </Card>
          </Section>

          <Section title="Review">
            <Card style={styles.destRowFlush}>
              <IconTile
                icon={approved ? 'checkmark-circle' : 'create-outline'}
                size={36}
                tone={approved ? 'success' : 'warning'}
              />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                  {approved ? 'Approved for publishing' : 'Approve this copy'}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                  {approved
                    ? 'Editing the title or caption clears this.'
                    : 'Read the post above. Nothing is published until you approve it.'}
                </Text>
              </View>
              <Switch
                value={approved}
                onValueChange={(value) => setApprovedSnapshot(value ? snapshot : null)}
                trackColor={{ true: colors.success, false: colors.cardPressed }}
                thumbColor="#FFFFFF"
              />
            </Card>
          </Section>

          <Section title="Ask your web app to publish to">
            <Card style={{ padding: 0 }}>
              {DESTINATIONS.map((destination, index) => (
                <View
                  key={destination}
                  style={[
                    styles.destRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}>
                  <IconTile
                    icon={DESTINATION_ICONS[destination]}
                    size={36}
                    tone={destinations[destination] ? 'primary' : 'neutral'}
                  />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                      {DESTINATION_LABELS[destination]}
                    </Text>
                  </View>
                  <Switch
                    value={destinations[destination]}
                    onValueChange={(value) =>
                      setDestinations((prev) => ({ ...prev, [destination]: value }))
                    }
                    trackColor={{ true: colors.primary, false: colors.cardPressed }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
              <View
                style={[
                  styles.destNote,
                  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                  This app never posts to a platform itself. It hands your approved post to your
                  web app, which decides how each of these is published — so what happens next is
                  reported back here, not guessed at.
                </Text>
              </View>
            </Card>
          </Section>

          <Button
            label="Publish project"
            icon="megaphone-outline"
            loading={publishing}
            disabled={!approved || needsRelease || chosenDestinations.length === 0}
            onPress={handlePublish}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            {!approved
              ? 'Approve the copy above to enable publishing.'
              : needsRelease
                ? 'Turn on the customer photo release to publish these photos.'
                : 'Marks the job completed. Copy is scrubbed and photos are stripped of location data before anything is sent.'}
          </Text>
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Job not found.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  check: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 14.5,
  },
  caption: {
    height: 120,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  /** Footnote under the destination rows, matching their horizontal padding. */
  destNote: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  /** Same row as destRow, but inside a Card that already has its padding. */
  destRowFlush: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
