import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatChannel {
  id?: string;
  name: string;
  description?: string;
  channel_type: 'public' | 'private' | 'direct_message';
  agency_id?: string;
  workspace_id?: string;
  topic?: string;
  purpose?: string;
  allow_all_agency_members?: boolean;
  require_approval_to_join?: boolean;
}

interface ChannelParticipant {
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  notification_level?: 'all' | 'mentions' | 'none';
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

// Helper function to check if user has admin access to channel
async function canUserAdminChannel(channelId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_channel_participants')
    .select('role')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .single();
  
  return !!data;
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
    const channelId = pathParts[pathParts.length - 1];
    const action = pathParts[pathParts.length - 2];

    switch (method) {
      case 'GET':
        if (action === 'channels' || channelId === 'chat-channels') {
          // Get user's channels
          const { data: channels, error } = await supabase
            .from('chat_channels')
            .select(`
              *,
              chat_channel_participants!inner (
                user_id,
                role,
                notification_level,
                last_read_at,
                is_muted,
                is_pinned
              )
            `)
            .eq('chat_channel_participants.user_id', user.id)
            .order('last_message_at', { ascending: false, nullsLast: true });

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channels: channels || [] }),
          };
        } else if (action === 'participants') {
          // Get channel participants
          if (!(await canUserAccessChannel(channelId, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          const { data: participants, error } = await supabase
            .from('chat_channel_participants')
            .select(`
              *,
              user:auth.users (
                id,
                email,
                raw_user_meta_data
              )
            `)
            .eq('channel_id', channelId);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ participants: participants || [] }),
          };
        } else {
          // Get specific channel
          if (!(await canUserAccessChannel(channelId, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Access denied' }),
            };
          }

          const { data: channel, error } = await supabase
            .from('chat_channels')
            .select(`
              *,
              chat_channel_participants (
                user_id,
                role,
                notification_level,
                last_read_at,
                is_muted,
                is_pinned
              )
            `)
            .eq('id', channelId)
            .single();

          if (error) {
            return {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Channel not found' }),
            };
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(channel),
          };
        }

      case 'POST':
        if (action === 'join') {
          // Join a channel
          const { notification_level = 'all' } = JSON.parse(event.body || '{}');

          // Check if channel exists and is public or user is invited
          const { data: channel, error: channelError } = await supabase
            .from('chat_channels')
            .select('*')
            .eq('id', channelId)
            .single();

          if (channelError || !channel) {
            return {
              statusCode: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Channel not found' }),
            };
          }

          // Check if user is already a participant
          const { data: existingParticipant } = await supabase
            .from('chat_channel_participants')
            .select('id')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .single();

          if (existingParticipant) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Already a member of this channel' }),
            };
          }

          // Add user to channel
          const { data: participant, error } = await supabase
            .from('chat_channel_participants')
            .insert({
              channel_id: channelId,
              user_id: user.id,
              role: 'member',
              notification_level
            })
            .select()
            .single();

          if (error) {
            throw error;
          }

          return {
            statusCode: 201,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(participant),
          };
        } else if (action === 'invite') {
          // Invite users to channel
          const { user_ids, role = 'member' }: { user_ids: string[], role?: string } = JSON.parse(event.body || '{}');

          if (!(await canUserAdminChannel(channelId, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Insufficient permissions' }),
            };
          }

          const invites = user_ids.map(userId => ({
            channel_id: channelId,
            user_id: userId,
            role,
            invited_by: user.id
          }));

          const { data: participants, error } = await supabase
            .from('chat_channel_participants')
            .insert(invites)
            .select();

          if (error) {
            throw error;
          }

          return {
            statusCode: 201,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ participants }),
          };
        } else {
          // Create new channel
          const channelData: ChatChannel = JSON.parse(event.body || '{}');

          // Validate required fields
          if (!channelData.name) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Channel name is required' }),
            };
          }

          // Create channel
          const { data: channel, error: channelError } = await supabase
            .from('chat_channels')
            .insert({
              ...channelData,
              created_by: user.id
            })
            .select()
            .single();

          if (channelError) {
            throw channelError;
          }

          // Add creator as owner
          const { error: participantError } = await supabase
            .from('chat_channel_participants')
            .insert({
              channel_id: channel.id,
              user_id: user.id,
              role: 'owner'
            });

          if (participantError) {
            throw participantError;
          }

          return {
            statusCode: 201,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(channel),
          };
        }

      case 'PUT':
        if (action === 'leave') {
          // Leave channel
          const { error } = await supabase
            .from('chat_channel_participants')
            .delete()
            .eq('channel_id', channelId)
            .eq('user_id', user.id);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Left channel successfully' }),
          };
        } else if (action === 'preferences') {
          // Update user preferences for channel
          const { notification_level, is_muted, is_pinned } = JSON.parse(event.body || '{}');

          const { data: participant, error } = await supabase
            .from('chat_channel_participants')
            .update({
              notification_level,
              is_muted,
              is_pinned
            })
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .select()
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
            body: JSON.stringify(participant),
          };
        } else {
          // Update channel
          if (!(await canUserAdminChannel(channelId, user.id))) {
            return {
              statusCode: 403,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'Insufficient permissions' }),
            };
          }

          const updateData = JSON.parse(event.body || '{}');
          delete updateData.id; // Don't allow ID updates
          delete updateData.created_by; // Don't allow creator updates

          const { data: channel, error } = await supabase
            .from('chat_channels')
            .update(updateData)
            .eq('id', channelId)
            .select()
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
            body: JSON.stringify(channel),
          };
        }

      case 'DELETE':
        // Delete channel (owner only)
        const { data: ownerCheck } = await supabase
          .from('chat_channel_participants')
          .select('role')
          .eq('channel_id', channelId)
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .single();

        if (!ownerCheck) {
          return {
            statusCode: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Only channel owner can delete channel' }),
          };
        }

        const { error } = await supabase
          .from('chat_channels')
          .delete()
          .eq('id', channelId);

        if (error) {
          throw error;
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
    console.error('Chat channels API error:', error);
    
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
