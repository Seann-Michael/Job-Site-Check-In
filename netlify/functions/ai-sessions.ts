import { Handler } from '@netlify/functions';
import { authMiddleware } from './auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: Handler = async (event, context) => {
  try {
    const { httpMethod, path } = event;
    const pathParts = path?.split('/').filter(p => p) || [];

    // Handle OPTIONS requests (CORS preflight)
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: '',
      };
    }

    // Apply auth middleware
    const authResult = await authMiddleware(event);
    if (authResult.statusCode !== 200) {
      return authResult;
    }

    const user = JSON.parse(authResult.body).user;

    // Parse path to determine action
    // /api/ai/sessions -> list sessions
    // /api/ai/sessions/{id} -> get/update/delete session
    // /api/ai/sessions/{id}/messages -> get messages for session

    if (httpMethod === 'GET') {
      // GET /api/ai/sessions - List all sessions for user
      if (pathParts.length === 3 && pathParts[2] === 'sessions') {
        // Handle demo users with mock data
        if (user.id === '1') {
          const mockSessions = [
            {
              id: 'demo-session-1',
              title: 'SEO Strategy Discussion',
              total_messages: 8,
              total_credits_used: 45,
              total_cost: 0.15,
              last_message_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            },
            {
              id: 'demo-session-2',
              title: 'Local Business Optimization',
              total_messages: 12,
              total_credits_used: 67,
              total_cost: 0.22,
              last_message_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            },
          ];

          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ sessions: mockSessions }),
          };
        }

        const { data: sessions, error } = await supabase
          .from('ai_chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching sessions:', error);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to fetch sessions' }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ sessions: sessions || [] }),
        };
      }

      // GET /api/ai/sessions/{id}/messages - Get messages for session
      if (pathParts.length === 5 && pathParts[4] === 'messages') {
        const sessionId = pathParts[3];

        // Handle demo users with mock data
        if (user.id === '1' && sessionId.startsWith('demo-session-')) {
          const mockMessages = [
            {
              id: '1',
              session_id: sessionId,
              user_id: user.id,
              message_type: 'user',
              content: 'Can you help me improve my website\'s SEO?',
              created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
              credits_used: null,
              cost: null,
            },
            {
              id: '2',
              session_id: sessionId,
              user_id: user.id,
              message_type: 'ai',
              content: 'I\'d be happy to help you improve your website\'s SEO! Here are some key areas to focus on:\n\n• **Keyword Research**: Identify relevant keywords your target audience searches for\n• **On-Page Optimization**: Optimize title tags, meta descriptions, and headers\n• **Content Quality**: Create valuable, engaging content that answers user questions\n• **Technical SEO**: Ensure fast loading times and mobile responsiveness\n• **Local SEO**: Optimize for local search if you serve specific geographic areas\n\nWhat specific aspect of SEO would you like to dive deeper into?',
              created_at: new Date(Date.now() - 29 * 60 * 1000).toISOString(), // 29 min ago
              credits_used: 15,
              cost: 0.05,
            },
          ];

          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ messages: mockMessages }),
          };
        }

        // Verify session belongs to user
        const { data: session } = await supabase
          .from('ai_chat_sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single();

        if (!session) {
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Session not found' }),
          };
        }

        const { data: messages, error } = await supabase
          .from('ai_chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to fetch messages' }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ messages: messages || [] }),
        };
      }
    }

    if (httpMethod === 'POST') {
      // POST /api/ai/sessions - Create new session
      if (pathParts.length === 3 && pathParts[2] === 'sessions') {
        const { title } = JSON.parse(event.body || '{}');

        if (!title || !title.trim()) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Title is required' }),
          };
        }

        // Handle demo users with mock data
        if (user.id === '1') {
          const mockSession = {
            id: `demo-session-${Date.now()}`,
            user_id: user.id,
            title: title.trim(),
            total_messages: 0,
            total_credits_used: 0,
            total_cost: 0,
            created_at: new Date().toISOString(),
            last_message_at: null,
          };

          return {
            statusCode: 201,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ session: mockSession }),
          };
        }

        const { data: session, error } = await supabase
          .from('ai_chat_sessions')
          .insert({
            user_id: user.id,
            title: title.trim(),
            total_messages: 0,
            total_credits_used: 0,
            total_cost: 0,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating session:', error);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to create session' }),
          };
        }

        return {
          statusCode: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ session }),
        };
      }
    }

    if (httpMethod === 'PUT') {
      // PUT /api/ai/sessions/{id} - Update session
      if (pathParts.length === 4) {
        const sessionId = pathParts[3];
        const { title } = JSON.parse(event.body || '{}');

        if (!title || !title.trim()) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Title is required' }),
          };
        }

        const { data: session, error } = await supabase
          .from('ai_chat_sessions')
          .update({ title: title.trim() })
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error || !session) {
          console.error('Error updating session:', error);
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Session not found or update failed' }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ session }),
        };
      }
    }

    if (httpMethod === 'DELETE') {
      // DELETE /api/ai/sessions/{id} - Delete session
      if (pathParts.length === 4) {
        const sessionId = pathParts[3];

        // Delete messages first (cascade should handle this, but being explicit)
        await supabase
          .from('ai_chat_messages')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', user.id);

        // Delete session
        const { error } = await supabase
          .from('ai_chat_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting session:', error);
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to delete session' }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ success: true }),
        };
      }
    }

    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };

  } catch (error) {
    console.error('Unhandled error in AI sessions:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      }),
    };
  }
};

export { handler };
