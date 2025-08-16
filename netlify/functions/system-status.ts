import { Handler } from '@netlify/functions';

interface SystemStatus {
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  description: string;
  lastChecked: string;
  responseTime?: number;
  uptime?: number;
  error?: string;
}

interface HealthCheckResult {
  status: "operational" | "degraded" | "outage";
  responseTime: number;
  error?: string;
}

// Helper function to check HTTP endpoint health
async function checkHttpHealth(url: string, timeout: number = 5000): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'GMB-Booster-Status-Check/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: responseTime > 2000 ? "degraded" : "operational",
        responseTime
      };
    } else {
      return {
        status: "degraded",
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: "outage",
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to check API key validity
async function checkApiKeyHealth(name: string, checkFn: () => Promise<boolean>): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const isValid = await checkFn();
    const responseTime = Date.now() - startTime;
    
    return {
      status: isValid ? "operational" : "outage",
      responseTime,
      error: isValid ? undefined : "API key invalid or service unavailable"
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: "outage",
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Individual service health checks
async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      status: "outage",
      responseTime: 0,
      error: "Supabase configuration missing"
    };
  }
  
  return checkHttpHealth(`${supabaseUrl}/rest/v1/`);
}

async function checkTwilioHealth(): Promise<HealthCheckResult> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!twilioSid || !twilioToken) {
    return {
      status: "outage",
      responseTime: 0,
      error: "Twilio configuration missing"
    };
  }
  
  return checkApiKeyHealth('Twilio', async () => {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  });
}

async function checkGoogleMapsHealth(): Promise<HealthCheckResult> {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return {
      status: "outage",
      responseTime: 0,
      error: "Google Maps API key missing"
    };
  }
  
  return checkApiKeyHealth('Google Maps', async () => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`
      );
      const data = await response.json();
      return response.ok && data.status !== 'REQUEST_DENIED';
    } catch {
      return false;
    }
  });
}

async function checkMailgunHealth(): Promise<HealthCheckResult> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN || 'mg.gmb-booster.com';
  
  if (!apiKey) {
    return {
      status: "outage",
      responseTime: 0,
      error: "Mailgun configuration missing"
    };
  }
  
  return checkApiKeyHealth('Mailgun', async () => {
    try {
      const auth = Buffer.from(`api:${apiKey}`).toString('base64');
      const response = await fetch(`https://api.mailgun.net/v3/${domain}`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  });
}

