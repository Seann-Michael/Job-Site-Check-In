// @ts-nocheck
import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Search,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  MoreVertical,
  Star,
  CalendarClock,
  MessageSquare,
  Phone,
  Mail,
  RefreshCw,
  Trash2,
  CalendarDays,
  Bell,
  Copy,
  ExternalLink,
  User,
  Briefcase,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityStatus =
  | "sent"
  | "viewed"
  | "completed"
  | "expired"
  | "scheduled"
  | "cancelled";

type SendMethod = "sms" | "email" | "both";

interface ActivityItem {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  projectName: string;
  status: ActivityStatus;
  sendMethod: SendMethod;
  sentAt?: string;
  scheduledAt?: string;
  viewedAt?: string;
  completedAt?: string;
  rating?: number;
  reviewText?: string;
  redirectedToGoogle?: boolean;
  reminderCount?: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const mockActivity: ActivityItem[] = [
  // Current (sent / viewed)
  {
    id: "c1",
    customerName: "James Carter",
    customerPhone: "(555) 101-2020",
    customerEmail: "james.carter@email.com",
    projectName: "Bathroom Remodel",
    status: "viewed",
    sendMethod: "sms",
    sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    viewedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    reminderCount: 0,
  },
  {
    id: "c2",
    customerName: "Priya Nair",
    customerPhone: "(555) 303-4040",
    customerEmail: "priya@email.com",
    projectName: "Kitchen Cabinets",
    status: "sent",
    sendMethod: "email",
    sentAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    reminderCount: 1,
  },
  {
    id: "c3",
    customerName: "Derek Mills",
    customerPhone: "(555) 505-6060",
    projectName: "Roof Inspection",
    status: "sent",
    sendMethod: "both",
    sentAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    reminderCount: 0,
  },
  // Past (completed / expired)
  {
    id: "p1",
    customerName: "John Smith",
    customerPhone: "(555) 123-4567",
    projectName: "Kitchen Renovation",
    status: "completed",
    sendMethod: "sms",
    sentAt: "2024-01-14T10:00:00Z",
    completedAt: "2024-01-15T14:30:00Z",
    rating: 5,
    reviewText: "Excellent work! Smith Construction exceeded our expectations.",
    redirectedToGoogle: true,
    reminderCount: 0,
  },
  {
    id: "p2",
    customerName: "Sarah Johnson",
    customerPhone: "(555) 234-5678",
    projectName: "Bathroom Remodel",
    status: "completed",
    sendMethod: "email",
    sentAt: "2024-01-11T11:30:00Z",
    completedAt: "2024-01-12T16:45:00Z",
    rating: 4,
    reviewText: "Great service, very professional team.",
    redirectedToGoogle: false,
    reminderCount: 1,
  },
  {
    id: "p3",
    customerName: "Robert Wilson",
    customerPhone: "(555) 567-8901",
    projectName: "Roof Repair",
    status: "completed",
    sendMethod: "sms",
    sentAt: "2024-01-07T15:45:00Z",
    completedAt: "2024-01-08T12:10:00Z",
    rating: 3,
    reviewText: "Decent work, but communication could be better.",
    redirectedToGoogle: false,
    reminderCount: 2,
  },
  {
    id: "p4",
    customerName: "Mike Davis",
    customerPhone: "(555) 345-6789",
    projectName: "Deck Construction",
    status: "expired",
    sendMethod: "both",
    sentAt: "2024-01-10T09:15:00Z",
    reminderCount: 3,
  },
  {
    id: "p5",
    customerName: "Lisa Brown",
    customerPhone: "(555) 456-7890",
    projectName: "Home Addition",
    status: "cancelled",
    sendMethod: "sms",
    sentAt: "2024-01-09T13:20:00Z",
    reminderCount: 0,
  },
  // Scheduled
  {
    id: "s1",
    customerName: "Angela Torres",
    customerPhone: "(555) 707-8080",
    customerEmail: "angela@email.com",
    projectName: "Flooring Install",
    status: "scheduled",
    sendMethod: "sms",
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    reminderCount: 0,
  },
  {
    id: "s2",
    customerName: "Brandon Lee",
    customerPhone: "(555) 909-1010",
    customerEmail: "brandon.lee@email.com",
    projectName: "Exterior Painting",
    status: "scheduled",
    sendMethod: "email",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    reminderCount: 0,
  },
  {
    id: "s3",
    customerName: "Maria Gonzalez",
    customerPhone: "(555) 111-2222",
    customerEmail: "maria.g@email.com",
    projectName: "HVAC Service",
    status: "scheduled",
    sendMethod: "both",
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    reminderCount: 0,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `in ${days}d`;
  if (hours > 0) return `in ${hours}h`;
  if (mins > 0) return `in ${mins}m`;
  return "soon";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function SendMethodIcon({ method }: { method: SendMethod }) {
  if (method === "sms") return <Phone className="h-3.5 w-3.5" />;
  if (method === "email") return <Mail className="h-3.5 w-3.5" />;
  return (
    <span className="flex items-center gap-0.5">
      <Phone className="h-3.5 w-3.5" />
      <Mail className="h-3.5 w-3.5" />
    </span>
  );
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  const map: Record<ActivityStatus, { label: string; className: string }> = {
    sent: {
      label: "Sent",
      className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    viewed: {
      label: "Viewed",
      className: "bg-purple-100 text-purple-700 border-purple-200",
    },
    completed: {
      label: "Completed",
      className: "bg-green-100 text-green-700 border-green-200",
    },
    expired: {
      label: "Expired",
      className: "bg-orange-100 text-orange-700 border-orange-200",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-red-100 text-red-700 border-red-200",
    },
    scheduled: {
      label: "Scheduled",
      className: "bg-sky-100 text-sky-700 border-sky-200",
    },
  };
  const cfg = map[status];
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium px-2 py-0.5 ${cfg.className}`}
    >
      {cfg.label}
    </Badge>
  );
}

// ─── Current Activity Card ─────────────────────────────────────────────────────

function CurrentCard({
  item,
  onResend,
  onReminder,
  onCancel,
  onCopyLink,
}: {
  item: ActivityItem;
  onResend: (id: string) => void;
  onReminder: (id: string) => void;
  onCancel: (id: string) => void;
  onCopyLink: (id: string) => void;
}) {
  return (
    <Card className="border hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-foreground">
                {item.customerName}
              </span>
              <StatusBadge status={item.status} />
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <SendMethodIcon method={item.sendMethod} />
                {item.sendMethod === "both" ? "SMS & Email" : item.sendMethod.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{item.projectName}</span>
              <span className="mx-1">·</span>
              <Phone className="h-3.5 w-3.5" />
              <span>{item.customerPhone}</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {item.sentAt && (
                <span className="flex items-center gap-1">
                  <Send className="h-3.5 w-3.5" />
                  Sent {timeAgo(item.sentAt)}
                </span>
              )}
              {item.viewedAt && (
                <span className="flex items-center gap-1 text-purple-600">
                  <Eye className="h-3.5 w-3.5" />
                  Viewed {timeAgo(item.viewedAt)}
                </span>
              )}
              {item.reminderCount !== undefined && item.reminderCount > 0 && (
                <span className="flex items-center gap-1 text-orange-500">
                  <Bell className="h-3.5 w-3.5" />
                  {item.reminderCount} reminder{item.reminderCount > 1 ? "s" : ""} sent
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1"
              onClick={() => onReminder(item.id)}
            >
              <Bell className="h-3.5 w-3.5" />
              Remind
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onCopyLink(item.id)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Review Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResend(item.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Resend Request
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onCancel(item.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Cancel Request
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Past Activity Card ────────────────────────────────────────────────────────

function PastCard({
  item,
  onResend,
  onCopyLink,
}: {
  item: ActivityItem;
  onResend: (id: string) => void;
  onCopyLink: (id: string) => void;
}) {
  return (
    <Card className="border hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-foreground">
                {item.customerName}
              </span>
              <StatusBadge status={item.status} />
              {item.rating && <StarDisplay rating={item.rating} />}
              {item.redirectedToGoogle && (
                <Badge
                  variant="outline"
                  className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Posted to Google
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{item.projectName}</span>
              <span className="mx-1">·</span>
              <Phone className="h-3.5 w-3.5" />
              <span>{item.customerPhone}</span>
            </div>

            {item.reviewText && (
              <p className="text-xs text-muted-foreground italic line-clamp-2 mb-2 bg-muted/50 rounded p-2">
                "{item.reviewText}"
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {item.sentAt && (
                <span className="flex items-center gap-1">
                  <Send className="h-3.5 w-3.5" />
                  Sent {formatDateTime(item.sentAt)}
                </span>
              )}
              {item.completedAt && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed {formatDateTime(item.completedAt)}
                </span>
              )}
              {item.reminderCount !== undefined && item.reminderCount > 0 && (
                <span className="flex items-center gap-1">
                  <Bell className="h-3.5 w-3.5" />
                  {item.reminderCount} reminder{item.reminderCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {item.status === "expired" || item.status === "cancelled" ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1 shrink-0"
              onClick={() => onResend(item.id)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onCopyLink(item.id)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Review Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResend(item.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Send Again
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Scheduled Card ────────────────────────────────────────────────────────────

function ScheduledCard({
  item,
  onEdit,
  onSendNow,
  onDelete,
}: {
  item: ActivityItem;
  onEdit: (id: string) => void;
  onSendNow: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="border hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-foreground">
                {item.customerName}
              </span>
              <StatusBadge status={item.status} />
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <SendMethodIcon method={item.sendMethod} />
                {item.sendMethod === "both" ? "SMS & Email" : item.sendMethod.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{item.projectName}</span>
              <span className="mx-1">·</span>
              <Phone className="h-3.5 w-3.5" />
              <span>{item.customerPhone}</span>
            </div>

            {item.scheduledAt && (
              <div className="flex items-center gap-1 text-xs font-medium text-sky-600">
                <CalendarClock className="h-3.5 w-3.5" />
                Scheduled for {formatDateTime(item.scheduledAt)}
                <span className="text-muted-foreground font-normal">
                  ({timeUntil(item.scheduledAt)})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1"
              onClick={() => onSendNow(item.id)}
            >
              <Send className="h-3.5 w-3.5" />
              Send Now
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(item.id)}>
                  <CalendarDays className="h-4 w-4 mr-2" /> Reschedule
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-base text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ReviewActivity() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ActivityItem[]>(mockActivity);

  const current = items.filter((i) =>
    ["sent", "viewed"].includes(i.status)
  );
  const past = items.filter((i) =>
    ["completed", "expired", "cancelled"].includes(i.status)
  );
  const scheduled = items.filter((i) => i.status === "scheduled");

  const filter = (list: ActivityItem[]) =>
    list.filter(
      (i) =>
        i.customerName.toLowerCase().includes(search.toLowerCase()) ||
        i.projectName.toLowerCase().includes(search.toLowerCase()),
    );

  const handleReminder = (id: string) => {
    const item = items.find((i) => i.id === id);
    toast.success(`Reminder sent to ${item?.customerName}`);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, reminderCount: (i.reminderCount || 0) + 1 } : i,
      ),
    );
  };

  const handleResend = (id: string) => {
    const item = items.find((i) => i.id === id);
    toast.success(`Review request resent to ${item?.customerName}`);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "sent" as const, sentAt: new Date().toISOString() }
          : i,
      ),
    );
  };

  const handleCancel = (id: string) => {
    const item = items.find((i) => i.id === id);
    toast.success(`Request for ${item?.customerName} cancelled`);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "cancelled" as const } : i,
      ),
    );
  };

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/review/${id}`;
    navigator.clipboard.writeText(link);
    toast.success("Review link copied!");
  };

  const handleSendNow = (id: string) => {
    const item = items.find((i) => i.id === id);
    toast.success(`Sending request to ${item?.customerName} now`);
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "sent" as const, sentAt: new Date().toISOString(), scheduledAt: undefined }
          : i,
      ),
    );
  };

