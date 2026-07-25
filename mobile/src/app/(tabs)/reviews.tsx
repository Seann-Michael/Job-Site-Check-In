import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Fab } from '@/components/fab';
import { ReviewCard } from '@/components/review-card';
import { EmptyState, Segmented, StatTile } from '@/components/ui/basics';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { fetchReviewRequests } from '@/lib/data';
import { notify } from '@/lib/format';
import { useData } from '@/hooks/use-data';

// Mirrors the web app's AdminReviews pipeline tabs (Current / Past / Scheduled)
const TABS = [
  { value: 'current', label: 'Current' },
  { value: 'past', label: 'Past' },
  { value: 'scheduled', label: 'Scheduled' },
];

export default function ReviewsScreen() {
  const { data: requests, refreshing, refresh } = useData(fetchReviewRequests);
  const [tab, setTab] = useState('current');

  const filtered = useMemo(() => {
    const all = requests ?? [];
    if (tab === 'current') return all.filter((r) => r.status === 'sent' || r.status === 'viewed');
    if (tab === 'past') return all.filter((r) => r.status === 'completed' || r.status === 'expired');
    return all.filter((r) => r.status === 'scheduled');
  }, [requests, tab]);

  const stats = useMemo(() => {
    const all = requests ?? [];
    const sent = all.filter((r) => r.status !== 'scheduled').length;
    const completed = all.filter((r) => r.status === 'completed');
    const avg =
      completed.length > 0
        ? (
            completed.reduce((sum, r) => sum + (r.rating ?? 0), 0) / completed.length
          ).toFixed(1)
        : '—';
    return { sent, completed: completed.length, avg };
  }, [requests]);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader title="Reviews" subtitle="Request pipeline" />
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <StatTile value={String(stats.sent)} label="Requests sent" tone="primary" />
          <StatTile value={String(stats.completed)} label="Completed" tone="success" />
          <StatTile value={stats.avg} label="Avg rating" tone="warning" />
        </View>
        <Segmented options={TABS} value={tab} onChange={setTab} />
        {filtered.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title="Nothing here yet"
            message="Review requests in this stage will show up here."
          />
        ) : (
          filtered.map((request) => <ReviewCard key={request.id} request={request} />)
        )}
      </Screen>
      <Fab
        icon="send"
        onPress={() =>
          notify(
            'New review request',
            'Sending SMS and email review requests reuses the web app’s Twilio integration — wired in an upcoming milestone.',
          )
        }
      />
    </View>
  );
}
