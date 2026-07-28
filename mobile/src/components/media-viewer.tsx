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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagEditor } from '@/components/tag-editor';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatDate, formatDateTime, timeAgo } from '@/lib/format';
import { mediaComments, type MediaComment } from '@/lib/media-comments';
import { setMediaTags } from '@/lib/media-tags';
import { fetchTeam, findTeamMember, type TeamRoster } from '@/lib/team';
import { useAuth } from '@/providers/auth-provider';
import type { MediaItem } from '@/lib/types';

/**
 * Caps on OS font scaling. The caption chips are 10–13pt and sit in a fixed-width
 * row, so unbounded Dynamic Type / Android large-font scaling clips them. Body
 * copy (captions, comment text) is deliberately left uncapped.
 */
const CHIP_FONT_SCALE = 1.2;
const LABEL_FONT_SCALE = 1.3;

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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** One line of the attribution stack: an icon plus a plain statement of fact. */
type Stamp = { key: string; icon: IoniconName; text: string; muted?: boolean };

/**
 * Two timestamps a minute apart are the same event described twice (the row's
 * upload time is written the moment the insert lands). Only a real gap — the
 * roof photo that sat in the queue until the van found signal — is worth
 * spelling out as two separate facts.
 */
function sameMoment(a: string, b: string): boolean {
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return a === b;
  return Math.abs(first - second) < 60_000;
}

