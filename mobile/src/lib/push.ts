/**
 * Push notifications — registers this phone with the server so the business
 * gets told about things that need a fast reply (a new low-star review).
 *
 * Registration never prompts on its own: it only runs once the person has
 * already allowed notifications, so signing in is never interrupted by a
 * permission sheet. The Notifications settings page is where the prompt lives.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api';
import { isApiConfigured } from '@/lib/config';

const TOKEN_KEY = 'push.registered-token-v1';

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Register this phone for the signed-in user. Safe to call on every launch:
 * the server upserts on the token. Returns true when the phone is registered.
 */
export async function registerForPush(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice || !isApiConfigured) return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) return false;
    const id = projectId();
    if (!id) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (!token) return false;
    await apiFetch('/api/push/register', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'android' ? 'android' : 'ios', deviceName: Device.deviceName ?? '' },
      timeoutMs: 10_000,
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    // Simulator, no network, or notifications not set up for this build.
    return false;
  }
}

/**
 * Stop notifying this phone for the current account. Must run BEFORE the
 * session is destroyed, because the request is authenticated.
 */
export async function unregisterFromPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(TOKEN_KEY);
    if (!isApiConfigured) return;
    await apiFetch('/api/push/register', { method: 'DELETE', body: { token }, timeoutMs: 8000 });
  } catch {
    // Best effort — a stale token is dropped by the server on first failed send.
  }
}

/** Where a tapped notification should take the person, from its payload. */
export function routeForNotification(data: unknown): '/(tabs)/reviews' | null {
  if (!data || typeof data !== 'object') return null;
  const screen = (data as { screen?: unknown }).screen;
  return screen === 'reviews' ? '/(tabs)/reviews' : null;
}
