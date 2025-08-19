import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BillingRelationshipRequest {
  adminUserId: string;
  agencyUserId: string;
  billingArrangement: 'admin_direct' | 'agency_sponsored' | 'agency_allocated';
  monthlyCreditsAllocation?: number;
  billingEndDate?: string;
}

interface TerminateRelationshipRequest {
  relationshipId: string;
  terminationReason?: string;
  newStatus: 'admin_ejected' | 'agency_ejected' | 'mutual_terminated';
}

interface CreditTransferRequest {
  relationshipId: string;
  creditsAmount: number;
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

    // Get user role
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    const userRole = userProfile.role;
    const userId = user.id;

    // Parse the path to determine the operation
    const pathParts = event.path.split('/').filter(Boolean);
    const operation = pathParts[pathParts.length - 1];

    switch (event.httpMethod) {
      case 'GET':
        return await handleGet(operation, userId, userRole, event.queryStringParameters);
      
      case 'POST':
        return await handlePost(operation, userId, userRole, JSON.parse(event.body || '{}'));
      
      case 'PUT':
        return await handlePut(operation, userId, userRole, JSON.parse(event.body || '{}'));
      
      case 'DELETE':
        return await handleDelete(operation, userId, userRole, JSON.parse(event.body || '{}'));
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in admin-agency-billing handler:', error);
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

async function handleGet(operation: string, userId: string, userRole: string, queryParams: any) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  switch (operation) {
    case 'relationships':
      // Get all billing relationships for the user
      let query = supabase
        .from('admin_agency_billing_relationships')
        .select(`
          *,
          admin_profile:user_profiles!admin_user_id(full_name, company),
          agency_profile:user_profiles!agency_user_id(full_name, agency_name)
        `);

      if (userRole === 'admin') {
        query = query.eq('admin_user_id', userId);
      } else if (userRole === 'agency') {
        query = query.eq('agency_user_id', userId);
      } else if (userRole !== 'super_admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Insufficient permissions' }),
        };
      }

      const { data: relationships, error } = await query;

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
        body: JSON.stringify({ relationships }),
      };

    case 'history':
      // Get billing history for relationships the user is part of
      const relationshipId = queryParams?.relationshipId;
      
      if (!relationshipId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'relationshipId parameter required' }),
        };
      }

      // Verify user has access to this relationship
      const { data: relationship } = await supabase
        .from('admin_agency_billing_relationships')
        .select('admin_user_id, agency_user_id')
        .eq('id', relationshipId)
        .single();

      if (!relationship || (
        userRole !== 'super_admin' && 
        relationship.admin_user_id !== userId && 
        relationship.agency_user_id !== userId
      )) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Access denied to this relationship' }),
        };
      }

      const { data: history, error: historyError } = await supabase
        .from('admin_agency_billing_history')
        .select('*')
        .eq('relationship_id', relationshipId)
        .order('created_at', { ascending: false });

      if (historyError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: historyError.message }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ history }),
      };

    case 'preferences':
      // Get billing preferences
      if (userRole === 'admin') {
        const { data: preferences, error } = await supabase
          .from('admin_billing_preferences')
          .select('*')
          .eq('admin_user_id', userId)
          .single();

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ preferences }),
        };
      } else if (userRole === 'agency') {
        const { data: settings, error } = await supabase
          .from('agency_billing_settings')
          .select('*')
          .eq('agency_user_id', userId)
          .single();

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ settings }),
        };
      } else {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Invalid user role for preferences' }),
        };
      }

    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Operation not found' }),
      };
  }
}

