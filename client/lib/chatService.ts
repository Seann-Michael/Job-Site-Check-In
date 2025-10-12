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
  private offlineMode = false;

  constructor() {
    // Check if we're in development and should use offline mode
    this.checkApiAvailability();
  }

  private async checkApiAvailability() {
    try {
      // Try a simple ping to check if the API is available
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: 'HEAD',
        timeout: 1000
      } as any);
      this.offlineMode = !response.ok;
    } catch {
      // If any error occurs, assume we're offline
      this.offlineMode = true;
      console.warn('🔌 API not available - chat running in offline mode with mock data');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // If we're in offline mode, immediately return mock data
    if (this.offlineMode) {
      console.log('📱 Using offline mode for:', endpoint);
      return this.getMockResponse<T>(endpoint, options);
    }

    try {
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

      // Try to read response body safely. Some environments may have the body already consumed
      // so we attempt multiple strategies: text(), then clone().json(), then clone().text().
      let responseText = '';
      try {
        responseText = await response.text();
      } catch (readErr) {
        console.warn('Failed to read response.text():', readErr);
        // Try parsing JSON from a clone if possible
        try {
          const clonedJson = await response.clone().json();
          return clonedJson;
        } catch (cloneJsonErr) {
          console.warn('Failed to parse cloned response as JSON:', cloneJsonErr);
          try {
            responseText = await response.clone().text();
          } catch (cloneTextErr) {
            console.error('Unable to read response body by any method:', cloneTextErr);
            // Fall back to minimal handling below
            responseText = '';
          }
        }
      }

      if (!response.ok) {
        // Try to parse error response as JSON first
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = responseText ? JSON.parse(responseText) : null;
          if (errorData && typeof errorData === 'object') {
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else if (responseText && responseText.length < 200) {
            errorMessage = responseText;
          } else {
            errorMessage = `HTTP ${response.status} - ${response.statusText}`;
          }
        } catch {
          if (responseText && responseText.length < 200) {
            errorMessage = responseText;
          } else {
            errorMessage = `HTTP ${response.status} - ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Try to parse successful response as JSON
      try {
        return responseText ? JSON.parse(responseText) : { data: null };
      } catch (jsonError) {
        console.warn('Response is not valid JSON:', jsonError);
        console.warn('Response text:', responseText ? responseText.substring(0, 200) : '<empty>');
        throw new Error(`Invalid JSON response: ${responseText ? responseText.substring(0, 100) + '...' : '<empty>'}`);
      }
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

  private getMockResponse<T>(endpoint: string, options: RequestInit = {}): ApiResponse<T> {
    const method = options.method || 'GET';
    const user = getCurrentUser();

    console.log(`🤖 Mock response for ${method} ${endpoint}`);

    // Handle chat-messages endpoint
    if (endpoint.includes('chat-messages')) {
      if (method === 'GET') {
        const mockMessages = [
          {
            id: '1',
            channel_id: 'general',
            user_id: 'demo-user-1',
            content: 'Welcome to the team chat! 👋 (This is mock data - real-time features available when Supabase is configured)',
            message_type: 'text',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            edited: false,
            user: {
              id: 'demo-user-1',
              full_name: 'Demo Admin',
              role: 'Admin'
            }
          },
          {
            id: '2',
            channel_id: 'general',
            user_id: 'demo-user-2',
            content: 'Thanks for setting up the chat system! Looking forward to collaborating here.',
            message_type: 'text',
            created_at: new Date(Date.now() - 1800000).toISOString(),
            edited: false,
            user: {
              id: 'demo-user-2',
              full_name: 'Demo Manager',
              role: 'Manager'
            }
          }
        ];
        return { messages: mockMessages as any } as ApiResponse<T>;
      } else if (method === 'POST') {
        // Mock successful message creation
        const body = JSON.parse(options.body as string || '{}');
        const newMessage = {
          id: Date.now().toString(),
          channel_id: body.channel_id || 'general',
          user_id: user?.id || 'current-user',
          content: body.content || 'Test message',
          message_type: 'text',
          created_at: new Date().toISOString(),
          edited: false,
          user: {
            id: user?.id || 'current-user',
            full_name: user?.name || 'Current User',
            role: user?.role || 'User'
          }
        };
        return { data: newMessage as any } as ApiResponse<T>;
      }
    }

    // Default success response for other endpoints
    return { data: { success: true } as any } as ApiResponse<T>;
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
