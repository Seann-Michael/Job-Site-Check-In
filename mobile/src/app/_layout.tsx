import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { StampHost } from '@/components/stamp-host';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/format';
import { recoverPendingCapture } from '@/lib/media-capture';
import { flushPendingReports, installCrashReporting, reportError } from '@/lib/crash-report';
import { initNotifications } from '@/lib/notifications';
import { routeForNotification } from '@/lib/push';
import { uploadQueue } from '@/lib/upload-queue';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemePreferenceProvider } from '@/providers/theme-preference';

/**
 * Shown by expo-router when a screen throws while rendering. Reports the error
 * once, then offers a way back into the app instead of a blank screen.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void reportError(error, { fatal: true, where: 'render' });
  }, [error]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0F172A' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ color: '#CBD5E1', fontSize: 15, textAlign: 'center', marginBottom: 24 }}>
        The problem has been reported. Your photos and jobs are safe.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ backgroundColor: '#0697E0', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

function RootNavigator() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  // Tapping a notification opens the screen it is about.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForNotification(response.notification.request.content.data);
      if (route) router.push(route);
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    // Set up notification handler now that the native layer is ready.
    initNotifications();

    // Report uncaught errors, and send anything saved from a previous session.
    installCrashReporting();
    void flushPendingReports();

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
