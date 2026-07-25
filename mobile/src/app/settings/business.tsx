import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, IconTile } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAuth } from '@/providers/auth-provider';

export default function BusinessSettingsScreen() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();
  const { business, businesses, select } = useWorkspace();

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Screen>
      <DetailHeader title="Business" />

      <Section title="Active business">
        <Card style={{ padding: 0 }}>
          {businesses.map((item, index) => {
            const selected = item.id === business?.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => void select(item)}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.cardPressed },
                ]}>
                <IconTile icon="business-outline" size={36} tone={selected ? 'primary' : 'neutral'} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{item.plan}</Text>
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
        Jobs, media, and your GMB profile follow the active business. Add businesses from the web
        dashboard.
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
