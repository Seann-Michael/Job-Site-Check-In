import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './useAuth';
import { makeAuthenticatedChatRequest, withAuthRetry } from '@/lib/chatAuth';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface UserPresence {
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen_at: string;
  current_channel_id?: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: any;
  };
}

export function useChatPresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [currentStatus, setCurrentStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('offline');
  const [isConnected, setIsConnected] = useState(false);


  // Update user presence
  const updatePresence = useCallback(async (
    status: 'online' | 'away' | 'busy' | 'offline',
    channelId?: string
  ) => {
    if (!user) return;

    return withAuthRetry(async () => {
      try {
        await makeAuthenticatedChatRequest('/api/chat/preferences/presence', {
          method: 'POST',
          body: JSON.stringify({
            status,
            current_channel_id: channelId,
            session_id: `${user.id}-${Date.now()}`,
          }),
        });

        setCurrentStatus(status);
        setIsConnected(true);
      } catch (error) {
        console.error('Error updating presence:', error);
        setIsConnected(false);
        throw error;
      }
    });
  }, [user]);

  // Load online users
  const loadOnlineUsers = useCallback(async () => {
    return withAuthRetry(async () => {
      try {
        const data = await makeAuthenticatedChatRequest('/api/chat/preferences/online-users');
        setOnlineUsers(data.users || []);
        setIsConnected(true);
      } catch (error) {
        console.error('Error loading online users:', error);
        setIsConnected(false);
        throw error;
      }
    });
  }, []);

  // Set up real-time presence subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user_presence_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_user_presence'
        },
        () => {
          // Reload online users when any presence changes
          loadOnlineUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadOnlineUsers]);

  // Initialize presence on mount
  useEffect(() => {
    if (user) {
      updatePresence('online');
      loadOnlineUsers();

      // Set up presence heartbeat
      const presenceInterval = setInterval(() => {
        updatePresence(currentStatus);
      }, 30000); // Update every 30 seconds

      // Handle page visibility changes
      const handleVisibilityChange = () => {
        if (document.hidden) {
          updatePresence('away');
        } else {
          updatePresence('online');
        }
      };

      // Handle window focus/blur
      const handleFocus = () => updatePresence('online');
      const handleBlur = () => updatePresence('away');

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      // Cleanup
      return () => {
        updatePresence('offline');
        clearInterval(presenceInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      };
    }
  }, [user, updatePresence, currentStatus]);

  // Handle beforeunload to set offline status
  useEffect(() => {
    const handleBeforeUnload = () => {
      updatePresence('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [updatePresence]);

  return {
    onlineUsers,
    currentStatus,
    isConnected,
    updatePresence,
    loadOnlineUsers
  };
}
