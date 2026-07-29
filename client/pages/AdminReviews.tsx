// @ts-nocheck - Temporary suppression of type errors
import React, { useState, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/StarRating";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Star,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  MoreVertical,
  ExternalLink,
  Copy,
  Send,
  Filter,
  Search,
  Calendar,
  X,
  BarChart3,
  Activity,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatTableDate } from "@/lib/dateUtils";
import { supabase } from "@/lib/dataService";
import { workspaceService } from "@/lib/workspaceService";
import { ReviewRequest } from "@/components/ReviewRequest";
import { ReviewAnalyticsSection } from "@/components/ReviewAnalyticsSection";

interface ReviewRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  projectName: string;
  status: "sent" | "viewed" | "completed" | "expired" | "scheduled";
  rating?: number;
  reviewText?: string;
  submittedAt?: string;
  sentAt: string;
  viewedAt?: string;
  linkClicked?: boolean;
  redirectedToGoogle?: boolean;
}

interface ReviewStats {
  totalRequests: number;
  completionRate: number;
  averageRating: number;
  googleRedirects: number;
  monthlyTrend: number;
}

// ── ReviewDataTable ───────────────────────────────────────────────────────────
function ReviewDataTable({
  data,
  tab,
  sortField,
  sortDir,
  onSort,
  page,
  pageSize,
  totalPages,
  totalFiltered,
  onPageChange,
  onPageSizeChange,
  onCopyLink,
  onResend,
  onCancel,
  onCopyText,
  onRowClick,
  getStatusBadge,
  searchTerm,
  formatDate,
}: any) {
  const parentRef = useRef<HTMLDivElement>(null);

  function GoogleIcon() {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" title="Google">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  }

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 57,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field)
      return <span className="ml-1 opacity-25 text-xs">↕</span>;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3.5 w-3.5 ml-0.5 text-primary" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5 ml-0.5 text-primary" />
    );
  }

  const emptyMessage = searchTerm
    ? "No results match your search."
    : tab === "current"
    ? "No active review requests."
    : tab === "past"
    ? "No past requests yet."
    : "No scheduled requests.";

  const from = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalFiltered);

  return (
    <Card>
      <CardContent className="p-0">
        {/* Scrollable virtual body */}
        <div className="overflow-x-auto">
          <div ref={parentRef} style={{ maxHeight: 440, overflowY: "auto" }}>
            <table
              style={{ minWidth: 700, width: "100%", borderCollapse: "collapse" }}
            >
              {/* Sticky header */}
              <thead
                style={{ position: "sticky", top: 0, zIndex: 10 }}
                className="bg-background border-b"
              >
                <tr>
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    onClick={() => onSort("customerName")}
                  >
                    Customer <SortIcon field="customerName" />
                  </th>
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    onClick={() => onSort("projectName")}
                  >
                    Project <SortIcon field="projectName" />
                  </th>
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    onClick={() => onSort("status")}
                  >
                    Status <SortIcon field="status" />
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Source
                  </th>
                  {tab === "past" && (
                    <th
                      className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => onSort("rating")}
                    >
                      Rating <SortIcon field="rating" />
                    </th>
                  )}
                  <th
                    className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                    onClick={() => onSort("sentAt")}
                  >
                    {tab === "scheduled" ? "Scheduled For" : "Sent Date"}{" "}
                    <SortIcon field="sentAt" />
                  </th>
                  {tab === "current" && (
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                      Viewed Date
                    </th>
                  )}
                  {tab === "past" && (
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                      Completed Date
                    </th>
                  )}
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tab === "past" ? 8 : tab === "current" ? 7 : 6}
                      className="text-center py-14 text-muted-foreground text-sm"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  <>
                    {paddingTop > 0 && (
                      <tr>
                        <td style={{ height: paddingTop }} />
                      </tr>
                    )}
                    {virtualItems.map((vRow) => {
                      const request = data[vRow.index];
                      // Row-based sends can only offer channels we have
                      // contact details for, and rows without a phone number
                      // (e.g. completed reviews from the reviews table, which
                      // store no contact info) have none — the send dialog
                      // would open with every method disabled. Hide the
                      // resend/send-now action instead of offering a dead end.
                      const canResend = Boolean(
                        request.customerPhone && request.customerPhone !== "N/A",
                      );
                      return (
                        <tr
                          key={request.id}
                          className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${tab === "past" ? "cursor-pointer" : ""}`}
                          onClick={() => tab === "past" && onRowClick?.(request)}
                        >
                          {/* Customer */}
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <p className="font-medium truncate text-sm">
                                {request.customerName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {request.customerPhone}
                              </p>
                              <div className="sm:hidden mt-0.5 text-xs text-muted-foreground">
                                {request.projectName}
                              </div>
                              <div className="lg:hidden mt-0.5 text-xs text-muted-foreground">
                                {formatDate(request.sentAt)}
                              </div>
                            </div>
                          </td>

                          {/* Project */}
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <p className="truncate text-sm">{request.projectName}</p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {getStatusBadge(request.status, request.linkClicked)}
                          </td>

                          {/* Source */}
                          <td className="px-4 py-3">
                            <span title="Google"><GoogleIcon /></span>
                          </td>

                          {/* Rating (past only) */}
                          {tab === "past" && (
                            <td className="px-4 py-3 hidden md:table-cell">
                              {request.rating ? (
                                <div className="flex items-center gap-2">
                                  <StarRating
                                    rating={request.rating}
                                    onRatingChange={() => {}}
                                    readonly
                                    size="sm"
                                  />
                                  <span className="text-sm">{request.rating}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          )}

                          {/* Sent Date */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="text-sm">
                              {formatDate(request.sentAt)}
                              <p className="text-xs text-muted-foreground">
                                {new Date(request.sentAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </td>

                          {/* Viewed Date (current only) */}
                          {tab === "current" && (
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {request.viewedAt ? (
                                <div className="text-sm">
                                  {formatDate(request.viewedAt)}
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(request.viewedAt).toLocaleTimeString()}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </td>
                          )}

                          {/* Completed Date (past only) */}
                          {tab === "past" && (
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {request.submittedAt ? (
                                <div className="text-sm">
                                  {formatDate(request.submittedAt)}
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(request.submittedAt).toLocaleTimeString()}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </td>
                          )}

                          {/* Actions */}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onCopyLink(request.id)}>
                                  <Copy className="h-4 w-4 mr-2" /> Copy Link
                                </DropdownMenuItem>
                                {tab !== "scheduled" && canResend && (
                                  <DropdownMenuItem onClick={() => onResend(request.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Resend Request
                                  </DropdownMenuItem>
                                )}
                                {tab === "scheduled" && canResend && (
                                  <DropdownMenuItem onClick={() => onResend(request.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Send Now
                                  </DropdownMenuItem>
                                )}
                                {(request.status === "sent" ||
                                  request.status === "scheduled") && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      onCancel(request.id, request.customerName)
                                    }
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <X className="h-4 w-4 mr-2" /> Cancel Request
                                  </DropdownMenuItem>
                                )}
                                {request.reviewText && (
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); onCopyText(request.reviewText!); }}
                                  >
                                    <Copy className="h-4 w-4 mr-2" /> Copy Review Text
                                  </DropdownMenuItem>
                                )}
                                {tab === "past" && (
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); onRowClick?.(request); }}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr>
                        <td style={{ height: paddingBottom }} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination footer ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                onPageSizeChange(Number(v));
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Record range */}
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {from}–{to} of {totalFiltered} records
          </span>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2 whitespace-nowrap">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminReviews() {
  const navigate = useNavigate();
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    totalRequests: 0,
    completionRate: 0,
    averageRating: 0,
    googleRedirects: 0,
    monthlyTrend: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("current");
  const [sortField, setSortField] = useState("sentAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  // The row the send dialog is operating on; null = composing a brand-new request
  const [activeRequest, setActiveRequest] = useState<ReviewRequest | null>(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState("12");
  const [analyticsRefreshTrigger, setAnalyticsRefreshTrigger] = useState(0);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  useEffect(() => {
    loadReviewData();
  }, []);

  const loadReviewData = async () => {
    // Load completed reviews from Supabase
    const { data: supabaseReviews } = await supabase
      .from("reviews")
      .select("id, business_id, platform, rating, title, text, author, date, metadata, created_at")
      .order("date", { ascending: false });

    // Map Supabase reviews to ReviewRequest shape. The review gate records its
    // submissions here with metadata.review_request_id linking back to the
    // review_requests row (the live status CHECK has no 'completed' value).
    const dbReviews: ReviewRequest[] = (supabaseReviews ?? []).map((r: any) => ({
      id: r.id,
      customerName: r.author?.name ?? "Customer",
      customerPhone: r.author?.phone ?? "N/A",
      projectName: r.title ?? "Review",
      status: "completed" as const,
      rating: r.rating,
      reviewText: r.text,
      submittedAt: r.date,
      sentAt: r.created_at,
      linkClicked: true,
      redirectedToGoogle:
        r.platform === "google" || r.metadata?.redirected_to_google === true,
    }));

    // Requests that already produced a submission move to the Past tab as the
    // review row instead of lingering under Current/Scheduled.
    const completedRequestIds = new Set(
      (supabaseReviews ?? [])
        .map((r: any) => r.metadata?.review_request_id)
        .filter(Boolean),
    );

    // Load pending/sent/viewed review requests from Supabase
    const { data: pendingRows } = await supabase
      .from("review_requests")
      .select("*")
      .order("created_at", { ascending: false });

    const pendingReviews: ReviewRequest[] = (pendingRows ?? [])
      .filter((r: any) => !completedRequestIds.has(r.id))
      .map((r: any) => ({
        id: r.id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone ?? "N/A",
        projectName: r.project_name ?? "Project",
        status: r.status as ReviewRequest["status"],
        sentAt: r.sent_at,
        viewedAt: r.viewed_at,
        linkClicked: r.status === "viewed",
      }));

    const allRequests = [...pendingReviews, ...dbReviews];
    setReviewRequests(allRequests);

    // Calculate stats from real data
    const completed = allRequests.filter((r) => r.status === "completed");
    const withRatings = completed.filter((r) => r.rating);
    const avgRating =
      withRatings.length > 0
        ? withRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / withRatings.length
        : 0;
    const googleRedirects = completed.filter((r) => r.redirectedToGoogle).length;

    setStats({
      totalRequests: allRequests.length,
      completionRate: allRequests.length > 0 ? (completed.length / allRequests.length) * 100 : 0,
      averageRating: avgRating,
      googleRedirects,
      monthlyTrend: 0,
    });
  };

  // Open the send dialog seeded with a real row (Send Now / Resend actions)
  const openSendDialog = (id: string) => {
    const request = reviewRequests.find((r) => r.id === id) ?? null;
    setActiveRequest(request);
    setShowReviewRequest(true);
  };

  const handleSendReviewRequest = async (
    method: "sms" | "email" | "both",
    message: string,
    details: {
      customerName: string;
      customerPhone: string;
      customerEmail: string;
      projectName: string;
    },
  ) => {
    // Rows with status "completed" come from the reviews table, not
    // review_requests — resending one creates a fresh request row instead.
    const isExistingRequest =
      activeRequest !== null && activeRequest.status !== "completed";
    let requestId = isExistingRequest ? activeRequest.id : null;

    if (isExistingRequest) {
      // Persist the send so the row leaves Scheduled/Expired on every client
      if (
        activeRequest.status === "scheduled" ||
        activeRequest.status === "expired"
      ) {
        const { error } = await supabase
          .from("review_requests")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", activeRequest.id);
        if (error) {
          toast.error(`Could not update the review request: ${error.message}`);
          return;
        }
      }
    } else {
      // New request: create the shared review_requests row so the review gate
      // can resolve the link and the mobile app sees the same request.
      // Wait for workspace init before stamping business_id — on a cold load
      // the synchronous getter is still null, and a NULL-stamped row is
      // invisible to mobile's scoped fetch and gives the review gate no
      // branding for the link that's about to reach a customer. Fail closed
      // if there's genuinely no workspace rather than writing that row.
      const { currentBusinessId } = await workspaceService.whenReady();
      if (!currentBusinessId) {
        toast.error(
          "No active business workspace — the review request can't be saved. Reload the page and try again.",
        );
        return;
      }
      const { data, error } = await supabase
        .from("review_requests")
        .insert({
          customer_name: details.customerName,
          customer_phone: details.customerPhone,
          project_name: details.projectName || "Project",
          status: "sent",
          sent_at: new Date().toISOString(),
          business_id: currentBusinessId,
        })
        .select("id")
        .single();
      if (error || !data?.id) {
        toast.error(
          `Could not save the review request: ${error?.message ?? "no id returned"}`,
        );
        return;
      }
      requestId = String(data.id);
    }

    // Make sure the delivered message carries the real review link
    const reviewLink = `${window.location.origin}/review/${requestId}`;
    let finalMessage = message;
    if (!finalMessage.includes(reviewLink)) {
      finalMessage = finalMessage.includes("[review link]")
        ? finalMessage.replace("[review link]", reviewLink)
        : `${finalMessage} ${reviewLink}`;
    }

    if (method === "sms" || method === "both") {
      const phoneUrl = `sms:${details.customerPhone}?body=${encodeURIComponent(finalMessage)}`;
      window.open(phoneUrl);
    }

    if (method === "email" || method === "both") {
      const subject = `Review Request for ${details.projectName || "your project"}`;
      const emailUrl = `mailto:${details.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalMessage)}`;
      window.open(emailUrl);
    }

    // Honest wording: this opens the operator's own messaging app — nothing is
    // delivered until they hit send there.
    toast.success(
      "Request saved — finish sending the message in the app that just opened",
    );
    setShowReviewRequest(false);
    setActiveRequest(null);
    loadReviewData();
  };

  const copyReviewLink = (id: string) => {
    const reviewLink = `${window.location.origin}/review/${id}`;
    navigator.clipboard.writeText(reviewLink);
    toast.success("Review link copied to clipboard!");
  };

  const cancelReviewRequest = async (id: string, customerName: string) => {
    // Persist first — an optimistic-only cancel reverts on reload and keeps
    // showing as pending on mobile.
    const { error } = await supabase
      .from("review_requests")
      .update({ status: "expired" })
      .eq("id", id);
    if (error) {
      toast.error(`Could not cancel the request: ${error.message}`);
      return;
    }
    setReviewRequests((prev) =>
      prev.map((request) =>
        request.id === id
          ? { ...request, status: "expired" as const }
          : request,
      ),
    );
    toast.success(`Review request for ${customerName} has been cancelled`);
  };

  const copyReviewText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Review text copied to clipboard!");
  };

  const tabStatuses = {
    current: ["sent", "viewed"],
    past: ["completed", "expired"],
    scheduled: ["scheduled"],
  };

  const filteredAndSorted = reviewRequests
    .filter((request) => {
      const allowedStatuses = tabStatuses[activeTab as keyof typeof tabStatuses] || [];
      if (!allowedStatuses.includes(request.status)) return false;
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (
        searchTerm &&
        !request.customerName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !request.projectName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(request.reviewText || "").toLowerCase().includes(searchTerm.toLowerCase())
      ) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "sentAt":
          return dir * (new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
        case "rating":
          return dir * ((a.rating || 0) - (b.rating || 0));
        case "customerName":
          return dir * a.customerName.localeCompare(b.customerName);
        case "projectName":
          return dir * a.projectName.localeCompare(b.projectName);
        case "status": {
          const ord: Record<string, number> = { completed: 4, viewed: 3, sent: 2, expired: 1, scheduled: 0 };
          return dir * ((ord[a.status] || 0) - (ord[b.status] || 0));
        }
        default:
          return 0;
      }
    });

  const totalFiltered = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedRequests = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  const getStatusBadge = (status: string, linkClicked?: boolean) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "viewed":
        return <Badge className="bg-blue-500">Viewed</Badge>;
      case "sent":
        return linkClicked ? (
          <Badge className="bg-yellow-500">Clicked</Badge>
        ) : (
          <Badge variant="secondary">Sent</Badge>
        );
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "scheduled":
        return <Badge className="bg-sky-500">Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-full px-4 py-6 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Review Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Track and manage customer review requests
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => {
                setActiveRequest(null);
                setShowReviewRequest(true);
              }}
              className="gap-2 whitespace-nowrap w-full sm:w-auto"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send Review Request</span>
              <span className="sm:hidden">Send Request</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/admin/review-gate-editor")} className="gap-2">
                  <Settings className="h-4 w-4" />
                  Edit Review Gate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/review-demo")} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Preview Review Gate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Google My Business Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Google My Business Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <div className="text-center">
                <p className="text-2xl lg:text-3xl font-bold text-blue-600">
                  127
                </p>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  Total Google Reviews
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+8 this month</span>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 lg:gap-2 mb-1">
                  <p className="text-2xl lg:text-3xl font-bold text-yellow-600">
                    4.7
                  </p>
                  <StarRating
                    rating={5}
                    onRatingChange={() => {}}
                    readonly
                    size="sm"
                  />
                </div>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  Average Google Rating
                </p>
                <span className="text-xs text-green-500">+0.2 this month</span>
              </div>
              <div className="text-center">
                <p className="text-2xl lg:text-3xl font-bold text-green-600">
                  23
                </p>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  Added by Platform
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">
                    +18% conversion
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl lg:text-3xl font-bold text-purple-600">
                  89%
                </p>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  5-Star Rate
                </p>
                <span className="text-xs text-green-500">Above average</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Analytics heading */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-foreground">Review Analytics</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={analyticsTimeRange} onValueChange={setAnalyticsTimeRange}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAnalyticsRefreshTrigger((n) => n + 1)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Review Requests
                  </p>
                  <p className="text-2xl font-bold">{stats.totalRequests}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500">+{stats.monthlyTrend}%</span>
                <span className="text-muted-foreground ml-1">this month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.completionRate)}%
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-500" />
              </div>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-muted-foreground">
                  Industry avg: 15-25%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Platform Rating
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">
                      {stats.averageRating.toFixed(1)}
                    </p>
                    <StarRating
                      rating={Math.round(stats.averageRating)}
                      onRatingChange={() => {}}
                      readonly
                      size="sm"
                    />
                  </div>
                </div>
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Google Redirects
                  </p>
                  <p className="text-2xl font-bold">{stats.googleRedirects}</p>
                </div>
                <ExternalLink className="h-8 w-8 text-green-500" />
              </div>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-muted-foreground">
                  {Math.round(
                    (stats.googleRedirects / stats.totalRequests) * 100,
                  )}
                  % of total
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <div className="mb-6">
          <ReviewAnalyticsSection timeRange={analyticsTimeRange} refreshTrigger={analyticsRefreshTrigger} />
        </div>

        {/* Tabbed Review Requests Table */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            setStatusFilter("all");
            setSearchTerm("");
            setPage(1);
          }}
        >
          {/* Tab bar + search row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
            <TabsList>
              <TabsTrigger value="current" className="gap-1.5">
                Current
                <Badge className="h-5 px-1.5 text-xs bg-blue-600 text-white ml-1">
                  {reviewRequests.filter((r) => ["sent", "viewed"].includes(r.status)).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-1.5">
                Past
                <Badge className="h-5 px-1.5 text-xs bg-muted text-muted-foreground ml-1">
                  {reviewRequests.filter((r) => ["completed", "expired"].includes(r.status)).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-1.5">
                Scheduled
                <Badge className="h-5 px-1.5 text-xs bg-sky-600 text-white ml-1">
                  {reviewRequests.filter((r) => r.status === "scheduled").length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers or projects…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* One ReviewDataTable per tab (each gets its own virtualizer ref) */}
          {(["current", "past", "scheduled"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <ReviewDataTable
                data={activeTab === tab ? paginatedRequests : []}
                tab={tab}
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                totalFiltered={activeTab === tab ? totalFiltered : 0}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                onCopyLink={copyReviewLink}
                onResend={openSendDialog}
                onCancel={cancelReviewRequest}
                onCopyText={copyReviewText}
                onRowClick={(request: any) => navigate(`/admin/reviews/${request.id}`, { state: { request } })}
                getStatusBadge={getStatusBadge}
                searchTerm={searchTerm}
                formatDate={formatTableDate}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Review Request Dialog — seeded from the actual row when sending an
            existing request; editable inputs when composing a new one. There is
            no email column on review_requests, so row-based sends only offer
            the channels we actually have contact details for. */}
        <ReviewRequest
          isOpen={showReviewRequest}
          onClose={() => {
            setShowReviewRequest(false);
            setActiveRequest(null);
          }}
          customerName={activeRequest?.customerName}
          customerPhone={
            activeRequest && activeRequest.customerPhone !== "N/A"
              ? activeRequest.customerPhone
              : undefined
          }
          projectName={activeRequest?.projectName}
          reviewLink={
            activeRequest && activeRequest.status !== "completed"
              ? `${window.location.origin}/review/${activeRequest.id}`
              : undefined
          }
          editableCustomer={!activeRequest}
          onSend={handleSendReviewRequest}
        />
      </div>
    </AppLayout>
  );
}
