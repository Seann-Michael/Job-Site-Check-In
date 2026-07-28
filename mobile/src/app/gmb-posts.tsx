import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Badge, Button, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { fetchMedia } from '@/lib/data';
import { formatDate, notify } from '@/lib/format';
import {
  createGmbPost,
  CTA_LABELS,
  deleteGmbPost,
  fetchGmbPosts,
  updateGmbPost,
  type GmbPost,
} from '@/lib/gmb-posts';
import { useAuth } from '@/providers/auth-provider';

const CTAS: NonNullable<GmbPost['cta']>[] = ['LEARN_MORE', 'CALL', 'BOOK'];

/** Manage the posts on your Google Business Profile: view, edit, delete,
 *  and publish new ones with a photo. */
export default function GmbPostsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data, refresh, refreshing } = useData(fetchGmbPosts);
  const { data: media } = useData(fetchMedia);

  const [composing, setComposing] = useState(false);
  const [summary, setSummary] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [cta, setCta] = useState<GmbPost['cta']>('LEARN_MORE');
  const [working, setWorking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const posts = data?.posts ?? [];
  const live = data?.live ?? false;
  const photoChoices = (media ?? []).filter(
    (item) => item.media_type === 'image' && item.uri,
  );

  const publish = async () => {
    if (!summary.trim() || working) return;
    setWorking(true);
    try {
      await createGmbPost({ summary: summary.trim(), photoUrl, cta });
      setSummary('');
      setPhotoUrl(undefined);
      setComposing(false);
      refresh();
      notify(
        live ? 'Post published' : 'Post saved (demo)',
        live
          ? 'It can take a few minutes to appear on Google.'
          : 'Publishes to Google once your Business Profile is connected.',
      );
    } catch (error) {
      notify('Could not publish', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  };

  const saveEdit = async (post: GmbPost) => {
    if (!editDraft.trim() || working) return;
    setWorking(true);
    try {
      await updateGmbPost(post.id, editDraft.trim());
      setEditingId(null);
      refresh();
      notify('Post updated', live ? 'Changes are syncing to Google.' : 'Saved (demo).');
    } catch (error) {
      notify('Could not update', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = (post: GmbPost) => {
    const doDelete = async () => {
      try {
        await deleteGmbPost(post.id);
        refresh();
        notify('Post deleted', live ? 'Removed from Google.' : 'Removed (demo).');
      } catch (error) {
        notify('Could not delete', error instanceof Error ? error.message : 'Try again.');
      }
    };
    if (Platform.OS === 'web') {
      void doDelete();
      return;
    }
    Alert.alert('Delete this post?', 'It comes off your Google profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader
        title="Google posts"
        actions={[
          {
            icon: composing ? 'close-outline' : 'add-circle-outline',
            onPress: () => setComposing((current) => !current),
          },
        ]}
      />

      {!live ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
          <Text style={{ flex: 1, fontSize: 12.5, color: colors.textSecondary }}>
            Demo mode — connect your Google Business Profile under Settings → Integrations and
            these actions run against your real Google listing.
          </Text>
        </Card>
      ) : null}

      {composing ? (
        <Section title="New post">
          <Card style={{ gap: Spacing.md }}>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              multiline
              placeholder="What's new? Finished projects, offers, seasonal reminders..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.composer,
                { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
              ]}
            />
            {photoChoices.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
                  Photo (optional)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {photoChoices.slice(0, 12).map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() =>
                          setPhotoUrl((current) => (current === item.uri ? undefined : item.uri))
                        }>
                        <Image
                          source={{ uri: item.uri }}
                          style={[
                            styles.photoChoice,
                            photoUrl === item.uri && {
                              borderWidth: 3,
                              borderColor: colors.primary,
                            },
                          ]}
                          contentFit="cover"
                        />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {CTAS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setCta(option)}
                  style={[
                    styles.ctaChip,
                    {
                      backgroundColor: cta === option ? colors.primarySoft : colors.card,
                      borderColor: cta === option ? colors.primary : colors.border,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: cta === option ? colors.primaryStrong : colors.textSecondary,
                    }}>
                    {CTA_LABELS[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              label="Publish to Google"
              icon="megaphone-outline"
              loading={working}
              disabled={!summary.trim()}
              onPress={() => void publish()}
            />
            <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
              Photos attach to the post; Google's API does not accept video on posts.
            </Text>
          </Card>
        </Section>
      ) : null}

      <Section title={`Posts (${posts.length})`}>
        {posts.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="No posts yet"
            message="Tap + to publish your first update to Google."
          />
        ) : (
          posts.map((post) => (
            <Card key={post.id} style={{ gap: Spacing.sm }}>
              {post.photo_url ? (
                <Image source={{ uri: post.photo_url }} style={styles.postPhoto} contentFit="cover" />
              ) : null}
              {editingId === post.id ? (
                <>
                  <TextInput
                    value={editDraft}
                    onChangeText={setEditDraft}
                    multiline
                    style={[
                      styles.composer,
                      {
                        backgroundColor: colors.input,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                  <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                    <Button
                      label="Save"
                      style={{ flex: 1 }}
                      loading={working}
                      onPress={() => void saveEdit(post)}
                    />
                    <Button
                      label="Cancel"
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => setEditingId(null)}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
                    {post.summary}
                  </Text>
                  <View style={styles.postMeta}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {formatDate(post.created_at)}
                    </Text>
                    {post.cta ? <Badge label={CTA_LABELS[post.cta]} tone="primary" /> : null}
                    {post.state === 'DEMO' ? (
                      <Badge label="Demo" tone="warning" />
                    ) : post.state !== 'LIVE' ? (
                      <Badge label={post.state} tone="warning" />
                    ) : (
                      <Badge label="Live on Google" tone="success" />
                    )}
                    <View style={{ flex: 1 }} />
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setEditingId(post.id);
                        setEditDraft(post.summary);
                      }}>
                      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => confirmDelete(post)}>
                      <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </>
              )}
            </Card>
          ))
        )}
      </Section>

      <Pressable
        onPress={() => router.push('/settings/integrations')}
        style={({ pressed }) => [
          styles.integrationsLink,
          { backgroundColor: colors.primarySoft },
          pressed && { opacity: 0.7 },
        ]}>
        <Ionicons name="link-outline" size={14} color={colors.primaryStrong} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryStrong }}>
          Connection settings
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 90,
    fontSize: 14.5,
    textAlignVertical: 'top',
  },
  photoChoice: {
    width: 74,
    height: 74,
    borderRadius: Radius.md,
  },
  ctaChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  postPhoto: {
    width: '100%',
    height: 160,
    borderRadius: Radius.md,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  integrationsLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
});
