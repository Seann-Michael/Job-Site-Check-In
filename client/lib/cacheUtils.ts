// Cache utilities for API responses and client-side caching

// Cache durations in seconds
export const CACHE_DURATIONS = {
  VERY_SHORT: 30,           // 30 seconds - real-time data
  SHORT: 300,               // 5 minutes - frequently changing data
  MEDIUM: 1800,             // 30 minutes - moderately changing data
  LONG: 3600,               // 1 hour - rarely changing data
  VERY_LONG: 86400,         // 24 hours - static data
  WEEK: 604800,             // 1 week - assets/images
} as const;

// HTTP cache headers for different content types
export const getCacheHeaders = (
  maxAge: number = CACHE_DURATIONS.MEDIUM,
  options: {
    private?: boolean;
    noCache?: boolean;
    mustRevalidate?: boolean;
    immutable?: boolean;
    staleWhileRevalidate?: number;
  } = {}
) => {
  const {
    private: isPrivate = false,
    noCache = false,
    mustRevalidate = false,
    immutable = false,
    staleWhileRevalidate,
  } = options;

  if (noCache) {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
  }

  const directives = [];
  
  if (isPrivate) {
    directives.push('private');
  } else {
    directives.push('public');
  }
  
  directives.push(`max-age=${maxAge}`);
  
  if (mustRevalidate) {
    directives.push('must-revalidate');
  }
  
  if (immutable) {
    directives.push('immutable');
  }
  
  if (staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  return {
    'Cache-Control': directives.join(', '),
  };
};

// Specific cache headers for different resource types
export const CACHE_HEADERS = {
  // User data - private, short cache
  USER_DATA: getCacheHeaders(CACHE_DURATIONS.SHORT, { 
    private: true,
    staleWhileRevalidate: CACHE_DURATIONS.VERY_SHORT 
  }),
  
  // Public business data - longer cache
  BUSINESS_DATA: getCacheHeaders(CACHE_DURATIONS.MEDIUM, {
    staleWhileRevalidate: CACHE_DURATIONS.SHORT 
  }),
  
  // Project data - medium cache
  PROJECT_DATA: getCacheHeaders(CACHE_DURATIONS.MEDIUM, { 
    private: true,
    staleWhileRevalidate: CACHE_DURATIONS.SHORT 
  }),
  
  // Analytics data - short cache due to frequent updates
  ANALYTICS_DATA: getCacheHeaders(CACHE_DURATIONS.SHORT, { 
    private: true,
    staleWhileRevalidate: CACHE_DURATIONS.VERY_SHORT 
  }),
  
  // Static assets - very long cache with immutable
  STATIC_ASSETS: getCacheHeaders(CACHE_DURATIONS.WEEK, { 
    immutable: true 
  }),
  
  // API responses with frequent updates
  REAL_TIME_DATA: getCacheHeaders(CACHE_DURATIONS.VERY_SHORT, { 
    private: true,
    mustRevalidate: true 
  }),
  
  // No cache for sensitive operations
  NO_CACHE: getCacheHeaders(0, { noCache: true }),
} as const;

// Memory cache for client-side caching
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number; }>();
  private maxSize = 100; // Maximum number of entries

  set(key: string, data: any, ttlSeconds: number = CACHE_DURATIONS.MEDIUM): void {
    // Clean up if cache is getting too large
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000),
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
    
    // If still too large, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2);
      
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expires) {
        expired++;
      }
    }
    
    return {
      size: this.cache.size,
      expired,
      valid: this.cache.size - expired,
    };
  }
}

// Global memory cache instance
export const memoryCache = new MemoryCache();

// Enhanced fetch with caching
export const cachedFetch = async (
  url: string,
  options: RequestInit & { 
    cacheKey?: string;
    cacheTtl?: number;
    bypassCache?: boolean;
  } = {}
): Promise<Response> => {
  const { cacheKey, cacheTtl = CACHE_DURATIONS.MEDIUM, bypassCache = false, ...fetchOptions } = options;
  
  // Use URL as cache key if not provided
  const key = cacheKey || `${fetchOptions.method || 'GET'}:${url}`;
  
  // Check memory cache for GET requests (unless bypassing)
  if (!bypassCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
    const cached = memoryCache.get(key);
    if (cached) {
      // Return a fake response with cached data
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // Make the actual request
  const response = await fetch(url, fetchOptions);
  
  // Cache successful GET responses
  if (
    response.ok &&
    (!fetchOptions.method || fetchOptions.method === 'GET') &&
    !bypassCache
  ) {
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      memoryCache.set(key, data, cacheTtl);
    } catch (error) {
      // Ignore JSON parsing errors for caching
      console.warn('Failed to cache response:', error);
    }
  }
  
  return response;
};

// Local Storage cache with expiration
export class LocalStorageCache {
  private prefix = 'lsr_cache_';

  set(key: string, data: any, ttlSeconds: number = CACHE_DURATIONS.MEDIUM): void {
    try {
      const item = {
        data,
        expires: Date.now() + (ttlSeconds * 1000),
      };
      
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      // Handle localStorage quota exceeded
      console.warn('Failed to cache to localStorage:', error);
      this.cleanup();
    }
  }

  get(key: string): any | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      
      if (!item) {
        return null;
      }
      
      const parsed = JSON.parse(item);
      
      if (Date.now() > parsed.expires) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }
      
      return parsed.data;
    } catch (error) {
      console.warn('Failed to read from localStorage cache:', error);
      return null;
    }
  }

  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    for (const key in localStorage) {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    
    for (const key in localStorage) {
      if (key.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '');
          if (now > item.expires) {
            localStorage.removeItem(key);
          }
        } catch (error) {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      }
    }
  }
}

// Global localStorage cache instance
export const localStorageCache = new LocalStorageCache();

// Periodic cleanup of caches
if (typeof window !== 'undefined') {
  // Clean up caches every 10 minutes
  setInterval(() => {
    localStorageCache.clear();
    memoryCache.clear();
  }, 10 * 60 * 1000);
}

// Cache-aware API wrapper
export const cacheAwareApi = {
  get: async (url: string, options: { cache?: boolean; ttl?: number } = {}) => {
    const { cache = true, ttl = CACHE_DURATIONS.MEDIUM } = options;
    
    return cachedFetch(url, {
      method: 'GET',
      bypassCache: !cache,
      cacheTtl: ttl,
    });
  },
  
  post: async (url: string, data: any) => {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  
  put: async (url: string, data: any) => {
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  
  delete: async (url: string) => {
    return fetch(url, { method: 'DELETE' });
  },
};
