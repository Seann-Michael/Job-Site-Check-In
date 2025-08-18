import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Stripe configuration (for credit purchases)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // in cents
  bonus_credits?: number;
  description?: string;
}

interface CreditPurchaseRequest {
  package_id: string;
  user_id?: string; // For admin purchases
}

interface CreditTransferRequest {
  to_user_id: string;
  credits: number;
  description?: string;
}

// Predefined credit packages
const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 2000, // $20.00
    description: 'Perfect for small businesses',
  },
  {
    id: 'professional',
    name: 'Professional Pack',
    credits: 500,
    price: 8000, // $80.00
    bonus_credits: 50,
    description: 'Great for growing agencies',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 2000,
    price: 25000, // $250.00
    bonus_credits: 300,
    description: 'Ideal for large organizations',
  },
  {
    id: 'unlimited',
    name: 'Monthly Unlimited',
    credits: 10000,
    price: 50000, // $500.00
    description: 'Unlimited monthly credits',
  },
];

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

// Helper function to get user credits
async function getUserCredits(userId: string) {
  const { data: credits, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error || !credits) {
    // Create credits record if it doesn't exist
    const { data: newCredits, error: createError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        current_credits: 100,
        monthly_allocation: 100,
      })
      .select()
      .single();
      
    if (createError || !newCredits) {
      throw new Error('Failed to create user credits');
    }
    
    return newCredits;
  }
  
  return credits;
}

// Helper function to reset monthly credits if needed
async function resetMonthlyCreditsIfNeeded(userId: string) {
  const credits = await getUserCredits(userId);
  const now = new Date();
  const lastReset = new Date(credits.last_reset_date);
  
  // Check if it's a new month
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    const { error } = await supabase
      .from('user_credits')
      .update({
        used_this_month: 0,
        last_reset_date: now.toISOString(),
      })
      .eq('user_id', userId);
      
    if (error) {
      throw error;
    }
  }
}

