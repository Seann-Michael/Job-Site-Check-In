import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagEditor } from '@/components/tag-editor';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, timeAgo } from '@/lib/format';
import { mediaComments, type MediaComment } from '@/lib/media-comments';
import { setMediaTags } from '@/lib/media-tags';
import { TEAM_NAMES } from '@/lib/team-presence';
import { useAuth } from '@/providers/auth-provider';
import type { MediaItem } from '@/lib/types';

/** Comment text with @mentions tinted. */
function CommentText({ text, color, accent }: { text: string; color: string; accent: string }) {
  const parts = text.split(/(@[A-Za-z]+(?: [A-Za-z]+)?)/g);
  return (
    <Text style={[styles.commentBody, { color }]}>
      {parts.map((part, index) =>
        part.startsWith('@') ? (
          <Text key={index} style={{ color: accent, fontWeight: '700' }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}


/** Full-screen swipeable photo viewer with native share. */
export function MediaViewer({
  items,
  initialIndex,
  visible,
  onClose,
  onLogoSticker,
  onAnnotate,
}: {
  items: MediaItem[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  /** Open the logo-sticker editor for a photo. */
  onLogoSticker?: (item: MediaItem) => void;
  /** Open the annotation editor for a photo. */
  onAnnotate?: (item: MediaItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = React.useState(initialIndex);
  const [editingTags, setEditingTags] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState<string[]>([]);
  const [showComments, setShowComments] = React.useState(false);
  const [comments, setComments] = React.useState<MediaComment[]>([]);
  const [commentDraft, setCommentDraft] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setEditingTags(false);
      setShowComments(false);
      setCommentDraft('');
    }
  }, [visible, initialIndex]);

  const current = items[index];
  const currentId = current?.id;

  React.useEffect(() => {
    if (!visible || !currentId) return;
    let alive = true;
    const refresh = () => {
      void mediaComments.get(currentId).then((list) => {
        if (alive) setComments(list);
      });
    };
    refresh();
    const unsubscribe = mediaComments.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [visible, currentId]);

  const knownNames = React.useMemo(() => {
    const names = new Set(TEAM_NAMES);
    if (user?.name) names.add(user.name);
    return [...names];
  }, [user?.name]);

  const postComment = () => {
    if (!currentId || !commentDraft.trim()) return;
    void mediaComments.add(currentId, commentDraft, user?.name ?? 'You', knownNames);
    setCommentDraft('');
  };

  const insertMention = (name: string) => {
    setCommentDraft((draft) => `${draft.trimEnd()}${draft.trim() ? ' ' : ''}@${name} `);
  };

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
          getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            setIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth));
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width: windowWidth }]}>
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
            {onAnnotate && current?.uri && current.media_type === 'image' ? (
              <Pressable
                onPress={() => onAnnotate(current)}
                hitSlop={10}
                style={styles.iconButton}>
                <Ionicons name="pencil-outline" size={19} color="#FFFFFF" />
              </Pressable>
            ) : null}
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={[styles.caption, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {showComments ? (
              <View style={[styles.commentPanel, { backgroundColor: colors.card }]}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                  {comments.length === 0 ? (
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      No comments yet — mention a teammate with @name.
                    </Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>
                            {comment.author} · {timeAgo(comment.created_at)}
                          </Text>
                          <CommentText
                            text={comment.text}
                            color={colors.text}
                            accent={colors.primaryStrong}
                          />
                        </View>
                        <Pressable
                          hitSlop={8}
                          onPress={() => currentId && void mediaComments.remove(currentId, comment.id)}>
                          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {knownNames
                      .filter((name) => name !== (user?.name ?? ''))
                      .map((name) => (
                        <Pressable
                          key={name}
                          onPress={() => insertMention(name)}
                          style={[styles.mentionChip, { backgroundColor: colors.primarySoft }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryStrong }}>
                            @{name.split(' ')[0]}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                </ScrollView>
                <View style={styles.commentInputRow}>
                  <TextInput
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.commentInput, { color: colors.text, borderColor: colors.border }]}
                    onSubmitEditing={postComment}
                    returnKeyType="send"
                  />
                  <Pressable hitSlop={8} onPress={postComment} disabled={!commentDraft.trim()}>
                    <Ionicons
                      name="arrow-up-circle"
                      size={26}
                      color={commentDraft.trim() ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}
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
              <Pressable
                onPress={() => setShowComments((open) => !open)}
                hitSlop={8}
                style={styles.tagButton}>
                <Ionicons name="chatbubble-outline" size={11} color="#7DD3FC" />
                <Text style={styles.tagButtonText}>
                  {comments.length > 0 ? `${comments.length}` : 'Comment'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
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
  commentPanel: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 5,
  },
  commentBody: {
    fontSize: 13.5,
  },
  mentionChip: {
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    fontSize: 13.5,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  tagSave: {
    alignSelf: 'flex-end',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
});
