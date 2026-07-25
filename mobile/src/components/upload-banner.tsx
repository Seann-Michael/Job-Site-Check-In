import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { uploadQueue } from '@/lib/upload-queue';

/** Shown while captured photos are waiting for the network to come back. */
export function UploadBanner() {
  const { colors } = useTheme();
  const [count, setCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const update = () => {
      void uploadQueue.getAll().then((items) => setCount(items.length));
    };
    update();
    return uploadQueue.subscribe(update);
  }, []);

  if (!isSupabaseConfigured || count === 0) return null;

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    await uploadQueue.flush();
    setRetrying(false);
  };

  return (
    <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
      <Ionicons name="cloud-upload-outline" size={17} color={colors.warningStrong} />
      <Text style={[styles.text, { color: colors.warningStrong }]}>
        {count} photo{count === 1 ? '' : 's'} waiting to upload
      </Text>
      <Pressable onPress={() => void retry()} hitSlop={8}>
        <Text style={[styles.retry, { color: colors.warningStrong }]}>
          {retrying ? 'Retrying…' : 'Retry now'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  retry: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
