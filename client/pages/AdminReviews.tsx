// @ts-nocheck - Temporary suppression of type errors
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatTableDate } from "@/lib/dateUtils";
import { ReviewRequest } from "@/components/ReviewRequest";

interface ReviewRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  projectName: string;
  status: "sent" | "viewed" | "completed" | "expired";
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
  const [sortBy, setSortBy] = useState("sentAt");
  const [showReviewRequest, setShowReviewRequest] = useState(false);

  useEffect(() => {
    loadReviewData();
  }, []);

  const loadReviewData = () => {
    // Load review requests from localStorage
    const submissions = JSON.parse(
      localStorage.getItem("reviewSubmissions") || "[]",
    );

    // Mock review requests data
    const mockRequests: ReviewRequest[] = [
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

  const filteredRequests = reviewRequests
    .filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      if (
        searchTerm &&
        !request.customerName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) &&
        !request.projectName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(request.reviewText || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const isDesc = sortBy.includes("-desc");
      const sortField = sortBy.replace("-desc", "");

      let aVal, bVal;

      switch (sortField) {
        case "sentAt":
          aVal = new Date(a.sentAt).getTime();
          bVal = new Date(b.sentAt).getTime();
          break;
        case "rating":
          aVal = a.rating || 0;
          bVal = b.rating || 0;
          break;
        case "customerName":
          aVal = a.customerName.toLowerCase();
          bVal = b.customerName.toLowerCase();
          break;
        case "status":
          const statusOrder = { completed: 4, viewed: 3, sent: 2, expired: 1 };
          aVal = statusOrder[a.status as keyof typeof statusOrder] || 0;
          bVal = statusOrder[b.status as keyof typeof statusOrder] || 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string") {
        return isDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }

      return isDesc ? bVal - aVal : aVal - bVal;
    });

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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/reviews/analytics")}
              className="gap-2 whitespace-nowrap w-full sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">View Analytics</span>
              <span className="sm:hidden">Analytics</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/review-demo")}
              className="gap-2 whitespace-nowrap w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Preview Review Gate</span>
              <span className="sm:hidden">Preview</span>
            </Button>
            <Button
              onClick={() => setShowReviewRequest(true)}
              className="gap-2 whitespace-nowrap w-full sm:w-auto"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send Review Request</span>
              <span className="sm:hidden">Send Request</span>
            </Button>
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

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers, projects, or review text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="viewed">Viewed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sentAt">Date Sent</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Review Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-hide">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setSortBy(
                          sortBy === "customerName"
                            ? "customerName-desc"
                            : "customerName",
                        )
                      }
                    >
                      Customer
                      {sortBy.includes("customerName") && (
                        <span className="ml-1">
                          {sortBy.includes("desc") ? "↓" : "↑"}
                        </span>
                      )}
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Project
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setSortBy(
                          sortBy === "status" ? "status-desc" : "status",
                        )
                      }
                    >
                      Status
                      {sortBy.includes("status") && (
                        <span className="ml-1">
                          {sortBy.includes("desc") ? "↓" : "↑"}
                        </span>
                      )}
                    </TableHead>
                    <TableHead
                      className="hidden md:table-cell cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setSortBy(
                          sortBy === "rating" ? "rating-desc" : "rating",
                        )
                      }
                    >
                      Rating
                      {sortBy.includes("rating") && (
                        <span className="ml-1">
                          {sortBy.includes("desc") ? "↓" : "↑"}
                        </span>
                      )}
                    </TableHead>
                    <TableHead
                      className="hidden lg:table-cell cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setSortBy(
                          sortBy === "sentAt" ? "sentAt-desc" : "sentAt",
                        )
                      }
                    >
                      Sent Date
                      {sortBy.includes("sentAt") && (
                        <span className="ml-1">
                          {sortBy.includes("desc") ? "↓" : "↑"}
                        </span>
                      )}
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      Review Text
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm sm:text-base">
                            {request.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {request.customerPhone}
                          </p>
                          <div className="sm:hidden mt-1 space-y-1">
                            <div className="text-xs text-muted-foreground">
                              {request.projectName}
                            </div>
                            <div className="md:hidden flex items-center gap-1">
                              {request.rating ? (
                                <>
                                  <StarRating
                                    rating={request.rating}
                                    onRatingChange={() => {}}
                                    readonly
                                    size="sm"
                                  />
                                  <span className="text-xs">
                                    {request.rating}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  No rating
                                </span>
                              )}
                            </div>
                            <div className="lg:hidden text-xs text-muted-foreground">
                              {formatTableDate(request.sentAt)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="truncate text-sm">
                          {request.projectName}
                        </p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status, request.linkClicked)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
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
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          {formatTableDate(request.sentAt)}
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.sentAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {request.reviewText ? (
                          <div className="space-y-2 max-w-[200px]">
                            <p className="text-sm line-clamp-2 break-words">
                              {request.reviewText.length > 60
                                ? `${request.reviewText.substring(0, 60)}...`
                                : request.reviewText}
                            </p>
                            {request.reviewText.length > 60 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toast.info(request.reviewText, {
                                    duration: 10000,
                                  })
                                }
                                className="h-6 px-2 text-xs"
                              >
                                Read More
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            No review yet
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => copyReviewLink(request.id)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                sendReviewRequest(
                                  request.customerName,
                                  request.projectName,
                                )
                              }
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Resend Request
                            </DropdownMenuItem>
                            {request.status === "sent" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  cancelReviewRequest(
                                    request.id,
                                    request.customerName,
                                  )
                                }
                                className="text-red-600 focus:text-red-600"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel Request
                              </DropdownMenuItem>
                            )}
                            {request.reviewText && (
                              <DropdownMenuItem
                                onClick={() =>
                                  copyReviewText(request.reviewText!)
                                }
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Review Text
                              </DropdownMenuItem>
                            )}
                            <div className="xl:hidden">
                              {request.reviewText && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    toast.info(request.reviewText, {
                                      duration: 10000,
                                    })
                                  }
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  View Review
                                </DropdownMenuItem>
                              )}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

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
