/**
 * Local job reminders — "job starts today" notifications at 7:30 AM on each
 * upcoming job's start date. Local notifications work in Expo Go; remote push
 * arrives with the dev-build milestone. Governed by the Notifications
 * settings page's "Job updates" toggle.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Job } from '@/lib/types';

const PREFS_KEY = 'lsr-notification-prefs-v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function jobRemindersEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return true; // default on
    const prefs = JSON.parse(raw) as { jobUpdates?: boolean };
    return prefs.jobUpdates !== false;
  } catch {
    return true;
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (!settings.canAskAgain) return false;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

function startDateOf(job: Job): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(job.start_date);
  if (!dateOnly) return null;
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 7, 30);
}

/**
 * Re-sync scheduled reminders to the current job list: one notification per
 * upcoming job (next 14 days), replacing everything scheduled before.
 */
export async function syncJobReminders(jobs: Job[]): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await jobRemindersEnabled())) {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
    return;
  }
  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) return; // Don't prompt from a background sync.

  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);

  const now = Date.now();
  const horizon = now + 14 * 24 * 60 * 60 * 1000;
  const upcoming = jobs.filter((job) => {
    if (job.status === 'completed' || job.status === 'cancelled') return false;
    const start = startDateOf(job);
    return start !== null && start.getTime() > now && start.getTime() < horizon;
  });

  for (const job of upcoming.slice(0, 20)) {
    const start = startDateOf(job);
    if (!start) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Job starts today',
        body: `${job.title} — ${[job.address, job.city].filter(Boolean).join(', ')}`,
        data: { jobId: job.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: start },
    }).catch(() => undefined);
  }
}
