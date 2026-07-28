import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { Badge, Button, Card, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchJob, fetchJobMedia } from '@/lib/data';
import { notify } from '@/lib/format';
import { captureNotice, savePreparedImage } from '@/lib/media-capture';
import { useAuth } from '@/providers/auth-provider';
import type { MediaItem } from '@/lib/types';

const LAYOUTS = [
  { value: 'side', label: 'Side by side' },
  { value: 'stacked', label: 'Stacked' },
];

function PhotoPicker({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: MediaItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={[
                  styles.pickerTile,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}>
                {item.uri ? (
                  <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[styles.pickerPlaceholder, { backgroundColor: colors.cardPressed }]}>
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={[styles.pickerChip, { backgroundColor: '#00000090' }]}>
                  <Text style={styles.pickerChipText}>{item.category}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Panel({ item, label }: { item: MediaItem | undefined; label: string }) {
  return (
    <View style={styles.panel}>
      {item?.uri ? (
        <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.panelEmpty]}>
          <Ionicons name="image-outline" size={30} color="#5A6B85" />
        </View>
      )}
      <View style={styles.panelLabel}>
        <Text style={styles.panelLabelText}>{label}</Text>
      </View>
    </View>
  );
}

export default function BeforeAfterScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();

  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: media, refresh } = useData(() => fetchJobMedia(id ?? ''));
  useMediaRefresh(refresh);

  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [layout, setLayout] = useState('side');
  const [working, setWorking] = useState<'share' | 'save' | null>(null);
  const shotRef = useRef<View>(null);

  const photos = (media ?? []).filter((item) => item.media_type === 'image');

  // Sensible defaults: first "before" and first "after"/"final" shot.
  useEffect(() => {
    if (!photos.length) return;
    const before = photos.find((item) => item.category === 'before') ?? photos[photos.length - 1];
    if (!beforeId) setBeforeId(before.id);
    if (!afterId) {
      const after =
        photos.find((item) => item.category === 'after' || item.category === 'final') ??
        photos.find((item) => item.id !== before.id) ??
        photos[0];
      setAfterId(after.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const before = photos.find((item) => item.id === beforeId);
  const after = photos.find((item) => item.id === afterId);

  const capture = async (): Promise<{ uri: string; base64: string } | null> => {
    if (Platform.OS === 'web') {
      notify('Not on web', 'Collage export works on your phone (iOS/Android).');
      return null;
    }
    const uri = await captureRef(shotRef, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
      width: 1200,
    });
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, base64 };
  };

  const handleShare = async () => {
    if (working) return;
    setWorking('share');
    try {
      const shot = await capture();
      if (shot) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(shot.uri, { mimeType: 'image/jpeg' });
        } else {
          notify('Sharing unavailable', 'This device cannot open the share sheet.');
        }
      }
    } catch (error) {
      notify('Could not share', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  const handleSave = async () => {
    if (working || !job) return;
    setWorking('save');
    try {
      const shot = await capture();
      if (shot) {
        const result = await savePreparedImage(job.id, job.title, 'final', {
          uri: shot.uri,
          base64: shot.base64,
          width: 1200,
          height: layout === 'side' ? 800 : 1500,
        });
        // `status`, not the presence of a message: a queued collage is on this
        // device and already in the job — it must never read as lost.
        if (result.status !== 'failed') refresh();
        const notice = captureNotice(
          result,
          'The collage was added to this job as a Final photo.',
        );
        notify(notice.title, notice.body);
      }
    } catch (error) {
      notify('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <Screen>
      <DetailHeader title="Before / After" />

      {job ? (
        <>
          <Section title="Preview">
            <ViewShot ref={shotRef} style={styles.shot}>
              <View
                style={[
                  styles.collage,
                  { flexDirection: layout === 'side' ? 'row' : 'column' },
                ]}>
                <Panel item={before} label="BEFORE" />
                <View
                  style={
                    layout === 'side'
                      ? { width: 3, backgroundColor: '#FFFFFF' }
                      : { height: 3, backgroundColor: '#FFFFFF' }
                  }
                />
                <Panel item={after} label="AFTER" />
              </View>
              <View style={[styles.brandBar, { backgroundColor: Colors.light.primary }]}>
                <Text style={styles.brandName} numberOfLines={1}>
                  {business?.name ?? 'Your Business'}
                </Text>
                <Text style={styles.brandJob} numberOfLines={1}>
                  {job.title}
                  {job.city ? ` · ${job.city}` : ''}
                </Text>
              </View>
            </ViewShot>
          </Section>

          <Segmented options={LAYOUTS} value={layout} onChange={setLayout} />

          {photos.length > 0 ? (
            <Card style={{ gap: Spacing.md }}>
              <PhotoPicker
                label="Before photo"
                items={photos}
                selectedId={beforeId}
                onSelect={setBeforeId}
              />
              <PhotoPicker
                label="After photo"
                items={photos}
                selectedId={afterId}
                onSelect={setAfterId}
              />
            </Card>
          ) : (
            <Card style={{ alignItems: 'center', gap: Spacing.sm }}>
              <Badge label="No photos yet" tone="warning" />
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                Capture before and after photos on the job first — then build the collage here.
              </Text>
            </Card>
          )}

          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Button
              label="Share"
              icon="share-outline"
              variant="secondary"
              style={{ flex: 1 }}
              loading={working === 'share'}
              onPress={() => void handleShare()}
            />
            <Button
              label="Save to job"
              icon="download-outline"
              style={{ flex: 1 }}
              loading={working === 'save'}
              onPress={() => void handleSave()}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            Saved collages land in the job as a Final photo — perfect for the publish flow.
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
  shot: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#05070B',
  },
  collage: {
    width: '100%',
    aspectRatio: 3 / 2,
  },
  panel: {
    flex: 1,
    overflow: 'hidden',
  },
  panelEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141922',
  },
  panelLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#000000A0',
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  panelLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 1,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  brandJob: {
    color: '#E0F2FE',
    fontSize: 11.5,
  },
  pickerTile: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  pickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerChip: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pickerChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
