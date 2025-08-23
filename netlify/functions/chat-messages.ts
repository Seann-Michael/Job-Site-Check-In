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
    // Verify user has access to channel
    const { data: participation, error: participationError } = await supabase
      .from('chat_channel_participants')
      .select('*')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied to this channel' }),
      };
    }

    const limit = parseInt(params.limit) || 50;
    const offset = parseInt(params.offset) || 0;

    // Get messages with user profiles
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        channel_id,
        user_id,
        content,
        message_type,
        created_at,
        updated_at,
        edited_at,
        deleted_at,
        metadata,
        user_profiles!inner(
          id,
          full_name,
          role
        )
      `)
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      throw new Error(`Database error: ${messagesError.message}`);
    }

    // Format messages for response
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      channel_id: msg.channel_id,
      user_id: msg.user_id,
      content: msg.content,
      message_type: msg.message_type,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      edited: !!msg.edited_at,
      user: {
        id: msg.user_id,
        full_name: msg.user_profiles?.full_name || 'Unknown User',
        role: msg.user_profiles?.role || 'User'
      }
    }));

    // Update last_read_at for the user
    await supabase
      .from('chat_channel_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        messages: formattedMessages,
        total: formattedMessages.length,
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
    // Get message with user profile and verify access
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        channel_id,
        user_id,
        content,
        message_type,
        created_at,
        updated_at,
        edited_at,
        deleted_at,
        metadata,
        user_profiles!inner(
          id,
          full_name,
          role
        ),
        chat_channels!inner(
          id,
          chat_channel_participants!inner(
            user_id
          )
        )
      `)
      .eq('id', messageId)
      .eq('chat_channels.chat_channel_participants.user_id', userId)
      .is('deleted_at', null)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Message not found or access denied' }),
      };
    }

    const formattedMessage = {
      id: message.id,
      channel_id: message.channel_id,
      user_id: message.user_id,
      content: message.content,
      message_type: message.message_type,
      created_at: message.created_at,
      updated_at: message.updated_at,
      edited: !!message.edited_at,
      user: {
        id: message.user_id,
        full_name: message.user_profiles?.full_name || 'Unknown User',
        role: message.user_profiles?.role || 'User'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedMessage),
    };
  } catch (error) {
    throw new Error(`Failed to get message: ${error.message}`);
  }
}

// Create new message
async function createMessage(messageData: Message, userId: string) {
  try {
    // Validate required fields
    if (!messageData.channel_id || !messageData.content?.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'channel_id and content are required'
        }),
      };
    }

    // Verify user has access to channel
    const { data: participation, error: participationError } = await supabase
      .from('chat_channel_participants')
      .select('*')
      .eq('channel_id', messageData.channel_id)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied to this channel' }),
      };
    }

    // Get user profile
    const userProfile = await getUserProfile(userId);

    // Insert message into database
    const { data: newMessage, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: messageData.channel_id,
        user_id: userId,
        content: messageData.content.trim(),
        message_type: messageData.message_type || 'text',
        metadata: messageData.metadata || {}
      })
      .select('*')
      .single();

    if (insertError) {
      throw new Error(`Failed to insert message: ${insertError.message}`);
    }

    // Create notifications for other channel participants
    const { data: participants } = await supabase
      .from('chat_channel_participants')
      .select('user_id')
      .eq('channel_id', messageData.channel_id)
      .neq('user_id', userId);

    if (participants && participants.length > 0) {
      const notifications = participants.map(p => ({
        user_id: p.user_id,
        channel_id: messageData.channel_id,
        message_id: newMessage.id,
        notification_type: 'message'
      }));

      await supabase
        .from('chat_notifications')
        .insert(notifications);
    }

    // Format response
    const formattedMessage = {
      id: newMessage.id,
      channel_id: newMessage.channel_id,
      user_id: newMessage.user_id,
      content: newMessage.content,
      message_type: newMessage.message_type,
      created_at: newMessage.created_at,
      edited: false,
      user: {
        id: userId,
        full_name: userProfile.full_name || userProfile.name || 'Unknown User',
        role: userProfile.role || 'User'
      }
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(formattedMessage),
    };
  } catch (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }
}

// Update message
async function updateMessage(messageId: string, updateData: Partial<Message>, userId: string) {
  try {
    if (!updateData.content?.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content is required' }),
      };
    }

    // Verify user owns the message
    const { data: existingMessage, error: checkError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingMessage) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Message not found or access denied' }),
      };
    }

    // Update the message
    const { data: updatedMessage, error: updateError } = await supabase
      .from('chat_messages')
      .update({
        content: updateData.content.trim(),
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .select(`
        id,
        channel_id,
        user_id,
        content,
        message_type,
        created_at,
        updated_at,
        edited_at
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }

    // Get user profile
    const userProfile = await getUserProfile(userId);

    const formattedMessage = {
      id: updatedMessage.id,
      channel_id: updatedMessage.channel_id,
      user_id: updatedMessage.user_id,
      content: updatedMessage.content,
      message_type: updatedMessage.message_type,
      created_at: updatedMessage.created_at,
      updated_at: updatedMessage.updated_at,
      edited: true,
      user: {
        id: userId,
        full_name: userProfile.full_name || userProfile.name || 'Unknown User',
        role: userProfile.role || 'User'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedMessage),
    };
  } catch (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }
}

// Delete message (soft delete)
async function deleteMessage(messageId: string, userId: string) {
  try {
    // Verify user owns the message
    const { data: existingMessage, error: checkError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingMessage) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Message not found or access denied' }),
      };
    }

    // Soft delete the message
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (deleteError) {
      throw new Error(`Failed to delete message: ${deleteError.message}`);
    }

    // Remove related notifications
    await supabase
      .from('chat_notifications')
      .delete()
      .eq('message_id', messageId);

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
