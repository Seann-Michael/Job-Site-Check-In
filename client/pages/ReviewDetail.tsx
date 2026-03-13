// @ts-nocheck
import React, { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import {
  ArrowLeft,
  Star,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  User,
  Briefcase,
  Calendar,
  ThumbsUp,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatTableDate } from "@/lib/dateUtils";

// ── Google icon ───────────────────────────────────────────────────────────────
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ── Star display ──────────────────────────────────────────────────────────────
function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-5 w-5 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </div>
  );
}

// ── Activity timeline event ───────────────────────────────────────────────────
function TimelineEvent({
  icon: Icon,
  iconClass,
  label,
  date,
  note,
  isLast,
}: {
  icon: any;
  iconClass: string;
  label: string;
  date?: string;
  note?: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1 mb-1" />}
      </div>
      <div className={`pb-5 min-w-0 ${isLast ? "" : ""}`}>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {date && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReviewDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Request data passed via router state; fall back to a placeholder
  const request = location.state?.request ?? {
    id,
    customerName: "Customer",
    customerPhone: "—",
    projectName: "—",
    status: "completed",
    rating: null,
    reviewText: null,
    sentAt: new Date().toISOString(),
    viewedAt: null,
    submittedAt: null,
    linkClicked: false,
    redirectedToGoogle: false,
  };

  const [response, setResponse] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  const MAX_CHARS = 4096;

  const handlePostToGoogle = async () => {
    if (!response.trim()) {
      toast.error("Please write a response before posting.");
      return;
    }
    setIsPosting(true);
    // Simulate API call to GMB
    await new Promise((r) => setTimeout(r, 1800));
    setIsPosting(false);
    setPosted(true);
    toast.success("Response posted to Google My Business.");
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(response);
    toast.success("Response copied to clipboard.");
  };

  // Build activity timeline
  const timeline = [
    {
      key: "sent",
      icon: Send,
      iconClass: "bg-blue-100 text-blue-600",
      label: "Review request sent",
      date: request.sentAt,
    },
    request.viewedAt && {
      key: "viewed",
      icon: Eye,
      iconClass: "bg-purple-100 text-purple-600",
      label: "Link opened by customer",
      date: request.viewedAt,
    },
    request.linkClicked && !request.viewedAt && {
      key: "clicked",
      icon: Eye,
      iconClass: "bg-purple-100 text-purple-600",
      label: "Review link clicked",
      date: request.sentAt,
      note: "Exact time unavailable",
    },
    request.redirectedToGoogle && {
      key: "redirected",
      icon: ExternalLink,
      iconClass: "bg-orange-100 text-orange-600",
      label: "Redirected to Google",
      date: request.submittedAt ?? request.sentAt,
    },
    request.submittedAt && {
      key: "submitted",
      icon: CheckCircle2,
      iconClass: "bg-green-100 text-green-600",
      label: request.rating ? "Review submitted on Google" : "Request completed",
      date: request.submittedAt,
    },
    posted && {
      key: "response",
      icon: MessageSquare,
      iconClass: "bg-blue-100 text-blue-600",
      label: "Owner response posted",
      date: new Date().toISOString(),
    },
  ].filter(Boolean);

  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-700 border-green-200",
    expired: "bg-red-100 text-red-700 border-red-200",
    viewed: "bg-purple-100 text-purple-700 border-purple-200",
    sent: "bg-blue-100 text-blue-700 border-blue-200",
    scheduled: "bg-sky-100 text-sky-700 border-sky-200",
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/reviews")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold truncate">{request.customerName}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusColors[request.status] ?? "bg-muted text-muted-foreground"}`}
              >
                {request.status}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                <GoogleIcon size={12} /> Google
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {request.projectName} · {request.customerPhone}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — review details + activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Review card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GoogleIcon />
                  Google Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rating */}
                {request.rating ? (
                  <div className="flex items-center gap-3">
                    <StarDisplay rating={request.rating} />
                    <span className="text-2xl font-bold">{request.rating}</span>
                    <span className="text-sm text-muted-foreground">/ 5</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">No rating submitted</span>
                  </div>
                )}

                {/* Review text */}
                {request.reviewText ? (
                  <div className="bg-muted/40 rounded-lg p-4 border">
                    <p className="text-sm text-foreground leading-relaxed italic">
                      "{request.reviewText}"
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted/40 rounded-lg p-4 border text-center">
                    <p className="text-sm text-muted-foreground">No written review left by customer.</p>
                  </div>
                )}

                {/* Date grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Send className="h-3 w-3" /> Sent
                    </p>
                    <p className="text-sm font-medium">{formatTableDate(request.sentAt)}</p>
                  </div>
                  {request.viewedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Eye className="h-3 w-3" /> Viewed
                      </p>
                      <p className="text-sm font-medium">{formatTableDate(request.viewedAt)}</p>
                    </div>
                  )}
                  {request.submittedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </p>
                      <p className="text-sm font-medium">{formatTableDate(request.submittedAt)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded.</p>
                ) : (
                  timeline.map((event, idx) => (
                    <TimelineEvent
                      key={event.key}
                      icon={event.icon}
                      iconClass={event.iconClass}
                      label={event.label}
                      date={event.date}
                      note={event.note}
                      isLast={idx === timeline.length - 1}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — response panel */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Owner Response
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {posted ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <p className="font-semibold text-green-700">Response Posted</p>
                    <p className="text-xs text-muted-foreground">
                      Your response has been sent to Google My Business and will appear publicly.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPosted(false); }}
                    >
                      Edit Response
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Textarea
                        placeholder="Write a professional response to this review…"
                        value={response}
                        onChange={(e) => setResponse(e.target.value.slice(0, MAX_CHARS))}
                        rows={8}
                        className="resize-none text-sm"
                      />
                      <p className={`text-xs text-right ${response.length > MAX_CHARS * 0.9 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {response.length} / {MAX_CHARS}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Button
                        className="w-full gap-2"
                        onClick={handlePostToGoogle}
                        disabled={isPosting || !response.trim()}
                      >
                        {isPosting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <GoogleIcon size={16} />
                        )}
                        {isPosting ? "Posting…" : "Post to Google My Business"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleCopyResponse}
                        disabled={!response.trim()}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Response
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="font-medium text-foreground">Tips for a great response:</p>
                      <ul className="space-y-0.5 list-disc list-inside">
                        <li>Thank the customer by name</li>
                        <li>Address specific feedback</li>
                        <li>Keep it professional and brief</li>
                        <li>Invite them back</li>
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Customer info card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{request.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{request.projectName}</span>
                </div>
                {request.customerPhone && request.customerPhone !== "—" && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">{request.customerPhone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
