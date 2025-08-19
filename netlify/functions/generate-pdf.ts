import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple HTML to PDF conversion using browser rendering
// In a production environment, you might want to use puppeteer or similar
function generateHTMLContent(report: any): string {
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#16a34a';
    if (score >= 70) return '#d97706';
    if (score >= 50) return '#ea580c';
    return '#dc2626';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#2563eb';
      default: return '#6b7280';
    }
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${report.report_title} - SEO Audit Report</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background: white;
          }
          
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 10px;
          }
          
          .title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1f2937;
          }
          
          .url {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 20px;
          }
          
          .score-section {
            background: #f8fafc;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .overall-score {
            font-size: 72px;
            font-weight: bold;
            color: ${getScoreColor(report.summary_metrics?.overall_score || 0)};
            margin-bottom: 10px;
          }
          
          .score-label {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 20px;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-top: 20px;
          }
          
          .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          
          .metric-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
            color: #1f2937;
          }
          
          .metric-label {
            font-size: 14px;
            color: #6b7280;
          }
          
          .severity-breakdown {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 10px;
          }
          
          .severity-item {
            text-align: center;
          }
          
          .severity-count {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .severity-label {
            font-size: 12px;
            color: #6b7280;
          }
          
          .findings-section {
            margin-top: 40px;
          }
          
          .section-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #1f2937;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 10px;
          }
          
          .finding {
            margin-bottom: 25px;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          
          .finding-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 15px;
          }
          
          .finding-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
            color: #1f2937;
          }
          
          .finding-meta {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
          }
          
          .severity-badge, .category-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          .description {
            margin-bottom: 15px;
            color: #4b5563;
            line-height: 1.6;
          }
          
          .recommendation {
            background: #eff6ff;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
            margin-bottom: 15px;
          }
          
          .recommendation-title {
            font-weight: bold;
            color: #1d4ed8;
            margin-bottom: 5px;
          }
          
          .recommendation-text {
            color: #1e40af;
            line-height: 1.5;
          }
          
          .finding-details {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 10px;
            border-top: 1px solid #f3f4f6;
            font-size: 14px;
            color: #6b7280;
          }
          
          .page-url {
            color: #3b82f6;
            text-decoration: none;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          
          @media print {
            body { margin: 0; padding: 15px; }
            .header { margin-bottom: 30px; }
            .finding { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🔍 SEO Audit Report</div>
          <h1 class="title">${report.report_title}</h1>
          <div class="url">${report.website_url}</div>
          <div style="font-size: 14px; color: #6b7280;">
            Generated on ${new Date(report.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        <div class="score-section">
          <div class="overall-score">${report.summary_metrics?.overall_score || 0}</div>
          <div class="score-label">Overall SEO Score</div>
          
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-value">${report.summary_metrics?.total_issues_found || 0}</div>
              <div class="metric-label">Total Issues</div>
            </div>
            <div class="metric">
              <div class="metric-value">${report.summary_metrics?.total_pages_analyzed || 0}</div>
              <div class="metric-label">Pages Analyzed</div>
            </div>
            <div class="metric">
              <div class="metric-value">${report.summary_metrics?.critical_issues || 0}</div>
              <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric">
              <div class="severity-breakdown">
                <div class="severity-item">
                  <div class="severity-count" style="color: #dc2626;">${report.summary_metrics?.critical_issues || 0}</div>
                  <div class="severity-label">Critical</div>
                </div>
                <div class="severity-item">
                  <div class="severity-count" style="color: #ea580c;">${report.summary_metrics?.high_issues || 0}</div>
                  <div class="severity-label">High</div>
                </div>
                <div class="severity-item">
                  <div class="severity-count" style="color: #d97706;">${report.summary_metrics?.medium_issues || 0}</div>
                  <div class="severity-label">Medium</div>
                </div>
                <div class="severity-item">
                  <div class="severity-count" style="color: #2563eb;">${report.summary_metrics?.low_issues || 0}</div>
                  <div class="severity-label">Low</div>
                </div>
              </div>
              <div class="metric-label">Issue Breakdown</div>
            </div>
          </div>
        </div>

        <div class="findings-section">
          <h2 class="section-title">Issues & Recommendations</h2>
          ${(report.audit_findings || []).map((finding: any) => `
            <div class="finding" style="border-left: 4px solid ${getSeverityColor(finding.severity)};">
              <div class="finding-header">
                <div>
                  <h3 class="finding-title">${finding.title}</h3>
                  <div class="finding-meta">
                    <span class="severity-badge" style="background: ${getSeverityColor(finding.severity)}; color: white;">
                      ${finding.severity.toUpperCase()}
                    </span>
                    <span class="category-badge" style="background: #f3f4f6; color: #374151;">
                      ${finding.category.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="description">${finding.description}</div>
              
              <div class="recommendation">
                <div class="recommendation-title">💡 Recommendation:</div>
                <div class="recommendation-text">${finding.recommendation}</div>
              </div>
              
              <div class="finding-details">
                <span>Page: <a href="${finding.page_url}" class="page-url">${finding.page_url}</a></span>
                <span>Fix Time: ${finding.estimated_fix_time} minutes</span>
                <span>Difficulty: ${finding.fix_difficulty}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="footer">
          <p><strong>SEO Audit Report</strong></p>
          <p>This comprehensive technical SEO analysis was generated using advanced crawling and analysis tools.</p>
          <p style="margin-top: 10px;">For questions about this report or to request additional analysis, please contact your SEO specialist.</p>
        </div>
      </body>
    </html>
  `;
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get auth token from header for private reports
    const authHeader = event.headers.authorization;
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    const { reportId, shareToken } = JSON.parse(event.body || '{}');

    let report;

    if (shareToken) {
      // Public report access
      const { data, error } = await supabase
        .from('audit_reports')
        .select(`
          id, website_url, report_title, audit_type, summary_metrics, created_at,
          audit_findings(id, category, subcategory, severity, title, description, recommendation, page_url, impact_score, fix_difficulty, estimated_fix_time)
        `)
        .eq('public_share_token', shareToken)
        .eq('is_public', true)
        .or(`public_expiry_date.is.null,public_expiry_date.gt.${new Date().toISOString()}`)
        .single();

      if (error || !data) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Report not found or not publicly accessible' }),
        };
      }
      report = data;
    } else if (reportId && userId) {
      // Private report access
      const { data, error } = await supabase
        .from('audit_reports')
        .select(`
          *,
          audit_findings(*)
        `)
        .eq('id', reportId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Report not found' }),
        };
      }
      report = data;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Either reportId with authentication or shareToken is required' }),
      };
    }

    // Generate HTML content
    const htmlContent = generateHTMLContent(report);

    // Return HTML for client-side PDF generation
    // In production, you might want to use a service like Puppeteer to generate actual PDFs
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
      },
      body: htmlContent,
    };

  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
