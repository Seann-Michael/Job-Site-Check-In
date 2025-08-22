import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { makeAuthenticatedChatRequest } from '@/lib/chatAuth';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface TypingUser {
  user_id: string;
  user_name: string;
  channel_id: string;
  started_at: string;
}

export function useTypingIndicators(channelId?: string) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcast = useRef<number>(0);

  // Clean up typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Set up real-time typing subscription
  useEffect(() => {
    if (!channelId || !user) return;

    const channel = supabase
      .channel(`typing:${channelId}`)
      .on(
        'broadcast',
        { event: 'typing_start' },
        (payload) => {
          const { user_id, user_name } = payload.payload;
          
          // Don't show own typing indicator
          if (user_id === user.id) return;

          setTypingUsers(prev => {
            // Remove existing entry for this user and add new one
            const filtered = prev.filter(u => u.user_id !== user_id);
            return [...filtered, {
              user_id,
              user_name,
              channel_id: channelId,
              started_at: new Date().toISOString()
            }];
          });

          // Auto-remove typing indicator after 5 seconds
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
          }, 5000);
        }
      )
      .on(
        'broadcast',
        { event: 'typing_stop' },
        (payload) => {
          const { user_id } = payload.payload;
          
          if (user_id === user.id) return;

          setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, user]);

  // Broadcast typing start
  const startTyping = useCallback(async () => {
    if (!channelId || !user || isTyping) return;

    const now = Date.now();
    // Throttle typing broadcasts to once per 2 seconds
    if (now - lastTypingBroadcast.current < 2000) return;

    lastTypingBroadcast.current = now;
    setIsTyping(true);

    try {
      // Broadcast to other users
      const channel = supabase.channel(`typing:${channelId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: {
          user_id: user.id,
          user_name: user.raw_user_meta_data?.full_name ||
                   user.raw_user_meta_data?.name ||
                   user.email?.split('@')[0] ||
                   'Anonymous'
        }
      });

      // Auto-stop typing after 3 seconds of inactivity
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    } catch (error) {
      console.error('Error broadcasting typing start:', error);
    }
  }, [channelId, user, isTyping]);

  // Broadcast typing stop
  const stopTyping = useCallback(async () => {
    if (!channelId || !user || !isTyping) return;

    setIsTyping(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      // Broadcast to other users
      const channel = supabase.channel(`typing:${channelId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: {
          user_id: user.id
        }
      });
    } catch (error) {
      console.error('Error broadcasting typing stop:', error);
    }
  }, [channelId, user, isTyping]);

  // Handle typing with automatic timeout
  const handleTyping = useCallback(() => {
    startTyping();

    // Reset the typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [startTyping, stopTyping]);

  // Stop typing when changing channels
  useEffect(() => {
    if (isTyping) {
      stopTyping();
    }
    setTypingUsers([]); // Clear typing users when changing channels
  }, [channelId]);

  // Format typing indicator text
  const getTypingText = useCallback(() => {
    if (typingUsers.length === 0) return '';

    const names = typingUsers.map(u => u.user_name);
    
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else if (names.length === 3) {
      return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
    } else {
      return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
    }
  }, [typingUsers]);

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    handleTyping,
    getTypingText,
    hasTypingUsers: typingUsers.length > 0
  };
}
