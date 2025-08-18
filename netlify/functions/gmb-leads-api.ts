import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GMBLead {
  id?: string;
  google_cid: string;
  business_name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  rating?: number;
  review_count?: number;
  hours?: any;
  attributes?: any;
  photos?: string[];
  description?: string;
  verified?: boolean;
  last_updated?: string;
  data_completeness_score?: number;
  unlock_credits_cost?: number;
  status?: 'active' | 'inactive' | 'verified' | 'duplicate';
  raw_data?: any;
}

interface LeadFilters {
  category?: string;
  min_rating?: number;
  max_rating?: number;
  location?: { lat: number; lng: number; radius: number };
  verified?: boolean;
  status?: string;
  search?: string;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

// Helper function to get user profile with role
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

// Helper function to check user credits
async function getUserCredits(userId: string) {
  const { data: credits, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error || !credits) {
    throw new Error('User credits not found');
  }
  
  return credits;
}

// Helper function to calculate data completeness score
function calculateCompletenessScore(lead: GMBLead): number {
  const fields = ['business_name', 'phone', 'email', 'website', 'address', 'category', 'rating', 'description'];
  const completedFields = fields.filter(field => lead[field as keyof GMBLead] != null && lead[field as keyof GMBLead] !== '');
  return Math.round((completedFields.length / fields.length) * 100);
}

// GET /api/gmb-leads - List leads with filtering
async function getLeads(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    const params = new URLSearchParams(event.queryStringParameters || {});
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabase
      .from('gmb_leads')
      .select('*', { count: 'exact' });
    
    // Apply filters based on user role
    if (profile.role !== 'super_admin') {
      query = query.eq('status', 'active');
    }
    
    // Apply search filters
    if (params.get('category')) {
      query = query.eq('category', params.get('category'));
    }
    
    if (params.get('min_rating')) {
      query = query.gte('rating', parseFloat(params.get('min_rating')!));
    }
    
    if (params.get('max_rating')) {
      query = query.lte('rating', parseFloat(params.get('max_rating')!));
    }
    
    if (params.get('verified') === 'true') {
      query = query.eq('verified', true);
    }
    
    if (params.get('search')) {
      const search = params.get('search')!;
      query = query.or(`business_name.ilike.%${search}%,address.ilike.%${search}%,category.ilike.%${search}%`);
    }
    
    // Location-based filtering
    if (params.get('lat') && params.get('lng') && params.get('radius')) {
      const lat = parseFloat(params.get('lat')!);
      const lng = parseFloat(params.get('lng')!);
      const radius = parseFloat(params.get('radius')!) / 111; // Convert km to degrees (approximate)
      
      query = query
        .gte('latitude', lat - radius)
        .lte('latitude', lat + radius)
        .gte('longitude', lng - radius)
        .lte('longitude', lng + radius);
    }
    
    // Add pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: leads, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    // For non-super-admin users, mask sensitive data for locked leads
    let processedLeads = leads;
    if (profile.role !== 'super_admin') {
      const { data: unlocks } = await supabase
        .from('lead_unlocks')
        .select('lead_id')
        .eq('user_id', user.id);
      
      const unlockedLeadIds = new Set(unlocks?.map(u => u.lead_id) || []);
      
      processedLeads = leads?.map(lead => {
        if (!unlockedLeadIds.has(lead.id)) {
          return {
            ...lead,
            phone: lead.phone ? '***-***-****' : null,
            email: lead.email ? '***@***.***' : null,
            website: lead.website ? 'www.***.***' : null,
            address: lead.address ? '*** *** ***, ***' : null,
          };
        }
        return lead;
      });
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: processedLeads,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// POST /api/gmb-leads - Create new lead
async function createLead(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can create leads directly
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    const leadData: GMBLead = JSON.parse(event.body || '{}');
    
    // Calculate data completeness score
    leadData.data_completeness_score = calculateCompletenessScore(leadData);
    
    // Check for duplicates by Google CID
    const { data: existing } = await supabase
      .from('gmb_leads')
      .select('id')
      .eq('google_cid', leadData.google_cid)
      .single();
    
    if (existing) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Lead with this Google CID already exists' }),
      };
    }
    
    const { data: lead, error } = await supabase
      .from('gmb_leads')
      .insert([leadData])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ data: lead }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// PUT /api/gmb-leads/:id - Update lead
async function updateLead(event: HandlerEvent, leadId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can update leads
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    const updates: Partial<GMBLead> = JSON.parse(event.body || '{}');
    
    // Recalculate data completeness score if relevant fields are updated
    const { data: currentLead } = await supabase
      .from('gmb_leads')
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (!currentLead) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Lead not found' }),
      };
    }
    
    const updatedLead = { ...currentLead, ...updates };
    updates.data_completeness_score = calculateCompletenessScore(updatedLead);
    
    const { data: lead, error } = await supabase
      .from('gmb_leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: lead }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// DELETE /api/gmb-leads/:id - Delete lead
async function deleteLead(event: HandlerEvent, leadId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can delete leads
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    const { error } = await supabase
      .from('gmb_leads')
      .delete()
      .eq('id', leadId);
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// POST /api/gmb-leads/:id/unlock - Unlock lead with credits
async function unlockLead(event: HandlerEvent, leadId: string) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only admins and agencies can unlock leads
    if (!['admin', 'agency'].includes(profile.role)) {
      throw new Error('Insufficient permissions');
    }
    
    // Check if lead exists and get unlock cost
    const { data: lead, error: leadError } = await supabase
      .from('gmb_leads')
      .select('id, unlock_credits_cost')
      .eq('id', leadId)
      .single();
    
    if (leadError || !lead) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Lead not found' }),
      };
    }
    
    // Check if already unlocked
    const { data: existingUnlock } = await supabase
      .from('lead_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('lead_id', leadId)
      .single();
    
    if (existingUnlock) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Lead already unlocked' }),
      };
    }
    
    // Check user credits
    const credits = await getUserCredits(user.id);
    
    if (credits.current_credits < lead.unlock_credits_cost) {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ 
          error: 'Insufficient credits',
          required: lead.unlock_credits_cost,
          available: credits.current_credits,
        }),
      };
    }
    
    // Perform unlock transaction
    const { error: unlockError } = await supabase
      .from('lead_unlocks')
      .insert({
        user_id: user.id,
        lead_id: leadId,
        credits_spent: lead.unlock_credits_cost,
      });
    
    if (unlockError) {
      throw unlockError;
    }
    
    // Update user credits
    const { error: creditError } = await supabase
      .from('user_credits')
      .update({
        current_credits: credits.current_credits - lead.unlock_credits_cost,
        total_spent: credits.total_spent + lead.unlock_credits_cost,
        used_this_month: credits.used_this_month + lead.unlock_credits_cost,
      })
      .eq('user_id', user.id);
    
    if (creditError) {
      throw creditError;
    }
    
    // Log transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        transaction_type: 'usage',
        credits_amount: -lead.unlock_credits_cost,
        description: `Unlocked lead: ${leadId}`,
        lead_id: leadId,
      });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Lead unlocked successfully',
        credits_spent: lead.unlock_credits_cost,
        remaining_credits: credits.current_credits - lead.unlock_credits_cost,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// POST /api/gmb-leads/bulk-import - Bulk import leads
