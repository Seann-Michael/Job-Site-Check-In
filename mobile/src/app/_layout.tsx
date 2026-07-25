import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { recoverPendingCapture } from '@/lib/media-capture';
import { AuthProvider } from '@/providers/auth-provider';

export default function RootLayout() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Android: finish saving a photo if the OS killed the app mid-capture.
    recoverPendingCapture().then((result) => {
      if (result?.item) {
        notify('Photo recovered', 'A photo from your last session was saved to its job.');
      }
    });
  }, []);

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <AuthProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </ThemeProvider>
    </AuthProvider>
  );
}
