import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, IconTile, type IconName } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getNavApp, NAV_APP_LABELS, setNavApp, type NavApp } from '@/lib/directions';
import { useAuth } from '@/providers/auth-provider';

const OPTIONS: { value: NavApp; icon: IconName; sub: string; iosOnly?: boolean }[] = [
  { value: 'system', icon: 'phone-portrait-outline', sub: 'Whatever your device uses by default' },
  { value: 'apple', icon: 'map-outline', sub: 'Built into iPhone', iosOnly: true },
  { value: 'google', icon: 'navigate-outline', sub: 'Opens the Google Maps app when installed' },
  { value: 'waze', icon: 'car-outline', sub: 'Live traffic and police alerts' },
];

export default function NavigationSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const [choice, setChoice] = useState<NavApp>('system');

  useEffect(() => {
    void getNavApp().then(setChoice);
  }, []);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const options = OPTIONS.filter((option) => !option.iosOnly || Platform.OS !== 'android');

  return (
    <Screen>
      <DetailHeader title="Navigation app" />
      <Section title="Directions open in">
        <Card style={{ padding: 0 }}>
          {options.map((option, index) => {
            const selected = option.value === choice;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setChoice(option.value);
                  void setNavApp(option.value);
                }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.cardPressed },
                ]}>
                <IconTile icon={option.icon} size={36} tone={selected ? 'primary' : 'neutral'} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                    {NAV_APP_LABELS[option.value]}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{option.sub}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      </Section>
      <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
        Used by the Directions button on job screens. If the chosen app isn&apos;t installed,
        directions open in the browser instead.
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