// GET /api/credit-system/balance - Get user's credit balance
async function getCreditBalance(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    await resetMonthlyCreditsIfNeeded(user.id);
    
    const credits = await getUserCredits(user.id);
    
    // Get recent transactions
    const { data: recentTransactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: {
          ...credits,
          recent_transactions: recentTransactions || [],
        },
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

// GET /api/credit-system/packages - Get available credit packages
async function getCreditPackages(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: CREDIT_PACKAGES,
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

// POST /api/credit-system/purchase - Create credit purchase session
async function createCreditPurchase(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const { package_id, user_id }: CreditPurchaseRequest = JSON.parse(event.body || '{}');
    
    // For admin purchases for other users
    const targetUserId = user_id || user.id;
    if (user_id && user.id !== user_id) {
      const profile = await getUserProfile(user.id);
      if (profile.role !== 'super_admin') {
        throw new Error('Insufficient permissions to purchase credits for other users');
      }
    }
    
    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === package_id);
    if (!creditPackage) {
      throw new Error('Invalid credit package');
    }

    // For demo purposes, we'll simulate a successful payment
    // In a real implementation, you would integrate with Stripe or another payment processor
    
    const totalCredits = creditPackage.credits + (creditPackage.bonus_credits || 0);
    
    // Add credits to user account
    const currentCredits = await getUserCredits(targetUserId);
    
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        current_credits: currentCredits.current_credits + totalCredits,
        total_purchased: currentCredits.total_purchased + totalCredits,
      })
      .eq('user_id', targetUserId);
    
    if (updateError) {
      throw updateError;
    }
    
    // Log transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: targetUserId,
        transaction_type: 'purchase',
        credits_amount: totalCredits,
        description: `Purchased ${creditPackage.name} - ${creditPackage.credits} credits${creditPackage.bonus_credits ? ` + ${creditPackage.bonus_credits} bonus` : ''}`,
      });
    
    if (transactionError) {
      throw transactionError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Credits purchased successfully',
        package: creditPackage,
        credits_added: totalCredits,
        new_balance: currentCredits.current_credits + totalCredits,
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

// POST /api/credit-system/transfer - Transfer credits between users
async function transferCredits(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can transfer credits
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    const { to_user_id, credits, description }: CreditTransferRequest = JSON.parse(event.body || '{}');
    
    if (!to_user_id || !credits || credits <= 0) {
      throw new Error('Invalid transfer parameters');
    }
    
    // Get source user credits (admin transferring)
    const sourceCredits = await getUserCredits(user.id);
    
    if (sourceCredits.current_credits < credits) {
      throw new Error('Insufficient credits to transfer');
    }
    
    // Get target user credits
    const targetCredits = await getUserCredits(to_user_id);
    
    // Perform transfer
    const { error: sourceUpdateError } = await supabase
      .from('user_credits')
      .update({
        current_credits: sourceCredits.current_credits - credits,
        total_spent: sourceCredits.total_spent + credits,
      })
      .eq('user_id', user.id);
    
    if (sourceUpdateError) {
      throw sourceUpdateError;
    }
    
    const { error: targetUpdateError } = await supabase
      .from('user_credits')
      .update({
        current_credits: targetCredits.current_credits + credits,
        total_purchased: targetCredits.total_purchased + credits,
      })
      .eq('user_id', to_user_id);
    
    if (targetUpdateError) {
      throw targetUpdateError;
    }
    
    // Log transactions
    await Promise.all([
      supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'usage',
          credits_amount: -credits,
          description: `Transferred ${credits} credits to user ${to_user_id}${description ? `: ${description}` : ''}`,
        }),
      supabase
        .from('credit_transactions')
        .insert({
          user_id: to_user_id,
          transaction_type: 'allocation',
          credits_amount: credits,
          description: `Received ${credits} credits from admin${description ? `: ${description}` : ''}`,
        }),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Credits transferred successfully',
        transferred: credits,
        source_new_balance: sourceCredits.current_credits - credits,
        target_new_balance: targetCredits.current_credits + credits,
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

// POST /api/credit-system/allocate - Allocate monthly credits to user
async function allocateMonthlyCredits(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can allocate credits
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    const { user_id, monthly_allocation }: { user_id: string; monthly_allocation: number } = JSON.parse(event.body || '{}');
    
    if (!user_id || !monthly_allocation || monthly_allocation < 0) {
      throw new Error('Invalid allocation parameters');
    }
    
    // Update user's monthly allocation
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        monthly_allocation,
        last_reset_date: new Date().toISOString(),
      })
      .eq('user_id', user_id);
    
    if (updateError) {
      throw updateError;
    }
    
    // Log transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: user_id,
        transaction_type: 'allocation',
        credits_amount: 0,
        description: `Monthly allocation set to ${monthly_allocation} credits`,
      });
    
    if (transactionError) {
      throw transactionError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Monthly allocation updated successfully',
        user_id,
        monthly_allocation,
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

// GET /api/credit-system/transactions - Get user's credit transactions
async function getCreditTransactions(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    
    const params = new URLSearchParams(event.queryStringParameters || {});
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '20');
    const offset = (page - 1) * limit;
    const transaction_type = params.get('type');

    let query = supabase
      .from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: transactions,
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
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// GET /api/credit-system/analytics - Get credit usage analytics (admin only)
async function getCreditAnalytics(event: HandlerEvent) {
  try {
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);
    
    // Only super admins can view analytics
    if (profile.role !== 'super_admin') {
      throw new Error('Insufficient permissions');
    }
    
    // Get total credits stats
    const { data: totalStats } = await supabase
      .from('user_credits')
      .select('current_credits, total_purchased, total_spent, monthly_allocation, used_this_month');
    
    // Get transaction stats by type
    const { data: transactionStats } = await supabase
      .from('credit_transactions')
      .select('transaction_type, credits_amount');
    
    // Calculate aggregated stats
    const stats = {
      total_users: totalStats?.length || 0,
      total_current_credits: totalStats?.reduce((sum, user) => sum + user.current_credits, 0) || 0,
      total_purchased_credits: totalStats?.reduce((sum, user) => sum + user.total_purchased, 0) || 0,
      total_spent_credits: totalStats?.reduce((sum, user) => sum + user.total_spent, 0) || 0,
      total_monthly_allocation: totalStats?.reduce((sum, user) => sum + user.monthly_allocation, 0) || 0,
      total_used_this_month: totalStats?.reduce((sum, user) => sum + user.used_this_month, 0) || 0,
    };
    
    // Transaction type breakdown
    const transactionBreakdown = transactionStats?.reduce((acc: any, transaction) => {
      const type = transaction.transaction_type;
      if (!acc[type]) {
        acc[type] = { count: 0, total_credits: 0 };
      }
      acc[type].count++;
      acc[type].total_credits += Math.abs(transaction.credits_amount);
      return acc;
    }, {}) || {};

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: {
          overview: stats,
          transaction_breakdown: transactionBreakdown,
        },
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
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'balance') {
          return await getCreditBalance(event);
        }
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'packages') {
          return await getCreditPackages(event);
        }
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'transactions') {
          return await getCreditTransactions(event);
        }
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'analytics') {
          return await getCreditAnalytics(event);
        }
        break;

      case 'POST':
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'purchase') {
          return await createCreditPurchase(event);
        }
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'transfer') {
          return await transferCredits(event);
        }
        if (pathParts[0] === 'credit-system' && pathParts[1] === 'allocate') {
          return await allocateMonthlyCredits(event);
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