async function checkDataForSEOHealth(): Promise<HealthCheckResult> {
  const apiCredentials = process.env.DATAFORSEO_API_KEY;
  
  if (!apiCredentials) {
    return {
      status: "outage",
      responseTime: 0,
      error: "DataForSEO configuration missing"
    };
  }
  
  return checkApiKeyHealth('DataForSEO', async () => {
    try {
      const [username, password] = Buffer.from(apiCredentials, 'base64').toString().split(':');
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      const response = await fetch('https://api.dataforseo.com/v3/user', {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  });
}

async function checkNetlifyHealth(): Promise<HealthCheckResult> {
  // Check current Netlify deployment status
  return checkHttpHealth(process.env.URL || 'https://gmb-booster.netlify.app');
}

// Calculate uptime based on recent checks (this would typically come from a monitoring database)
function calculateUptime(serviceName: string, status: string): number {
  // In a real implementation, this would query historical data
  // For now, we'll simulate based on current status
  switch (status) {
    case "operational":
      return 99.9 + Math.random() * 0.1;
    case "degraded":
      return 98.5 + Math.random() * 1.0;
    case "outage":
      return 95.0 + Math.random() * 3.0;
    default:
      return 99.0;
  }
}

export const handler: Handler = async (event, context) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Perform all health checks in parallel
    const [
      appHealth,
      databaseHealth,
      twilioHealth,
      googleMapsHealth,
      mailgunHealth,
      dataForSEOHealth,
      netlifyHealth
    ] = await Promise.all([
      checkHttpHealth(process.env.URL || 'https://gmb-booster.netlify.app'),
      checkSupabaseHealth(),
      checkTwilioHealth(),
      checkGoogleMapsHealth(),
      checkMailgunHealth(),
      checkDataForSEOHealth(),
      checkNetlifyHealth()
    ]);

    const currentTime = new Date().toISOString();

    // Build system status array
    const systems: SystemStatus[] = [
      {
        name: "Core Application",
        status: appHealth.status,
        description: "Main application services",
        lastChecked: currentTime,
        responseTime: appHealth.responseTime,
        uptime: calculateUptime("app", appHealth.status),
        error: appHealth.error
      },
      {
        name: "Database",
        status: databaseHealth.status,
        description: "Supabase database cluster",
        lastChecked: currentTime,
        responseTime: databaseHealth.responseTime,
        uptime: calculateUptime("database", databaseHealth.status),
        error: databaseHealth.error
      },
      {
        name: "API Services",
        status: netlifyHealth.status,
        description: "Netlify serverless functions",
        lastChecked: currentTime,
        responseTime: netlifyHealth.responseTime,
        uptime: calculateUptime("api", netlifyHealth.status),
        error: netlifyHealth.error
      },
      {
        name: "Twilio SMS",
        status: twilioHealth.status,
        description: "SMS notification service",
        lastChecked: currentTime,
        responseTime: twilioHealth.responseTime,
        uptime: calculateUptime("twilio", twilioHealth.status),
        error: twilioHealth.error
      },
      {
        name: "Google Maps API",
        status: googleMapsHealth.status,
        description: "Location and mapping services",
        lastChecked: currentTime,
        responseTime: googleMapsHealth.responseTime,
        uptime: calculateUptime("maps", googleMapsHealth.status),
        error: googleMapsHealth.error
      },
      {
        name: "Email Service",
        status: mailgunHealth.status,
        description: "Mailgun email delivery",
        lastChecked: currentTime,
        responseTime: mailgunHealth.responseTime,
        uptime: calculateUptime("email", mailgunHealth.status),
        error: mailgunHealth.error
      },
      {
        name: "DataForSEO API",
        status: dataForSEOHealth.status,
        description: "SEO data and ranking services",
        lastChecked: currentTime,
        responseTime: dataForSEOHealth.responseTime,
        uptime: calculateUptime("dataforseo", dataForSEOHealth.status),
        error: dataForSEOHealth.error
      }
    ];

    // Calculate overall status
    const hasOutage = systems.some(s => s.status === "outage");
    const hasDegraded = systems.some(s => s.status === "degraded");
    
    let overallStatus: string;
    if (hasOutage) {
      overallStatus = "outage";
    } else if (hasDegraded) {
      overallStatus = "degraded";  
    } else {
      overallStatus = "operational";
    }

    // Calculate overall uptime
    const overallUptime = systems.reduce((sum, system) => sum + (system.uptime || 0), 0) / systems.length;

    // Generate incidents based on current issues
    const incidents = systems
      .filter(system => system.status === "outage" || system.status === "degraded")
      .map(system => ({
        id: `inc-${system.name.toLowerCase().replace(/\s+/g, '-')}`,
        title: `${system.name} ${system.status === "outage" ? "Outage" : "Performance Issues"}`,
        status: system.status === "outage" ? "investigating" : "monitoring",
        severity: system.status === "outage" ? "high" : "medium",
        description: system.error || `${system.name} is experiencing ${system.status === "outage" ? "service disruption" : "performance degradation"}`,
        startTime: currentTime,
        updates: [{
          time: currentTime,
          message: system.error || `We are ${system.status === "outage" ? "investigating the service disruption" : "monitoring performance issues"}`,
          status: system.status === "outage" ? "investigating" : "monitoring"
        }]
      }));

    const response = {
      systems,
      incidents,
      overallStatus,
      overallUptime: Math.round(overallUptime * 100) / 100,
      lastUpdated: currentTime,
      servicesMonitored: systems.length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('System status check failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to check system status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
