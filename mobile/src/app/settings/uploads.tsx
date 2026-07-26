import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo, notify } from '@/lib/format';
import { uploadQueue, type QueuedUpload } from '@/lib/upload-queue';
import { useAuth } from '@/providers/auth-provider';

/** Dedicated upload-queue manager: see, retry, or drop pending uploads. */
export default function UploadsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [items, setItems] = useState<QueuedUpload[]>([]);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const refresh = () => {
      void uploadQueue.getAll().then((all) => setItems([...all]));
    };
    refresh();
    return uploadQueue.subscribe(refresh);
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const retryAll = async () => {
    setRetrying(true);
    try {
      await uploadQueue.flush();
      const remaining = await uploadQueue.getAll();
      notify(
        remaining.length === 0 ? 'All caught up' : 'Still offline',
        remaining.length === 0
          ? 'Everything uploaded.'
          : `${remaining.length} item(s) still waiting — will retry automatically.`,
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Screen>
      <DetailHeader title="Uploads" />

      {items.length === 0 ? (
        <EmptyState
          icon="cloud-done-outline"
          title="Nothing waiting"
          message="Photos and videos upload immediately when you have signal. Anything captured offline queues here."
        />
      ) : (
        <>
          <Section title={`Waiting to upload (${items.length})`}>
            <Card style={{ padding: 0 }}>
              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}>
                  {item.media_type === 'video' ? (
                    <View style={[styles.thumb, { backgroundColor: colors.cardPressed }]}>
                      <Ionicons name="videocam" size={18} color={colors.textSecondary} />
                    </View>
                  ) : (
                    <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                  )}
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: colors.text }}
                      numberOfLines={1}>
                      {item.job_title || 'Job media'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {item.category} · {item.media_type ?? 'image'} · {timeAgo(item.taken_at)}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      void uploadQueue.remove(item.id);
                      notify('Removed', 'The item stays in your on-device gallery.');
                    }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </Section>
          <Button
            label="Retry all now"
            icon="cloud-upload-outline"
            loading={retrying}
            onPress={() => void retryAll()}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            The queue also retries automatically every 30 seconds and on app launch.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
