import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, X, RefreshCw, Info } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { toast } from "sonner";

interface UpdateNotificationProps {
  onClose?: () => void;
}

export function UpdateNotification({ onClose }: UpdateNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const { track } = useAnalytics();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setRegistration(reg);

          // Check for updates immediately
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  setIsVisible(true);
                  track("app_update_available");
                }
              });
            }
          });

          // Check if there's already a waiting worker
          if (reg.waiting) {
            setIsVisible(true);
            track("app_update_available");
          }
        }
      });
    }
  }, [track]);

  const handleUpdate = async () => {
    if (!registration?.waiting) return;

    setIsUpdating(true);
    track("app_update_started");

    try {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: "SKIP_WAITING" });

      // Listen for the controlling change and reload
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        track("app_update_completed");
        window.location.reload();
      });
    } catch (error) {
      track("app_update_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("The update couldn't be applied. Please reload the page.");
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    track("app_update_dismissed");
    onClose?.();
  };

  const handlePostpone = () => {
    setIsVisible(false);
    track("app_update_postponed");

    // Show again after 1 hour
    setTimeout(
      () => {
        setIsVisible(true);
      },
      60 * 60 * 1000,
    );

    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-600" />
              App Update Available
            </CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              New
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            A new version of Local SEO Ranker is available with improvements and bug
            fixes.
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full gap-2"
              size="sm"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Update Now
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePostpone}
                className="flex-1"
              >
                Later
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="flex-1"
              >
                <X className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Updates include enhanced file optimization and performance
            improvements.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// PWA Install Prompt
export function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { track } = useAnalytics();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
      track("pwa_install_prompt_triggered");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Hide prompt if app is already installed
    window.addEventListener("appinstalled", () => {
      setIsVisible(false);
      track("pwa_installed");
    });

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, [track]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    track("pwa_install_clicked");

    const result = await deferredPrompt.prompt();
    track("pwa_install_result", { outcome: result.outcome });

    if (result.outcome === "accepted") {
      setIsVisible(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    track("pwa_install_dismissed");

    // Don't show again for this session
    setDeferredPrompt(null);
  };

  if (!isVisible || !deferredPrompt) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4 text-green-600" />
              Install Local SEO Ranker
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Install Local SEO Ranker on your device for faster access and offline
            capabilities.
          </div>

          <Button onClick={handleInstall} className="w-full gap-2" size="sm">
            <Download className="h-4 w-4" />
            Install App
          </Button>

          <div className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Works offline and loads faster when installed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Combined notification manager
export function AppNotifications() {
  return (
    <>
      <UpdateNotification />
      <InstallPrompt />
    </>
  );
}
