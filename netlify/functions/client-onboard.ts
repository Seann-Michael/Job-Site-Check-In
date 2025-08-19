import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: Handler = async (event, context) => {
  try {
    const { httpMethod, body } = event;

    // Handle OPTIONS requests (CORS preflight)
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: '',
      };
    }

    // Only allow POST requests
    if (httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
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
      const { agency_token, client_info, selected_platforms } = JSON.parse(body);

      if (!agency_token || !client_info || !selected_platforms) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ 
            error: 'Agency token, client info, and selected platforms are required' 
          }),
        };
      }

      // Validate required client info
      if (!client_info.name || !client_info.email) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ 
            error: 'Client name and email are required' 
          }),
        };
      }

      // Verify agency token exists
      const { data: agencyConfig, error: agencyError } = await supabase
        .from('agency_static_configs')
        .select('id, created_by, config')
        .eq('agency_token', agency_token)
        .single();

      if (agencyError || !agencyConfig) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Invalid agency token' }),
        };
      }

      // Check if client has already submitted for this agency
      const { data: existingSubmission } = await supabase
        .from('client_onboarding_submissions')
        .select('id')
        .eq('agency_token', agency_token)
        .eq('client_email', client_info.email)
        .single();

      if (existingSubmission) {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ 
            error: 'You have already submitted an onboarding request for this agency' 
          }),
        };
      }

      // Create client onboarding submission
      const { data, error } = await supabase
        .from('client_onboarding_submissions')
        .insert({
          agency_token,
          agency_config_id: agencyConfig.id,
          client_name: client_info.name,
          client_email: client_info.email,
          client_company: client_info.company || null,
          client_phone: client_info.phone || null,
          selected_platforms,
          custom_platform_responses: client_info.custom_platform_responses || {},
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating client submission:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Failed to submit onboarding request' }),
        };
      }

      // TODO: Send notification email to agency
      // TODO: Send confirmation email to client

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          submission_id: data.id,
          message: 'Onboarding request submitted successfully',
        }),
      };
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }
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
