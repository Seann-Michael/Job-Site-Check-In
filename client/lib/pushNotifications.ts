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
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  deviceType: string;
  userAgent: string;
}

class PushNotificationService {
  private vapidPublicKey: string;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  constructor() {
    // VAPID public key - this should be stored in environment variables
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BNxEcAeqCLnHqXmJ8lQn...'; // Placeholder
    this.initialize();
  }

  private async initialize() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return;
    }

    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      await this.checkExistingSubscription();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  private async checkExistingSubscription() {
    if (!this.serviceWorkerRegistration) return;

    try {
      this.subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('Existing push subscription found');
        await this.syncSubscriptionWithServer();
      }
    } catch (error) {
      console.error('Error checking existing subscription:', error);
    }
  }

  async requestPermission(): Promise<NotificationPermissionResult> {
    if (!('Notification' in window)) {
      return {
        permission: 'denied',
        error: 'Notifications not supported'
      };
    }

    // Check current permission
    let permission = Notification.permission;

    // Request permission if not already granted
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      try {
        const subscription = await this.subscribe();
        return {
          permission,
          subscription
        };
      } catch (error) {
        return {
          permission,
          error: error instanceof Error ? error.message : 'Failed to subscribe'
        };
      }
    }

    return { permission };
  }

  async subscribe(): Promise<PushSubscription> {
    if (!this.serviceWorkerRegistration) {
      throw new Error('Service worker not ready');
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.subscription = subscription;
      await this.syncSubscriptionWithServer();
      
      console.log('Push subscription successful');
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        await this.removeSubscriptionFromServer();
        this.subscription = null;
        console.log('Successfully unsubscribed from push notifications');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  private async syncSubscriptionWithServer(): Promise<void> {
    if (!this.subscription) return;

    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: this.subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(this.subscription.getKey('auth'))
        },
        deviceType: this.getDeviceType(),
        userAgent: navigator.userAgent
      };

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(subscriptionData)
      });

      console.log('Subscription synced with server');
    } catch (error) {
      console.error('Failed to sync subscription with server:', error);
    }
  }

  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      console.log('Subscription removed from server');
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  async showLocalNotification(options: NotificationOptions): Promise<void> {
    if (Notification.permission !== 'granted') {
      console.warn('Cannot show notification: permission not granted');
      return;
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icon-192x192.png',
      badge: options.badge || '/icon-72x72.png',
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction,
      silent: options.silent,
      vibrate: options.vibrate || [200, 100, 200]
    });

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      notification.close();
      
      // Focus or open app window
      if (options.data?.url) {
        window.open(options.data.url, '_blank');
      }
    };

    // Auto-close after 5 seconds if not requireInteraction
    if (!options.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  async testNotification(): Promise<void> {
    await this.showLocalNotification({
      title: 'Local SEO Ranker',
      body: 'Push notifications are working! 🎉',
      tag: 'test-notification',
      data: { url: '/admin/projects' }
    });
  }

  // Notification management methods
  async getNotificationPreferences() {
    try {
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return null;
    }
  }

  async updateNotificationPreferences(preferences: {
    projectUpdates?: boolean;
    deadlineReminders?: boolean;
    teamNotifications?: boolean;
    marketingUpdates?: boolean;
    emailBackup?: boolean;
  }) {
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(preferences)
      });
      console.log('Notification preferences updated');
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  }

  // Utility methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/android/.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/windows/.test(userAgent)) return 'windows';
    if (/macintosh|mac os/.test(userAgent)) return 'macos';
    if (/linux/.test(userAgent)) return 'linux';
    
    return 'desktop';
  }

  private getAuthToken(): string {
    // Get auth token from your auth system
    return localStorage.getItem('auth_token') || '';
  }

  // Getters
  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  get permission(): NotificationPermission {
    return Notification.permission;
  }

  get isSubscribed(): boolean {
    return this.subscription !== null;
  }

  get subscriptionInfo(): PushSubscription | null {
    return this.subscription;
  }
}

// Notification templates for common use cases
export const NotificationTemplates = {
  projectDeadline: (projectName: string, daysLeft: number): NotificationOptions => ({
    title: 'Project Deadline Reminder',
    body: `"${projectName}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    tag: 'deadline-reminder',
    requireInteraction: true,
    data: { type: 'deadline', url: '/admin/projects' },
    actions: [
      { action: 'view', title: 'View Project' },
      { action: 'snooze', title: 'Remind Later' }
    ]
  }),

  newMessage: (senderName: string, preview: string): NotificationOptions => ({
    title: `New message from ${senderName}`,
    body: preview,
    tag: 'new-message',
    data: { type: 'message', url: '/chat' },
    actions: [
      { action: 'reply', title: 'Reply' },
      { action: 'view', title: 'View Chat' }
    ]
  }),

  taskAssigned: (taskName: string, assignedBy: string): NotificationOptions => ({
    title: 'New Task Assigned',
    body: `"${taskName}" has been assigned to you by ${assignedBy}`,
    tag: 'task-assigned',
    requireInteraction: true,
    data: { type: 'task', url: '/admin/projects' },
    actions: [
      { action: 'view', title: 'View Task' },
      { action: 'accept', title: 'Accept' }
    ]
  }),

  systemUpdate: (version: string): NotificationOptions => ({
    title: 'App Update Available',
    body: `Version ${version} is now available with new features and improvements`,
    tag: 'system-update',
    data: { type: 'update', url: '/admin/settings' },
    actions: [
      { action: 'update', title: 'Update Now' },
      { action: 'later', title: 'Later' }
    ]
  }),

  backupComplete: (itemCount: number): NotificationOptions => ({
    title: 'Backup Complete',
    body: `Successfully backed up ${itemCount} items`,
    tag: 'backup-complete',
    data: { type: 'backup' }
  })
};

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
