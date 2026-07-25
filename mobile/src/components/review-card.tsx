import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Card, type Tone } from '@/components/ui/basics';
import { Spacing } from '@/constants/theme';
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

function Stars({ rating }: { rating: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((slot) => (
        <Ionicons
          key={slot}
          name={slot <= rating ? 'star' : 'star-outline'}
          size={13}
          color={slot <= rating ? colors.star : colors.textMuted}
        />
      ))}
    </View>
  );
}

export function ReviewCard({ request }: { request: ReviewRequest }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={request.customer_name} size={40} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {request.customer_name}
          </Text>
          <Text style={[styles.job, { color: colors.textSecondary }]} numberOfLines={1}>
            {request.job_title}
          </Text>
          <View style={styles.contactRow}>
            <Ionicons
              name={request.channel === 'sms' ? 'chatbubble-outline' : 'mail-outline'}
              size={12}
              color={colors.textMuted}
            />
            <Text style={[styles.contact, { color: colors.textMuted }]} numberOfLines={1}>
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
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {request.status === 'scheduled' ? 'for ' : ''}
              {timeAgo(request.sent_at)}
            </Text>
          )}
        </View>
      </View>
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
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  job: {
    fontSize: 13,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  contact: {
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    fontSize: 11.5,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
});