  const handleDeleteScheduled = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Scheduled request removed");
  };

  const handleReschedule = (id: string) => {
    toast.info("Reschedule dialog coming soon");
  };

  // Summary counts
  const currentViewed = current.filter((i) => i.status === "viewed").length;
  const pastCompleted = past.filter((i) => i.status === "completed").length;
  const pastWithRating = past.filter((i) => i.rating);
  const avgRating =
    pastWithRating.length > 0
      ? (
          pastWithRating.reduce((s, i) => s + (i.rating || 0), 0) /
          pastWithRating.length
        ).toFixed(1)
      : "—";

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/reviews")}
            className="gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Reviews
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track all review requests — active, completed, and upcoming
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{current.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                Active Requests
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{currentViewed}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-purple-500" />
                Link Viewed
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{pastCompleted}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Completed
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-500 flex items-center gap-1">
                {avgRating}
                {avgRating !== "—" && <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Avg Rating
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="current">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="current" className="flex-1 sm:flex-none gap-1.5">
              <Clock className="h-4 w-4" />
              Current
              {current.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-xs bg-blue-600 text-white">
                  {current.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1 sm:flex-none gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Past
              {past.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-xs bg-muted text-muted-foreground">
                  {past.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex-1 sm:flex-none gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Scheduled
              {scheduled.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-xs bg-sky-600 text-white">
                  {scheduled.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Current ── */}
          <TabsContent value="current" className="mt-4 space-y-3">
            {filter(current).length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No active requests"
                description="Review requests that have been sent and are awaiting a response will appear here."
              />
            ) : (
              filter(current).map((item) => (
                <CurrentCard
                  key={item.id}
                  item={item}
                  onResend={handleResend}
                  onReminder={handleReminder}
                  onCancel={handleCancel}
                  onCopyLink={handleCopyLink}
                />
              ))
            )}
          </TabsContent>

          {/* ── Past ── */}
          <TabsContent value="past" className="mt-4 space-y-3">
            {filter(past).length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No past activity"
                description="Completed, expired, and cancelled review requests will appear here."
              />
            ) : (
              filter(past).map((item) => (
                <PastCard
                  key={item.id}
                  item={item}
                  onResend={handleResend}
                  onCopyLink={handleCopyLink}
                />
              ))
            )}
          </TabsContent>

          {/* ── Scheduled ── */}
          <TabsContent value="scheduled" className="mt-4 space-y-3">
            {filter(scheduled).length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No scheduled requests"
                description="Review requests queued to send at a future time will appear here."
              />
            ) : (
              filter(scheduled).map((item) => (
                <ScheduledCard
                  key={item.id}
                  item={item}
                  onEdit={handleReschedule}
                  onSendNow={handleSendNow}
                  onDelete={handleDeleteScheduled}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
