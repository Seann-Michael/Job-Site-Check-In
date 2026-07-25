import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, IconTile, type IconName } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference, type ThemePreference } from '@/providers/theme-preference';

const OPTIONS: { value: ThemePreference; label: string; sub: string; icon: IconName }[] = [
  { value: 'system', label: 'System', sub: 'Match your device setting', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', sub: 'Always light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', sub: 'Always dark', icon: 'moon-outline' },
];

export default function AppearanceSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { preference, setPreference } = useThemePreference();

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Screen>
      <DetailHeader title="Appearance" />
      <Section title="Theme">
        <Card style={{ padding: 0 }}>
          {OPTIONS.map((option, index) => {
            const selected = option.value === preference;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreference(option.value)}
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
                    {option.label}
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
        Changes apply immediately across the whole app.
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
