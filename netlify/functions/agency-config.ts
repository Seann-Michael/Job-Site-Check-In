import { Handler } from '@netlify/functions';
import { authMiddleware } from './auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: Handler = async (event, context) => {
  try {
    const { path, httpMethod, body, queryStringParameters } = event;
    
    // Handle GET requests for fetching agency config
    if (httpMethod === 'GET') {
      const agencyToken = path?.split('/').pop();
      
      if (!agencyToken) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Agency token is required' }),
        };
      }

      try {
        const { data: agencyConfig, error } = await supabase
          .from('agency_static_configs')
          .select('*')
          .eq('agency_token', agencyToken)
          .single();

        if (error || !agencyConfig) {
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Configuration not found' }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            config: agencyConfig.config,
            created_at: agencyConfig.created_at,
          }),
        };
      } catch (error) {
        console.error('Error fetching agency config:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Internal server error' }),
        };
      }
    }

    // Handle POST requests for creating agency config (protected)
    if (httpMethod === 'POST') {
      // Apply auth middleware for POST requests
      const authResult = await authMiddleware(event);
      if (authResult.statusCode !== 200) {
        return authResult;
      }

      if (!body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Request body is required' }),
        };
      }

      try {
        const { agency_token, config } = JSON.parse(body);

        if (!agency_token || !config) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Agency token and config are required' }),
          };
        }

        // Get the authenticated user from auth middleware
        const user = JSON.parse(authResult.body).user;

        // Check if agency token already exists
        const { data: existing } = await supabase
          .from('agency_static_configs')
          .select('id')
          .eq('agency_token', agency_token)
          .single();

        if (existing) {
          return {
            statusCode: 409,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Agency token already exists' }),
          };
        }

        // Insert new agency config
        const { data, error } = await supabase
          .from('agency_static_configs')
          .insert({
            agency_token,
            config,
            created_by: user.id,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating agency config:', error);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to create agency configuration' }),
          };
        }

        return {
          statusCode: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: true,
            data,
          }),
        };
      } catch (error) {
        console.error('Error processing request:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Internal server error' }),
        };
      }
    }

    // Handle OPTIONS requests (CORS preflight)
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
        body: '',
      };
    }

    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
