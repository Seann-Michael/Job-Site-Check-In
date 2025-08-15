import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  source?: "system" | "user" | "api" | "webhook";
  priority?: "low" | "normal" | "high" | "urgent";
  category?: "project" | "system" | "billing" | "security" | "update";
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications (mock data for now)
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: "1",
        type: "info",
        title: "System Update",
        message: "System maintenance scheduled for tonight",
        timestamp: new Date(),
        read: false,
        source: "system",
        priority: "normal",
        category: "system",
      },
      {
        id: "2",
        type: "success",
        title: "Project Completed",
        message: "Coffee Shop SEO project has been completed",
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
        read: false,
        source: "system",
        priority: "normal",
        category: "project",
      },
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // Simplified notification button without popover
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toast.info(`You have ${unreadCount} unread notifications`)}
      className="relative"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
