import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { isPlacesConfigured } from '@/lib/places';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';
const WEBHOOK_ID = process.env.EXPO_PUBLIC_PUBLISH_WEBHOOK_ID ?? '';

interface LocalCounts {
  photos: number;
  jobs: number;
  publishes: number;
  keys: number;
}

function ConfigRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.configRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={ok ? colors.success : colors.textMuted}
      />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{detail}</Text>
      </View>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [counts, setCounts] = useState<LocalCounts | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('lsr-'));
      const read = async (key: string) => {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return 0;
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed.length : 0;
      };
      setCounts({
        photos: await read('lsr-captured-media-v1'),
        jobs: await read('lsr-created-jobs-v1'),
        publishes: await read('lsr-published-jobs-v1'),
        keys: keys.length,
      });
    } catch {
      setCounts({ photos: 0, jobs: 0, publishes: 0, keys: 0 });
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const version = Constants.expoConfig?.version ?? '0.1.0';
  const sdk = Constants.expoConfig?.sdkVersion ?? '54';

  const report = [
    `Local SEO Ranker Mobile v${version}`,
    `Expo SDK ${sdk} · ${Platform.OS} ${Platform.Version}`,
    `Supabase: ${isSupabaseConfigured ? 'connected' : 'demo mode'}`,
    `Google Maps: ${isPlacesConfigured ? 'configured' : 'not set'}`,
    `API base: ${API_BASE || 'not set'}`,
    `App URL: ${APP_URL || 'not set'}`,
    `Publish webhook: ${WEBHOOK_ID ? 'set' : 'not set'}`,
    `On-device: ${counts?.photos ?? 0} photos, ${counts?.jobs ?? 0} jobs, ${counts?.publishes ?? 0} publishes`,
  ].join('\n');

  const copyReport = async () => {
    try {
      await Share.share({ message: report });
    } catch {
      // dismissed
    }
  };

  const clearLocalData = () => {
    const wipe = async () => {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('lsr-'));
      await AsyncStorage.multiRemove(keys);
      await loadCounts();
      notify('Local data cleared', 'Restart the app to reload fresh demo data.');
    };
    if (Platform.OS === 'web') {
      void wipe();
      return;
    }
    Alert.alert(
      'Clear local data?',
      'Removes on-device demo photos, created jobs, publish records, and preferences. Nothing on the server is touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => void wipe() },
      ],
    );
  };

  return (
    <Screen>
      <DetailHeader title="Diagnostics" />

      <Section title="App">
        <Card style={{ gap: Spacing.sm }}>
          <ConfigRow label={`Version ${version}`} ok detail={`Expo SDK ${sdk} · ${Platform.OS} ${Platform.Version}`} />
        </Card>
      </Section>

      <Section title="Connections">
        <Card style={{ gap: Spacing.md }}>
          <ConfigRow
            label="Supabase"
            ok={isSupabaseConfigured}
            detail={isSupabaseConfigured ? 'Connected to your project' : 'Demo mode — add EXPO_PUBLIC_SUPABASE_URL'}
          />
          <ConfigRow
            label="Google Maps"
            ok={isPlacesConfigured}
            detail={isPlacesConfigured ? 'Autocomplete, Street View, GMB scan active' : 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'}
          />
          <ConfigRow
            label="Web app API"
            ok={Boolean(API_BASE)}
            detail={API_BASE || 'Add EXPO_PUBLIC_API_BASE_URL for server features'}
          />
          <ConfigRow
            label="Publish webhook"
            ok={Boolean(WEBHOOK_ID)}
            detail={WEBHOOK_ID ? 'Website/GoHighLevel delivery wired' : 'Add EXPO_PUBLIC_PUBLISH_WEBHOOK_ID'}
          />
        </Card>
      </Section>

      <Section title="On-device data">
        <Card style={{ gap: Spacing.sm }}>
          <Text style={{ fontSize: 13.5, color: colors.textSecondary }}>
            {counts
              ? `${counts.photos} captured photos · ${counts.jobs} created jobs · ${counts.publishes} publish records · ${counts.keys} storage keys`
              : 'Loading…'}
          </Text>
        </Card>
      </Section>

      <View style={{ gap: Spacing.md }}>
        <Button label="Share diagnostics report" icon="share-outline" variant="secondary" onPress={() => void copyReport()} />
        <Button label="Clear local data" icon="trash-outline" variant="secondary" onPress={clearLocalData} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
