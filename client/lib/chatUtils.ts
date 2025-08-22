import { ChatChannel } from '@/types/chat';

interface CreateChannelOptions {
  name: string;
  description?: string;
  channel_type: 'public' | 'private' | 'direct_message';
  topic?: string;
  purpose?: string;
  allow_all_agency_members?: boolean;
  require_approval_to_join?: boolean;
}

export class ChatChannelManager {
  private getAuthToken(): string {
    return localStorage.getItem('supabase_auth_token') || '';
  }

  async ensureDefaultChannels(): Promise<void> {
    try {
      const channels = await this.getUserChannels();
      
      // Check if user has any channels
      if (channels.length === 0) {
        // Create default general channel
        const generalChannel = await this.createChannel({
          name: 'general',
          description: 'General discussion for all team members',
          channel_type: 'public',
          topic: 'Welcome to the team chat!',
          allow_all_agency_members: true,
          require_approval_to_join: false
        });

        if (generalChannel) {
          // Auto-join the user to the general channel
          await this.joinChannel(generalChannel.id);
        }

        // Create random channel for casual conversation
        const randomChannel = await this.createChannel({
          name: 'random',
          description: 'Random discussions and casual chat',
          channel_type: 'public',
          topic: 'Casual conversations and fun topics',
          allow_all_agency_members: true,
          require_approval_to_join: false
        });

        if (randomChannel) {
          await this.joinChannel(randomChannel.id);
        }
      } else {
        // Check if user is part of a general channel
        const hasGeneralChannel = channels.some(ch => ch.name.toLowerCase() === 'general');
        
        if (!hasGeneralChannel) {
          // Try to find an existing general channel
          const allChannels = await this.getAllPublicChannels();
          const generalChannel = allChannels.find(ch => ch.name.toLowerCase() === 'general');
          
          if (generalChannel) {
            // Join existing general channel
            await this.joinChannel(generalChannel.id);
          } else {
            // Create new general channel
            const newGeneralChannel = await this.createChannel({
              name: 'general',
              description: 'General discussion for all team members',
              channel_type: 'public',
              topic: 'Welcome to the team chat!',
              allow_all_agency_members: true,
              require_approval_to_join: false
            });

            if (newGeneralChannel) {
              await this.joinChannel(newGeneralChannel.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring default channels:', error);
    }
  }

  async getUserChannels(): Promise<ChatChannel[]> {
    try {
      const token = this.getAuthToken();
      const response = await fetch('/api/chat/channels', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.channels || [];
      }
      return [];
    } catch (error) {
      console.error('Error loading user channels:', error);
      return [];
    }
  }

  async getAllPublicChannels(): Promise<ChatChannel[]> {
    try {
      const token = this.getAuthToken();
      const response = await fetch('/api/chat/channels?type=public', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.channels || [];
      }
      return [];
    } catch (error) {
      console.error('Error loading public channels:', error);
      return [];
    }
  }

  async createChannel(options: CreateChannelOptions): Promise<ChatChannel | null> {
    try {
      const token = this.getAuthToken();
      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error creating channel:', error);
      return null;
    }
  }

  async joinChannel(channelId: string): Promise<boolean> {
    try {
      const token = this.getAuthToken();
      const response = await fetch(`/api/chat/channels/${channelId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification_level: 'all'
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error joining channel:', error);
      return false;
    }
  }

  async leaveChannel(channelId: string): Promise<boolean> {
    try {
      const token = this.getAuthToken();
      const response = await fetch(`/api/chat/channels/${channelId}/leave`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error leaving channel:', error);
      return false;
    }
  }

  async updateChannelPreferences(channelId: string, preferences: {
    notification_level?: 'all' | 'mentions' | 'none';
    is_muted?: boolean;
    is_pinned?: boolean;
  }): Promise<boolean> {
    try {
      const token = this.getAuthToken();
      const response = await fetch(`/api/chat/channels/${channelId}/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      return response.ok;
    } catch (error) {
      console.error('Error updating channel preferences:', error);
      return false;
    }
  }
}

export const chatChannelManager = new ChatChannelManager();