async function handlePost(operation: string, userId: string, userRole: string, body: any) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  switch (operation) {
    case 'create-relationship':
      const createData = body as BillingRelationshipRequest;
      
      // Validate that user can create this relationship
      if (userRole === 'admin' && createData.adminUserId !== userId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Admin can only create relationships for themselves' }),
        };
      }
      
      if (userRole === 'agency' && createData.agencyUserId !== userId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Agency can only create relationships for themselves' }),
        };
      }

      // Check if relationship already exists
      const { data: existing } = await supabase
        .from('admin_agency_billing_relationships')
        .select('id')
        .eq('admin_user_id', createData.adminUserId)
        .eq('agency_user_id', createData.agencyUserId)
        .eq('status', 'active')
        .single();

      if (existing) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Active relationship already exists' }),
        };
      }

      // Create the relationship
      const { data: newRelationship, error: createError } = await supabase
        .from('admin_agency_billing_relationships')
        .insert({
          admin_user_id: createData.adminUserId,
          agency_user_id: createData.agencyUserId,
          billing_arrangement: createData.billingArrangement,
          monthly_credit_allocation: createData.monthlyCreditsAllocation || 0,
          billing_end_date: createData.billingEndDate || null,
          created_by: userId,
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

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ relationship: newRelationship }),
      };

    case 'transfer-credits':
      const transferData = body as CreditTransferRequest;
      
      // Verify relationship exists and user has access
      const { data: rel } = await supabase
        .from('admin_agency_billing_relationships')
        .select('*')
        .eq('id', transferData.relationshipId)
        .eq('status', 'active')
        .single();

      if (!rel) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Active relationship not found' }),
        };
      }

      if (userRole !== 'super_admin' && rel.agency_user_id !== userId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only agency can transfer credits' }),
        };
      }

      // Call the stored procedure to transfer credits
      const { data: transferResult, error: transferError } = await supabase
        .rpc('transfer_credits_agency_to_admin', {
          p_relationship_id: transferData.relationshipId,
          p_credits_amount: transferData.creditsAmount,
          p_initiated_by: userId,
        });

      if (transferError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: transferError.message }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, transferred: transferData.creditsAmount }),
      };

    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Operation not found' }),
      };
  }
}

async function handlePut(operation: string, userId: string, userRole: string, body: any) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  switch (operation) {
    case 'update-preferences':
      if (userRole === 'admin') {
        const { data: preferences, error } = await supabase
          .from('admin_billing_preferences')
          .upsert({
            admin_user_id: userId,
            ...body,
          })
          .select()
          .single();

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
          body: JSON.stringify({ preferences }),
        };
      } else if (userRole === 'agency') {
        const { data: settings, error } = await supabase
          .from('agency_billing_settings')
          .upsert({
            agency_user_id: userId,
            ...body,
          })
          .select()
          .single();

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
          body: JSON.stringify({ settings }),
        };
      } else {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Invalid user role for preferences' }),
        };
      }

    case 'update-relationship':
      const updateData = body;
      const relationshipId = updateData.relationshipId;

      // Verify user has access to this relationship
      const { data: relationship } = await supabase
        .from('admin_agency_billing_relationships')
        .select('admin_user_id, agency_user_id')
        .eq('id', relationshipId)
        .single();

      if (!relationship || (
        userRole !== 'super_admin' && 
        relationship.admin_user_id !== userId && 
        relationship.agency_user_id !== userId
      )) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Access denied to this relationship' }),
        };
      }

      // Update the relationship
      const { data: updatedRelationship, error: updateError } = await supabase
        .from('admin_agency_billing_relationships')
        .update({
          billing_arrangement: updateData.billingArrangement,
          monthly_credit_allocation: updateData.monthlyCreditsAllocation,
          billing_end_date: updateData.billingEndDate,
        })
        .eq('id', relationshipId)
        .select()
        .single();

      if (updateError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: updateError.message }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ relationship: updatedRelationship }),
      };

    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Operation not found' }),
      };
  }
}

async function handleDelete(operation: string, userId: string, userRole: string, body: any) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  switch (operation) {
    case 'terminate-relationship':
      const terminateData = body as TerminateRelationshipRequest;
      
      // Call the stored procedure to terminate the relationship
      const { data: terminateResult, error: terminateError } = await supabase
        .rpc('terminate_admin_agency_relationship', {
          p_relationship_id: terminateData.relationshipId,
          p_terminated_by: userId,
          p_termination_reason: terminateData.terminationReason,
          p_new_status: terminateData.newStatus,
        });

      if (terminateError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: terminateError.message }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, terminated: true }),
      };

    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Operation not found' }),
      };
  }
}
