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
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatReadableDate } from "@/lib/dateUtils";

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
}

interface UserDismissal {
  userId: string;
  messageId: string;
  dismissedAt: string;
}

export function BroadcastAlert() {
  const [activeMessages, setActiveMessages] = useState<BroadcastMessage[]>([]);
  const [dismissedMessages, setDismissedMessages] = useState<string[]>([]);
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadActiveMessages();
    loadUserDismissals();
  }, []);

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

  // Filter out dismissed messages
  const visibleMessages = activeMessages.filter(
    (message) => !dismissedMessages.includes(message.id),
  );

  if (visibleMessages.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      {visibleMessages.map((message) => (
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
            </AlertTitle>
            <AlertDescription className="text-sm mb-3">
              {message.content}
            </AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs opacity-75">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatReadableDate(message.createdAt)}</span>
              </div>
              {message.expiresAt && (
                <div className="flex items-center gap-1">
                  <span>Expires:</span>
                  <span>{formatReadableDate(message.expiresAt)}</span>
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
    </div>
  );
}
