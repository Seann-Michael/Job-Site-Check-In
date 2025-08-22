import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatMessage {
  id?: string;
  channel_id: string;
  content: string;
  message_type?: 'text' | 'system' | 'task_created' | 'file' | 'image';
  parent_message_id?: string;
  mentioned_users?: string[];
  mentioned_channels?: string[];
  formatted_content?: any;
}

interface MessageQuery {
  channel_id: string;
  limit?: number;
  offset?: number;
  before_message_id?: string;
  after_message_id?: string;
  thread_id?: string;
  search?: string;
}

// Helper function to check if user can access channel
async function canUserAccessChannel(channelId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_channel_participants')
    .select('id')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .single();
  
  return !!data;
}

// Helper function to extract mentions from message content
function extractMentions(content: string): { users: string[], channels: string[] } {
  const userMentions = content.match(/@([a-f0-9-]{36})/g) || [];
  const channelMentions = content.match(/#([a-f0-9-]{36})/g) || [];
  
  return {
    users: userMentions.map(mention => mention.substring(1)),
    channels: channelMentions.map(mention => mention.substring(1))
  };
}

// Helper function to create notifications for mentions
async function createMentionNotifications(messageId: string, channelId: string, mentionedUsers: string[], senderId: string) {
  if (mentionedUsers.length === 0) return;

  const notifications = mentionedUsers
    .filter(userId => userId !== senderId) // Don't notify the sender
    .map(userId => ({
      user_id: userId,
      channel_id: channelId,
      message_id: messageId,
      notification_type: 'mention',
      title: 'You were mentioned',
      body: 'You were mentioned in a message'
    }));

  if (notifications.length > 0) {
    await supabase
      .from('chat_notifications')
      .insert(notifications);
  }
}

export const handler: Handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    };
  }

  try {
    // Verify authentication
    const authHeader = event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    const method = event.httpMethod;
    const path = event.path;
    const pathParts = path.split('/');
    const messageId = pathParts[pathParts.length - 1];
    const action = pathParts[pathParts.length - 2];

    switch (method) {
      case 'GET':
        if (action === 'messages' || messageId === 'chat-messages') {
          // Get messages for a channel
          const query: MessageQuery = {
            channel_id: event.queryStringParameters?.channel_id || '',
            limit: parseInt(event.queryStringParameters?.limit || '50'),
            offset: parseInt(event.queryStringParameters?.offset || '0'),
            before_message_id: event.queryStringParameters?.before_message_id,
            after_message_id: event.queryStringParameters?.after_message_id,
            thread_id: event.queryStringParameters?.thread_id,
            search: event.queryStringParameters?.search
          };

          if (!query.channel_id) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Channel ID is required' }),
            };
          }

          // Check access to channel
          if (!(await canUserAccessChannel(query.channel_id, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          let queryBuilder = supabase
            .from('chat_messages')
            .select(`
              *,
              user:auth.users (
                id,
                email,
                raw_user_meta_data
              ),
              reactions:chat_message_reactions (
                id,
                emoji,
                emoji_native,
                user_id,
                created_at
              ),
              attachments:chat_message_attachments (
                id,
                filename,
                file_size,
                mime_type,
                public_url,
                thumbnail_url
              )
            `)
            .eq('channel_id', query.channel_id)
            .is('deleted_at', null);

          // Apply filters
          if (query.thread_id) {
            queryBuilder = queryBuilder.eq('parent_message_id', query.thread_id);
          } else {
            queryBuilder = queryBuilder.is('parent_message_id', null); // Only top-level messages
          }

          if (query.search) {
            queryBuilder = queryBuilder.ilike('content', `%${query.search}%`);
          }

          if (query.before_message_id) {
            const { data: beforeMessage } = await supabase
              .from('chat_messages')
              .select('created_at')
              .eq('id', query.before_message_id)
              .single();
            
            if (beforeMessage) {
              queryBuilder = queryBuilder.lt('created_at', beforeMessage.created_at);
            }
          }

          if (query.after_message_id) {
            const { data: afterMessage } = await supabase
              .from('chat_messages')
              .select('created_at')
              .eq('id', query.after_message_id)
              .single();
            
            if (afterMessage) {
              queryBuilder = queryBuilder.gt('created_at', afterMessage.created_at);
            }
          }

          const { data: messages, error, count } = await queryBuilder
            .order('created_at', { ascending: false })
            .limit(query.limit)
            .range(query.offset, query.offset + query.limit - 1);

          if (error) {
            throw error;
          }

          // Update last read timestamp for the user
          await supabase
            .from('chat_channel_participants')
            .update({ 
              last_read_at: new Date().toISOString(),
              last_read_message_id: messages?.[0]?.id || null
            })
            .eq('channel_id', query.channel_id)
            .eq('user_id', user.id);

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: messages || [],
              total: count || 0,
              limit: query.limit,
              offset: query.offset
            }),
          };
        } else if (action === 'thread') {
          // Get thread messages
          if (!(await canUserAccessChannel(event.queryStringParameters?.channel_id || '', user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          const { data: messages, error } = await supabase
            .from('chat_messages')
            .select(`
              *,
              user:auth.users (
                id,
                email,
                raw_user_meta_data
              ),
              reactions:chat_message_reactions (
                id,
                emoji,
                emoji_native,
                user_id,
                created_at
              )
            `)
            .eq('parent_message_id', messageId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages: messages || [] }),
          };
        } else {
          // Get specific message
          const { data: message, error } = await supabase
            .from('chat_messages')
            .select(`
              *,
              user:auth.users (
                id,
                email,
                raw_user_meta_data
              ),
              reactions:chat_message_reactions (
                id,
                emoji,
                emoji_native,
                user_id,
                created_at
              ),
              attachments:chat_message_attachments (
                id,
                filename,
                file_size,
                mime_type,
                public_url,
                thumbnail_url
              )
            `)
            .eq('id', messageId)
            .is('deleted_at', null)
            .single();

          if (error) {
            return {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Message not found' }),
            };
          }

          // Check access to channel
          if (!(await canUserAccessChannel(message.channel_id, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          };
        }

      case 'POST':
        if (action === 'react') {
          // Add reaction to message
          const { emoji, emoji_native } = JSON.parse(event.body || '{}');

          // Check if message exists and user has access
          const { data: message } = await supabase
            .from('chat_messages')
            .select('channel_id')
            .eq('id', messageId)
            .single();

          if (!message || !(await canUserAccessChannel(message.channel_id, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          // Add or remove reaction (toggle)
          const { data: existingReaction } = await supabase
            .from('chat_message_reactions')
            .select('id')
            .eq('message_id', messageId)
            .eq('user_id', user.id)
            .eq('emoji', emoji)
            .single();

          if (existingReaction) {
            // Remove reaction
            const { error } = await supabase
              .from('chat_message_reactions')
              .delete()
              .eq('id', existingReaction.id);

            if (error) throw error;

            return {
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action: 'removed' }),
            };
          } else {
            // Add reaction
            const { data: reaction, error } = await supabase
              .from('chat_message_reactions')
              .insert({
                message_id: messageId,
                user_id: user.id,
                emoji,
                emoji_native
              })
              .select()
              .single();

            if (error) throw error;

            return {
              statusCode: 201,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action: 'added', reaction }),
            };
          }
        } else {
          // Send new message
          const messageData: ChatMessage = JSON.parse(event.body || '{}');

          // Validate required fields
          if (!messageData.channel_id || !messageData.content) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Channel ID and content are required' }),
            };
          }

          // Check access to channel
          if (!(await canUserAccessChannel(messageData.channel_id, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          // Extract mentions from content
          const mentions = extractMentions(messageData.content);

          // Create message
          const { data: message, error: messageError } = await supabase
            .from('chat_messages')
            .insert({
              ...messageData,
              user_id: user.id,
              mentioned_users: mentions.users,
              mentioned_channels: mentions.channels,
              message_type: messageData.message_type || 'text'
            })
            .select(`
              *,
              user:auth.users (
                id,
                email,
                raw_user_meta_data
              )
            `)
            .single();

          if (messageError) {
            throw messageError;
          }

          // Create notifications for mentions
          if (mentions.users.length > 0) {
            await createMentionNotifications(message.id, messageData.channel_id, mentions.users, user.id);
          }

          // Create notifications for channel members (except sender)
          const { data: participants } = await supabase
            .from('chat_channel_participants')
            .select('user_id, notification_level')
            .eq('channel_id', messageData.channel_id)
            .neq('user_id', user.id)
            .neq('notification_level', 'none');

          if (participants) {
            const channelNotifications = participants
              .filter(p => p.notification_level === 'all' || mentions.users.includes(p.user_id))
              .map(p => ({
                user_id: p.user_id,
                channel_id: messageData.channel_id,
                message_id: message.id,
                notification_type: mentions.users.includes(p.user_id) ? 'mention' : 'channel_message',
                title: mentions.users.includes(p.user_id) ? 'You were mentioned' : 'New message',
                body: messageData.content.substring(0, 100)
              }));

            if (channelNotifications.length > 0) {
              await supabase
                .from('chat_notifications')
                .insert(channelNotifications);
            }
          }

          return {
            statusCode: 201,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          };
        }

      case 'PUT':
        // Update message (edit)
        const updateData = JSON.parse(event.body || '{}');

        // Check if user owns the message
        const { data: existingMessage } = await supabase
          .from('chat_messages')
          .select('user_id, channel_id')
          .eq('id', messageId)
          .single();

        if (!existingMessage || existingMessage.user_id !== user.id) {
          return {
            statusCode: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Can only edit your own messages' }),
          };
        }

        // Check access to channel
        if (!(await canUserAccessChannel(existingMessage.channel_id, user.id))) {
          return {
            statusCode: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Access denied' }),
          };
        }

        // Extract mentions from updated content
        const updatedMentions = extractMentions(updateData.content || '');

        const { data: updatedMessage, error } = await supabase
          .from('chat_messages')
          .update({
            content: updateData.content,
            mentioned_users: updatedMentions.users,
            mentioned_channels: updatedMentions.channels,
            edited_at: new Date().toISOString(),
            formatted_content: updateData.formatted_content
          })
          .eq('id', messageId)
          .select(`
            *,
            user:auth.users (
              id,
              email,
              raw_user_meta_data
            )
          `)
          .single();

        if (error) {
          throw error;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedMessage),
        };

      case 'DELETE':
        // Delete message (soft delete)
        const { data: messageToDelete } = await supabase
          .from('chat_messages')
          .select('user_id, channel_id')
          .eq('id', messageId)
          .single();

        if (!messageToDelete || messageToDelete.user_id !== user.id) {
          return {
            statusCode: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Can only delete your own messages' }),
          };
        }

        // Check access to channel
        if (!(await canUserAccessChannel(messageToDelete.channel_id, user.id))) {
          return {
            statusCode: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Access denied' }),
          };
        }

        const { error: deleteError } = await supabase
          .from('chat_messages')
          .update({ 
            deleted_at: new Date().toISOString(),
            content: '[deleted]'
          })
          .eq('id', messageId);

        if (deleteError) {
          throw deleteError;
        }

        return {
          statusCode: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        };

      default:
        return {
          statusCode: 405,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

  } catch (error) {
    console.error('Chat messages API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
