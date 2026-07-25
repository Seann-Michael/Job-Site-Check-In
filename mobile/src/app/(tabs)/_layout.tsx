import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { type ColorValue } from 'react-native';

import { type IconName } from '@/components/ui/basics';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={23} color={color as string} />;
  };
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user, initializing } = useAuth();

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Jobs', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }}
      />
      <Tabs.Screen
        name="gallery"
        options={{ title: 'Gallery', tabBarIcon: tabIcon('images-outline', 'images') }}
      />
      <Tabs.Screen
        name="reviews"
        options={{ title: 'Reviews', tabBarIcon: tabIcon('star-outline', 'star') }}
      />
      <Tabs.Screen
        name="gmb"
        options={{ title: 'GMB', tabBarIcon: tabIcon('storefront-outline', 'storefront') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
