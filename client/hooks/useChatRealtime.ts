import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

// Initialize Supabase client with proper error handling
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: any = null;
let supabaseConfigured = false;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    supabaseConfigured = true;
    console.log('✅ Supabase client initialized successfully');
  } else {
    console.warn('⚠️ Supabase not configured - real-time features disabled');
    console.warn('Missing environment variables:');
    if (!supabaseUrl) console.warn('- VITE_SUPABASE_URL');
    if (!supabaseAnonKey) console.warn('- VITE_SUPABASE_ANON_KEY');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
  supabaseConfigured = false;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    role: string;
  };
}

interface UseChatRealtimeProps {
  channelId: string;
  onNewMessage: (message: Message) => void;
  onMessageUpdate: (message: Message) => void;
  onMessageDelete: (messageId: string) => void;
}

export function useChatRealtime({
  channelId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete
}: UseChatRealtimeProps) {
  const subscriptionRef = useRef<any>(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    // Early return if Supabase is not configured
    if (!supabaseConfigured || !supabaseClient || !channelId || !currentUser) {
      if (!supabaseConfigured) {
        console.log('ℹ️ Real-time messaging disabled - Supabase not configured');
      }
      return;
    }

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Create new subscription for messages in this channel
    const subscription = supabaseClient
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: any) => {
          // Don't show our own messages (they're added optimistically)
          if (payload.new.user_id === currentUser.id) {
            return;
          }

          // Fetch user profile for the message
          try {
            const { data: userProfile } = await supabaseClient
              .from('user_profiles')
              .select('id, full_name, role')
              .eq('id', payload.new.user_id)
              .single();

            const messageWithUser = {
              ...payload.new,
              user: {
                id: payload.new.user_id,
                full_name: userProfile?.full_name || 'Unknown User',
                role: userProfile?.role || 'User'
              }
            };

            onNewMessage(messageWithUser);
          } catch (error) {
            console.error('Error fetching user profile for new message:', error);
            // Still show the message even if we can't get user profile
            onNewMessage({
              ...payload.new,
              user: {
                id: payload.new.user_id,
                full_name: 'Unknown User',
                role: 'User'
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: any) => {
          // Handle message updates (edits)
          if (payload.new.deleted_at) {
            // Message was soft deleted
            onMessageDelete(payload.new.id);
          } else {
            // Message was edited
            try {
              const { data: userProfile } = await supabaseClient
                .from('user_profiles')
                .select('id, full_name, role')
                .eq('id', payload.new.user_id)
                .single();

              const messageWithUser = {
                ...payload.new,
                user: {
                  id: payload.new.user_id,
                  full_name: userProfile?.full_name || 'Unknown User',
                  role: userProfile?.role || 'User'
                }
              };

              onMessageUpdate(messageWithUser);
            } catch (error) {
              console.error('Error fetching user profile for updated message:', error);
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    // Update user presence to online
    updateUserPresence('online');

    // Cleanup function
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [channelId, currentUser?.id, onNewMessage, onMessageUpdate, onMessageDelete]);

  // Update user presence
  const updateUserPresence = async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!supabaseConfigured || !supabaseClient || !currentUser) {
      return;
    }

    try {
      await supabaseClient
        .from('chat_user_presence')
        .upsert({
          user_id: currentUser.id,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  };

  // Set user as away when window loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!currentUser) return;
      
      if (document.hidden) {
        updateUserPresence('away');
      } else {
        updateUserPresence('online');
      }
    };

    const handleBeforeUnload = () => {
      updateUserPresence('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateUserPresence('offline');
    };
  }, [currentUser?.id]);

  return {
    updateUserPresence
  };
}

// Hook for typing indicators
export function useTypingIndicator(channelId: string) {
  const currentUser = getCurrentUser();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = () => {
    if (!supabaseConfigured || !supabaseClient || !currentUser || !channelId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing start event
    supabaseClient
      .channel(`typing:${channelId}`)
      .send({
        type: 'broadcast',
        event: 'typing_start',
        payload: {
          user_id: currentUser.id,
          user_name: currentUser.name
        }
      });

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = () => {
    if (!supabaseConfigured || !supabaseClient || !currentUser || !channelId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    supabaseClient
      .channel(`typing:${channelId}`)
      .send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: {
          user_id: currentUser.id
        }
      });
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    };
  }, [channelId]);

  return {
    startTyping,
    stopTyping
  };
}
