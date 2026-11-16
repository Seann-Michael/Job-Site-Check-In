/**
 * Crash reporting — sends an uncaught error to the server so it reaches the
 * owner of the product without anyone screenshotting TestFlight.
 *
 * Three sources feed it: the root error boundary (render errors), the global
 * JS handler (errors outside React), and unhandled promise rejections that
 * surface through the same handler. Reports are best-effort and silent: a
 * failure to report must never become a second error on screen.
 *
 * A report needs a signed-in user (the endpoint is authenticated so it cannot
 * be flooded anonymously). A crash before sign-in is kept on the phone and
 * sent the next time the app starts with a session.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api';
import { isApiConfigured } from '@/lib/config';

const PENDING_KEY = 'crash-report.pending-v1';
const MAX_PENDING = 5;

interface Report {
  severity: 'fatal' | 'error';
  component: string;
  message: string;
  stack?: string;
  url?: string;
  userAgent: string;
}

function describeDevice(): string {
  const version = Constants.expoConfig?.version ?? '?';
  return `JobSiteCheckIn/${version} ${Platform.OS} ${String(Platform.Version)}`;
}

function toReport(error: unknown, severity: Report['severity'], where?: string): Report {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  return {
    severity,
    component: 'mobile',
    message: err.message || err.name || 'Unknown error',
    stack: err.stack,
    url: where,
    userAgent: describeDevice(),
  };
}

async function send(report: Report): Promise<boolean> {
  if (!isApiConfigured) return false;
  try {
    await apiFetch('/api/client-errors', { method: 'POST', body: { ...report }, timeoutMs: 8000 });
    return true;
  } catch {
    return false;
  }
}

async function readPending(): Promise<Report[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Report[]) : [];
  } catch {
    return [];
  }
}

async function keep(report: Report): Promise<void> {
  try {
    const pending = await readPending();
    pending.push(report);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(-MAX_PENDING)));
  } catch {
    // Nothing useful to do if the phone's storage is unavailable.
  }
}

/** Report one error. Never throws. */
export async function reportError(error: unknown, options: { fatal?: boolean; where?: string } = {}): Promise<void> {
  const report = toReport(error, options.fatal ? 'fatal' : 'error', options.where);
  if (!(await send(report))) await keep(report);
}

/** Send anything saved from an earlier session (e.g. a crash before sign-in). */
export async function flushPendingReports(): Promise<void> {
  const pending = await readPending();
  if (pending.length === 0) return;
  const unsent: Report[] = [];
  for (const report of pending) {
    if (!(await send(report))) unsent.push(report);
  }
  try {
    if (unsent.length === 0) await AsyncStorage.removeItem(PENDING_KEY);
    else await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(unsent));
  } catch {
    // Best effort.
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsShape {
  getGlobalHandler?: () => GlobalHandler;
  setGlobalHandler?: (handler: GlobalHandler) => void;
}

let installed = false;

/**
 * Chain onto React Native's global JS error handler. The previous handler is
 * always called afterwards so the platform's own behaviour (red box in
 * development, process exit on a fatal in release) is unchanged.
 */
export function installCrashReporting(): void {
  if (installed || Platform.OS === 'web') return;
  installed = true;
  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;
  const previous = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportError(error, { fatal: Boolean(isFatal), where: 'global' });
    previous?.(error, isFatal);
  });
}
