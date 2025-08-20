import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Globe,
  FileText,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  ExternalLink,
  Copy,
  Filter,
  BarChart3,
  Zap,
  Shield,
  Smartphone,
  Link,
  Image,
  Code,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";

interface AuditReport {
  id: string;
  website_url: string;
  report_title: string;
  audit_type: "on_page" | "off_page" | "comprehensive";
  status: "pending" | "running" | "completed" | "failed";
  summary_metrics: {
    overall_score: number;
    total_pages_analyzed: number;
    total_issues_found: number;
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
  };
  public_share_token: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  audit_findings: AuditFinding[];
}

interface AuditFinding {
  id: string;
  category: string;
  subcategory: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  recommendation: string;
  page_url: string;
  impact_score: number;
  fix_difficulty: "easy" | "medium" | "hard";
  estimated_fix_time: number;
}

interface NewAuditForm {
  websiteUrl: string;
  reportTitle: string;
  auditType: "on_page" | "off_page" | "comprehensive";
  maxPages: number;
}

export default function AuditReport() {
  const { user } = useAuth();
  const token = user?.token;
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [showNewAuditDialog, setShowNewAuditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [newAuditForm, setNewAuditForm] = useState<NewAuditForm>({
    websiteUrl: "",
    reportTitle: "",
    auditType: "comprehensive",
    maxPages: 50,
  });

  useEffect(() => {
    loadReports();
  }, [token]);

  const loadReports = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch("/api/audit-report/reports", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        throw new Error("Failed to load reports");
      }
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Failed to load audit reports");
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async (reportId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/audit-report/${reportId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedReport(data.report);
      } else {
        throw new Error("Failed to load report details");
      }
    } catch (error) {
      console.error("Error loading report details:", error);
      toast.error("Failed to load report details");
    }
  };

  const startNewAudit = async () => {
    if (!token || !newAuditForm.websiteUrl) return;

    try {
      setRunningAudit(true);

      // Validate URL
      const url = new URL(
        newAuditForm.websiteUrl.startsWith("http")
          ? newAuditForm.websiteUrl
          : `https://${newAuditForm.websiteUrl}`,
      );

      const response = await fetch("/api/audit-report/start-audit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteUrl: url.toString(),
          reportTitle:
            newAuditForm.reportTitle || `SEO Audit for ${url.hostname}`,
          auditType: newAuditForm.auditType,
          maxPages: newAuditForm.maxPages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Audit started successfully! Score: ${data.auditScore}/100`,
        );
        setShowNewAuditDialog(false);
        setNewAuditForm({
          websiteUrl: "",
          reportTitle: "",
          auditType: "comprehensive",
          maxPages: 50,
        });
        loadReports();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start audit");
      }
    } catch (error) {
      console.error("Error starting audit:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start audit",
      );
    } finally {
      setRunningAudit(false);
    }
  };

  const generatePDF = async (report: AuditReport) => {
    if (!token) return;

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: report.id,
        }),
      });

      if (response.ok) {
        const htmlContent = await response.text();

        // Open in new window for printing
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();

          // Trigger print dialog after content loads
          printWindow.onload = () => {
            printWindow.print();
          };
        }

        toast.success("PDF preview opened in new window");
      } else {
        throw new Error("Failed to generate PDF");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const shareReport = async (report: AuditReport) => {
    if (!token) return;

    try {
      // Make report public if not already
      if (!report.is_public) {
        // TODO: Implement public sharing toggle
        toast.info("Public sharing feature coming soon!");
        return;
      }

      // Copy share URL to clipboard
      const shareUrl = `${window.location.origin}/public/audit-report/${report.public_share_token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share URL copied to clipboard!");
    } catch (error) {
      console.error("Error sharing report:", error);
      toast.error("Failed to copy share URL");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      case "info":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const filteredFindings =
    selectedReport?.audit_findings?.filter((finding) => {
      const severityMatch =
        filterSeverity === "all" || finding.severity === filterSeverity;
      const categoryMatch =
        filterCategory === "all" || finding.category === filterCategory;
      return severityMatch && categoryMatch;
    }) || [];

  const categories = [
    ...new Set(selectedReport?.audit_findings?.map((f) => f.category) || []),
  ];

  return (
    <AppLayout
      title="SEO Audit Reports"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/projects" },
        { label: "Audit Reports" },
      ]}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SEO Audit Reports</h1>
            <p className="text-muted-foreground">
              Comprehensive technical SEO analysis powered by DataForSEO
            </p>
          </div>
          <Dialog
            open={showNewAuditDialog}
            onOpenChange={setShowNewAuditDialog}
          >
            <DialogTrigger asChild>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Start New Audit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Start New SEO Audit</DialogTitle>
                <DialogDescription>
                  Analyze your website's technical SEO performance and get
                  actionable recommendations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="website-url">Website URL *</Label>
                  <Input
                    id="website-url"
                    placeholder="https://example.com"
                    value={newAuditForm.websiteUrl}
                    onChange={(e) =>
                      setNewAuditForm((prev) => ({
                        ...prev,
                        websiteUrl: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-title">Report Title</Label>
                  <Input
                    id="report-title"
                    placeholder="Custom report name (optional)"
                    value={newAuditForm.reportTitle}
                    onChange={(e) =>
                      setNewAuditForm((prev) => ({
                        ...prev,
                        reportTitle: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audit-type">Audit Type</Label>
                  <Select
                    value={newAuditForm.auditType}
                    onValueChange={(value: any) =>
                      setNewAuditForm((prev) => ({ ...prev, auditType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprehensive">
                        Comprehensive (On-page + Off-page)
                      </SelectItem>
                      <SelectItem value="on_page">On-page Only</SelectItem>
                      <SelectItem value="off_page">Off-page Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-pages">Max Pages to Analyze</Label>
                  <Select
                    value={newAuditForm.maxPages.toString()}
                    onValueChange={(value) =>
                      setNewAuditForm((prev) => ({
                        ...prev,
                        maxPages: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 pages</SelectItem>
                      <SelectItem value="25">25 pages</SelectItem>
                      <SelectItem value="50">50 pages</SelectItem>
                      <SelectItem value="100">100 pages</SelectItem>
                      <SelectItem value="250">250 pages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowNewAuditDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={startNewAudit}
                    disabled={runningAudit || !newAuditForm.websiteUrl}
                  >
                    {runningAudit && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Start Audit
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Reports List */}
        {!selectedReport && (
          <div>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading audit reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    No audit reports yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Start your first SEO audit to analyze your website's
                    performance.
                  </p>
                  <Button onClick={() => setShowNewAuditDialog(true)}>
                    <Play className="h-4 w-4 mr-2" />
                    Start New Audit
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {reports.map((report) => (
                  <Card
                    key={report.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Globe className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold">
                              {report.report_title}
                            </h3>
                            <Badge variant="outline" className="capitalize">
                              {report.audit_type.replace("_", " ")}
                            </Badge>
                            <Badge
                              variant={
                                report.status === "completed"
                                  ? "default"
                                  : report.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {report.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {report.website_url}
                          </p>
                          {report.summary_metrics && (
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Score:
                                </span>
                                <span
                                  className={`font-bold ${getScoreColor(report.summary_metrics.overall_score)}`}
                                >
                                  {report.summary_metrics.overall_score}/100
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Issues:
                                </span>
                                <span className="font-medium">
                                  {report.summary_metrics.total_issues_found}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Pages:
                                </span>
                                <span className="font-medium">
                                  {report.summary_metrics.total_pages_analyzed}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generatePDF(report)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => shareReport(report)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadReportDetails(report.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report Details */}
        {selectedReport && (
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="ghost" onClick={() => setSelectedReport(null)}>
              ← Back to Reports
            </Button>

            {/* Report Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      {selectedReport.report_title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {selectedReport.website_url} •{" "}
                      {new Date(selectedReport.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => generatePDF(selectedReport)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => shareReport(selectedReport)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Report
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedReport.summary_metrics && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold ${getScoreColor(selectedReport.summary_metrics.overall_score)}`}
                      >
                        {selectedReport.summary_metrics.overall_score}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Overall Score
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {selectedReport.summary_metrics.total_issues_found}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Issues
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {selectedReport.summary_metrics.total_pages_analyzed}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pages Analyzed
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex justify-center gap-2">
                        <span className="text-red-600 font-semibold">
                          {selectedReport.summary_metrics.critical_issues}
                        </span>
                        <span className="text-orange-600 font-semibold">
                          {selectedReport.summary_metrics.high_issues}
                        </span>
                        <span className="text-yellow-600 font-semibold">
                          {selectedReport.summary_metrics.medium_issues}
                        </span>
                        <span className="text-blue-600 font-semibold">
                          {selectedReport.summary_metrics.low_issues}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Critical • High • Medium • Low
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Issues and Findings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Issues & Recommendations</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select
                      value={filterSeverity}
                      onValueChange={setFilterSeverity}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filterCategory}
                      onValueChange={setFilterCategory}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem
                            key={category}
                            value={category}
                            className="capitalize"
                          >
                            {category.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredFindings.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold mb-2">
                      No issues found
                    </h3>
                    <p className="text-muted-foreground">
                      {selectedReport.audit_findings?.length === 0
                        ? "Great! Your website has no technical SEO issues."
                        : "No issues match the current filters."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Issue</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Fix Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFindings.map((finding) => (
                        <TableRow key={finding.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{finding.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {finding.description.substring(0, 100)}...
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getSeverityColor(finding.severity)}
                            >
                              {finding.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">
                            {finding.category.replace("_", " ")}
                          </TableCell>
                          <TableCell>
                            <a
                              href={finding.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <span className="truncate max-w-[200px]">
                                {finding.page_url.replace(/^https?:\/\//, "")}
                              </span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {finding.estimated_fix_time}m
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
