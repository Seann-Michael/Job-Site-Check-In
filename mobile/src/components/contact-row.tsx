import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type IconName } from '@/components/ui/basics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';

export interface ContactAction {
  icon: IconName;
  onPress: () => void;
}

/**
 * A contact line (phone / email / address): tapping the text copies it to
 * the clipboard; the trailing icon buttons run actions (call, text,
 * navigate, email).
 */
export function ContactRow({
  icon,
  text,
  copyLabel,
  actions,
}: {
  icon: IconName;
  text: string;
  /** What the toast calls it, e.g. "Phone number". */
  copyLabel: string;
  actions: ContactAction[];
}) {
  const { colors } = useTheme();

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      notify(`${copyLabel} copied`, text);
    } catch {
      notify('Could not copy', 'Try again.');
    }
  };

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Pressable onPress={() => void copy()} hitSlop={6} style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, color: colors.text }}>{text}</Text>
      </Pressable>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.primarySoft },
            pressed && { opacity: 0.7 },
          ]}>
          <Ionicons name={action.icon} size={15} color={colors.primaryStrong} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
