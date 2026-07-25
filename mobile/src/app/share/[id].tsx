import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchJob, fetchJobMedia } from '@/lib/data';
import { formatDate, notify } from '@/lib/format';
import { galleryUrl, shareLinks } from '@/lib/share-links';
import { useAuth } from '@/providers/auth-provider';
import type { MediaItem } from '@/lib/types';

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function ShareGalleryScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();

  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: mediaData } = useData(() => fetchJobMedia(id ?? ''));
  const { data: links, refresh: refreshLinks } = useData(() => shareLinks.forJob(id ?? ''));
  useEffect(() => shareLinks.subscribe(refreshLinks), [refreshLinks]);

  const media = (mediaData ?? []).filter((item) => item.uri && item.media_type === 'image');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);

  // Everything selected by default once media loads.
  const seeded = React.useRef(false);
  useEffect(() => {
    if (!seeded.current && media.length > 0) {
      seeded.current = true;
      setSelected(new Set(media.map((item) => item.id)));
    }
  }, [media]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const toggle = (itemId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleShare = async () => {
    if (!job || selected.size === 0 || sharing) return;
    setSharing(true);
    try {
      const link = await shareLinks.create(job.id, [...selected]);
      const url = galleryUrl(link);
      await Share.share({
        message: [
          `${job.title} — photo gallery from ${job.client_name ? `your project` : 'our team'}`,
          `${selected.size} photos`,
          url,
        ].join('\n'),
      });
      notify(
        'Gallery link created',
        'The link goes live on your website when the web app is connected.',
      );
    } catch {
      // Share sheet dismissed.
    } finally {
      setSharing(false);
    }
  };

  const rows = chunk<MediaItem>(media, 3);

  return (
    <Screen>
      <DetailHeader title="Share gallery" />

      {job ? (
        <Card style={{ gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{job.title}</Text>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
            Pick the photos to include — your client gets one clean web gallery link, no app
            needed.
          </Text>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            No photos on this job yet — capture some first.
          </Text>
        </Card>
      ) : (
        <Section title={`Photos (${selected.size} of ${media.length} selected)`}>
          <View style={{ gap: Spacing.sm }}>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {row.map((item) => {
                  const isOn = selected.has(item.id);
                  return (
                    <Pressable key={item.id} style={{ flex: 1 }} onPress={() => toggle(item.id)}>
                      <View style={[styles.thumbWrap, !isOn && { opacity: 0.35 }]}>
                        <MediaThumb item={item} />
                      </View>
                      <View
                        style={[
                          styles.check,
                          {
                            backgroundColor: isOn ? colors.primary : '#00000070',
                            borderColor: '#FFFFFF',
                          },
                        ]}>
                        {isOn ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                      </View>
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
      )}

      <Button
        label={selected.size > 0 ? `Share gallery link (${selected.size} photos)` : 'Select photos to share'}
        icon="link-outline"
        loading={sharing}
        onPress={() => void handleShare()}
      />

      {(links ?? []).length > 0 ? (
        <Section title="Shared links">
          <Card style={{ padding: 0 }}>
            {(links ?? []).map((link, index) => (
              <View
                key={link.token}
                style={[
                  styles.linkRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <Ionicons name="link-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {galleryUrl(link)}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                    {link.photo_ids.length} photos · {formatDate(link.created_at)}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => void Share.share({ message: galleryUrl(link) }).catch(() => undefined)}>
                  <Ionicons name="share-outline" size={17} color={colors.textSecondary} />
                </Pressable>
                <Pressable hitSlop={8} onPress={() => void shareLinks.remove(link.token)}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
