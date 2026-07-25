import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { StampHost } from '@/components/stamp-host';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { recoverPendingCapture } from '@/lib/media-capture';
import { uploadQueue } from '@/lib/upload-queue';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemePreferenceProvider } from '@/providers/theme-preference';

function RootNavigator() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Android: finish saving a photo if the OS killed the app mid-capture.
    recoverPendingCapture().then((result) => {
      if (result?.item) {
        notify('Photo recovered', 'A photo from your last session was saved to its job.');
      }
    });
    // Offline queue: try on launch, then keep retrying in the background.
    void uploadQueue.flush();
    const interval = setInterval(() => {
      if (uploadQueue.countSync() > 0) void uploadQueue.flush();
    }, 30_000);
    return () => clearInterval(interval);
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
        <StampHost />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootNavigator />
    </ThemePreferenceProvider>
  );
}
