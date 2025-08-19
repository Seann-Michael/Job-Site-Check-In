import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Content-Type': 'application/json',
};

// Helper function to get user from token
async function getUserFromAuth(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid token');
  }
  
  return user;
}

// Helper function to get user profile
async function getUserProfile(userId: string) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error || !profile) {
    throw new Error('User profile not found');
  }
  
  return profile;
}

// POST /api/oauth/generate-link - Generate onboarding link
async function generateOnboardingLink(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only agency users can generate links
    if (profile.role !== 'agency') {
      throw new Error('Only agency users can generate onboarding links');
    }
    
    const {
      client_name,
      client_email,
      client_company,
      selected_platforms,
      access_level,
      branding
    } = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!client_name || !client_email || !selected_platforms || selected_platforms.length === 0) {
      throw new Error('Missing required fields');
    }
    
    // Create onboarding session
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .insert({
        agency_user_id: user.id,
        client_name,
        client_email,
        client_company,
        required_platforms: selected_platforms,
        access_level: access_level || 'read_only',
        branding_config: branding || {
          primary_color: '#2563eb',
          company_name: profile.company || profile.agency_name
        }
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Log activity
    await supabase
      .from('oauth_activity_log')
      .insert({
        session_id: session.id,
        event_type: 'link_generated',
        event_data: {
          platforms: selected_platforms,
          access_level
        }
      });
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          session,
          link: {
            url: `${process.env.VITE_APP_URL || 'https://localhost:3000'}/onboard/${session.onboarding_token}`,
            token: session.onboarding_token,
            expires_at: session.expires_at
          }
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// GET /api/oauth/sessions - Get user's onboarding sessions
async function getOnboardingSessions(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    const params = new URLSearchParams(event.queryStringParameters || {});
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '25');
    const offset = (page - 1) * limit;
    
    let query = supabase
      .from('onboarding_sessions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Filter by user role
    if (profile.role === 'agency') {
      query = query.eq('agency_user_id', user.id);
    } else if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    query = query.range(offset, offset + limit - 1);
    
    const { data: sessions, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: sessions,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// GET /api/oauth/onboarding/:token - Get onboarding session by token
async function getOnboardingSession(event: HandlerEvent, token: string) {
  try {
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('onboarding_token', token)
      .single();
    
    if (error || !session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Session not found' })
      };
    }
    
    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ success: false, error: 'Session expired' })
      };
    }
    
    // Increment link clicks
    await supabase
      .from('onboarding_sessions')
      .update({ link_clicks: session.link_clicks + 1 })
      .eq('id', session.id);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: session
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// PATCH /api/oauth/onboarding/:token/update - Update session status
async function updateOnboardingSession(event: HandlerEvent, token: string) {
  try {
    const { platform, status, accountInfo } = JSON.parse(event.body || '{}');
    
    const { data: session, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('onboarding_token', token)
      .single();
    
    if (sessionError || !session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Session not found' })
      };
    }
    
    if (platform && status) {
      // Update or create client access record
      const { error: accessError } = await supabase
        .from('client_access')
        .upsert({
          session_id: session.id,
          platform,
          status,
          account_info: accountInfo || {},
          is_active: status === 'connected'
        });
      
      if (accessError) {
        throw accessError;
      }
      
      // Log activity
      await supabase
        .from('oauth_activity_log')
        .insert({
          session_id: session.id,
          platform,
          event_type: `platform_${status}`,
          event_data: accountInfo || {}
        });
    } else if (status === 'completed') {
      // Mark session as completed
      await supabase
        .from('onboarding_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      // Log completion
      await supabase
        .from('oauth_activity_log')
        .insert({
          session_id: session.id,
          event_type: 'onboarding_completed',
          event_data: {}
        });
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// GET /api/oauth/platforms - Get platform configurations
async function getPlatformConfigurations(event: HandlerEvent) {
  try {
    const { data: platforms, error } = await supabase
      .from('platform_configurations')
      .select('*')
      .eq('is_enabled', true)
      .order('display_name');
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: platforms
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// GET /api/oauth/sessions/:id/access - Get client access for session
async function getSessionAccess(event: HandlerEvent, sessionId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Verify access to session
    const { data: session, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .select('agency_user_id')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Session not found' })
      };
    }
    
    const profile = await getUserProfile(user.id);
    if (profile.role !== 'super_admin' && session.agency_user_id !== user.id) {
      throw new Error('Insufficient permissions');
    }
    
    const { data: access, error } = await supabase
      .from('client_access')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at');
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: access
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// GET /api/oauth/sessions/:id/activity - Get session activity log
async function getSessionActivity(event: HandlerEvent, sessionId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Verify access to session
    const { data: session, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .select('agency_user_id')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Session not found' })
      };
    }
    
    const profile = await getUserProfile(user.id);
    if (profile.role !== 'super_admin' && session.agency_user_id !== user.id) {
      throw new Error('Insufficient permissions');
    }
    
    const { data: activity, error } = await supabase
      .from('oauth_activity_log')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: activity
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// POST /api/oauth/sessions/:id/regenerate - Regenerate onboarding link
async function regenerateLink(event: HandlerEvent, sessionId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Verify access to session
    const { data: session, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Session not found' })
      };
    }
    
    const profile = await getUserProfile(user.id);
    if (profile.role !== 'super_admin' && session.agency_user_id !== user.id) {
      throw new Error('Insufficient permissions');
    }
    
    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString('base64url');
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7); // 7 days from now
    
    const { error: updateError } = await supabase
      .from('onboarding_sessions')
      .update({
        onboarding_token: newToken,
        expires_at: newExpiry.toISOString(),
        link_clicks: 0
      })
      .eq('id', sessionId);
    
    if (updateError) {
      throw updateError;
    }
    
    // Log activity
    await supabase
      .from('oauth_activity_log')
      .insert({
        session_id: sessionId,
        event_type: 'link_regenerated',
        event_data: {}
      });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          token: newToken,
          expires_at: newExpiry.toISOString()
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// POST /api/oauth/sessions/:id/revoke - Revoke access
async function revokeAccess(event: HandlerEvent, sessionId: string, platform?: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    // Verify access to session
    const { data: session, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Session not found' })
      };
    }
    
    const profile = await getUserProfile(user.id);
    if (profile.role !== 'super_admin' && session.agency_user_id !== user.id) {
      throw new Error('Insufficient permissions');
    }
    
    if (platform) {
      // Revoke specific platform
      const { error: revokeError } = await supabase
        .from('client_access')
        .update({
          status: 'revoked',
          is_active: false
        })
        .eq('session_id', sessionId)
        .eq('platform', platform);
      
      if (revokeError) {
        throw revokeError;
      }
      
      // Log activity
      await supabase
        .from('oauth_activity_log')
        .insert({
          session_id: sessionId,
          platform,
          event_type: 'access_revoked',
          event_data: {}
        });
    } else {
      // Revoke all access
      const { error: revokeError } = await supabase
        .from('client_access')
        .update({
          status: 'revoked',
          is_active: false
        })
        .eq('session_id', sessionId);
      
      if (revokeError) {
        throw revokeError;
      }
      
      // Update session status
      await supabase
        .from('onboarding_sessions')
        .update({ status: 'expired' })
        .eq('id', sessionId);
      
      // Log activity
      await supabase
        .from('oauth_activity_log')
        .insert({
          session_id: sessionId,
          event_type: 'all_access_revoked',
          event_data: {}
        });
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// GET /api/oauth/stats - Get OAuth statistics
async function getOAuthStats(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    if (profile.role !== 'agency' && profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    let baseQuery = supabase.from('onboarding_sessions');
    if (profile.role === 'agency') {
      baseQuery = baseQuery.eq('agency_user_id', user.id);
    }
    
    // Get total active connections
    const { count: totalConnections } = await supabase
      .from('client_access')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // Get pending links
    const { count: pendingLinks } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    // Get connections this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const { count: thisMonthConnections } = await supabase
      .from('client_access')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonth.toISOString())
      .eq('status', 'connected');
    
    // Calculate average onboarding time (simplified)
    const averageTime = 24; // TODO: Calculate actual average
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          total_active_connections: totalConnections || 0,
          pending_onboarding_links: pendingLinks || 0,
          connections_this_month: thisMonthConnections || 0,
          average_onboarding_time: averageTime
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: (error as Error).message })
    };
  }
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/api/', '');
  const pathParts = path.split('/');

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (pathParts[0] === 'oauth' && pathParts[1] === 'sessions' && pathParts.length === 2) {
          return await getOnboardingSessions(event);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'onboarding' && pathParts[2]) {
          return await getOnboardingSession(event, pathParts[2]);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'platforms') {
          return await getPlatformConfigurations(event);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'sessions' && pathParts[3] === 'access') {
          return await getSessionAccess(event, pathParts[2]);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'sessions' && pathParts[3] === 'activity') {
          return await getSessionActivity(event, pathParts[2]);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'stats') {
          return await getOAuthStats(event);
        }
        break;

      case 'POST':
        if (pathParts[0] === 'oauth' && pathParts[1] === 'generate-link') {
          return await generateOnboardingLink(event);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'sessions' && pathParts[3] === 'regenerate') {
          return await regenerateLink(event, pathParts[2]);
        }
        if (pathParts[0] === 'oauth' && pathParts[1] === 'sessions' && pathParts[3] === 'revoke') {
          return await revokeAccess(event, pathParts[2], pathParts[4]);
        }
        break;

      case 'PATCH':
        if (pathParts[0] === 'oauth' && pathParts[1] === 'onboarding' && pathParts[3] === 'update') {
          return await updateOnboardingSession(event, pathParts[2]);
        }
        break;
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'Endpoint not found' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
