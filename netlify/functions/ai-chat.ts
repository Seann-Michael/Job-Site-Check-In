import { Handler } from '@netlify/functions';
import { authMiddleware } from './auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// DataForSEO credentials (these should be set in Netlify environment variables)
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

interface AIRequest {
  message: string;
  session_id?: string;
}

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

    // Apply auth middleware
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
      const { message, session_id }: AIRequest = JSON.parse(body);

      if (!message || !message.trim()) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Message is required' }),
        };
      }

      if (!session_id) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Session ID is required' }),
        };
      }

      const user = JSON.parse(authResult.body).user;

      // Check user's credit balance
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .select('current_credits, total_spent')
        .eq('user_id', user.id)
        .single();

      if (creditError || !creditData || creditData.current_credits <= 0) {
        return {
          statusCode: 402,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Insufficient credits',
            credits_remaining: creditData?.current_credits || 0
          }),
        };
      }

      // Verify session exists and belongs to user
      const { data: session, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .select('id')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Session not found' }),
        };
      }

      // Save user message to database
      await supabase
        .from('ai_chat_messages')
        .insert({
          session_id: session_id,
          user_id: user.id,
          message_type: 'user',
          content: message.trim(),
        });

      // For now, provide a mock AI response while DataForSEO integration is being configured
      const mockResponses = [
        `Great question about "${message.trim()}"! Here are some key insights:

• SEO Strategy: Focus on long-tail keywords and user intent
• Content Marketing: Create valuable, engaging content that solves problems
• Technical SEO: Ensure fast loading times and mobile optimization
• Local SEO: Optimize for local search if you serve specific geographic areas

Would you like me to elaborate on any of these areas?`,

        `Regarding "${message.trim()}", here's my analysis:

• Competitor Research: Analyze top-performing competitors in your space
• Keyword Opportunities: Look for low-competition, high-intent keywords
• Content Gaps: Identify topics your competitors haven't covered well
• Backlink Strategy: Build quality links from relevant, authoritative sites

Let me know if you need specific tactics for any of these strategies!`,

        `For "${message.trim()}", I recommend these approaches:

• Performance Optimization: Improve Core Web Vitals and page speed
• User Experience: Enhance navigation and reduce bounce rates
• Content Quality: Create comprehensive, authoritative content
• Social Signals: Build engagement across social media platforms

Each of these elements works together to improve your overall digital presence.`
      ];

      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      
      // Simulate API cost and processing time
      const actualCost = 0.005 + Math.random() * 0.010; // $0.005 - $0.015
      const creditsToDeduct = Math.ceil(actualCost * 150); // 150x markup for testing

      // Deduct credits from user account
      const { error: deductError } = await supabase
        .from('user_credits')
        .update({
          current_credits: creditData.current_credits - creditsToDeduct,
          total_spent: (creditData.total_spent || 0) + creditsToDeduct,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (deductError) {
        console.error('Error deducting credits:', deductError);
        // Continue anyway, we don't want to fail the AI response
      }

      // Save AI response to database
      await supabase
        .from('ai_chat_messages')
        .insert({
          session_id: session_id,
          user_id: user.id,
          message_type: 'ai',
          content: randomResponse,
          credits_used: creditsToDeduct,
          cost: actualCost,
          processing_time: '1.5s',
          metadata: {
            note: 'Mock response while DataForSEO integration is configured'
          }
        });

      // Log the transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'usage',
          credits_amount: creditsToDeduct,
          description: 'AI Agent query (mock)',
          created_at: new Date().toISOString()
        });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          response: randomResponse,
          cost: actualCost,
          credits_used: creditsToDeduct,
          credits_remaining: creditData.current_credits - creditsToDeduct,
          processing_time: '1.5s',
          note: 'Mock AI response - DataForSEO integration in progress'
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
    console.error('Unhandled error in AI chat:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      }),
    };
  }
};

export { handler };
