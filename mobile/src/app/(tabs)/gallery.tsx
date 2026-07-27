import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { MediaViewer } from '@/components/media-viewer';
import { Button, Card, EmptyState, IconTile, Segmented } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dataErrors, fetchMedia } from '@/lib/data';
import { useData } from '@/hooks/use-data';
import { useMediaRefresh } from '@/hooks/use-media-refresh';
import type { MediaItem } from '@/lib/types';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
];

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function GalleryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: media, loading, refreshing, refresh } = useData(fetchMedia);
  useMediaRefresh(refresh);
  // Tells "nothing captured yet" apart from "the media query failed".
  const [loadError, setLoadError] = useState<string | null>(() => dataErrors.get('media'));
  React.useEffect(() => dataErrors.subscribe(() => setLoadError(dataErrors.get('media'))), []);
  const [filter, setFilter] = useState('all');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const all = media ?? [];
    if (filter === 'all') return all;
    return all.filter((item) => item.media_type === filter);
  }, [media, filter]);

  const rows = useMemo(() => chunk<MediaItem>(filtered, 3), [filtered]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader
        title="Feed"
        // The count describes what is actually on screen. When the read failed
        // and nothing survived it, "0 items" would assert an empty workspace we
        // can no longer vouch for, so the banner speaks for itself instead.
        subtitle={loadError && filtered.length === 0 ? undefined : `${filtered.length} items`}
        actions={[{ icon: 'business-outline', onPress: () => router.push('/feed') }]}
      />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {/* A banner, not a replacement: a failed read still returns this device's
          queued captures, and hiding them makes just-taken work look lost. */}
      {loadError ? (
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
          }}>
          <IconTile icon="cloud-offline-outline" tone="danger" size={32} />
          <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 }}>
            {loadError}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            icon="refresh"
            loading={refreshing}
            onPress={refresh}
          />
        </Card>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : rows.length === 0 ? (
        loadError ? null : (
          <EmptyState
            icon="images-outline"
            title="No media yet"
            message="Photos and videos you capture on jobs show up here."
          />
        )
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {row.map((item, colIndex) => (
                <Pressable
                  key={item.id}
                  style={{ flex: 1 }}
                  onPress={() => setViewerIndex(rowIndex * 3 + colIndex)}>
                  <MediaThumb item={item} />
                </Pressable>
              ))}
              {row.length < 3
                ? Array.from({ length: 3 - row.length }).map((_, i) => (
                    <View key={`pad-${i}`} style={{ flex: 1 }} />
                  ))
                : null}
            </View>
          ))}
        </View>
      )}
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
        Capture geotagged photos from any job&apos;s detail screen.
      </Text>
      <MediaViewer
        items={filtered}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        onLogoSticker={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/logo-sticker', params: { mediaId: item.id } });
        }}
        onAnnotate={(item) => {
          setViewerIndex(null);
          router.push({ pathname: '/annotate', params: { mediaId: item.id } });
        }}
      />
    </Screen>
  );
}
