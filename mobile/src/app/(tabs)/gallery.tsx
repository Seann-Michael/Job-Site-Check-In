import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { MediaThumb } from '@/components/media-thumb';
import { EmptyState, Segmented } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchMedia } from '@/lib/data';
import { useData } from '@/hooks/use-data';
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
  const { data: media, loading, refreshing, refresh } = useData(fetchMedia);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const all = media ?? [];
    if (filter === 'all') return all;
    return all.filter((item) => item.media_type === filter);
  }, [media, filter]);

  const rows = useMemo(() => chunk<MediaItem>(filtered, 3), [filtered]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Gallery" subtitle={`${filtered.length} items`} />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title="No media yet"
          message="Photos and videos you capture on jobs show up here."
        />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {row.map((item) => (
                <MediaThumb key={item.id} item={item} />
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
        Geotagged photo capture arrives with the next milestone.
      </Text>
    </Screen>
  );
}
