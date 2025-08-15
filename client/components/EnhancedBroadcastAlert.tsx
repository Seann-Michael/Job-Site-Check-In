import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  X,
  Calendar,
  Users,
  Settings,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatReadableDate } from "@/lib/dateUtils";
import { Link } from "react-router-dom";

interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  targetAudience:
    | "all"
    | "business-owners"
    | "agency-admins"
    | "staff"
    | "custom";
  customUserIds?: string[];
  scheduledFor?: string;
  createdAt: string;
  createdBy: string;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  sentAt?: string;
  viewCount: number;
  dismissCount: number;
  isActive: boolean;
  expiresAt?: string;
  category?: "system" | "marketing" | "support" | "emergency";
}

interface UserDismissal {
  userId: string;
  messageId: string;
  dismissedAt: string;
}

interface NotificationPreferences {
  enableNotifications: boolean;
  enableSounds: boolean;
  messageTypes: {
    info: boolean;
    warning: boolean;
    success: boolean;
    error: boolean;
  };
  categories: {
    system: boolean;
    marketing: boolean;
    support: boolean;
    emergency: boolean;
  };
  frequency: "immediate" | "hourly" | "daily" | "weekly";
  doNotDisturb: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    weekendsOnly: boolean;
  };
  autoMarkAsRead: boolean;
  showPreviews: boolean;
  groupSimilar: boolean;
}

