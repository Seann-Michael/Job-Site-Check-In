import { getCurrentUser } from "@/lib/auth";

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  created_at: string;
  updated_at?: string;
  edited?: boolean;
  user?: {
    id: string;
    full_name: string;
    role: string;
  };
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  messages?: Message[];
  total?: number;
  limit?: number;
  offset?: number;
}

class ChatService {
  private baseUrl = '/.netlify/functions';

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const user = getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // For now, we'll use a demo token. In real implementation, this would come from Supabase auth
      const token = user.id ? `demo-token-${user.id}` : 'demo-token';

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat API error:', error);

      // If this is a network error, provide fallback mock data for development
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        console.warn('⚠️ Using mock data due to API unavailability');
        return this.getMockResponse<T>(endpoint);
      }

      return { error: error.message };
    }
  }

  private getMockResponse<T>(endpoint: string): ApiResponse<T> {
    // Provide mock data when API is not available
    if (endpoint.includes('chat-messages')) {
      const mockMessages = [
        {
          id: '1',
          channel_id: 'general',
          user_id: 'user1',
          content: 'Welcome to the team chat! 👋 (Mock data - configure Supabase for full functionality)',
          message_type: 'text',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          edited: false,
          user: {
            id: 'user1',
            full_name: 'Demo User',
            role: 'Admin'
          }
        }
      ];
      return { messages: mockMessages as any } as ApiResponse<T>;
    }

    return { data: null as any };
  }

  // Get messages for a channel
  async getMessages(channelId: string, limit = 50, offset = 0): Promise<Message[]> {
    const params = new URLSearchParams({
      channel_id: channelId,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await this.makeRequest<Message[]>(`/chat-messages?${params}`);
    
    if (response.error) {
      console.error('Failed to get messages:', response.error);
      return [];
    }

    return response.messages || [];
  }

  // Send a new message
  async sendMessage(channelId: string, content: string): Promise<Message | null> {
    const response = await this.makeRequest<Message>('/chat-messages', {
      method: 'POST',
      body: JSON.stringify({
        channel_id: channelId,
        content,
        message_type: 'text',
      }),
    });

    if (response.error) {
      console.error('Failed to send message:', response.error);
      return null;
    }

    return response.data || null;
  }

  // Update a message
  async updateMessage(messageId: string, content: string): Promise<Message | null> {
    const response = await this.makeRequest<Message>(`/chat-messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
      }),
    });

    if (response.error) {
      console.error('Failed to update message:', response.error);
      return null;
    }

    return response.data || null;
  }

  // Delete a message
  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await this.makeRequest(`/chat-messages/${messageId}`, {
      method: 'DELETE',
    });

    if (response.error) {
      console.error('Failed to delete message:', response.error);
      return false;
    }

    return true;
  }

  // Get current user info for chat
  getCurrentChatUser() {
    const user = getCurrentUser();
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name,
    };
  }

  // Get mock users for the company (in real implementation, this would come from API)
  getCompanyUsers() {
    const currentUser = this.getCurrentChatUser();
    if (!currentUser) return [];

    // Return mock users including current user
    return [
      {
        id: currentUser.id,
        name: currentUser.name,
        full_name: currentUser.full_name,
        status: 'online' as const,
        role: currentUser.role,
        avatar: currentUser.avatar,
      },
      {
        id: 'user-2',
        name: 'Sarah Johnson',
        full_name: 'Sarah Johnson',
        status: 'online' as const,
        role: 'Manager',
      },
      {
        id: 'user-3',
        name: 'Mike Wilson',
        full_name: 'Mike Wilson',
        status: 'away' as const,
        role: 'Agent',
      },
      {
        id: 'user-4',
        name: 'Emma Davis',
        full_name: 'Emma Davis',
        status: 'busy' as const,
        role: 'Agent',
      },
      {
        id: 'user-5',
        name: 'Alex Brown',
        full_name: 'Alex Brown',
        status: 'offline' as const,
        role: 'Client',
      },
    ];
  }

  // Get mock channels (in real implementation, this would come from API)
  getChannels() {
    return [
      { id: 'general', name: 'general', type: 'text' as const, category: 'Company' },
      { id: 'announcements', name: 'announcements', type: 'text' as const, category: 'Company' },
      { id: 'project-updates', name: 'project-updates', type: 'text' as const, category: 'Work', unread: 3 },
      { id: 'team-discussion', name: 'team-discussion', type: 'text' as const, category: 'Work' },
      { id: 'client-feedback', name: 'client-feedback', type: 'text' as const, category: 'Clients' },
      { id: 'dm-sarah', name: 'Sarah Johnson', type: 'dm' as const, category: 'Direct Messages' },
      { id: 'dm-mike', name: 'Mike Wilson', type: 'dm' as const, category: 'Direct Messages' },
    ];
  }
}

export const chatService = new ChatService();
export type { Message };
