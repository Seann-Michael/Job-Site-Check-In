import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  Lock,
} from "lucide-react";
import {
  OnboardingSession,
  PlatformConfiguration,
  OAuthFlowState,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DESCRIPTIONS,
  PlatformStatus,
  CustomPlatform,
  CustomPlatformField,
} from "../../types/oauth";

interface ClientOnboardingPortalProps {
  onboardingToken: string;
  onComplete?: (sessionId: string) => void;
}

interface PlatformCardProps {
  platform: PlatformConfiguration;
  flowState: OAuthFlowState;
  onConnect: (platform: string) => void;
  onRetry: (platform: string) => void;
  disabled?: boolean;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  flowState,
  onConnect,
  onRetry,
  disabled = false,
}) => {
  const getStatusColor = (status: PlatformStatus) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-blue-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (flowState: OAuthFlowState) => {
    if (flowState.isConnected) return "Connected ✓";
    if (flowState.isLoading) return "Connecting...";
    if (flowState.error) return "Error ⚠️";
    return "Not Connected";
  };

  const getButtonText = (flowState: OAuthFlowState) => {
    if (flowState.isConnected)
      return `Connected to ${flowState.accountInfo?.accountName || "Account"}`;
    if (flowState.isLoading) return "Connecting...";
    if (flowState.error && flowState.retryCount > 0) return `Retry Connection`;
    return `Connect ${platform.display_name}`;
  };

  const getButtonVariant = (flowState: OAuthFlowState) => {
    if (flowState.isConnected) return "default";
    if (flowState.error) return "destructive";
    return "outline";
  };

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-md ${flowState.isConnected ? "ring-2 ring-green-500" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {platform.icon_url && (
              <img
                src={platform.icon_url}
                alt={platform.display_name}
                className="w-8 h-8 object-contain"
              />
            )}
            <div>
              <CardTitle className="text-lg">{platform.display_name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-2 h-2 rounded-full ${getStatusColor(flowState.isConnected ? "connected" : flowState.isLoading ? "connecting" : flowState.error ? "error" : "not_connected")}`}
                />
                <span className="text-sm text-muted-foreground">
                  {getStatusText(flowState)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription>{platform.description}</CardDescription>

        {/* Required Permissions */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Required Permissions:</p>
          <div className="flex flex-wrap gap-1">
            {platform.scopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="text-xs">
                {scope
                  .replace("https://www.googleapis.com/auth/", "")
                  .replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>

        {/* Account Info (when connected) */}
        {flowState.isConnected && flowState.accountInfo && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Connected Successfully</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Account:{" "}
              {flowState.accountInfo.accountName || flowState.accountInfo.email}
            </p>
          </div>
        )}

        {/* Error Message */}
        {flowState.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {flowState.error}
              {flowState.retryCount > 0 && (
                <span className="block mt-1 text-sm">
                  Retry attempt {flowState.retryCount}/3
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Connect Button */}
        <Button
          onClick={() => {
            if (flowState.error) {
              onRetry(platform.platform);
            } else if (!flowState.isConnected) {
              onConnect(platform.platform);
            }
          }}
          disabled={disabled || flowState.isLoading || flowState.isConnected}
          variant={getButtonVariant(flowState)}
          className="w-full"
        >
          {flowState.isLoading && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          {flowState.isConnected && <CheckCircle className="h-4 w-4 mr-2" />}
          {flowState.error && <RefreshCw className="h-4 w-4 mr-2" />}
          {getButtonText(flowState)}
        </Button>
      </CardContent>
    </Card>
  );
};

export const ClientOnboardingPortal: React.FC<ClientOnboardingPortalProps> = ({
  onboardingToken,
  onComplete,
}) => {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [platforms, setPlatforms] = useState<PlatformConfiguration[]>([]);
  const [flowStates, setFlowStates] = useState<Record<string, OAuthFlowState>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate progress
  const connectedCount = Object.values(flowStates).filter(
    (state) => state.isConnected,
  ).length;
  const totalPlatforms = session?.required_platforms.length || 0;
  const progressPercentage =
    totalPlatforms > 0 ? (connectedCount / totalPlatforms) * 100 : 0;

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);

        // Load session details
        const sessionResponse = await fetch(
          `/api/oauth/onboarding/${onboardingToken}`,
        );
        if (!sessionResponse.ok) {
          throw new Error("Invalid or expired onboarding link");
        }
        const sessionData = await sessionResponse.json();
        setSession(sessionData.data);

        // Load platform configurations
        const platformsResponse = await fetch("/api/oauth/platforms");
        if (!platformsResponse.ok) {
          throw new Error("Failed to load platform configurations");
        }
        const platformsData = await platformsResponse.json();
        const availablePlatforms = platformsData.data.filter(
          (p: PlatformConfiguration) =>
            sessionData.data.required_platforms.includes(p.platform),
        );
        setPlatforms(availablePlatforms);

        // Initialize flow states
        const initialStates: Record<string, OAuthFlowState> = {};
        sessionData.data.required_platforms.forEach((platform: string) => {
          const connectedPlatform = sessionData.data.connected_platforms.find(
            (cp: any) => cp.platform === platform,
          );

          initialStates[platform] = {
            platform,
            isLoading: false,
            isConnected: connectedPlatform?.status === "connected",
            accountInfo: connectedPlatform?.account_name
              ? { accountName: connectedPlatform.account_name }
              : undefined,
            error:
              connectedPlatform?.status === "error"
                ? "Connection failed"
                : undefined,
            retryCount: 0,
          };
        });
        setFlowStates(initialStates);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [onboardingToken]);

  // Handle OAuth completion messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, platform, data, error } = event.data;

      setFlowStates((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          isLoading: type === "oauth_started",
          isConnected: type === "oauth_success",
          accountInfo:
            type === "oauth_success" ? data : prev[platform].accountInfo,
          error: type === "oauth_error" ? error : undefined,
          retryCount:
            type === "oauth_error"
              ? prev[platform].retryCount + 1
              : prev[platform].retryCount,
        },
      }));

      // Update session data when platform connects
      if (type === "oauth_success") {
        updateSessionStatus(platform, "connected", data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Check if onboarding is complete
  useEffect(() => {
    if (session && totalPlatforms > 0 && connectedCount === totalPlatforms) {
      // Mark session as completed
      updateSessionStatus(null, "completed");
      onComplete?.(session.id);
    }
  }, [connectedCount, totalPlatforms, session, onComplete]);

  const updateSessionStatus = async (
    platform: string | null,
    status: string,
    accountInfo?: any,
  ) => {
    try {
      await fetch(`/api/oauth/onboarding/${onboardingToken}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, status, accountInfo }),
      });
    } catch (error) {
      console.error("Failed to update session status:", error);
    }
  };

  const handleConnect = (platform: string) => {
    // Set loading state
    setFlowStates((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], isLoading: true, error: undefined },
    }));

    // Open OAuth popup
    const popup = window.open(
      `/api/oauth/${platform}/authorize?token=${onboardingToken}`,
      "oauth_popup",
      "width=600,height=700,scrollbars=yes,resizable=yes,left=" +
        (window.screen.width / 2 - 300) +
        ",top=" +
        (window.screen.height / 2 - 350),
    );

    // Monitor popup
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        // Reset loading state if popup was closed without completion
        setTimeout(() => {
          setFlowStates((prev) => ({
            ...prev,
            [platform]: { ...prev[platform], isLoading: false },
          }));
        }, 1000);
      }
    }, 1000);
  };

  const handleRetry = (platform: string) => {
    setFlowStates((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], error: undefined },
    }));
    handleConnect(platform);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading onboarding session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Onboarding Link Invalid</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.close()}
            >
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isExpired = new Date(session.expires_at) < new Date();
  const isCompleted = connectedCount === totalPlatforms && totalPlatforms > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="bg-white border-b shadow-sm sticky top-0 z-10"
        style={{
          borderTopColor: session.branding_config.primary_color,
          borderTopWidth: "4px",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {session.branding_config.logo_url && (
                <img
                  src={session.branding_config.logo_url}
                  alt="Company Logo"
                  className="h-10 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">
                  {session.branding_config.company_name ||
                    "Platform Onboarding"}
                </h1>
                <p className="text-muted-foreground">
                  Hi {session.client_name}, let's connect your marketing
                  platforms
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Progress</div>
              <div className="font-semibold">
                {connectedCount}/{totalPlatforms}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <Progress
              value={progressPercentage}
              className="h-2"
              style={{
                background: `linear-gradient(to right, ${session.branding_config.primary_color} 0%, ${session.branding_config.primary_color} ${progressPercentage}%, #e5e7eb ${progressPercentage}%, #e5e7eb 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Email Verification</span>
              <span>Platform Selection</span>
              <span>Connections</span>
              <span>Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isExpired && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This onboarding link has expired. Please contact your agency for a
              new link.
            </AlertDescription>
          </Alert>
        )}

        {isCompleted && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              🎉 Congratulations! All platforms have been connected
              successfully. Your agency now has access to manage your marketing
              accounts.
            </AlertDescription>
          </Alert>
        )}

        {/* Welcome Message */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">
            Connect Your Marketing Platforms
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Securely connect your marketing accounts to give{" "}
            {session.branding_config.company_name || "your agency"}
            {session.access_level === "read_only"
              ? " view access to your data"
              : " management access to your accounts"}
            .
          </p>
          <Badge variant="secondary" className="mt-2">
            {session.access_level === "read_only"
              ? "Read Only Access"
              : "Full Management Access"}
          </Badge>
        </div>

        {/* Platform Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {platforms.map((platform) => (
            <PlatformCard
              key={platform.platform}
              platform={platform}
              flowState={
                flowStates[platform.platform] || {
                  platform: platform.platform,
                  isLoading: false,
                  isConnected: false,
                  retryCount: 0,
                }
              }
              onConnect={handleConnect}
              onRetry={handleRetry}
              disabled={isExpired}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t pt-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <Button variant="link" size="sm" className="p-0 h-auto">
              <HelpCircle className="h-4 w-4 mr-1" />
              Need Help?
            </Button>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Your data is secure
            </div>
            <div className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              SSL Encrypted
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Powered by {session.branding_config.company_name || "Your Platform"}{" "}
            • This connection is secured with industry-standard OAuth 2.0
            authentication
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientOnboardingPortal;
