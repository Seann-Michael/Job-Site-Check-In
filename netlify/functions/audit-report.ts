import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DataForSEO API configuration
const DATAFORSEO_API_LOGIN = process.env.DATAFORSEO_API_LOGIN || '';
const DATAFORSEO_API_PASSWORD = process.env.DATAFORSEO_API_PASSWORD || '';
const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com/v3';

interface AuditRequest {
  websiteUrl: string;
  reportTitle?: string;
  auditType: 'on_page' | 'off_page' | 'comprehensive';
  includeKeywords?: string[];
  maxPages?: number;
}

interface DataForSEOCredentials {
  login: string;
  password: string;
}

// Helper function to make DataForSEO API calls
async function callDataForSEOAPI(endpoint: string, data: any, credentials: DataForSEOCredentials) {
  const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
  
  const response = await fetch(`${DATAFORSEO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Function to start on-page audit
async function startOnPageAudit(websiteUrl: string, maxPages: number = 100) {
  const credentials = {
    login: DATAFORSEO_API_LOGIN,
    password: DATAFORSEO_API_PASSWORD,
  };

  const taskData = [{
    target: websiteUrl,
    max_crawl_pages: maxPages,
    load_resources: true,
    enable_javascript: true,
    enable_browser_rendering: true,
    enable_xhr: true,
    custom_js: '',
    browser_preset: 'desktop',
    crawl_delay: 1,
  }];

  const result = await callDataForSEOAPI('/on_page/task_post', taskData, credentials);
  return result;
}

// Function to start backlinks audit
async function startBacklinksAudit(websiteUrl: string) {
  const credentials = {
    login: DATAFORSEO_API_LOGIN,
    password: DATAFORSEO_API_PASSWORD,
  };

  const taskData = [{
    target: websiteUrl,
    limit: 1000,
    filters: ["dofollow", "=", true],
    order_by: ["rank", "desc"],
  }];

  const result = await callDataForSEOAPI('/backlinks/summary/live', taskData, credentials);
  return result;
}

// Function to get page speed insights
async function getPageSpeedInsights(websiteUrl: string) {
  const credentials = {
    login: DATAFORSEO_API_LOGIN,
    password: DATAFORSEO_API_PASSWORD,
  };

  const taskData = [{
    url: websiteUrl,
    device: 'desktop',
    load_resources: true,
  }];

  const result = await callDataForSEOAPI('/page_speed/live', taskData, credentials);
  return result;
}

// Function to analyze technical SEO issues
function analyzeTechnicalIssues(onPageData: any): any[] {
  const findings: any[] = [];

  if (onPageData && onPageData.tasks && onPageData.tasks[0] && onPageData.tasks[0].result) {
    const pages = onPageData.tasks[0].result;

    pages.forEach((page: any) => {
      const url = page.url;
      
      // Check for missing title tags
      if (!page.meta || !page.meta.title) {
        findings.push({
          category: 'technical',
          subcategory: 'meta_tags',
          severity: 'high',
          title: 'Missing Title Tag',
          description: `The page ${url} is missing a title tag.`,
          recommendation: 'Add a descriptive title tag (50-60 characters) that includes your target keywords.',
          page_url: url,
          impact_score: 85,
          fix_difficulty: 'easy',
          estimated_fix_time: 15,
        });
      }

      // Check for title length
      if (page.meta && page.meta.title && page.meta.title.length > 60) {
        findings.push({
          category: 'technical',
          subcategory: 'meta_tags',
          severity: 'medium',
          title: 'Title Tag Too Long',
          description: `The title tag on ${url} is ${page.meta.title.length} characters, which may be truncated in search results.`,
          recommendation: 'Optimize title tag to be between 50-60 characters for better search result display.',
          page_url: url,
          impact_score: 65,
          fix_difficulty: 'easy',
          estimated_fix_time: 10,
        });
      }

      // Check for missing meta description
      if (!page.meta || !page.meta.description) {
        findings.push({
          category: 'technical',
          subcategory: 'meta_tags',
          severity: 'medium',
          title: 'Missing Meta Description',
          description: `The page ${url} is missing a meta description.`,
          recommendation: 'Add a compelling meta description (150-160 characters) that summarizes the page content.',
          page_url: url,
          impact_score: 70,
          fix_difficulty: 'easy',
          estimated_fix_time: 15,
        });
      }

      // Check for multiple H1 tags
      if (page.meta && page.meta.htags && page.meta.htags.h1 && page.meta.htags.h1.length > 1) {
        findings.push({
          category: 'technical',
          subcategory: 'heading_structure',
          severity: 'medium',
          title: 'Multiple H1 Tags',
          description: `The page ${url} has ${page.meta.htags.h1.length} H1 tags.`,
          recommendation: 'Use only one H1 tag per page for better SEO structure.',
          page_url: url,
          impact_score: 60,
          fix_difficulty: 'medium',
          estimated_fix_time: 30,
        });
      }

      // Check for images without alt text
      if (page.meta && page.meta.images) {
        const imagesWithoutAlt = page.meta.images.filter((img: any) => !img.alt || img.alt.trim() === '');
        if (imagesWithoutAlt.length > 0) {
          findings.push({
            category: 'technical',
            subcategory: 'accessibility',
            severity: 'medium',
            title: 'Images Missing Alt Text',
            description: `${imagesWithoutAlt.length} images on ${url} are missing alt text.`,
            recommendation: 'Add descriptive alt text to all images for better accessibility and SEO.',
            page_url: url,
            impact_score: 55,
            fix_difficulty: 'easy',
            estimated_fix_time: imagesWithoutAlt.length * 5,
          });
        }
      }

      // Check for slow loading pages
      if (page.page_timing && page.page_timing.time_to_interactive > 3000) {
        findings.push({
          category: 'performance',
          subcategory: 'page_speed',
          severity: 'high',
          title: 'Slow Page Load Time',
          description: `The page ${url} has a time to interactive of ${page.page_timing.time_to_interactive}ms.`,
          recommendation: 'Optimize images, minify CSS/JS, and consider using a CDN to improve page speed.',
          page_url: url,
          impact_score: 80,
          fix_difficulty: 'hard',
          estimated_fix_time: 120,
        });
      }

      // Check for broken internal links
      if (page.broken_links && page.broken_links.length > 0) {
        findings.push({
          category: 'technical',
          subcategory: 'links',
          severity: 'high',
          title: 'Broken Internal Links',
          description: `${page.broken_links.length} broken internal links found on ${url}.`,
          recommendation: 'Fix or remove broken internal links to improve user experience and crawlability.',
          page_url: url,
          impact_score: 75,
          fix_difficulty: 'medium',
          estimated_fix_time: page.broken_links.length * 10,
        });
      }
    });
  }

  return findings;
}

// Function to calculate overall audit score
function calculateAuditScore(findings: any[]): number {
  if (findings.length === 0) return 100;

  const severityWeights = {
    critical: 10,
    high: 7,
    medium: 4,
    low: 2,
    info: 1,
  };

  const totalImpact = findings.reduce((sum, finding) => {
    const weight = severityWeights[finding.severity as keyof typeof severityWeights] || 1;
    return sum + (finding.impact_score * weight);
  }, 0);

  const maxPossibleImpact = findings.length * 100 * 10; // Assuming worst case (all critical)
  const score = Math.max(0, 100 - (totalImpact / maxPossibleImpact) * 100);
  
  return Math.round(score);
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get auth token from header
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }),
      };
    }

    const token = authHeader.substring(7);
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    const userId = user.id;
    const pathParts = event.path.split('/').filter(Boolean);
    const operation = pathParts[pathParts.length - 1];

    switch (event.httpMethod) {
      case 'POST':
        if (operation === 'start-audit') {
          const auditRequest: AuditRequest = JSON.parse(event.body || '{}');
          
          // Validate request
          if (!auditRequest.websiteUrl) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Website URL is required' }),
            };
          }

          // Create audit report record
          const { data: auditReport, error: createError } = await supabase
            .from('audit_reports')
            .insert({
              user_id: userId,
              website_url: auditRequest.websiteUrl,
              report_title: auditRequest.reportTitle || `SEO Audit for ${auditRequest.websiteUrl}`,
              audit_type: auditRequest.auditType,
              status: 'running',
              processing_started_at: new Date().toISOString(),
              audit_config: {
                max_pages: auditRequest.maxPages || 50,
                include_keywords: auditRequest.includeKeywords || [],
              },
            })
            .select()
            .single();

          if (createError) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: createError.message }),
            };
          }

          // Start DataForSEO audits asynchronously
          try {
            let onPageResults = null;
            let offPageResults = null;
            let pageSpeedResults = null;

            if (auditRequest.auditType === 'on_page' || auditRequest.auditType === 'comprehensive') {
              onPageResults = await startOnPageAudit(auditRequest.websiteUrl, auditRequest.maxPages);
              pageSpeedResults = await getPageSpeedInsights(auditRequest.websiteUrl);
            }

            if (auditRequest.auditType === 'off_page' || auditRequest.auditType === 'comprehensive') {
              offPageResults = await startBacklinksAudit(auditRequest.websiteUrl);
            }

            // Analyze results and generate findings
            const findings = analyzeTechnicalIssues(onPageResults);
            const auditScore = calculateAuditScore(findings);

            // Update audit report with results
            const { error: updateError } = await supabase
              .from('audit_reports')
              .update({
                on_page_results: onPageResults,
                off_page_results: offPageResults,
                technical_results: pageSpeedResults,
                summary_metrics: {
                  overall_score: auditScore,
                  total_pages_analyzed: onPageResults?.tasks?.[0]?.result?.length || 0,
                  total_issues_found: findings.length,
                  critical_issues: findings.filter(f => f.severity === 'critical').length,
                  high_issues: findings.filter(f => f.severity === 'high').length,
                  medium_issues: findings.filter(f => f.severity === 'medium').length,
                  low_issues: findings.filter(f => f.severity === 'low').length,
                },
                status: 'completed',
                processing_completed_at: new Date().toISOString(),
              })
              .eq('id', auditReport.id);

            if (updateError) {
              throw updateError;
            }

            // Insert findings
            if (findings.length > 0) {
              const findingsToInsert = findings.map(finding => ({
                ...finding,
                audit_report_id: auditReport.id,
              }));

              await supabase
                .from('audit_findings')
                .insert(findingsToInsert);
            }

            return {
              statusCode: 201,
              headers,
              body: JSON.stringify({
                success: true,
                auditId: auditReport.id,
                auditScore,
                totalIssues: findings.length,
              }),
            };

          } catch (apiError) {
            // Update audit report with error status
            await supabase
              .from('audit_reports')
              .update({
                status: 'failed',
                error_message: apiError instanceof Error ? apiError.message : 'Unknown error',
                processing_completed_at: new Date().toISOString(),
              })
              .eq('id', auditReport.id);

            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ 
                error: 'Failed to complete audit',
                details: apiError instanceof Error ? apiError.message : 'Unknown error'
              }),
            };
          }
        }
        break;

      case 'GET':
        if (operation === 'reports') {
          // Get user's audit reports
          const { data: reports, error } = await supabase
            .from('audit_reports')
            .select('id, website_url, report_title, audit_type, status, summary_metrics, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: error.message }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reports }),
          };
        }

        // Handle public report access (no auth required)
        if (pathParts.includes('public')) {
          const shareToken = pathParts[pathParts.length - 1];

          const { data: report, error } = await supabase
            .from('audit_reports')
            .select(`
              id, website_url, report_title, audit_type, summary_metrics, created_at,
              audit_findings(id, category, subcategory, severity, title, description, recommendation, page_url, impact_score, fix_difficulty, estimated_fix_time)
            `)
            .eq('public_share_token', shareToken)
            .eq('is_public', true)
            .or(`public_expiry_date.is.null,public_expiry_date.gt.${new Date().toISOString()}`)
            .single();

          if (error || !report) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Report not found or not publicly accessible' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ report }),
          };
        }

        // Get specific audit report
        const reportId = pathParts[pathParts.length - 1];
        if (reportId && reportId !== 'reports') {
          const { data: report, error } = await supabase
            .from('audit_reports')
            .select(`
              *,
              audit_findings(*),
              audit_pages(*),
              audit_keywords(*)
            `)
            .eq('id', reportId)
            .eq('user_id', userId)
            .single();

          if (error) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Report not found' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ report }),
          };
        }
        break;

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };

  } catch (error) {
    console.error('Error in audit-report handler:', error);
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
