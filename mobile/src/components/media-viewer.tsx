import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagEditor } from '@/components/tag-editor';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { setMediaTags } from '@/lib/media-tags';
import type { MediaItem } from '@/lib/types';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

/** Full-screen swipeable photo viewer with native share. */
export function MediaViewer({
  items,
  initialIndex,
  visible,
  onClose,
  onLogoSticker,
}: {
  items: MediaItem[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  /** Open the logo-sticker editor for a photo. */
  onLogoSticker?: (item: MediaItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [index, setIndex] = React.useState(initialIndex);
  const [editingTags, setEditingTags] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setEditingTags(false);
    }
  }, [visible, initialIndex]);

  const current = items[index];

  const startEditingTags = () => {
    setTagDraft(current?.tags ?? []);
    setEditingTags(true);
  };

  const saveTags = () => {
    if (current) void setMediaTags(current.id, tagDraft);
    setEditingTags(false);
  };

  const handleShare = async () => {
    if (!current) return;
    const caption = `${current.job_title || 'Job photo'} — ${current.category} (${formatDate(current.taken_at)})`;
    try {
      await Share.share(
        current.uri
          ? { message: caption, url: current.uri }
          : { message: caption },
      );
    } catch {
      // User dismissed the share sheet.
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(initialIndex, Math.max(0, items.length - 1))}
          getItemLayout={(_, i) => ({ length: WINDOW_WIDTH, offset: WINDOW_WIDTH * i, index: i })}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            setIndex(Math.round(event.nativeEvent.contentOffset.x / WINDOW_WIDTH));
          }}
          renderItem={({ item }) => (
            <View style={styles.page}>
              {item.uri ? (
                <Image
                  source={{ uri: item.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  transition={100}
                />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons
                    name={item.media_type === 'video' ? 'videocam' : 'image-outline'}
                    size={64}
                    color="#5A6B85"
                  />
                  <Text style={styles.placeholderText}>
                    Placeholder tile — real photos appear here after capture
                  </Text>
                </View>
              )}
            </View>
          )}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.counter}>
            {items.length > 0 ? `${index + 1} / ${items.length}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {onLogoSticker && current?.uri && current.media_type === 'image' ? (
              <Pressable
                onPress={() => onLogoSticker(current)}
                hitSlop={10}
                style={styles.iconButton}>
                <Ionicons name="color-wand-outline" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <Pressable onPress={handleShare} hitSlop={10} style={styles.iconButton}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {current ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {editingTags ? (
              <View style={[styles.tagPanel, { backgroundColor: colors.card }]}>
                <TagEditor tags={tagDraft} onChange={setTagDraft} placeholder="Tag this photo..." />
                <Pressable onPress={saveTags} style={[styles.tagSave, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13 }}>
                    Done
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.captionTitle} numberOfLines={1}>
              {current.job_title || 'Job photo'}
            </Text>
            <View style={styles.captionMeta}>
              <Text style={styles.captionText}>
                {current.category.toUpperCase()} · {formatDate(current.taken_at)}
              </Text>
              {typeof current.latitude === 'number' ? (
                <View style={styles.geoChip}>
                  <Ionicons name="location" size={11} color="#34D399" />
                  <Text style={styles.geoText}>GPS</Text>
                </View>
              ) : null}
              <Pressable onPress={startEditingTags} hitSlop={8} style={styles.tagButton}>
                <Ionicons name="pricetag-outline" size={11} color="#7DD3FC" />
                <Text style={styles.tagButtonText}>
                  {current.tags?.length ? current.tags.map((t) => `#${t}`).join(' ') : 'Add tags'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  page: {
    width: WINDOW_WIDTH,
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  placeholderText: {
    color: '#5A6B85',
    fontSize: 13,
    textAlign: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    gap: 4,
  },
  captionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  captionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  captionText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  geoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0B2E2380',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  geoText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0C2B4080',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 200,
  },
  tagButtonText: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '700',
  },
  tagPanel: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tagSave: {
    alignSelf: 'flex-end',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
});