export function EnhancedBroadcastAlert() {
  const [activeMessages, setActiveMessages] = useState<BroadcastMessage[]>([]);
  const [dismissedMessages, setDismissedMessages] = useState<string[]>([]);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPreviews, setShowPreviews] = useState(true);
  const [lastSoundTime, setLastSoundTime] = useState<number>(0);
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadUserPreferences();
    loadActiveMessages();
    loadUserDismissals();
  }, []);

  useEffect(() => {
    if (activeMessages.length > 0 && preferences) {
      checkForNewMessages();
    }
  }, [activeMessages, preferences]);

  const loadUserPreferences = () => {
    if (!currentUser) return;

    const userId = currentUser.id;
    const stored = localStorage.getItem(`notificationPreferences_${userId}`);

    if (stored) {
      const parsed = JSON.parse(stored);
      setPreferences(parsed);
      setSoundEnabled(parsed.enableSounds);
      setShowPreviews(parsed.showPreviews);
    } else {
      // Default preferences if none exist
      const defaultPrefs = {
        enableNotifications: true,
        enableSounds: true,
        messageTypes: { info: true, warning: true, success: true, error: true },
        categories: {
          system: true,
          marketing: true,
          support: true,
          emergency: true,
        },
        frequency: "immediate" as const,
        doNotDisturb: {
          enabled: false,
          startTime: "22:00",
          endTime: "08:00",
          weekendsOnly: false,
        },
        autoMarkAsRead: false,
        showPreviews: true,
        groupSimilar: true,
      };
      setPreferences(defaultPrefs);
    }
  };

  const loadActiveMessages = () => {
    const storedMessages = localStorage.getItem("broadcastMessages");
    if (!storedMessages) return;

    const allMessages: BroadcastMessage[] = JSON.parse(storedMessages);
    const now = new Date();

    // Filter messages that should be shown to current user
    const relevantMessages = allMessages.filter((message) => {
      // Only show sent and active messages
      if (message.status !== "sent" || !message.isActive) return false;

      // Check if message has expired
      if (message.expiresAt && new Date(message.expiresAt) < now) return false;

      // Check target audience
      if (message.targetAudience === "all") return true;

      if (!currentUser) return false;

      switch (message.targetAudience) {
        case "business-owners":
          return (
            currentUser.role === "admin" || currentUser.role === "editor"
          );
        case "agency-admins":
          return currentUser.role === "agency";
        case "staff":
          return currentUser.role === "viewer" || currentUser.role === "editor";
        case "custom":
          return message.customUserIds?.includes(currentUser.id) || false;
        default:
          return false;
      }
    });

    setActiveMessages(relevantMessages);
  };

  const loadUserDismissals = () => {
    if (!currentUser) return;

    const dismissals = localStorage.getItem("userMessageDismissals");
    if (!dismissals) return;

    const userDismissals: UserDismissal[] = JSON.parse(dismissals);
    const userDismissedIds = userDismissals
      .filter((d) => d.userId === currentUser.id)
      .map((d) => d.messageId);

    setDismissedMessages(userDismissedIds);
  };

  const checkForNewMessages = () => {
    if (!preferences?.enableSounds || !soundEnabled) return;

    const now = Date.now();
    // Only play sound if it's been more than 30 seconds since last sound
    if (now - lastSoundTime < 30000) return;

    // Check if it's during Do Not Disturb hours
    if (isDoNotDisturbTime()) return;

    // Play notification sound (in a real app, you'd play an actual sound file)
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+jyr2YdBzaH",
      );
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore errors if audio can't play
      });
      setLastSoundTime(now);
    } catch (error) {
      // Ignore audio errors
    }
  };

  const isDoNotDisturbTime = (): boolean => {
    if (!preferences?.doNotDisturb.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const startTime = parseInt(
      preferences.doNotDisturb.startTime.replace(":", ""),
    );
    const endTime = parseInt(preferences.doNotDisturb.endTime.replace(":", ""));

    // Check if it's weekend and weekendsOnly is true
    if (preferences.doNotDisturb.weekendsOnly) {
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      if (!isWeekend) return false;
    }

    // Handle overnight periods (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  };

  const shouldShowMessage = (message: BroadcastMessage): boolean => {
    if (!preferences) return true;

    // Check global notification setting
    if (!preferences.enableNotifications) return false;

    // Check message type preference
    if (!preferences.messageTypes[message.type]) return false;

    // Check category preference
    if (message.category && !preferences.categories[message.category])
      return false;

    // Check frequency preference (for immediate, always show; for digest, this would be handled elsewhere)
    if (preferences.frequency !== "immediate") {
      // In a real implementation, digest messages would be handled by a separate system
      // For now, we'll still show them immediately but mark them for digest processing
    }

    return true;
  };

  const handleDismissMessage = (messageId: string) => {
    if (!currentUser) return;

    // Update local state
    setDismissedMessages((prev) => [...prev, messageId]);

    // Save dismissal to localStorage
    const dismissals = localStorage.getItem("userMessageDismissals");
    const existingDismissals: UserDismissal[] = dismissals
      ? JSON.parse(dismissals)
      : [];

    const newDismissal: UserDismissal = {
      userId: currentUser.id,
      messageId,
      dismissedAt: new Date().toISOString(),
    };

    const updatedDismissals = [...existingDismissals, newDismissal];
    localStorage.setItem(
      "userMessageDismissals",
      JSON.stringify(updatedDismissals),
    );

    // Update message dismiss count
    const storedMessages = localStorage.getItem("broadcastMessages");
    if (storedMessages) {
      const messages: BroadcastMessage[] = JSON.parse(storedMessages);
      const updatedMessages = messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, dismissCount: msg.dismissCount + 1 }
          : msg,
      );
      localStorage.setItem(
        "broadcastMessages",
        JSON.stringify(updatedMessages),
      );
    }

    // Auto-mark as read if preference is enabled
    if (preferences?.autoMarkAsRead) {
      handleViewMessage(messageId);
    }
  };

  const handleViewMessage = (messageId: string) => {
    // Update message view count
    const storedMessages = localStorage.getItem("broadcastMessages");
    if (!storedMessages) return;

    const messages: BroadcastMessage[] = JSON.parse(storedMessages);
    const updatedMessages = messages.map((msg) =>
      msg.id === messageId ? { ...msg, viewCount: msg.viewCount + 1 } : msg,
    );
    localStorage.setItem("broadcastMessages", JSON.stringify(updatedMessages));
  };

  const dismissAllMessages = () => {
    const visibleMessageIds = visibleMessages.map((m) => m.id);
    visibleMessageIds.forEach((id) => handleDismissMessage(id));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (
    type: string,
  ): "default" | "destructive" | undefined => {
    switch (type) {
      case "error":
        return "destructive";
      default:
        return "default";
    }
  };

  const getAlertStyle = (type: string) => {
    switch (type) {
      case "info":
        return "border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600";
      case "warning":
        return "border-yellow-200 bg-yellow-50 text-yellow-800 [&>svg]:text-yellow-600";
      case "success":
        return "border-green-200 bg-green-50 text-green-800 [&>svg]:text-green-600";
      case "error":
        return ""; // Use default destructive variant
      default:
        return "";
    }
  };

  // Filter messages based on preferences and dismissals
  const visibleMessages = activeMessages.filter(
    (message) =>
      !dismissedMessages.includes(message.id) && shouldShowMessage(message),
  );

  // Group similar messages if preference is enabled
  const groupedMessages = preferences?.groupSimilar
    ? groupSimilarMessages(visibleMessages)
    : visibleMessages.map((msg) => ({ ...msg, groupCount: 1 }));

  if (groupedMessages.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* Notification Controls */}
      {groupedMessages.length > 1 && (
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {groupedMessages.length} notifications
            </Badge>
            <span>•</span>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1 hover:text-foreground"
            >
              {soundEnabled ? (
                <Volume2 className="h-3 w-3" />
              ) : (
                <VolumeX className="h-3 w-3" />
              )}
              Sound {soundEnabled ? "On" : "Off"}
            </button>
            <span>•</span>
            <button
              onClick={() => setShowPreviews(!showPreviews)}
              className="flex items-center gap-1 hover:text-foreground"
            >
              {showPreviews ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {showPreviews ? "Hide" : "Show"} Previews
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={dismissAllMessages}>
              Dismiss All
            </Button>
            <Link to="/notification-preferences">
              <Button variant="ghost" size="sm" className="gap-1">
                <Settings className="h-3 w-3" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Messages */}
      {groupedMessages.map((message) => (
        <Alert
          key={message.id}
          variant={getAlertVariant(message.type)}
          className={`relative ${message.type !== "error" ? getAlertStyle(message.type) : ""}`}
          onClick={() => handleViewMessage(message.id)}
        >
          {getAlertIcon(message.type)}
          <div className="flex-1 pr-8">
            <AlertTitle className="flex items-center gap-2 mb-2">
              {message.title}
              {message.type !== "info" && (
                <Badge
                  variant={
                    message.type === "error" ? "destructive" : "secondary"
                  }
                  className="text-xs"
                >
                  {message.type.toUpperCase()}
                </Badge>
              )}
              {message.groupCount && message.groupCount > 1 && (
                <Badge variant="outline" className="text-xs">
                  {message.groupCount} similar
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription className="text-sm mb-3">
              {showPreviews ? message.content : "Click to view message content"}
            </AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs opacity-75">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatReadableDate(message.createdAt)}</span>
              </div>
              {message.expiresAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Expires: {formatReadableDate(message.expiresAt)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>
                  {message.targetAudience === "all"
                    ? "All Users"
                    : message.targetAudience
                        .split("-")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ")}
                </span>
              </div>
              {message.category && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {message.category}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              handleDismissMessage(message.id);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ))}

      {/* No notifications message */}
      {!preferences?.enableNotifications && (
        <Alert className="border-dashed">
          <Settings className="h-4 w-4" />
          <AlertTitle>Notifications Disabled</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>You have disabled notifications in your preferences.</span>
            <Link to="/notification-preferences">
              <Button variant="outline" size="sm">
                Enable Notifications
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Helper function to group similar messages
function groupSimilarMessages(messages: BroadcastMessage[]) {
  const grouped: (BroadcastMessage & { groupCount?: number })[] = [];
  const processed = new Set<string>();

  messages.forEach((message) => {
    if (processed.has(message.id)) return;

    // Find similar messages (same type and category)
    const similar = messages.filter(
      (m) =>
        m.type === message.type &&
        m.category === message.category &&
        !processed.has(m.id),
    );

    // Mark all similar messages as processed
    similar.forEach((m) => processed.add(m.id));

    // Add the first message with group count
    grouped.push({
      ...message,
      groupCount: similar.length,
    });
  });

  return grouped;
}
