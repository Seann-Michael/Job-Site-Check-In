import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card, IconTile, type IconName } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useAuth } from '@/providers/auth-provider';

const STORAGE_KEY = 'lsr-notification-prefs-v1';

interface Prefs {
  reviewCompleted: boolean;
  jobUpdates: boolean;
  gmbAlerts: boolean;
  weeklySummary: boolean;
}

const DEFAULT_PREFS: Prefs = {
  reviewCompleted: true,
  jobUpdates: true,
  gmbAlerts: true,
  weeklySummary: false,
};

const ROWS: { key: keyof Prefs; icon: IconName; label: string; sub: string }[] = [
  { key: 'reviewCompleted', icon: 'star-outline', label: 'Review completed', sub: 'A customer leaves a review from your request' },
  { key: 'jobUpdates', icon: 'briefcase-outline', label: 'Job updates', sub: 'Status changes and new photos on your jobs' },
  { key: 'gmbAlerts', icon: 'storefront-outline', label: 'GMB alerts', sub: 'Audit score drops and new customer questions' },
  { key: 'weeklySummary', icon: 'stats-chart-outline', label: 'Weekly summary', sub: 'Jobs, photos, and reviews recap every Monday' },
];

export default function NotificationsSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) });
      })
      .catch(() => undefined);
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const toggle = (key: keyof Prefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      // Turning job reminders on needs the OS notification permission.
      if (key === 'jobUpdates' && next.jobUpdates) {
        void ensureNotificationPermission();
      }
      return next;
    });
  };

  return (
    <Screen>
      <DetailHeader title="Notifications" />
      <Section title="Notify me about">
        <Card style={{ padding: 0 }}>
          {ROWS.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}>
              <IconTile icon={row.icon} size={36} tone={prefs[row.key] ? 'primary' : 'neutral'} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                  {row.label}
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{row.sub}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={() => toggle(row.key)}
                trackColor={{ true: colors.primary, false: colors.cardPressed }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </Card>
      </Section>
      <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
        Job updates schedule local &quot;job starts today&quot; reminders at 7:30 AM. Remote push
        for reviews and GMB alerts arrives with the dev-build milestone.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
