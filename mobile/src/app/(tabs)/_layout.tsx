import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type IconName } from '@/components/ui/basics';
import { Radius } from '@/constants/theme';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

/**
 * Active icon sits inside a soft primary pill; inactive icons are bare. Gives
 * the bar a modern "filled pill behind the active tab" treatment.
 */
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const { colors } = useTheme();
    return (
      <View
        style={[
          styles.iconPill,
          focused && { backgroundColor: colors.primarySoft },
        ]}>
        <Ionicons name={focused ? filled : outline} size={22} color={color as string} />
      </View>
    );
  };
}

type TabKey = 'index' | 'gallery' | 'reviews' | 'gmb' | 'clients';

const TAB_ICONS: Record<TabKey, ReturnType<typeof tabIcon>> = {
  index: tabIcon('home-outline', 'home'),
  gallery: tabIcon('images-outline', 'images'),
  reviews: tabIcon('star-outline', 'star'),
  gmb: tabIcon('storefront-outline', 'storefront'),
  clients: tabIcon('people-outline', 'people'),
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, initializing } = useAuth();
  const { mode } = useRole();

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Role decides which routes appear as tabs (and in what order). Every screen
  // stays routable — hidden ones just get href:null so deep links still work.
  const isOwner = mode === 'owner';
  // Owner: Home, Reviews, GMB, Clients, Feed.
  // Staff / viewer: Jobs, Feed, Reviews, Clients (GMB hidden but routable).
  const visibleOrder: TabKey[] = isOwner
    ? ['index', 'reviews', 'gmb', 'clients', 'gallery']
    : ['index', 'gallery', 'reviews', 'clients'];
  const titleFor = (key: TabKey): string => {
    if (key === 'index') return isOwner ? 'Home' : 'Jobs';
    if (key === 'gallery') return 'Feed';
    if (key === 'reviews') return 'Reviews';
    if (key === 'gmb') return 'GMB';
    return 'Clients';
  };

  const allKeys: TabKey[] = ['index', 'gallery', 'reviews', 'gmb', 'clients'];
  const hiddenKeys = allKeys.filter((key) => !visibleOrder.includes(key));

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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarItemStyle: { paddingTop: 2 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      {visibleOrder.map((key) => (
        <Tabs.Screen
          key={key}
          name={key}
          options={{ title: titleFor(key), tabBarIcon: TAB_ICONS[key] }}
        />
      ))}
      {hiddenKeys.map((key) => (
        <Tabs.Screen key={key} name={key} options={{ href: null }} />
      ))}
      {/* Settings stays routable (gear icon on Home) but is off the tab bar. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    minWidth: 46,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
