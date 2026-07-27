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
import {
  buildPublishContent,
  isDelivered,
  publishJob,
  DESTINATION_LABELS,
  type Destination,
  type DestinationResult,
  type DeliveryStatus,
} from '@/lib/publish';
import { useAuth } from '@/providers/auth-provider';

const DESTINATIONS: { key: Destination; icon: IconName; sub: string }[] = [
  { key: 'gmb', icon: 'storefront-outline', sub: 'Post with photos to your Google profile' },
  { key: 'website', icon: 'globe-outline', sub: 'Project page via your site automation' },
  { key: 'gohighlevel', icon: 'flash-outline', sub: 'Trigger your GoHighLevel workflows' },
];

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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [destinations, setDestinations] = useState<Record<Destination, boolean>>({
    gmb: true,
    website: true,
    gohighlevel: true,
  });
  const [publishing, setPublishing] = useState(false);
  // Null until we have a real per-destination answer from publishJob.
  const [results, setResults] = useState<DestinationResult[] | null>(null);

  const generated = useMemo(
    () => (job ? buildPublishContent(job, business?.name ?? 'We', (media ?? []).length) : null),
    [job, business, media],
  );

  // Prefill: caption from the generator, photo selection favoring after/final.
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

  const handlePublish = async () => {
    if (!job || !generated || publishing) return;
    if (chosenDestinations.length === 0) {
      notify('Pick a destination', 'Choose at least one place to publish this project.');
      return;
    }
    setPublishing(true);
    const result = await publishJob({
      job,
      media: (media ?? []).filter((item) => selected.has(item.id)),
      destinations: chosenDestinations,
      content: { ...generated, title, content: caption },
    });
    setPublishing(false);
    if (result.error) {
      notify('Publish failed', result.error);
      return;
    }
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
    let icon: IconName = 'checkmark-circle';
    let tone: Tone = 'success';
    let heading = 'Project published';
    let body = `${job.title} is marked completed and on its way to:`;
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
        <DetailHeader title={allDelivered || allDemo ? 'Published' : 'Publish result'} />
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
          {allDemo ? (
            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
              Demo result — connect Supabase and your publish webhook to post to Google and run
              your automations for real.
            </Text>
          ) : null}
          {nothingConfigured ? (
            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
              Set EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_PUBLISH_WEBHOOK_ID so completed
              projects can be delivered.
            </Text>
          ) : null}
          {deliveredCount === 0 && !nothingConfigured && !allDemo ? (
            <Button label="Try again" icon="refresh-outline" onPress={() => setResults(null)} />
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
            </Card>
          </Section>

          <Section title="Publish to">
            <Card style={{ padding: 0 }}>
              {DESTINATIONS.map((destination, index) => (
                <View
                  key={destination.key}
                  style={[
                    styles.destRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}>
                  <IconTile
                    icon={destination.icon}
                    size={36}
                    tone={destinations[destination.key] ? 'primary' : 'neutral'}
                  />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                      {DESTINATION_LABELS[destination.key]}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      {destination.sub}
                    </Text>
                  </View>
                  <Switch
                    value={destinations[destination.key]}
                    onValueChange={(value) =>
                      setDestinations((prev) => ({ ...prev, [destination.key]: value }))
                    }
                    trackColor={{ true: colors.primary, false: colors.cardPressed }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </Card>
          </Section>

          <Button
            label="Publish project"
            icon="megaphone-outline"
            loading={publishing}
            onPress={handlePublish}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            Marks the job completed. Delivery runs through your web app&apos;s syndication
            pipeline and automations.
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
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
