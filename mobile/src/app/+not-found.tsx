import { Link, Stack } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          backgroundColor: colors.background,
        }}>
        <Text style={[Typography.h1, { color: colors.text }]}>That page doesn&apos;t exist.</Text>
        <Link href="/" style={[Typography.bodyStrong, { color: colors.primary }]}>
          Go to the home screen
        </Link>
      </View>
    </>
  );
}
