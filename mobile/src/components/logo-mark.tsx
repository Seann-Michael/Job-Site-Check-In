import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Brand mark: building icon on a primary tile — the mobile counterpart of the
 * web app's Building2 icon inside a bg-primary rounded square.
 */
export function LogoMark({ size = 56 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? Radius.xl : Radius.md,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name="business" size={Math.round(size * 0.52)} color={colors.onPrimary} />
    </View>
  );
}
