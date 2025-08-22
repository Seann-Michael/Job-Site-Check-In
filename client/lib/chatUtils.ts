import { ChatChannel } from '@/types/chat';
import { makeAuthenticatedChatRequest, withAuthRetry } from './chatAuth';

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
    return withAuthRetry(async () => {
      try {
        const data = await makeAuthenticatedChatRequest('/api/chat/channels');
        return data.channels || [];
      } catch (error) {
        console.error('Error loading user channels:', error);
        return [];
      }
    });
  }

  async getAllPublicChannels(): Promise<ChatChannel[]> {
    return withAuthRetry(async () => {
      try {
        const data = await makeAuthenticatedChatRequest('/api/chat/channels?type=public');
        return data.channels || [];
      } catch (error) {
        console.error('Error loading public channels:', error);
        return [];
      }
    });
  }

  async createChannel(options: CreateChannelOptions): Promise<ChatChannel | null> {
    return withAuthRetry(async () => {
      try {
        return await makeAuthenticatedChatRequest('/api/chat/channels', {
          method: 'POST',
          body: JSON.stringify(options),
        });
      } catch (error) {
        console.error('Error creating channel:', error);
        return null;
      }
    });
  }

  async joinChannel(channelId: string): Promise<boolean> {
    return withAuthRetry(async () => {
      try {
        await makeAuthenticatedChatRequest(`/api/chat/channels/${channelId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            notification_level: 'all'
          }),
        });
        return true;
      } catch (error) {
        console.error('Error joining channel:', error);
        return false;
      }
    });
  }

  async leaveChannel(channelId: string): Promise<boolean> {
    return withAuthRetry(async () => {
      try {
        await makeAuthenticatedChatRequest(`/api/chat/channels/${channelId}/leave`, {
          method: 'PUT',
        });
        return true;
      } catch (error) {
        console.error('Error leaving channel:', error);
        return false;
      }
    });
  }

  async updateChannelPreferences(channelId: string, preferences: {
    notification_level?: 'all' | 'mentions' | 'none';
    is_muted?: boolean;
    is_pinned?: boolean;
  }): Promise<boolean> {
    return withAuthRetry(async () => {
      try {
        await makeAuthenticatedChatRequest(`/api/chat/channels/${channelId}/preferences`, {
          method: 'PUT',
          body: JSON.stringify(preferences),
        });
        return true;
      } catch (error) {
        console.error('Error updating channel preferences:', error);
        return false;
      }
    });
  }
}

export const chatChannelManager = new ChatChannelManager();
