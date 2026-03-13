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
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatTableDate } from "@/lib/dateUtils";
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
  onViewReview,
  getStatusBadge,
  searchTerm,
  formatDate,
}: any) {
  const parentRef = useRef<HTMLDivElement>(null);

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
                  {tab === "past" && (
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                      Review
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
                      colSpan={tab === "past" ? 6 : 4}
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
                      return (
                        <tr
                          key={request.id}
                          className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
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

                          {/* Date */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="text-sm">
                              {formatDate(request.sentAt)}
                              <p className="text-xs text-muted-foreground">
                                {new Date(request.sentAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </td>

                          {/* Review text (past only) */}
                          {tab === "past" && (
                            <td className="px-4 py-3 max-w-xs">
                              {request.reviewText ? (
                                <p className="text-sm text-foreground italic leading-snug break-words whitespace-normal">
                                  "{request.reviewText}"
                                </p>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  No review left
                                </span>
                              )}
                            </td>
                          )}

                          {/* Actions */}
                          <td className="px-4 py-3">
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
                                {tab !== "scheduled" && (
                                  <DropdownMenuItem onClick={() => onResend(request.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Resend Request
                                  </DropdownMenuItem>
                                )}
                                {tab === "scheduled" && (
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
                                    onClick={() => onCopyText(request.reviewText!)}
                                  >
                                    <Copy className="h-4 w-4 mr-2" /> Copy Review Text
                                  </DropdownMenuItem>
                                )}
                                {request.reviewText && (
                                  <DropdownMenuItem
                                    className="xl:hidden"
                                    onClick={() => onViewReview(request.reviewText)}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" /> View Review
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

  const loadReviewData = () => {
    // Load review requests from localStorage
    const submissions = JSON.parse(
      localStorage.getItem("reviewSubmissions") || "[]",
    );

    // Mock review requests data (including scheduled)
    const mockRequests: ReviewRequest[] = [
      {
        id: "s1",
        customerName: "Angela Torres",
        customerPhone: "(555) 707-8080",
        projectName: "Flooring Install",
        status: "scheduled",
        sentAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        linkClicked: false,
      },
      {
        id: "s2",
        customerName: "Brandon Lee",
        customerPhone: "(555) 909-1010",
        projectName: "Exterior Painting",
        status: "scheduled",
        sentAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        linkClicked: false,
      },
      {
        id: "s3",
        customerName: "Maria Gonzalez",
        customerPhone: "(555) 111-2222",
        projectName: "HVAC Service",
        status: "scheduled",
        sentAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        linkClicked: false,
      },
      {
        id: "1",
        customerName: "John Smith",
        customerPhone: "(555) 123-4567",
        projectName: "Kitchen Renovation",
        status: "completed",
        rating: 5,
        reviewText:
          "Excellent work! Smith Construction exceeded our expectations.",
        submittedAt: "2024-01-15T14:30:00Z",
        sentAt: "2024-01-14T10:00:00Z",
        linkClicked: true,
        redirectedToGoogle: true,
      },
      {
        id: "2",
        customerName: "Sarah Johnson",
        customerPhone: "(555) 234-5678",
        projectName: "Bathroom Remodel",
        status: "completed",
        rating: 4,
        reviewText: "Great service, very professional team.",
        submittedAt: "2024-01-12T16:45:00Z",
        sentAt: "2024-01-11T11:30:00Z",
        linkClicked: true,
        redirectedToGoogle: false,
      },
      {
        id: "3",
        customerName: "Mike Davis",
        customerPhone: "(555) 345-6789",
        projectName: "Deck Construction",
        status: "viewed",
        sentAt: "2024-01-10T09:15:00Z",
        linkClicked: true,
      },
      {
        id: "4",
        customerName: "Lisa Brown",
        customerPhone: "(555) 456-7890",
        projectName: "Home Addition",
        status: "sent",
        sentAt: "2024-01-09T13:20:00Z",
        linkClicked: false,
      },
      {
        id: "5",
        customerName: "Robert Wilson",
        customerPhone: "(555) 567-8901",
        projectName: "Roof Repair",
        status: "completed",
        rating: 3,
        reviewText: "Decent work, but communication could be better.",
        submittedAt: "2024-01-08T12:10:00Z",
        sentAt: "2024-01-07T15:45:00Z",
        linkClicked: true,
        redirectedToGoogle: false,
      },
    ];

    // Merge with actual submissions
    const allRequests = [
      ...mockRequests,
      ...submissions.map((sub: any) => ({
        id: sub.requestId,
        customerName: sub.customerName,
        customerPhone: "N/A",
        projectName: "Recent Project",
        status: "completed" as const,
        rating: sub.rating,
        reviewText: sub.reviewText,
        submittedAt: sub.submittedAt,
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        linkClicked: true,
        redirectedToGoogle: sub.redirectedToGoogle,
      })),
    ];

    setReviewRequests(allRequests);

    // Calculate stats
    const completed = allRequests.filter((r) => r.status === "completed");
    const withRatings = completed.filter((r) => r.rating);
    const avgRating =
      withRatings.reduce((sum, r) => sum + (r.rating || 0), 0) /
      withRatings.length;
    const googleRedirects = completed.filter(
      (r) => r.redirectedToGoogle,
    ).length;

    setStats({
      totalRequests: allRequests.length,
      completionRate: (completed.length / allRequests.length) * 100,
      averageRating: avgRating || 0,
      googleRedirects,
      monthlyTrend: 15.2, // Mock trend data
    });
  };

  const handleSendReviewRequest = (
    method: "sms" | "email" | "both",
    message: string,
  ) => {
    // Mock customer data for demo
    const customerName = "New Customer";
    const customerPhone = "(555) 123-4567";
    const customerEmail = "customer@email.com";
    const projectName = "Recent Project";

    if (method === "sms" || method === "both") {
      const phoneUrl = `sms:${customerPhone}?body=${encodeURIComponent(message)}`;
      window.open(phoneUrl);
    }

    if (method === "email" || method === "both") {
      const subject = `Review Request for ${projectName}`;
      const emailUrl = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.open(emailUrl);
    }

    // Store the review request
    const reviewId = Math.random().toString(36).substr(2, 9);
    const newRequest: ReviewRequest = {
      id: reviewId,
      customerName,
      customerPhone,
      projectName,
      status: "sent",
      sentAt: new Date().toISOString(),
    };

    const existingRequests = JSON.parse(
      localStorage.getItem("reviewRequests") || "[]",
    );
    existingRequests.push(newRequest);
    localStorage.setItem("reviewRequests", JSON.stringify(existingRequests));

    toast.success(`Review request sent via ${method}!`);
    setShowReviewRequest(false);
    loadReviewData();
  };

  const copyReviewLink = (id: string) => {
    const reviewLink = `${window.location.origin}/review/${id}`;
    navigator.clipboard.writeText(reviewLink);
    toast.success("Review link copied to clipboard!");
  };

  const cancelReviewRequest = (id: string, customerName: string) => {
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
              onClick={() => setShowReviewRequest(true)}
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
                onResend={() => setShowReviewRequest(true)}
                onCancel={cancelReviewRequest}
                onCopyText={copyReviewText}
                onViewReview={(text: string) => toast.info(text, { duration: 10000 })}
                getStatusBadge={getStatusBadge}
                searchTerm={searchTerm}
                formatDate={formatTableDate}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Review Request Dialog */}
        <ReviewRequest
          isOpen={showReviewRequest}
          onClose={() => setShowReviewRequest(false)}
          customerName="Customer"
          customerPhone="(555) 123-4567"
          customerEmail="customer@email.com"
          projectName="Recent Project"
          onSend={handleSendReviewRequest}
        />
      </div>
    </AppLayout>
  );
}
