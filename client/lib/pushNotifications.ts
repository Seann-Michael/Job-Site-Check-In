import { supabaseClient } from "./supabaseClient";

interface NotificationPermissionResult {
  permission: NotificationPermission;
  subscription?: PushSubscription;
  error?: string;
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
  silent?: boolean;
  // vibrate?: number[]; // Not supported in standard NotificationOptions
}

export interface NotificationPreferences {
  projectUpdates: boolean;
  deadlineReminders: boolean;
  teamNotifications: boolean;
  marketingUpdates: boolean;
  emailBackup: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  projectUpdates: true,
  deadlineReminders: true,
  teamNotifications: true,
  marketingUpdates: false,
  emailBackup: false,
};

/**
 * Browser notification service.
 *
 * Local (in-page) notifications work whenever the browser supports the
 * Notification API and the user has granted permission.
 *
 * Web Push (server-sent) is DISABLED: there is no push backend in this app.
 * `isPushSupported` only becomes true when a VITE_VAPID_PUBLIC_KEY is set AND
 * a subscription endpoint exists — today neither does, so no subscription is
 * ever created and nothing is POSTed anywhere.
 *
 * Notification preferences persist to users.metadata.notification_preferences.
 */
class PushNotificationService {
  private readonly vapidPublicKey: string | null;

  constructor() {
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    this.vapidPublicKey = key && key.trim() ? key.trim() : null;
  }

  /** Ask for browser notification permission. Never creates a push subscription. */
  async requestPermission(): Promise<NotificationPermissionResult> {
    if (!("Notification" in window)) {
      return { permission: "denied", error: "Notifications not supported" };
    }
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    return { permission };
  }

  /** Web Push is not available (no backend). */
  async subscribe(): Promise<PushSubscription | null> {
    return null;
  }

  async unsubscribe(): Promise<boolean> {
    return true;
  }

  async showLocalNotification(options: NotificationOptions): Promise<void> {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || "/icon-192x192.png",
      badge: options.badge || "/icon-72x72.png",
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction,
      silent: options.silent,
    });

    notification.onclick = (event) => {
      event.preventDefault();
      notification.close();
      if (options.data?.url) {
        window.open(options.data.url, "_blank");
      }
    };

    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }
  }

  async testNotification(): Promise<void> {
    await this.showLocalNotification({
      title: "Local SEO Ranker",
      body: "Browser notifications are working.",
      tag: "test-notification",
      data: { url: "/admin/jobs" },
    });
  }

  private async currentUserId(): Promise<string | null> {
    const { data } = await supabaseClient.auth.getUser();
    return data.user?.id ?? null;
  }

  async getNotificationPreferences(): Promise<NotificationPreferences | null> {
    try {
      const uid = await this.currentUserId();
      if (!uid) return null;
      const { data, error } = await supabaseClient
        .from("users")
        .select("metadata")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      const prefs = (data?.metadata as Record<string, any> | null)?.notification_preferences;
      return prefs && typeof prefs === "object"
        ? { ...DEFAULT_PREFERENCES, ...(prefs as Partial<NotificationPreferences>) }
        : null;
    } catch (error) {
      console.error("Failed to get notification preferences:", error);
      return null;
    }
  }

  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    const uid = await this.currentUserId();
    if (!uid) throw new Error("Not signed in");
    const { data, error: readError } = await supabaseClient
      .from("users")
      .select("metadata")
      .eq("id", uid)
      .maybeSingle();
    if (readError) throw readError;
    const existing = (data?.metadata as Record<string, any>) || {};
    const metadata = {
      ...existing,
      notification_preferences: {
        ...DEFAULT_PREFERENCES,
        ...(existing.notification_preferences || {}),
        ...preferences,
      },
    };
    const { error } = await supabaseClient
      .from("users")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", uid);
    if (error) throw error;
  }

  // Getters
  /** Local browser notifications are available. */
  get isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  /** Server-sent Web Push. Always false until a push backend exists. */
  get isPushSupported(): boolean {
    return false;
  }

  get hasVapidKey(): boolean {
    return this.vapidPublicKey !== null;
  }

  get permission(): NotificationPermission {
    return "Notification" in window ? Notification.permission : "denied";
  }

  get isSubscribed(): boolean {
    return false;
  }

  get subscriptionInfo(): PushSubscription | null {
    return null;
  }
}

// Notification templates for common use cases
export const NotificationTemplates = {
  projectDeadline: (
    projectName: string,
    daysLeft: number,
  ): NotificationOptions => ({
    title: "Project Deadline Reminder",
    body: `"${projectName}" is due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    tag: "deadline-reminder",
    requireInteraction: true,
    data: { type: "deadline", url: "/admin/jobs" },
    actions: [
      { action: "view", title: "View Job" },
      { action: "snooze", title: "Remind Later" },
    ],
  }),

  newMessage: (senderName: string, preview: string): NotificationOptions => ({
    title: `New message from ${senderName}`,
    body: preview,
    tag: "new-message",
    data: { type: "message", url: "/notifications" },
    actions: [
      { action: "reply", title: "Reply" },
      { action: "view", title: "View Messages" },
    ],
  }),

  taskAssigned: (
    taskName: string,
    assignedBy: string,
  ): NotificationOptions => ({
    title: "New Task Assigned",
    body: `"${taskName}" has been assigned to you by ${assignedBy}`,
    tag: "task-assigned",
    requireInteraction: true,
    data: { type: "task", url: "/admin/jobs" },
    actions: [
      { action: "view", title: "View Task" },
      { action: "accept", title: "Accept" },
    ],
  }),

  systemUpdate: (version: string): NotificationOptions => ({
    title: "App Update Available",
    body: `Version ${version} is now available with new features and improvements`,
    tag: "system-update",
    data: { type: "update", url: "/admin/settings" },
    actions: [
      { action: "update", title: "Update Now" },
      { action: "later", title: "Later" },
    ],
  }),

  backupComplete: (itemCount: number): NotificationOptions => ({
    title: "Backup Complete",
    body: `Successfully backed up ${itemCount} items`,
    tag: "backup-complete",
    data: { type: "backup" },
  }),
};

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
