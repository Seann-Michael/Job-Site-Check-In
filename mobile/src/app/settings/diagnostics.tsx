import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

interface LocalCounts {
  photos: number;
  jobs: number;
  publishes: number;
  keys: number;
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as never} size={18} color={colors.textSecondary} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 13.5, color: colors.textSecondary, maxWidth: '55%' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function buildType(): string {
  const runtime =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? 'Expo Go'
      : Platform.OS === 'web'
        ? 'Web preview'
        : 'Native build';
  return `${runtime} · ${__DEV__ ? 'development' : 'production'}`;
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
  const phone =
    [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') ||
    Constants.deviceName ||
    'Unknown device';
  const os = [Device.osName ?? Platform.OS, Device.osVersion ?? String(Platform.Version)]
    .filter(Boolean)
    .join(' ');
  const osBuild = Device.osBuildId ?? Device.osInternalBuildId ?? '—';

  const report = [
    `Local SEO Ranker Mobile v${version} (Expo SDK ${sdk})`,
    `Phone: ${phone}`,
    `OS: ${os} (build ${osBuild})`,
    `App build: ${buildType()}`,
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

      <Section title="Phone">
        <Card style={{ gap: Spacing.md }}>
          <InfoRow icon="phone-portrait-outline" label="Phone type" value={phone} />
          <InfoRow icon="hardware-chip-outline" label="Operating system" value={os} />
          <InfoRow icon="build-outline" label="OS build" value={osBuild} />
        </Card>
      </Section>

      <Section title="App">
        <Card style={{ gap: Spacing.md }}>
          <InfoRow icon="apps-outline" label="App version" value={`v${version}`} />
          <InfoRow icon="cube-outline" label="Expo SDK" value={String(sdk)} />
          <InfoRow icon="construct-outline" label="Build type" value={buildType()} />
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
});
