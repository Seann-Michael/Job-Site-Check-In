import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatUserPreferences {
  email_notifications?: boolean;
  push_notifications?: boolean;
  desktop_notifications?: boolean;
  notification_start_time?: string;
  notification_end_time?: string;
  weekend_notifications?: boolean;
  theme?: string;
  compact_mode?: boolean;
  show_member_list?: boolean;
  message_sound?: boolean;
  mention_sound?: boolean;
  status?: string;
  status_message?: string;
  auto_away_minutes?: number;
}

interface UserPresence {
  status: 'online' | 'away' | 'busy' | 'offline';
  current_channel_id?: string;
  session_id?: string;
  user_agent?: string;
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
    const action = pathParts[pathParts.length - 1];

    switch (method) {
      case 'GET':
        if (action === 'preferences') {
          // Get user chat preferences
          const { data: preferences, error } = await supabase
            .from('chat_user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') { // Not found is OK
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferences || {}),
          };
        } else if (action === 'notifications') {
          // Get user notifications
          const limit = parseInt(event.queryStringParameters?.limit || '50');
          const offset = parseInt(event.queryStringParameters?.offset || '0');
          const unread_only = event.queryStringParameters?.unread_only === 'true';

          let query = supabase
            .from('chat_notifications')
            .select(`
              *,
              channel:chat_channels (
                id,
                name,
                channel_type
              ),
              message:chat_messages (
                id,
                content,
                user_id
              )
            `)
            .eq('user_id', user.id);

          if (unread_only) {
            query = query.eq('is_read', false);
          }

          const { data: notifications, error, count } = await query
            .order('created_at', { ascending: false })
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notifications: notifications || [],
              total: count || 0,
              limit,
              offset
            }),
          };
        } else if (action === 'presence') {
          // Get user presence information
          const { data: presence, error } = await supabase
            .from('chat_user_presence')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') { // Not found is OK
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(presence || { status: 'offline' }),
          };
        } else if (action === 'online-users') {
          // Get online users that share channels with current user
          const { data: onlineUsers, error } = await supabase
            .from('chat_user_presence')
            .select(`
              *,
              user:auth.users (
                id,
                email,
                raw_user_meta_data
              )
            `)
            .in('status', ['online', 'away', 'busy'])
            .gte('last_seen_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ users: onlineUsers || [] }),
          };
        }

        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Endpoint not found' }),
        };

      case 'POST':
        if (action === 'presence') {
          // Update user presence
          const presenceData: UserPresence = JSON.parse(event.body || '{}');

          const { data: presence, error } = await supabase
            .from('chat_user_presence')
            .upsert({
              user_id: user.id,
              status: presenceData.status,
              current_channel_id: presenceData.current_channel_id,
              session_id: presenceData.session_id,
              user_agent: presenceData.user_agent || event.headers['user-agent'],
              last_seen_at: new Date().toISOString()
            })
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
            body: JSON.stringify(presence),
          };
        }

        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Endpoint not found' }),
        };

      case 'PUT':
        if (action === 'preferences') {
          // Update user chat preferences
          const preferencesData: ChatUserPreferences = JSON.parse(event.body || '{}');

          const { data: preferences, error } = await supabase
            .from('chat_user_preferences')
            .upsert({
              user_id: user.id,
              ...preferencesData
            })
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
            body: JSON.stringify(preferences),
          };
        } else if (action === 'read-notifications') {
          // Mark notifications as read
          const { notification_ids } = JSON.parse(event.body || '{}');

          if (!notification_ids || !Array.isArray(notification_ids)) {
            return {
              statusCode: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ error: 'notification_ids array is required' }),
            };
          }

          const { error } = await supabase
            .from('chat_notifications')
            .update({ 
              is_read: true,
              read_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .in('id', notification_ids);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Notifications marked as read' }),
          };
        } else if (action === 'read-all-notifications') {
          // Mark all notifications as read
          const { error } = await supabase
            .from('chat_notifications')
            .update({ 
              is_read: true,
              read_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('is_read', false);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'All notifications marked as read' }),
          };
        }

        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Endpoint not found' }),
        };

      case 'DELETE':
        if (action === 'clear-notifications') {
          // Clear old notifications (older than 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

          const { error } = await supabase
            .from('chat_notifications')
            .delete()
            .eq('user_id', user.id)
            .lt('created_at', thirtyDaysAgo);

          if (error) {
            throw error;
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Old notifications cleared' }),
          };
        }

        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Endpoint not found' }),
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
    console.error('Chat preferences API error:', error);
    
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