async function bulkImportLeads(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can bulk import
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    const { leads }: { leads: GMBLead[] } = JSON.parse(event.body || '{}');
    
    if (!Array.isArray(leads) || leads.length === 0) {
      throw new Error('Invalid leads data');
    }
    
    // Process leads and calculate completeness scores
    const processedLeads = leads.map(lead => ({
      ...lead,
      data_completeness_score: calculateCompletenessScore(lead),
    }));
    
    // Get existing CIDs to check for duplicates
    const cids = processedLeads.map(lead => lead.google_cid);
    const { data: existingLeads } = await supabase
      .from('gmb_leads')
      .select('google_cid')
      .in('google_cid', cids);
    
    const existingCids = new Set(existingLeads?.map(lead => lead.google_cid) || []);
    const newLeads = processedLeads.filter(lead => !existingCids.has(lead.google_cid));
    
    if (newLeads.length === 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          error: 'All leads already exist',
          duplicates: processedLeads.length,
        }),
      };
    }
    
    // Insert new leads
    const { data: insertedLeads, error } = await supabase
      .from('gmb_leads')
      .insert(newLeads)
      .select();
    
    if (error) {
      throw error;
    }
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Leads imported successfully',
        imported: insertedLeads?.length || 0,
        duplicates: processedLeads.length - newLeads.length,
        data: insertedLeads,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
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
        if (pathParts[0] === 'gmb-leads' && pathParts.length === 1) {
          return await getLeads(event);
        }
        break;
        
      case 'POST':
        if (pathParts[0] === 'gmb-leads' && pathParts.length === 1) {
          return await createLead(event);
        }
        if (pathParts[0] === 'gmb-leads' && pathParts[2] === 'unlock') {
          return await unlockLead(event, pathParts[1]);
        }
        if (pathParts[0] === 'gmb-leads' && pathParts[1] === 'bulk-import') {
          return await bulkImportLeads(event);
        }
        break;
        
      case 'PUT':
        if (pathParts[0] === 'gmb-leads' && pathParts.length === 2) {
          return await updateLead(event, pathParts[1]);
        }
        break;
        
      case 'DELETE':
        if (pathParts[0] === 'gmb-leads' && pathParts.length === 2) {
          return await deleteLead(event, pathParts[1]);
        }
        break;
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
