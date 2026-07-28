import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Badge, Button, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { formatDate, notify } from '@/lib/format';
import { fetchGoogleReviews, replyToGoogleReview, type GoogleReview } from '@/lib/google-business';
import { useAuth } from '@/providers/auth-provider';

const DEMO_REVIEWS: GoogleReview[] = [
  {
    id: 'demo-review-1',
    reviewer: 'Sarah Mitchell',
    rating: 5,
    comment:
      'Crew showed up on time, installed our gutter guards in a day, and cleaned up completely. Photos of the finished work were sent the same afternoon.',
    created_at: '2026-07-22T15:12:00Z',
    reply: 'Thanks Sarah! Glad the new guards are keeping things flowing.',
  },
  {
    id: 'demo-review-2',
    reviewer: 'Tom Rivera',
    rating: 5,
    comment: 'French drain fixed a decade-old flooding problem. Fair price, great communication.',
    created_at: '2026-07-15T19:40:00Z',
  },
  {
    id: 'demo-review-3',
    reviewer: 'Linda Okafor',
    rating: 4,
    comment: 'Good work on the sump pump. Scheduling took a couple of tries but the job was solid.',
    created_at: '2026-07-02T13:05:00Z',
  },
];

function Stars({ rating }: { rating: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={13}
          color={colors.star}
        />
      ))}
    </View>
  );
}

/** Google reviews from the Business Profile API, with owner replies. */
export default function GmbReviewsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, initializing } = useAuth();
  const { data, refresh, refreshing } = useData(fetchGoogleReviews);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState(false);
  const [localReplies, setLocalReplies] = useState<Record<string, string>>({});

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const live = data !== null && data !== undefined;
  const reviews = (live ? data : DEMO_REVIEWS) ?? DEMO_REVIEWS;

  const sendReply = async (review: GoogleReview) => {
    if (!draft.trim() || working) return;
    setWorking(true);
    try {
      if (live) {
        await replyToGoogleReview(review.id, draft.trim());
        refresh();
      } else {
        setLocalReplies((current) => ({ ...current, [review.id]: draft.trim() }));
      }
      setReplyingId(null);
      setDraft('');
      notify(
        'Reply posted',
        live ? 'It appears on Google shortly.' : 'Saved in demo mode.',
      );
    } catch (error) {
      notify('Could not reply', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setWorking(false);
    }
  };

  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : '—';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DetailHeader title="Google reviews" />

      <Card style={styles.summary}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{average}</Text>
          <Stars rating={Math.round(Number(average) || 0)} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
            {reviews.length} recent reviews
          </Text>
          <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
            {live
              ? 'Live from your Google Business Profile.'
              : 'Demo reviews — connect Google under Settings → Integrations.'}
          </Text>
        </View>
      </Card>

      <Section title="Reviews">
        {reviews.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title="No reviews yet"
            message="Send review requests from a completed job to start collecting them."
          />
        ) : (
          reviews.map((review) => {
            const reply = review.reply ?? localReplies[review.id];
            return (
              <Card key={review.id} style={{ gap: Spacing.sm }}>
                <View style={styles.reviewHead}>
                  <Avatar name={review.reviewer} size={34} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                      {review.reviewer}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Stars rating={review.rating} />
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {review.created_at ? formatDate(review.created_at) : ''}
                      </Text>
                    </View>
                  </View>
                  {reply ? <Badge label="Replied" tone="success" /> : null}
                </View>

                {review.comment ? (
                  <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 19 }}>
                    {review.comment}
                  </Text>
                ) : null}

                {reply ? (
                  <View style={[styles.reply, { borderLeftColor: colors.primary }]}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>
                      Your reply
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{reply}</Text>
                  </View>
                ) : replyingId === review.id ? (
                  <>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      placeholder="Thanks for the kind words..."
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.input,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                    />
                    <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                      <Button
                        label="Post reply"
                        style={{ flex: 1 }}
                        loading={working}
                        onPress={() => void sendReply(review)}
                      />
                      <Button
                        label="Cancel"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() => setReplyingId(null)}
                      />
                    </View>
                  </>
                ) : (
                  <Button
                    label="Reply"
                    icon="return-down-forward-outline"
                    variant="secondary"
                    onPress={() => {
                      setReplyingId(review.id);
                      setDraft('');
                    }}
                  />
                )}
              </Card>
            );
          })
        )}
      </Section>

      {!live ? (
        <Button
          label="Connect Google Business Profile"
          icon="link-outline"
          variant="secondary"
          onPress={() => router.push('/settings/integrations')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  reply: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    gap: 2,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
    fontSize: 14,
    textAlignVertical: 'top',
  },
});
