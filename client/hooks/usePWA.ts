import { useState, useEffect, useCallback } from 'react';
import { offlineStorageService } from '@/lib/offlineStorage';
import { pushNotificationService, NotificationTemplates } from '@/lib/pushNotifications';

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  installPromptEvent: any;
  hasNotificationPermission: boolean;
  isNotificationSupported: boolean;
  isSyncPending: boolean;
}

interface PWAActions {
  installApp: () => Promise<boolean>;
  requestNotificationPermission: () => Promise<boolean>;
  showTestNotification: () => Promise<void>;
  updateApp: () => Promise<void>;
  retrySync: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
}

export function usePWA(): PWAState & PWAActions {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isOnline: navigator.onLine,
    isUpdateAvailable: false,
    installPromptEvent: null,
    hasNotificationPermission: Notification.permission === 'granted',
    isNotificationSupported: pushNotificationService.isSupported,
    isSyncPending: false
  });

  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if app is installed (running in standalone mode)
  const checkInstallStatus = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const isWebKit = 'standalone' in window.navigator && (window.navigator as any).standalone;
    
    setState(prev => ({ 
      ...prev, 
      isInstalled: isStandalone || isFullscreen || isWebKit 
    }));
  }, []);

  // Service Worker registration and update handling
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        setServiceWorkerRegistration(registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState(prev => ({ ...prev, isUpdateAvailable: true }));
              }
            });
          }
        });
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, payload } = event.data;
        
        switch (type) {
          case 'SW_UPDATE_AVAILABLE':
            setState(prev => ({ ...prev, isUpdateAvailable: true }));
            break;
          case 'SW_CACHE_UPDATED':
            console.log('Cache updated:', payload);
            break;
          case 'SYNC_PROGRESS':
            setState(prev => ({ ...prev, isSyncPending: payload.pending > 0 }));
            break;
        }
      });
    }
  }, []);

  // Install prompt handling
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setState(prev => ({ ...prev, installPromptEvent: e }));
    };

    const handleAppInstalled = () => {
      setState(prev => ({ 
        ...prev, 
        isInstalled: true, 
        installPromptEvent: null 
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync queue monitoring
  useEffect(() => {
    const checkSyncStatus = () => {
      setState(prev => ({ 
        ...prev, 
        isSyncPending: offlineStorageService.queueLength > 0 
      }));
    };

    // Check every 30 seconds
    const interval = setInterval(checkSyncStatus, 30000);
    checkSyncStatus(); // Initial check

    return () => clearInterval(interval);
  }, []);

  // Check install status on mount
  useEffect(() => {
    checkInstallStatus();
  }, [checkInstallStatus]);

  // Actions
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!state.installPromptEvent) {
      return false;
    }

    try {
      await state.installPromptEvent.prompt();
      const result = await state.installPromptEvent.userChoice;
      
      if (result.outcome === 'accepted') {
        setState(prev => ({ ...prev, installPromptEvent: null }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to install app:', error);
      return false;
    }
  }, [state.installPromptEvent]);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await pushNotificationService.requestPermission();
      const granted = result.permission === 'granted';
      
      setState(prev => ({ ...prev, hasNotificationPermission: granted }));
      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  const showTestNotification = useCallback(async (): Promise<void> => {
    if (!state.hasNotificationPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }

    await pushNotificationService.testNotification();
  }, [state.hasNotificationPermission, requestNotificationPermission]);

  const updateApp = useCallback(async (): Promise<void> => {
    if (serviceWorkerRegistration?.waiting) {
      serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [serviceWorkerRegistration]);

  const retrySync = useCallback(async (): Promise<void> => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if ('sync' in registration) {
          (registration as any).sync.register('sync-data');
        }
      });
    }
  }, []);

  const clearOfflineData = useCallback(async (): Promise<void> => {
    await offlineStorageService.clearAllData();
    setState(prev => ({ ...prev, isSyncPending: false }));
  }, []);

  return {
    ...state,
    installApp,
    requestNotificationPermission,
    showTestNotification,
    updateApp,
    retrySync,
    clearOfflineData
  };
}

// Hook for offline data management
export function useOfflineData() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveForLater = useCallback(async (type: string, data: any): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const id = await offlineStorageService.saveDraft(type, data);
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save data';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const drafts = await offlineStorageService.getDrafts();
      return drafts;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load drafts';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncData = useCallback(async () => {
    if (!navigator.onLine) {
      setError('Cannot sync while offline');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Trigger sync via service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.sync) {
          await registration.sync.register('sync-data');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    saveForLater,
    loadDrafts,
    syncData,
    queueLength: offlineStorageService.queueLength,
    isOnline: navigator.onLine
  };
}

// Hook for notification management
export function useNotifications() {
  const [preferences, setPreferences] = useState({
    projectUpdates: true,
    deadlineReminders: true,
    teamNotifications: true,
    marketingUpdates: false,
    emailBackup: true
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      const prefs = await pushNotificationService.getNotificationPreferences();
      if (prefs) {
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (newPreferences: Partial<typeof preferences>) => {
    setIsLoading(true);
    try {
      const updatedPrefs = { ...preferences, ...newPreferences };
      await pushNotificationService.updateNotificationPreferences(updatedPrefs);
      setPreferences(updatedPrefs);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendNotification = useCallback(async (type: keyof typeof NotificationTemplates, ...args: any[]) => {
    try {
      if (Notification.permission === 'granted') {
        const template = NotificationTemplates[type];
        if (template) {
          await pushNotificationService.showLocalNotification(template(...args));
        }
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }, []);

  return {
    preferences,
    isLoading,
    updatePreferences,
    sendNotification,
    isSupported: pushNotificationService.isSupported,
    permission: pushNotificationService.permission,
    isSubscribed: pushNotificationService.isSubscribed
  };
}

// Hook for PWA installation detection and prompts
export function useInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      const isWebKit = 'standalone' in window.navigator && (window.navigator as any).standalone;
      
      setIsInstalled(isStandalone || isFullscreen || isWebKit);
    };

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    checkInstalled();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        setIsInstallable(false);
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }, [installPrompt]);

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    canInstall: isInstallable && installPrompt
  };
}

export default usePWA;
