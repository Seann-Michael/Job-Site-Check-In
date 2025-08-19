import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Globe,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  BarChart3,
  Shield,
  Zap,
  Eye,
  FileText,
  Loader2,
} from 'lucide-react';

interface PublicAuditReport {
  id: string;
  website_url: string;
  report_title: string;
  audit_type: 'on_page' | 'off_page' | 'comprehensive';
  summary_metrics: {
    overall_score: number;
    total_pages_analyzed: number;
    total_issues_found: number;
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
  };
  created_at: string;
  audit_findings: PublicAuditFinding[];
}

interface PublicAuditFinding {
  id: string;
  category: string;
  subcategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  page_url: string;
  impact_score: number;
  fix_difficulty: 'easy' | 'medium' | 'hard';
  estimated_fix_time: number;
}

export default function PublicAuditReport() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [report, setReport] = useState<PublicAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    loadPublicReport();
  }, [shareToken]);

  const loadPublicReport = async () => {
    if (!shareToken) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/audit-report/public/${shareToken}`);

      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      } else if (response.status === 404) {
        setError('Report not found or no longer available');
      } else if (response.status === 403) {
        setError('This report is not publicly accessible');
      } else {
        setError('Failed to load report');
      }
    } catch (error) {
      console.error('Error loading public report:', error);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    // TODO: Implement PDF generation for public reports
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${report?.report_title} - SEO Audit Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .score { font-size: 48px; font-weight: bold; color: ${getScoreColor(report?.summary_metrics.overall_score || 0)}; }
              .metrics { display: flex; justify-content: space-around; margin: 20px 0; }
              .metric { text-align: center; }
              .findings { margin-top: 30px; }
              .finding { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
              .severity-critical { border-left: 4px solid #dc2626; }
              .severity-high { border-left: 4px solid #ea580c; }
              .severity-medium { border-left: 4px solid #d97706; }
              .severity-low { border-left: 4px solid #2563eb; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${report?.report_title}</h1>
              <p>${report?.website_url}</p>
              <div class="score">${report?.summary_metrics.overall_score}/100</div>
              <p>Overall SEO Score</p>
            </div>
            <div class="metrics">
              <div class="metric">
                <h3>${report?.summary_metrics.total_issues_found}</h3>
                <p>Total Issues</p>
              </div>
              <div class="metric">
                <h3>${report?.summary_metrics.total_pages_analyzed}</h3>
                <p>Pages Analyzed</p>
              </div>
              <div class="metric">
                <h3>${report?.summary_metrics.critical_issues}</h3>
                <p>Critical Issues</p>
              </div>
            </div>
            <div class="findings">
              <h2>Issues & Recommendations</h2>
              ${report?.audit_findings.map(finding => `
                <div class="finding severity-${finding.severity}">
                  <h3>${finding.title}</h3>
                  <p><strong>Severity:</strong> ${finding.severity.toUpperCase()}</p>
                  <p><strong>Description:</strong> ${finding.description}</p>
                  <p><strong>Recommendation:</strong> ${finding.recommendation}</p>
                  <p><strong>Page:</strong> ${finding.page_url}</p>
                  <p><strong>Estimated Fix Time:</strong> ${finding.estimated_fix_time} minutes</p>
                </div>
              `).join('')}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'info': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#16a34a';
    if (score >= 70) return '#d97706';
    if (score >= 50) return '#ea580c';
    return '#dc2626';
  };

  const filteredFindings = report?.audit_findings?.filter(finding => {
    const severityMatch = filterSeverity === 'all' || finding.severity === filterSeverity;
    const categoryMatch = filterCategory === 'all' || finding.category === filterCategory;
    return severityMatch && categoryMatch;
  }) || [];

  const categories = [...new Set(report?.audit_findings?.map(f => f.category) || [])];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading audit report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Report Not Available</h3>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Report Data</h3>
            <p className="text-muted-foreground">Unable to load report data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">SEO Audit Report</span>
            </div>
            <Button onClick={generatePDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Report Header */}
        <Card>
          <CardHeader>
            <div className="text-center">
              <CardTitle className="text-2xl mb-2">{report.report_title}</CardTitle>
              <CardDescription className="text-lg mb-4">{report.website_url}</CardDescription>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge variant="outline" className="capitalize">
                  {report.audit_type.replace('_', ' ')} Audit
                </Badge>
                <Badge variant="outline">
                  {new Date(report.created_at).toLocaleDateString()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div 
                  className="text-4xl font-bold mb-2"
                  style={{ color: getScoreColor(report.summary_metrics.overall_score) }}
                >
                  {report.summary_metrics.overall_score}
                </div>
                <div className="text-lg font-medium">Overall Score</div>
                <Progress 
                  value={report.summary_metrics.overall_score} 
                  className="mt-2" 
                />
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">{report.summary_metrics.total_issues_found}</div>
                <div className="text-lg font-medium">Total Issues</div>
                <div className="text-sm text-muted-foreground mt-2">Found across all pages</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">{report.summary_metrics.total_pages_analyzed}</div>
                <div className="text-lg font-medium">Pages Analyzed</div>
                <div className="text-sm text-muted-foreground mt-2">Technical scan depth</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center gap-3 mb-2">
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600">{report.summary_metrics.critical_issues}</div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-orange-600">{report.summary_metrics.high_issues}</div>
                    <div className="text-xs text-muted-foreground">High</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-600">{report.summary_metrics.medium_issues}</div>
                    <div className="text-xs text-muted-foreground">Medium</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{report.summary_metrics.low_issues}</div>
                    <div className="text-xs text-muted-foreground">Low</div>
                  </div>
                </div>
                <div className="text-lg font-medium">Issue Breakdown</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issues and Findings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Issues & Recommendations</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
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
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="capitalize">
                        {category.replace('_', ' ')}
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
                <h3 className="text-lg font-semibold mb-2">No issues found</h3>
                <p className="text-muted-foreground">
                  {report.audit_findings?.length === 0 
                    ? "Great! This website has no technical SEO issues."
                    : "No issues match the current filters."
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFindings.map((finding) => (
                  <Card key={finding.id} className="border-l-4" style={{
                    borderLeftColor: finding.severity === 'critical' ? '#dc2626' :
                                   finding.severity === 'high' ? '#ea580c' :
                                   finding.severity === 'medium' ? '#d97706' :
                                   finding.severity === 'low' ? '#2563eb' : '#6b7280'
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold">{finding.title}</h4>
                            <Badge className={getSeverityColor(finding.severity)}>
                              {finding.severity}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {finding.category.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-3">{finding.description}</p>
                          <div className="bg-blue-50 p-3 rounded-md mb-3">
                            <h5 className="font-medium text-sm mb-1">💡 Recommendation:</h5>
                            <p className="text-sm">{finding.recommendation}</p>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <a 
                                href={finding.page_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <span className="truncate max-w-[300px]">
                                  {finding.page_url}
                                </span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Est. fix time: {finding.estimated_fix_time} minutes
                              </div>
                              <div className="capitalize">
                                Difficulty: {finding.fix_difficulty}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-8 border-t">
          <p>This SEO audit report was generated using advanced technical analysis tools.</p>
          <p className="mt-2">For questions about this report, please contact the website owner.</p>
        </div>
      </div>
    </div>
  );
}
