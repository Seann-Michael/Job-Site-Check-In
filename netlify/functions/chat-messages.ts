import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

interface Message {
  id?: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type?: 'text' | 'image' | 'file';
  created_at?: string;
  updated_at?: string;
  edited?: boolean;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
    };
  }

  try {
    // Authenticate user
    const user = await getUserFromAuth(event.headers.authorization);
    const profile = await getUserProfile(user.id);

    const path = event.path;
    const method = event.httpMethod;

    // Parse message ID from path if present
    const messageIdMatch = path.match(/\/chat-messages\/([^\/]+)$/);
    const messageId = messageIdMatch ? messageIdMatch[1] : null;

    switch (method) {
      case 'GET':
        if (messageId) {
          // Get specific message
          return await getMessage(messageId, user.id);
        } else {
          // Get messages for a channel
          const channelId = event.queryStringParameters?.channel_id;
          if (!channelId) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'channel_id is required' }),
            };
          }
          return await getMessages(channelId, user.id, event.queryStringParameters);
        }

      case 'POST':
        // Create new message
        const messageData = JSON.parse(event.body || '{}');
        return await createMessage(messageData, user.id);

      case 'PUT':
        // Update message
        if (!messageId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Message ID is required for updates' }),
          };
        }
        const updateData = JSON.parse(event.body || '{}');
        return await updateMessage(messageId, updateData, user.id);

      case 'DELETE':
        // Delete message
        if (!messageId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Message ID is required for deletion' }),
          };
        }
        return await deleteMessage(messageId, user.id);

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Chat messages error:', error);
    return {
      statusCode: error.message.includes('authorization') || error.message.includes('token') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
    };
  }
};

// Get messages for a channel
async function getMessages(channelId: string, userId: string, params: any = {}) {
  try {
    // TODO: Add channel access verification
    
    const limit = parseInt(params.limit) || 50;
    const offset = parseInt(params.offset) || 0;

    // For now, return mock data since we don't have tables yet
    const mockMessages = [
      {
        id: '1',
        channel_id: channelId,
        user_id: 'user1',
        content: 'Welcome to the team chat! 👋',
        message_type: 'text',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        edited: false,
        user: {
          id: 'user1',
          full_name: 'John Smith',
          role: 'Admin'
        }
      },
      {
        id: '2',
        channel_id: channelId,
        user_id: 'user2',
        content: 'Thanks! Looking forward to working together.',
        message_type: 'text',
        created_at: new Date(Date.now() - 3500000).toISOString(),
        edited: false,
        user: {
          id: 'user2',
          full_name: 'Sarah Johnson',
          role: 'Manager'
        }
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        messages: mockMessages,
        total: mockMessages.length,
        limit,
        offset
      }),
    };
  } catch (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }
}

// Get specific message
async function getMessage(messageId: string, userId: string) {
  try {
    // TODO: Add database query when tables exist
    // For now, return mock data
    const mockMessage = {
      id: messageId,
      channel_id: 'general',
      user_id: 'user1',
      content: 'This is a test message',
      message_type: 'text',
      created_at: new Date().toISOString(),
      edited: false,
      user: {
        id: 'user1',
        full_name: 'John Smith',
        role: 'Admin'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockMessage),
    };
  } catch (error) {
    throw new Error(`Failed to get message: ${error.message}`);
  }
}

// Create new message
async function createMessage(messageData: Message, userId: string) {
  try {
    // Validate required fields
    if (!messageData.channel_id || !messageData.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'channel_id and content are required' 
        }),
      };
    }

    // TODO: Add to database when tables exist
    // For now, return mock response
    const newMessage = {
      id: Date.now().toString(),
      channel_id: messageData.channel_id,
      user_id: userId,
      content: messageData.content,
      message_type: messageData.message_type || 'text',
      created_at: new Date().toISOString(),
      edited: false,
      user: {
        id: userId,
        full_name: 'Current User',
        role: 'User'
      }
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(newMessage),
    };
  } catch (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }
}

// Update message
async function updateMessage(messageId: string, updateData: Partial<Message>, userId: string) {
  try {
    // TODO: Add database update when tables exist
    // For now, return mock response
    const updatedMessage = {
      id: messageId,
      channel_id: 'general',
      user_id: userId,
      content: updateData.content || 'Updated message',
      message_type: 'text',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString(),
      edited: true,
      user: {
        id: userId,
        full_name: 'Current User',
        role: 'User'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updatedMessage),
    };
  } catch (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }
}

// Delete message
async function deleteMessage(messageId: string, userId: string) {
  try {
    // TODO: Add database deletion when tables exist
    // For now, return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Message deleted successfully',
        id: messageId 
      }),
    };
  } catch (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
}