type MediaViewerProps = {
  /**
   * Attribution (`uploaded_by` / `captured_at` / `uploaded_at`) is optional on
   * every item, so an item that records none of it still renders — the caption
   * simply says the uploader was not recorded.
   */
  items: MediaItem[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  /** Open the logo-sticker editor for a photo. */
  onLogoSticker?: (item: MediaItem) => void;
  /** Open the annotation editor for a photo. */
  onAnnotate?: (item: MediaItem) => void;
};

/**
 * Full-screen swipeable photo viewer with native share.
 *
 * The body lives in its own component so that `useSafeAreaInsets()` reads the
 * SafeAreaProvider nested *inside* the modal. On Android a Modal is its own
 * window, so the root provider's insets would be counted a second time on top
 * of the window's own inset. `statusBarTranslucent` / `navigationBarTranslucent`
 * make the modal window span the whole screen so the nested provider measures
 * the real insets; both props are no-ops on iOS and web.
 *
 * The nested provider deliberately takes no `initialMetrics`, and passing
 * `initialWindowMetrics` would be a regression, not a fix. Do not "restore" it.
 *
 * It is true that safe-area-context renders `null` for its children until it has
 * insets (SafeAreaContext.tsx: `{insets != null ? <Provider>…</Provider> : null}`)
 * and that RN's Modal returns `null` while `visible === false`, so this provider
 * remounts on every open. But the seed on that remount is
 * `initialMetrics?.insets ?? initialSafeAreaInsets ?? parentInsets ?? null`
 * (SafeAreaContext.tsx, `SafeAreaProvider`), and `parentInsets` is just
 * `useContext(SafeAreaInsetsContext)`. A Modal renders its children in the same
 * React tree, so context crosses the modal boundary: expo-router mounts a root
 * `<SafeAreaProvider>` around the whole app in `ExpoRoot`, and every screen that
 * renders a MediaViewer sits under it. That root provider itself renders nothing
 * until its own insets resolve, so by the time this component can mount at all,
 * `parentInsets` is non-null. The seed is therefore non-null on the first commit
 * and children render immediately — there is no blank frame to patch.
 *
 * Passing `initialWindowMetrics` would take priority over `parentInsets` in that
 * `??` chain and pin the first frame to the launch orientation's insets, which is
 * wrong after a rotate — strictly worse than the live parent value we get today.
 * The constant is also `null` on web, so it would buy nothing there either.
 */
export function MediaViewer(props: MediaViewerProps) {
  return (
    <Modal
      visible={props.visible}
      animationType="fade"
      onRequestClose={props.onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <SafeAreaProvider>
        <MediaViewerBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function MediaViewerBody({
  items,
  initialIndex,
  visible,
  onClose,
  onLogoSticker,
  onAnnotate,
}: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { business } = useWorkspace();
  const [roster, setRoster] = React.useState<TeamRoster | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

  // Keep the caption stack off the top toolbar on short phones; it scrolls once capped.
  const captionMaxHeight = Math.round(windowHeight * 0.55);
  const commentListMaxHeight = Math.min(200, Math.round(windowHeight * 0.25));

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

  // The roster names both the @-mention chips and the uploader line. `business`
  // starts null while useWorkspace loads, so this cannot be a fetch-once hook —
  // it has to re-run when the workspace resolves. fetchTeam never rejects.
  const businessId = business?.id ?? null;
  React.useEffect(() => {
    let alive = true;
    void fetchTeam(businessId, user).then((next) => {
      if (alive) setRoster(next);
    });
    return () => {
      alive = false;
    };
  }, [businessId, user]);

  // Only real names: until the roster resolves the sole person we can name is
  // the signed-in user. Sample teammates are still offered as mention targets
  // (the comment panel says they are samples), never as photo authors.
  const knownNames = React.useMemo(() => {
    const names = new Set((roster?.members ?? []).map((member) => member.name));
    if (user?.name) names.add(user.name);
    return [...names];
  }, [roster, user?.name]);

  /**
   * When the shutter fired and when the row reached the server, kept apart:
   * for a photo taken offline these are genuinely different facts. Each line
   * states only what the item actually carries — nothing is inferred from a
   * neighbouring field, and the unlabelled fallback is used when all we have is
   * a best-available date (`taken_at`, always present).
   */
  const stamps = React.useMemo<Stamp[]>(() => {
    if (!current) return [];
    const captured = current.captured_at;
    const uploaded = current.uploaded_at;
    const capturedLine = (iso: string): Stamp => ({
      key: 'captured',
      icon: 'camera-outline',
      text: `Captured ${formatDateTime(iso)}`,
    });
    const uploadedLine = (iso: string): Stamp => ({
      key: 'uploaded',
      icon: 'cloud-upload-outline',
      text: `Uploaded ${formatDateTime(iso)}`,
    });
    if (captured && uploaded) {
      return sameMoment(captured, uploaded)
        ? [capturedLine(captured)]
        : [capturedLine(captured), uploadedLine(uploaded)];
    }
    if (captured) return [capturedLine(captured)];
    if (uploaded) return [uploadedLine(uploaded)];
    return [{ key: 'taken', icon: 'time-outline', text: formatDateTime(current.taken_at) }];
  }, [current]);

  /**
   * Who uploaded it — or an honest admission that nobody knows. Photos that
   * predate the `uploaded_by` column have no author recorded and never will,
   * and a name is never invented to fill the gap.
   */
  const uploader = React.useMemo<Stamp | null>(() => {
    if (!current) return null;
    if (current.pending) {
      return {
        key: 'uploader',
        icon: 'cloud-offline-outline',
        text: 'Not uploaded yet — waiting on this device',
        muted: true,
      };
    }
    // `uploaded_by` is a user id (that column is a pending migration; the
    // capture pipeline mirrors the same id into `metadata.uploaded_by`
    // meanwhile), so it is never rendered raw — findTeamMember is what turns it
    // into a person, and declines to when the roster is only a sample.
    const match = findTeamMember(current.uploaded_by, roster);
    if (match) {
      const name = match.isYou ? `${match.name} (you)` : match.name;
      return { key: 'uploader', icon: 'person-circle-outline', text: `Uploaded by ${name}` };
    }
    return {
      key: 'uploader',
      icon: 'person-outline',
      text: current.uploaded_by ? 'Uploader not on your team list' : 'Uploader not recorded',
      muted: true,
    };
  }, [current, roster]);

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
    setShowComments(false);
    setEditingTags(true);
  };

  const toggleComments = () => {
    setEditingTags(false);
    setShowComments((open) => !open);
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
        <Text style={styles.counter} maxFontSizeMultiplier={LABEL_FONT_SCALE}>
          {items.length > 0 ? `${index + 1} / ${items.length}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {onAnnotate && current?.uri && current.media_type === 'image' ? (
            <Pressable onPress={() => onAnnotate(current)} hitSlop={10} style={styles.iconButton}>
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
          style={styles.caption}>
          {/*
            The scrim doubles as the scroll clip: `behavior="padding"` overwrites
            paddingBottom on the KeyboardAvoidingView itself, so the safe-area gap
            has to live on this child as a margin instead.
          */}
          <ScrollView
            style={[
              styles.captionScrim,
              { maxHeight: captionMaxHeight, marginBottom: insets.bottom + Spacing.lg },
            ]}
            contentContainerStyle={styles.captionContent}
            scrollEnabled={showComments || editingTags}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {showComments ? (
              <View style={[styles.commentPanel, { backgroundColor: colors.card }]}>
                <ScrollView
                  style={{ maxHeight: commentListMaxHeight }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled">
                  {comments.length === 0 ? (
                    <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      No comments yet — mention a teammate with @name.
                    </Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text
                            style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}
                            maxFontSizeMultiplier={LABEL_FONT_SCALE}>
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
                {roster?.isDemo && roster.demoReason ? (
                  <Text
                    style={{ fontSize: 11, color: colors.textMuted }}
                    maxFontSizeMultiplier={LABEL_FONT_SCALE}>
                    {roster.demoReason}
                  </Text>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {knownNames
                      .filter((name) => name !== (user?.name ?? ''))
                      .map((name) => (
                        <Pressable
                          key={name}
                          onPress={() => insertMention(name)}
                          style={[styles.mentionChip, { backgroundColor: colors.primarySoft }]}>
                          <Text
                            style={{ fontSize: 11, fontWeight: '700', color: colors.primaryStrong }}
                            maxFontSizeMultiplier={CHIP_FONT_SCALE}>
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
            <View style={styles.attribution}>
              {[...stamps, ...(uploader ? [uploader] : [])].map((stamp) => (
                <View key={stamp.key} style={styles.attributionRow}>
                  <Ionicons
                    name={stamp.icon}
                    size={11}
                    color={stamp.muted ? '#64748B' : '#94A3B8'}
                  />
                  <Text
                    style={[styles.captionText, stamp.muted ? styles.captionMuted : null]}
                    numberOfLines={2}
                    maxFontSizeMultiplier={LABEL_FONT_SCALE}>
                    {stamp.text}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.captionMeta}>
              <Text
                style={styles.captionText}
                numberOfLines={1}
                maxFontSizeMultiplier={LABEL_FONT_SCALE}>
                {current.category.toUpperCase()}
              </Text>
              {typeof current.latitude === 'number' ? (
                <View style={styles.geoChip}>
                  <Ionicons name="location" size={11} color="#34D399" />
                  <Text style={styles.geoText} maxFontSizeMultiplier={CHIP_FONT_SCALE}>
                    GPS
                  </Text>
                </View>
              ) : null}
              <Pressable onPress={startEditingTags} hitSlop={8} style={styles.tagButton}>
                <Ionicons name="pricetag-outline" size={11} color="#7DD3FC" />
                <Text
                  style={styles.tagButtonText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={CHIP_FONT_SCALE}>
                  {current.tags?.length ? current.tags.map((t) => `#${t}`).join(' ') : 'Add tags'}
                </Text>
              </Pressable>
              <Pressable onPress={toggleComments} hitSlop={8} style={styles.tagButton}>
                <Ionicons name="chatbubble-outline" size={11} color="#7DD3FC" />
                <Text
                  style={styles.tagButtonText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={CHIP_FONT_SCALE}>
                  {comments.length > 0 ? `${comments.length}` : 'Comment'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </View>
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
  },
  /** Dark scrim so white caption text stays legible over bright photos — matches the toolbar pills. */
  captionScrim: {
    backgroundColor: '#00000080',
    borderRadius: Radius.lg,
  },
  captionContent: {
    padding: Spacing.md,
    gap: 4,
  },
  captionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  captionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    rowGap: 6,
  },
  captionText: {
    color: '#94A3B8',
    fontSize: 12,
    flexShrink: 1,
  },
  /** Dimmer tone for what the app does *not* know: unknown uploader, not yet uploaded. */
  captionMuted: {
    color: '#64748B',
  },
  attribution: {
    gap: 2,
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    flexShrink: 1,
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
