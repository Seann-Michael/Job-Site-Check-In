import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Webhook secrets for verification
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const GOOGLE_WEBHOOK_SECRET = process.env.GOOGLE_WEBHOOK_SECRET;
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature, X-Google-Notification',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Helper function to verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace(/^(sha256=|sha1=)/, '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Helper function to log webhook events
async function logWebhookEvent(
  eventType: string,
  source: string,
  data: any,
  status: 'success' | 'failed' | 'skipped',
  error?: string
): Promise<void> {
  try {
    await supabase
      .from('webhook_logs')
      .insert({
        event_type: eventType,
        source,
        payload: data,
        status,
        error_message: error,
        processed_at: new Date().toISOString(),
      });
  } catch (logError) {
    console.error('Failed to log webhook event:', logError);
  }
}

// Helper function to send notifications
async function sendNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: any
): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        read: false,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

// Stripe webhook handler for payment events
async function handleStripeWebhook(event: HandlerEvent) {
  try {
    const signature = event.headers['stripe-signature'];
    const payload = event.body || '';

    if (!STRIPE_WEBHOOK_SECRET || !signature) {
      throw new Error('Missing Stripe webhook secret or signature');
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, STRIPE_WEBHOOK_SECRET)) {
      throw new Error('Invalid webhook signature');
    }

    const stripeEvent = JSON.parse(payload);
    
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(stripeEvent.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleSubscriptionPayment(stripeEvent.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(stripeEvent.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(stripeEvent.data.object);
        break;
        
      default:
        console.log(`Unhandled Stripe event type: ${stripeEvent.type}`);
        await logWebhookEvent(stripeEvent.type, 'stripe', stripeEvent, 'skipped');
    }

    await logWebhookEvent(stripeEvent.type, 'stripe', stripeEvent, 'success');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    await logWebhookEvent('unknown', 'stripe', { error: (error as Error).message }, 'failed', (error as Error).message);
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// Handle successful payment
async function handlePaymentSuccess(paymentIntent: any): Promise<void> {
  try {
    const userId = paymentIntent.metadata?.user_id;
    const packageId = paymentIntent.metadata?.package_id;
    const creditsAmount = parseInt(paymentIntent.metadata?.credits_amount || '0');

    if (!userId || !creditsAmount) {
      throw new Error('Missing required payment metadata');
    }

    // Add credits to user account
    const { data: currentCredits, error: fetchError } = await supabase
      .from('user_credits')
      .select('current_credits, total_purchased')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        current_credits: currentCredits.current_credits + creditsAmount,
        total_purchased: currentCredits.total_purchased + creditsAmount,
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    // Log credit transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'purchase',
        credits_amount: creditsAmount,
        description: `Credit purchase completed - Payment ID: ${paymentIntent.id}`,
      });

    // Send notification to user
    await sendNotification(
      userId,
      'credit_purchase',
      'Credits Added Successfully',
      `${creditsAmount} credits have been added to your account. Your new balance is ${currentCredits.current_credits + creditsAmount} credits.`,
      { payment_intent_id: paymentIntent.id, credits_added: creditsAmount }
    );

  } catch (error) {
    console.error('Error handling payment success:', error);
    throw error;
  }
}

// Handle failed payment
async function handlePaymentFailed(paymentIntent: any): Promise<void> {
  try {
    const userId = paymentIntent.metadata?.user_id;

    if (userId) {
      await sendNotification(
        userId,
        'payment_failed',
        'Payment Failed',
        'Your credit purchase could not be completed. Please try again or contact support if the problem persists.',
        { payment_intent_id: paymentIntent.id, last_payment_error: paymentIntent.last_payment_error }
      );
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Handle subscription payment
async function handleSubscriptionPayment(invoice: any): Promise<void> {
  try {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    // Find user by Stripe customer ID
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error || !user) {
      console.error('User not found for customer ID:', customerId);
      return;
    }

    // Update user's subscription status and add monthly credits
    const monthlyCredits = parseInt(invoice.metadata?.monthly_credits || '1000');

    await supabase
      .from('user_credits')
      .update({
        monthly_allocation: monthlyCredits,
        last_reset_date: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // Log transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        transaction_type: 'allocation',
        credits_amount: monthlyCredits,
        description: `Monthly subscription credits - Invoice: ${invoice.id}`,
      });

    await sendNotification(
      user.id,
      'subscription_renewal',
      'Subscription Renewed',
      `Your monthly subscription has been renewed. ${monthlyCredits} credits have been allocated to your account.`,
      { invoice_id: invoice.id, monthly_credits: monthlyCredits }
    );

  } catch (error) {
    console.error('Error handling subscription payment:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdate(subscription: any): Promise<void> {
  try {
    const customerId = subscription.customer;
    
    // Find user by Stripe customer ID
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error || !user) {
      console.error('User not found for customer ID:', customerId);
      return;
    }

    // Update subscription status
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        plan_id: subscription.items.data[0]?.price?.id,
        updated_at: new Date().toISOString(),
      });

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handle subscription cancellation
async function handleSubscriptionCancellation(subscription: any): Promise<void> {
  try {
    const customerId = subscription.customer;
    
    // Find user by Stripe customer ID
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error || !user) {
      console.error('User not found for customer ID:', customerId);
      return;
    }

    // Update subscription status
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    // Reset monthly allocation
    await supabase
      .from('user_credits')
      .update({
        monthly_allocation: 100, // Default free tier
      })
      .eq('user_id', user.id);

    await sendNotification(
      user.id,
      'subscription_canceled',
      'Subscription Canceled',
      'Your subscription has been canceled. You will retain access until the end of your current billing period.',
      { subscription_id: subscription.id, canceled_at: subscription.canceled_at }
    );

  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

// Google My Business webhook handler
async function handleGoogleWebhook(event: HandlerEvent) {
  try {
    const payload = event.body || '';
    const googleNotification = event.headers['x-google-notification'];

    if (!googleNotification) {
      throw new Error('Missing Google notification header');
    }

    // Parse the notification
    const notification = JSON.parse(payload);
    
    switch (notification.eventType) {
      case 'business.profile.updated':
        await handleBusinessProfileUpdate(notification);
        break;
        
      case 'business.reviews.new':
        await handleNewReview(notification);
        break;
        
      case 'business.hours.updated':
        await handleBusinessHoursUpdate(notification);
        break;
        
      default:
        console.log(`Unhandled Google event type: ${notification.eventType}`);
        await logWebhookEvent(notification.eventType, 'google', notification, 'skipped');
    }

    await logWebhookEvent(notification.eventType, 'google', notification, 'success');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    await logWebhookEvent('unknown', 'google', { error: (error as Error).message }, 'failed', (error as Error).message);
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// Handle business profile updates
async function handleBusinessProfileUpdate(notification: any): Promise<void> {
  try {
    const accountId = notification.accountId;
    const locationId = notification.locationId;

    // Find the corresponding GMB lead
    const { data: lead, error } = await supabase
      .from('gmb_leads')
      .select('*')
      .eq('google_cid', locationId)
      .single();

    if (error || !lead) {
      console.log('Lead not found for location:', locationId);
      return;
    }

    // Update the lead's last_updated timestamp
    await supabase
      .from('gmb_leads')
      .update({
        last_updated: new Date().toISOString(),
        raw_data: {
          ...lead.raw_data,
          last_google_update: notification,
        },
      })
      .eq('id', lead.id);

    // TODO: Fetch updated business data from Google API
    // This would require implementing Google My Business API calls

  } catch (error) {
    console.error('Error handling business profile update:', error);
  }
}

// Handle new reviews
async function handleNewReview(notification: any): Promise<void> {
  try {
    const locationId = notification.locationId;
    const review = notification.review;

    // Find the corresponding GMB lead
    const { data: lead, error } = await supabase
      .from('gmb_leads')
      .select('*')
      .eq('google_cid', locationId)
      .single();

    if (error || !lead) {
      console.log('Lead not found for location:', locationId);
      return;
    }

    // Update review count and potentially rating
    await supabase
      .from('gmb_leads')
      .update({
        review_count: (lead.review_count || 0) + 1,
        last_updated: new Date().toISOString(),
      })
      .eq('id', lead.id);

    // Notify users who have unlocked this lead
    const { data: unlocks } = await supabase
      .from('lead_unlocks')
      .select('user_id')
      .eq('lead_id', lead.id);

    if (unlocks) {
      const notifications = unlocks.map(unlock =>
        sendNotification(
          unlock.user_id,
          'business_update',
          'New Review Alert',
          `${lead.business_name} received a new review. This could be a good opportunity for outreach.`,
          { lead_id: lead.id, business_name: lead.business_name, review }
        )
      );

      await Promise.all(notifications);
    }

  } catch (error) {
    console.error('Error handling new review:', error);
  }
}

// Handle business hours updates
async function handleBusinessHoursUpdate(notification: any): Promise<void> {
  try {
    const locationId = notification.locationId;
    const hours = notification.hours;

    // Find the corresponding GMB lead
    const { data: lead, error } = await supabase
      .from('gmb_leads')
      .select('*')
      .eq('google_cid', locationId)
      .single();

    if (error || !lead) {
      console.log('Lead not found for location:', locationId);
      return;
    }

    // Update business hours
    await supabase
      .from('gmb_leads')
      .update({
        hours,
        last_updated: new Date().toISOString(),
      })
      .eq('id', lead.id);

  } catch (error) {
    console.error('Error handling business hours update:', error);
  }
}

// Internal webhook handler for system events
async function handleInternalWebhook(event: HandlerEvent) {
  try {
    const signature = event.headers['x-webhook-signature'];
    const payload = event.body || '';

    if (!INTERNAL_WEBHOOK_SECRET || !signature) {
      throw new Error('Missing internal webhook secret or signature');
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, INTERNAL_WEBHOOK_SECRET)) {
      throw new Error('Invalid webhook signature');
    }

    const internalEvent = JSON.parse(payload);
    
    switch (internalEvent.type) {
      case 'scan.completed':
        await handleScanCompleted(internalEvent.data);
        break;
        
      case 'lead.analyzed':
        await handleLeadAnalyzed(internalEvent.data);
        break;
        
      case 'user.credits.low':
        await handleLowCredits(internalEvent.data);
        break;
        
      case 'system.maintenance':
        await handleSystemMaintenance(internalEvent.data);
        break;
        
      default:
        console.log(`Unhandled internal event type: ${internalEvent.type}`);
        await logWebhookEvent(internalEvent.type, 'internal', internalEvent, 'skipped');
    }

    await logWebhookEvent(internalEvent.type, 'internal', internalEvent, 'success');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    await logWebhookEvent('unknown', 'internal', { error: (error as Error).message }, 'failed', (error as Error).message);
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// Handle scan completion
async function handleScanCompleted(data: any): Promise<void> {
  try {
    const { scan_id, user_id, results } = data;

    await sendNotification(
      user_id,
      'scan_completed',
      'Geo Grid Scan Completed',
      `Your scan has completed successfully. Found ${results.new_leads} new leads out of ${results.total_processed} businesses scanned.`,
      { scan_id, results }
    );
  } catch (error) {
    console.error('Error handling scan completion:', error);
  }
}

// Handle lead analysis completion
async function handleLeadAnalyzed(data: any): Promise<void> {
  try {
    const { lead_id, user_id, analysis } = data;

    if (analysis.lead_potential_score >= 70) {
      await sendNotification(
        user_id,
        'high_potential_lead',
        'High Potential Lead Identified',
        `A high-potential lead has been identified with a score of ${analysis.lead_potential_score}. Consider prioritizing this lead for outreach.`,
        { lead_id, analysis }
      );
    }
  } catch (error) {
    console.error('Error handling lead analysis:', error);
  }
}

// Handle low credits warning
async function handleLowCredits(data: any): Promise<void> {
  try {
    const { user_id, current_credits, threshold } = data;

    await sendNotification(
      user_id,
      'low_credits',
      'Low Credits Warning',
      `Your credit balance is running low (${current_credits} remaining). Consider purchasing more credits to continue unlocking leads.`,
      { current_credits, threshold }
    );
  } catch (error) {
    console.error('Error handling low credits warning:', error);
  }
}

// Handle system maintenance notifications
async function handleSystemMaintenance(data: any): Promise<void> {
  try {
    const { message, scheduled_at, duration } = data;

    // Notify all active users
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('active', true);

    if (users) {
      const notifications = users.map(user =>
        sendNotification(
          user.id,
          'system_maintenance',
          'Scheduled Maintenance',
          message,
          { scheduled_at, duration }
        )
      );

      await Promise.all(notifications);
    }
  } catch (error) {
    console.error('Error handling system maintenance notification:', error);
  }
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
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

  const path = event.path.replace('/api/', '');
  const pathParts = path.split('/');

  try {
    switch (pathParts[1]) {
      case 'stripe':
        return await handleStripeWebhook(event);
        
      case 'google':
        return await handleGoogleWebhook(event);
        
      case 'internal':
        return await handleInternalWebhook(event);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Webhook endpoint not found' }),
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
