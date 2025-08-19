import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { 
  PLATFORM_DISPLAY_NAMES,
  OAuthPopupMessage 
} from '../../types/oauth';

interface OAuthPopupProps {
  platform: string;
  onboardingToken?: string;
  authUrl: string;
  onMessage?: (message: OAuthPopupMessage) => void;
}

interface OAuthPopupState {
  status: 'loading' | 'iframe' | 'success' | 'error' | 'cancelled';
  message?: string;
  accountInfo?: any;
  error?: string;
  errorCode?: string;
  retryCount: number;
}

export const OAuthPopup: React.FC<OAuthPopupProps> = ({
  platform,
  onboardingToken,
  authUrl,
  onMessage
}) => {
  const [state, setState] = useState<OAuthPopupState>({
    status: 'loading',
    retryCount: 0
  });

  const platformName = PLATFORM_DISPLAY_NAMES[platform as keyof typeof PLATFORM_DISPLAY_NAMES] || platform;

  useEffect(() => {
    // Notify parent that OAuth has started
    const startMessage: OAuthPopupMessage = {
      type: 'oauth_started',
      platform
    };
    onMessage?.(startMessage);
    window.parent?.postMessage(startMessage, window.location.origin);

    // Start OAuth flow
    startOAuthFlow();

    // Set up message listener for OAuth completion
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, data, error, code } = event.data;
      
      if (type === 'oauth_callback') {
        if (data && data.success) {
          handleOAuthSuccess(data);
        } else {
          handleOAuthError(error || 'OAuth failed', code);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Set up auto-close timer for success state
    let autoCloseTimer: NodeJS.Timeout;
    if (state.status === 'success') {
      autoCloseTimer = setTimeout(() => {
        window.close();
      }, 3000);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
    };
  }, [platform, onMessage, state.status]);

  const startOAuthFlow = () => {
    setState(prev => ({ ...prev, status: 'iframe' }));
  };

  const handleOAuthSuccess = (data: any) => {
    const accountInfo = data.accountInfo || data.account || {};
    
    setState({
      status: 'success',
      message: `Successfully connected to ${platformName}!`,
      accountInfo,
      retryCount: 0
    });

    const successMessage: OAuthPopupMessage = {
      type: 'oauth_success',
      platform,
      data: accountInfo
    };
    
    onMessage?.(successMessage);
    window.parent?.postMessage(successMessage, window.location.origin);
  };

  const handleOAuthError = (error: string, code?: string) => {
    setState(prev => ({
      ...prev,
      status: 'error',
      error,
      errorCode: code,
      retryCount: prev.retryCount + 1
    }));

    const errorMessage: OAuthPopupMessage = {
      type: 'oauth_error',
      platform,
      error,
      code
    };
    
    onMessage?.(errorMessage);
    window.parent?.postMessage(errorMessage, window.location.origin);
  };

  const handleCancel = () => {
    setState(prev => ({ ...prev, status: 'cancelled' }));

    const cancelMessage: OAuthPopupMessage = {
      type: 'oauth_cancelled',
      platform
    };
    
    onMessage?.(cancelMessage);
    window.parent?.postMessage(cancelMessage, window.location.origin);
    
    window.close();
  };

  const handleRetry = () => {
    setState(prev => ({
      ...prev,
      status: 'loading',
      error: undefined,
      errorCode: undefined
    }));
    
    startOAuthFlow();
  };

  const renderContent = () => {
    switch (state.status) {
      case 'loading':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <img 
                src={`/icons/${platform}.svg`} 
                alt={platformName}
                className="w-16 h-16 mx-auto mb-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Connecting to {platformName}...
            </h2>
            <p className="text-gray-600 mb-6">
              This may take a few moments
            </p>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        );

      case 'iframe':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                Connect {platformName}
              </h2>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 relative">
              <iframe
                src={authUrl}
                className="w-full h-full border-0"
                title={`${platformName} OAuth`}
                onLoad={() => {
                  // Handle iframe load events if needed
                }}
                onError={() => {
                  handleOAuthError('Failed to load OAuth page', 'IFRAME_ERROR');
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    Having trouble? Try opening in a new tab
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(authUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="relative">
                <img 
                  src={`/icons/${platform}.svg`} 
                  alt={platformName}
                  className="w-16 h-16 mx-auto mb-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="animate-pulse">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-green-700 mb-2">
              Successfully connected to {platformName}!
            </h2>
            {state.accountInfo?.accountName && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-800">
                  <span className="font-medium">Account:</span> {state.accountInfo.accountName}
                </p>
                {state.accountInfo.email && (
                  <p className="text-green-700 text-sm">
                    {state.accountInfo.email}
                  </p>
                )}
              </div>
            )}
            <p className="text-gray-600 mb-6">
              You can close this window
            </p>
            <div className="space-y-2">
              <Button onClick={() => window.close()}>
                Close Window
              </Button>
              <p className="text-xs text-gray-500">
                Auto-closing in 3 seconds...
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <img 
                src={`/icons/${platform}.svg`} 
                alt={platformName}
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            </div>
            <h2 className="text-xl font-semibold text-red-700 mb-4">
              Connection Failed
            </h2>
            
            <Alert variant="destructive" className="mb-6 text-left max-w-md mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>{getErrorMessage(state.error, state.errorCode)}</p>
                  {state.retryCount > 0 && (
                    <p className="text-sm">
                      Retry attempt {state.retryCount}/3
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {state.retryCount < 3 && (
                <Button onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              <div className="space-x-3">
                <Button variant="outline" onClick={() => window.close()}>
                  Close Window
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open('mailto:support@example.com', '_blank')}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        );

      case 'cancelled':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <X className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Connection Cancelled
            </h2>
            <p className="text-gray-600 mb-6">
              You cancelled the connection to {platformName}
            </p>
            <Button variant="outline" onClick={() => window.close()}>
              Close Window
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getErrorMessage = (error?: string, code?: string): string => {
    if (code) {
      switch (code) {
        case 'ACCESS_DENIED':
          return 'Access denied. Please approve all permissions to continue.';
        case 'INVALID_ACCOUNT':
          return 'Account not found. Please check your login credentials.';
        case 'RATE_LIMITED':
          return 'Too many attempts. Please wait 5 minutes before trying again.';
        case 'NETWORK_ERROR':
          return 'Network connection failed. Please check your internet connection.';
        case 'IFRAME_ERROR':
          return 'Failed to load the authentication page. Please try again.';
        case 'TIMEOUT':
          return 'Connection timed out. Please try again.';
        default:
          return error || 'An unexpected error occurred during authentication.';
      }
    }
    
    if (error) {
      // Handle common error messages
      if (error.includes('access_denied')) {
        return 'Access denied. Please approve all permissions to continue.';
      }
      if (error.includes('invalid_request')) {
        return 'Invalid request. Please try again or contact support.';
      }
      if (error.includes('unauthorized_client')) {
        return 'Unauthorized client. Please contact support.';
      }
      if (error.includes('server_error')) {
        return 'Server error. Please try again in a few minutes.';
      }
      return error;
    }
    
    return 'An unexpected error occurred during authentication.';
  };

  return (
    <div className="min-h-screen bg-white">
      {renderContent()}
    </div>
  );
};

// OAuth Popup Window Manager
export class OAuthPopupManager {
  private popups: Map<string, Window> = new Map();
  private callbacks: Map<string, (message: OAuthPopupMessage) => void> = new Map();

  constructor() {
    // Listen for messages from popup windows
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;

    const message = event.data as OAuthPopupMessage;
    if (message.type && message.platform) {
      const callback = this.callbacks.get(message.platform);
      callback?.(message);

      // Clean up on completion
      if (message.type === 'oauth_success' || message.type === 'oauth_error' || message.type === 'oauth_cancelled') {
        this.cleanup(message.platform);
      }
    }
  }

  openPopup(
    platform: string, 
    authUrl: string, 
    callback: (message: OAuthPopupMessage) => void
  ): Window | null {
    // Close existing popup for this platform
    this.closePopup(platform);

    // Open new popup
    const popup = window.open(
      authUrl,
      `oauth_${platform}`,
      'width=600,height=700,scrollbars=yes,resizable=yes,left=' +
      (window.screen.width / 2 - 300) + ',top=' + (window.screen.height / 2 - 350)
    );

    if (popup) {
      this.popups.set(platform, popup);
      this.callbacks.set(platform, callback);

      // Monitor for manual close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          callback({
            type: 'oauth_cancelled',
            platform
          });
          this.cleanup(platform);
        }
      }, 1000);
    }

    return popup;
  }

  closePopup(platform: string): void {
    const popup = this.popups.get(platform);
    if (popup && !popup.closed) {
      popup.close();
    }
    this.cleanup(platform);
  }

  private cleanup(platform: string): void {
    this.popups.delete(platform);
    this.callbacks.delete(platform);
  }

  closeAllPopups(): void {
    for (const [platform, popup] of this.popups) {
      if (!popup.closed) {
        popup.close();
      }
    }
    this.popups.clear();
    this.callbacks.clear();
  }
}

// Global popup manager instance
export const oauthPopupManager = new OAuthPopupManager();

export default OAuthPopup;
