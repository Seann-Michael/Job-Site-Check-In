import { QueryClient } from '@tanstack/react-query';

// Create a custom query client with optimized caching strategies
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      
      // Retry failed queries
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      
      // Refetch on reconnect for real-time data
      refetchOnReconnect: true,
      
      // Don't refetch on mount if data is still fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

// Cache time configurations for different data types
export const CACHE_TIMES = {
  // Very short cache for real-time data
  REAL_TIME: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  },
  
  // Short cache for frequently changing data
  SHORT: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  
  // Medium cache for moderately changing data
  MEDIUM: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Long cache for rarely changing data
  LONG: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  },
  
  // Very long cache for static data
  STATIC: {
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

// Query key factories for consistent caching
export const queryKeys = {
  // User-related queries
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    profile: () => [...queryKeys.users.all, 'profile'] as const,
  },
  
  // Business-related queries
  businesses: {
    all: ['businesses'] as const,
    lists: () => [...queryKeys.businesses.all, 'list'] as const,
    list: (ownerId?: string, filters?: any) => [...queryKeys.businesses.lists(), ownerId, filters] as const,
    details: () => [...queryKeys.businesses.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.businesses.details(), id] as const,
  },
  
  // Project-related queries
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (businessId?: string, filters?: any) => [...queryKeys.projects.lists(), businessId, filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
  },
  
  // Keyword-related queries
  keywords: {
    all: ['keywords'] as const,
    lists: () => [...queryKeys.keywords.all, 'list'] as const,
    list: (businessId: string, filters?: any) => [...queryKeys.keywords.lists(), businessId, filters] as const,
    details: () => [...queryKeys.keywords.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.keywords.details(), id] as const,
  },
  
  // Analytics queries (short cache due to frequently changing data)
  analytics: {
    all: ['analytics'] as const,
    summary: (timeRange?: string) => [...queryKeys.analytics.all, 'summary', timeRange] as const,
    performance: (timeRange?: string) => [...queryKeys.analytics.all, 'performance', timeRange] as const,
  },
  
  // Credit system queries
  credits: {
    all: ['credits'] as const,
    balance: () => [...queryKeys.credits.all, 'balance'] as const,
    transactions: (filters?: any) => [...queryKeys.credits.all, 'transactions', filters] as const,
  },
  
  // Chat queries (real-time data)
  chat: {
    all: ['chat'] as const,
    channels: () => [...queryKeys.chat.all, 'channels'] as const,
    messages: (channelId: string, filters?: any) => [...queryKeys.chat.all, 'messages', channelId, filters] as const,
  },
} as const;

// Cache invalidation helpers
export const invalidateQueries = {
  // Invalidate all user-related data
  users: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  
  // Invalidate specific user data
  userDetail: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) }),
  
  // Invalidate all business-related data
  businesses: () => queryClient.invalidateQueries({ queryKey: queryKeys.businesses.all }),
  
  // Invalidate specific business data
  businessDetail: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.businesses.detail(id) }),
  
  // Invalidate all project-related data
  projects: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  
  // Invalidate projects for a specific business
  businessProjects: (businessId: string) => 
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.projects.all,
      predicate: (query) => 
        query.queryKey.includes(businessId)
    }),
  
  // Invalidate all analytics data
  analytics: () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
  
  // Invalidate credit data
  credits: () => queryClient.invalidateQueries({ queryKey: queryKeys.credits.all }),
};

// Prefetch helpers for common data combinations
export const prefetchQueries = {
  // Prefetch user dashboard data
  userDashboard: async (userId: string) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.users.profile(),
        staleTime: CACHE_TIMES.MEDIUM.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.businesses.list(userId),
        staleTime: CACHE_TIMES.MEDIUM.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.analytics.summary(),
        staleTime: CACHE_TIMES.SHORT.staleTime,
      }),
    ]);
  },
  
  // Prefetch business details and related data
  businessDetails: async (businessId: string) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.businesses.detail(businessId),
        staleTime: CACHE_TIMES.MEDIUM.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.projects.list(businessId),
        staleTime: CACHE_TIMES.MEDIUM.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.keywords.list(businessId),
        staleTime: CACHE_TIMES.MEDIUM.staleTime,
      }),
    ]);
  },
};

// Memory optimization - remove unused queries periodically
export const cleanupQueries = () => {
  // Remove queries that haven't been used in the last hour
  queryClient.getQueryCache().getAll().forEach((query) => {
    const lastUsed = query.getObserversCount() > 0 ? Date.now() : (query as any).state.dataUpdatedAt;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    if (lastUsed < oneHourAgo) {
      queryClient.removeQueries({ queryKey: query.queryKey });
    }
  });
};

// Setup periodic cleanup (disabled temporarily to prevent load issues)
// if (typeof window !== 'undefined') {
//   // Cleanup unused queries every 30 minutes
//   setInterval(cleanupQueries, 30 * 60 * 1000);
// }
