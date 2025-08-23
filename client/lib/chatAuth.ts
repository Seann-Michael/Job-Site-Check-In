import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check for placeholder values
const isPlaceholderValue = (value: string | undefined): boolean => {
  if (!value) return true;
  const placeholderPatterns = [
    'YOUR_ACTUAL_SUPABASE_PROJECT_URL',
    'YOUR_ACTUAL_SUPABASE_ANON_KEY',
    'placeholder',
    'demo',
    'example',
    'change-me'
  ];
  return placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase()));
};

const supabase = createClient(
  (!supabaseUrl || isPlaceholderValue(supabaseUrl)) ? "https://placeholder.supabase.co" : supabaseUrl,
  (!supabaseAnonKey || isPlaceholderValue(supabaseAnonKey)) ? "placeholder-key" : supabaseAnonKey
);

export class ChatAuthManager {
  private static instance: ChatAuthManager;
  private currentUser: any = null;
  private authListeners: ((user: any) => void)[] = [];
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeAuth();
  }

  public static getInstance(): ChatAuthManager {
    if (!ChatAuthManager.instance) {
      ChatAuthManager.instance = new ChatAuthManager();
    }
    return ChatAuthManager.instance;
  }

  private async initializeAuth() {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return;
      }

      if (session?.user) {
        this.currentUser = session.user;
        this.notifyAuthListeners(session.user);
        this.setupTokenRefresh(session);
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          this.currentUser = session.user;
          this.notifyAuthListeners(session.user);
          this.setupTokenRefresh(session);
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.notifyAuthListeners(null);
          this.clearTokenRefresh();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          this.currentUser = session.user;
          this.setupTokenRefresh(session);
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }

  private setupTokenRefresh(session: any) {
    this.clearTokenRefresh();
    
    if (session?.expires_at) {
      // Refresh token 5 minutes before expiry
      const refreshTime = (session.expires_at * 1000) - Date.now() - (5 * 60 * 1000);
      
      if (refreshTime > 0) {
        this.tokenRefreshTimer = setTimeout(async () => {
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error('Error refreshing token:', error);
              toast.error('Session expired. Please sign in again.');
            }
          } catch (error) {
            console.error('Error refreshing token:', error);
          }
        }, refreshTime);
      }
    }
  }

  private clearTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private notifyAuthListeners(user: any) {
    this.authListeners.forEach(listener => listener(user));
  }

  public onAuthChange(callback: (user: any) => void) {
    this.authListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authListeners.indexOf(callback);
      if (index > -1) {
        this.authListeners.splice(index, 1);
      }
    };
  }

  public async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  public getCurrentUser(): any {
    return this.currentUser;
  }

  public async makeAuthenticatedRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  public async retryWithAuth<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // If it's an auth error, try to refresh the token
        if (error instanceof Error && 
            (error.message.includes('401') || 
             error.message.includes('Unauthorized') ||
             error.message.includes('Invalid token'))) {
          
          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              throw refreshError;
            }
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (refreshError) {
            console.error('Error refreshing session for retry:', refreshError);
            break; // Don't retry if refresh fails
          }
        } else {
          break; // Don't retry for non-auth errors
        }
      }
    }

    throw lastError!;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error during sign out:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const chatAuth = ChatAuthManager.getInstance();

// Helper function for making authenticated requests
export async function makeAuthenticatedChatRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await chatAuth.makeAuthenticatedRequest(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
}

// Wrapper for operations that might need auth retry
export async function withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  return chatAuth.retryWithAuth(operation);
}
