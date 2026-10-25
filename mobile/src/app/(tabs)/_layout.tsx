import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type IconName } from '@/components/ui/basics';
import { Radius } from '@/constants/theme';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

/**
 * One tab set for every role: Today · Feed · Capture · GMB · More.
 *
 * Role never reorders or relabels tabs; a role that cannot do something sees
 * the same bar and is told so on the screen. Capture is the center button and
 * is not a screen of its own: pressing it opens the capture picker (nearest
 * project first) over whatever tab is current.
 */
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const { colors } = useTheme();
    return (
      <View style={[styles.iconPill, focused && { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={focused ? filled : outline} size={22} color={color as string} />
      </View>
    );
  };
}

function CaptureButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Capture"
      onPress={() => router.push('/capture-picker')}
      style={({ pressed }) => [styles.captureWrap, pressed && { opacity: 0.85 }]}>
      <View style={[styles.capture, { backgroundColor: colors.primary, borderColor: colors.tabBar, shadowColor: colors.primary }]}>
        <Ionicons name="camera" size={26} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, initializing } = useAuth();
  const { canWrite } = useRole();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 2 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="gallery" options={{ title: 'Feed', tabBarIcon: tabIcon('grid-outline', 'grid') }} />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginTop: 2, color: colors.primary },
          tabBarButton: canWrite ? () => <CaptureButton /> : () => null,
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tabs.Screen name="gmb" options={{ title: 'GMB', tabBarIcon: tabIcon('storefront-outline', 'storefront') }} />
      <Tabs.Screen name="settings" options={{ title: 'More', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
      {/* Routable but off the bar: reached from Feed and More. */}
      <Tabs.Screen name="reviews" options={{ href: null }} />
      <Tabs.Screen name="clients" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: { minWidth: 46, height: 30, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  captureWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  capture: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
