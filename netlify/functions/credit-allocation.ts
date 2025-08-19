import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ManualAllocationRequest {
  relationshipId: string;
  creditsAmount: number;
  allocationReason?: string;
}

interface UpdateAllocationSettingsRequest {
  relationshipId: string;
  autoAllocateEnabled?: boolean;
  monthlyCreditsAllocation?: number;
  allocationDayOfMonth?: number;
}

interface AllocationHistoryResponse {
  id: string;
  credits_amount: number;
  allocation_type: 'manual' | 'monthly_auto' | 'bonus';
  allocation_reason?: string;
  status: 'pending' | 'processed' | 'failed' | 'cancelled';
  processed_at?: string;
  failure_reason?: string;
  created_at: string;
  agency_profile?: {
    full_name: string;
    agency_name: string;
  };
  admin_profile?: {
    full_name: string;
    company: string;
  };
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
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in credit-allocation handler:', error);
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
    case 'history':
      // Get allocation history for relationships the user is part of
      const relationshipId = queryParams?.relationshipId;
      const limit = parseInt(queryParams?.limit || '50');
      const offset = parseInt(queryParams?.offset || '0');
      
      let query = supabase
        .from('credit_allocations')
        .select(`
          *,
          admin_agency_billing_relationships!inner(
            admin_profile:user_profiles!admin_user_id(full_name, company),
            agency_profile:user_profiles!agency_user_id(full_name, agency_name)
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (relationshipId) {
        query = query.eq('relationship_id', relationshipId);
      }

      // Apply user-based filtering
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

      const { data: allocations, error } = await query;

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
        body: JSON.stringify({ allocations }),
      };

    case 'relationship-settings':
      // Get allocation settings for a specific relationship
      const relationshipIdForSettings = queryParams?.relationshipId;
      
      if (!relationshipIdForSettings) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'relationshipId parameter required' }),
        };
      }

      // Verify user has access to this relationship
      const { data: relationship } = await supabase
        .from('admin_agency_billing_relationships')
        .select('*')
        .eq('id', relationshipIdForSettings)
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          relationship: {
            id: relationship.id,
            monthly_credit_allocation: relationship.monthly_credit_allocation,
            auto_allocate_enabled: relationship.auto_allocate_enabled,
            allocation_day_of_month: relationship.allocation_day_of_month,
            last_allocation_date: relationship.last_allocation_date,
            next_allocation_date: relationship.next_allocation_date,
          }
        }),
      };

    case 'pending-allocations':
      // Get pending allocations (for agencies to see what's queued)
      if (userRole !== 'agency' && userRole !== 'super_admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only agencies can view pending allocations' }),
        };
      }

      let pendingQuery = supabase
        .from('credit_allocations')
        .select(`
          *,
          admin_agency_billing_relationships!inner(
            admin_profile:user_profiles!admin_user_id(full_name, company)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (userRole === 'agency') {
        pendingQuery = pendingQuery.eq('agency_user_id', userId);
      }

      const { data: pendingAllocations, error: pendingError } = await pendingQuery;

      if (pendingError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: pendingError.message }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ allocations: pendingAllocations }),
      };

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
    case 'manual-allocation':
      const allocationData = body as ManualAllocationRequest;
      
      // Only agencies and super admins can create manual allocations
      if (userRole !== 'agency' && userRole !== 'super_admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only agencies can create manual allocations' }),
        };
      }

      // Validate input
      if (!allocationData.relationshipId || !allocationData.creditsAmount || allocationData.creditsAmount <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid allocation data' }),
        };
      }

      try {
        // Call the stored procedure to create manual allocation
        const { data: allocationId, error: allocationError } = await supabase
          .rpc('create_manual_allocation', {
            p_relationship_id: allocationData.relationshipId,
            p_credits_amount: allocationData.creditsAmount,
            p_allocation_reason: allocationData.allocationReason,
            p_initiated_by: userId,
          });

        if (allocationError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: allocationError.message }),
          };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ 
            success: true, 
            allocationId,
            creditsTransferred: allocationData.creditsAmount 
          }),
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to create allocation' 
          }),
        };
      }

    case 'process-monthly-allocations':
      // Process monthly allocations (typically called by cron job or admin)
      if (userRole !== 'super_admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only super admins can trigger monthly allocations' }),
        };
      }

      try {
        const { data: processedCount, error: processError } = await supabase
          .rpc('create_monthly_allocations');

        if (processError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: processError.message }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            processedCount 
          }),
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to process monthly allocations' 
          }),
        };
      }

    case 'ensure-admin-billing':
      // Ensure admin purchases are billed to admin
      const { purchaseSessionId } = body;
      
      if (userRole !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only admins can set purchase overrides' }),
        };
      }

      try {
        const { data: overrideSuccess, error: overrideError } = await supabase
          .rpc('ensure_admin_direct_billing', {
            p_admin_user_id: userId,
            p_purchase_session_id: purchaseSessionId,
          });

        if (overrideError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: overrideError.message }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            directBillingEnsured: true 
          }),
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to ensure direct billing' 
          }),
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

async function handlePut(operation: string, userId: string, userRole: string, body: any) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  switch (operation) {
    case 'allocation-settings':
      const settingsData = body as UpdateAllocationSettingsRequest;
      
      if (!settingsData.relationshipId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'relationshipId is required' }),
        };
      }

      // Verify user has access to this relationship
      const { data: relationship } = await supabase
        .from('admin_agency_billing_relationships')
        .select('agency_user_id, admin_user_id')
        .eq('id', settingsData.relationshipId)
        .single();

      if (!relationship || (
        userRole !== 'super_admin' && 
        relationship.agency_user_id !== userId
      )) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only agency can update allocation settings' }),
        };
      }

      // Build update object
      const updateData: any = {};
      if (settingsData.autoAllocateEnabled !== undefined) {
        updateData.auto_allocate_enabled = settingsData.autoAllocateEnabled;
      }
      if (settingsData.monthlyCreditsAllocation !== undefined) {
        updateData.monthly_credit_allocation = settingsData.monthlyCreditsAllocation;
      }
      if (settingsData.allocationDayOfMonth !== undefined) {
        updateData.allocation_day_of_month = settingsData.allocationDayOfMonth;
      }

      // Update next allocation date if settings changed
      if (settingsData.autoAllocateEnabled || settingsData.allocationDayOfMonth !== undefined) {
        const { data: currentRel } = await supabase
          .from('admin_agency_billing_relationships')
          .select('allocation_day_of_month, last_allocation_date, created_at')
          .eq('id', settingsData.relationshipId)
          .single();

        if (currentRel) {
          const dayOfMonth = settingsData.allocationDayOfMonth || currentRel.allocation_day_of_month;
          const { data: nextDate } = await supabase
            .rpc('calculate_next_allocation_date', {
              current_date: currentRel.last_allocation_date || currentRel.created_at,
              day_of_month: dayOfMonth,
            });
          
          if (nextDate) {
            updateData.next_allocation_date = nextDate;
          }
        }
      }

      // Update the relationship
      const { data: updatedRelationship, error: updateError } = await supabase
        .from('admin_agency_billing_relationships')
        .update(updateData)
        .eq('id', settingsData.relationshipId)
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
        body: JSON.stringify({ 
          success: true, 
          relationship: updatedRelationship 
        }),
      };

    default:
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Operation not found' }),
      };
  }
}
