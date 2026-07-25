import { Alert, Platform } from 'react-native';

import type { JobStatus, ReviewRequestStatus } from '@/lib/types';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Date-only strings ('2026-07-21') parse as UTC midnight, which renders a day
 * early in US timezones — parse them as local dates instead.
 */
function parseDate(iso: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(iso);
}

export function formatDate(iso: string): string {
  const date = parseDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function timeAgo(iso: string): string {
  const date = parseDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDate(iso);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  in_progress: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const REVIEW_STATUS_LABELS: Record<ReviewRequestStatus, string> = {
  sent: 'Sent',
  viewed: 'Viewed',
  completed: 'Completed',
  expired: 'Expired',
  scheduled: 'Scheduled',
};

/** Cross-platform alert — Alert.alert is a no-op on react-native-web. */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
