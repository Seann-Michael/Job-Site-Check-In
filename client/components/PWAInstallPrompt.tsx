import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Download, Smartphone, Monitor, Zap, Wifi, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
  showBenefits?: boolean;
}

export function PWAInstallPrompt({ 
  onInstall, 
  onDismiss,
  showBenefits = true 
}: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstallation = () => {
      // Check if running in standalone mode (installed PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      const isWebKit = 'standalone' in window.navigator && (window.navigator as any).standalone;
      
      if (isStandalone || isFullscreen || isWebKit) {
        setIsInstalled(true);
        return;
      }

      // Check if dismissed recently
      const dismissedTime = localStorage.getItem('pwa-install-dismissed');
      if (dismissedTime) {
        const dismissedDate = new Date(dismissedTime);
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) { // Don't show for 7 days after dismissal
          return;
        }
      }

      // Check if user has visited multiple times
      const visitCount = parseInt(localStorage.getItem('pwa-visit-count') || '0');
      localStorage.setItem('pwa-visit-count', (visitCount + 1).toString());
      
      // Show prompt after 3 visits
      if (visitCount >= 2) {
        setShowPrompt(true);
      }
    };

    // Listen for install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      checkInstallation();
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      toast.success('Local SEO Ranker installed successfully! 🎉');
      onInstall?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    checkInstallation();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstall]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback for browsers that don't support install prompt
      setShowBenefitsModal(true);
      return;
    }

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA install');
        setShowPrompt(false);
      } else {
        console.log('User dismissed PWA install');
        handleDismiss();
      }
    } catch (error) {
      console.error('Error during PWA install:', error);
      toast.error('Installation failed. Please try again.');
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    onDismiss?.();
  };

  const getPlatformInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      return {
        browser: 'Chrome',
        instructions: [
          'Click the three dots menu (⋮) in the top right',
          'Select "Install Local SEO Ranker"',
          'Confirm installation'
        ]
      };
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      return {
        browser: 'Safari',
        instructions: [
          'Tap the Share button (□↗)',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to confirm'
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        browser: 'Firefox',
        instructions: [
          'Click the three lines menu (☰)',
          'Select "Install Local SEO Ranker"',
          'Confirm installation'
        ]
      };
    } else if (userAgent.includes('edg')) {
      return {
        browser: 'Edge',
        instructions: [
          'Click the three dots menu (⋯)',
          'Select "Apps" → "Install this site as an app"',
          'Confirm installation'
        ]
      };
    }
    
    return {
      browser: 'Browser',
      instructions: [
        'Look for an install icon in the address bar',
        'Or check your browser menu for install options',
        'Follow the prompts to install'
      ]
    };
  };

  if (isInstalled) {
    return null;
  }

  if (!showPrompt) {
    return null;
  }

  const benefits = [
    {
      icon: <Zap className="h-5 w-5 text-blue-500" />,
      title: "Faster Performance",
      description: "Lightning-fast loading and smooth animations"
    },
    {
      icon: <Wifi className="h-5 w-5 text-green-500" />,
      title: "Works Offline",
      description: "Access your projects even without internet"
    },
    {
      icon: <Bell className="h-5 w-5 text-purple-500" />,
      title: "Push Notifications",
      description: "Stay updated with project changes and deadlines"
    },
    {
      icon: <Smartphone className="h-5 w-5 text-orange-500" />,
      title: "Native Experience",
      description: "App-like experience on mobile and desktop"
    }
  ];

  return (
    <>
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Install Local SEO Ranker</CardTitle>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                PWA
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Get the full app experience with offline access and faster performance
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {showBenefits && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  {benefit.icon}
                  <div>
                    <p className="text-sm font-medium">{benefit.title}</p>
                    <p className="text-xs text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1"
            >
              {isInstalling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowBenefitsModal(true)}
              className="px-3"
            >
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showBenefitsModal} onOpenChange={setShowBenefitsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Install Local SEO Ranker
            </DialogTitle>
            <DialogDescription>
              Transform your browser experience into a native app
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid gap-4">
              <h4 className="font-medium">Why Install?</h4>
              <div className="grid gap-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    {benefit.icon}
                    <div>
                      <h5 className="font-medium">{benefit.title}</h5>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Installation Instructions ({getPlatformInstructions().browser})</h4>
              <ol className="space-y-2">
                {getPlatformInstructions().instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                      {index + 1}
                    </span>
                    <span className="text-sm">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleInstall} disabled={isInstalling} className="flex-1">
                {isInstalling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Install Now
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowBenefitsModal(false)}>
                Maybe Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PWAInstallPrompt;
