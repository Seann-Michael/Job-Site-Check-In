import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card, type Tone } from '@/components/ui/basics';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REVIEW_STATUS_LABELS, timeAgo } from '@/lib/format';
import type { ReviewRequest, ReviewRequestStatus } from '@/lib/types';

export const REVIEW_STATUS_TONES: Record<ReviewRequestStatus, Tone> = {
  sent: 'primary',
  viewed: 'warning',
  completed: 'success',
  expired: 'neutral',
  scheduled: 'neutral',
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((slot) => (
        <Ionicons
          key={slot}
          name={slot <= rating ? 'star' : 'star-outline'}
          size={size}
          color={slot <= rating ? colors.star : colors.textMuted}
        />
      ))}
    </View>
  );
}

export function ReviewCard({
  request,
  onReply,
}: {
  request: ReviewRequest;
  /** When provided, renders a Reply affordance. Callers hide it for viewer role. */
  onReply?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={styles.row}>
        <Avatar name={request.customer_name} size={44} />
        <View style={styles.info}>
          <Text style={[Typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {request.customer_name}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {request.job_title}
          </Text>
          <View style={styles.contactRow}>
            <Ionicons
              name={request.channel === 'sms' ? 'chatbubble-outline' : 'mail-outline'}
              size={12}
              color={colors.textMuted}
            />
            <Text style={[Typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {request.contact}
            </Text>
          </View>
        </View>
        <View style={styles.right}>
          <Badge
            label={REVIEW_STATUS_LABELS[request.status]}
            tone={REVIEW_STATUS_TONES[request.status]}
          />
          {typeof request.rating === 'number' ? (
            <Stars rating={request.rating} />
          ) : (
            <Text style={[Typography.caption, { color: colors.textMuted }]}>
              {request.status === 'scheduled' ? 'for ' : ''}
              {timeAgo(request.sent_at)}
            </Text>
          )}
        </View>
      </View>
      {onReply ? (
        <Pressable
          onPress={onReply}
          style={({ pressed }) => [
            styles.reply,
            { backgroundColor: colors.primarySoft },
            pressed && { opacity: 0.8 },
          ]}>
          <Ionicons name="arrow-undo-outline" size={15} color={colors.primary} />
          <Text style={[Typography.label, { color: colors.primary }]}>Reply</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.button,
    paddingVertical: 10,
  },
});
